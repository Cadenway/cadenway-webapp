import {
  computed,
  inject,
  resource,
  type ResourceRef,
  type Signal,
  type Type,
} from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import {
  AutomationsApi,
  isStaleAutomationRule,
  isUncertainAutomationCreate,
  isUncertainAutomationWrite,
} from '../../data-access/services/automations-api/automations-api.service';
import { ListsApi } from '../../data-access/services/lists-api/lists-api.service';
import type {
  AutomationCreateOutcome,
  AutomationDraft,
  AutomationRule,
  AutomationRun,
  AutomationWriteOutcome,
} from '../../models/automation-rule/automation-rule.interface';
import type { ListMember } from '../../models/list-member/list-member.interface';
import { AUTOMATION_RETRY_DELAYS } from './automation-retry-delays.token';

/**
 * Interface AutomationDraftKey
 *
 * @description
 * The idempotency key of the draft last submitted, reused by a retry of the same draft.
 */
interface AutomationDraftKey {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * The `Idempotency-Key` sent.
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;

  /**
   * Property body
   *
   * @description
   * The submitted draft, serialized: another draft takes a new key.
   *
   * @type {string}
   * @readonly
   */
  readonly body: string;

  /**
   * Property organizationId
   *
   * @description
   * The organization the draft was submitted to.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property uncertain
   *
   * @description
   * Whether the gateway may have recorded the draft: its answers were lost. The draft and its
   * key are then kept until a resend settles it, whatever the builder does.
   *
   * @type {boolean}
   * @readonly
   */
  readonly uncertain: boolean;
  // #endregion
}

/**
 * Interface AutomationUnresolved
 *
 * @description
 * A switch or a deletion whose resends did not settle: it stays pending and the rule takes no
 * other write until a read started after it settles it.
 */
interface AutomationUnresolved {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * The organization of the rule.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property since
   *
   * @description
   * Write count when the resends gave up: a read started from it on settles the rule.
   *
   * @type {number}
   * @readonly
   */
  readonly since: number;
  // #endregion
}

/**
 * Function wait
 *
 * @description
 * Resolves after a delay.
 *
 * @param {number} ms - The delay, in milliseconds.
 * @returns {Promise<void>} Resolves once it has elapsed.
 */
function wait(ms: number): Promise<void> {
  return new Promise<void>((resolve: () => void): void => {
    setTimeout(resolve, ms);
  });
}

/**
 * Interface AutomationRulesRead
 *
 * @description
 * The last complete read of the rules, kept apart from the resource so the writes keep a
 * confirmed version while the rules are read again.
 */
interface AutomationRulesRead {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * The organization the rules were read from.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property items
   *
   * @description
   * The rules the gateway returned.
   *
   * @type {readonly AutomationRule[]}
   * @readonly
   */
  readonly items: readonly AutomationRule[];

  /**
   * Property epoch
   *
   * @description
   * How many writes had settled when the read started: a write settled later may be missing
   * from it.
   *
   * @type {number}
   * @readonly
   */
  readonly epoch: number;
  // #endregion
}

/**
 * Interface AutomationWritten
 *
 * @description
 * A rule as a write of this dialog left it, applied over reads started before the write settled.
 */
interface AutomationWritten {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * The organization the write went to.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property rule
   *
   * @description
   * The rule the gateway returned.
   *
   * @type {AutomationRule}
   * @readonly
   */
  readonly rule: AutomationRule;

  /**
   * Property settledAt
   *
   * @description
   * Write count once this write settled.
   *
   * @type {number}
   * @readonly
   */
  readonly settledAt: number;

  /**
   * Property created
   *
   * @description
   * Whether the write created the rule, which an older read does not hold.
   *
   * @type {boolean}
   * @readonly
   */
  readonly created: boolean;
  // #endregion
}

/**
 * Interface AutomationDeleted
 *
 * @description
 * A rule the gateway confirmed gone (deleted, or already absent).
 */
interface AutomationDeleted {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * The organization of the rule.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property settledAt
   *
   * @description
   * Write count once the deletion settled.
   *
   * @type {number}
   * @readonly
   */
  readonly settledAt: number;
  // #endregion
}

/**
 * Interface AutomationsState
 *
 * @description
 * The openings of the dialog, the pending writes and the creation in flight.
 */
interface AutomationsState {
  // #region Properties
  /**
   * Property _opening
   *
   * @description
   * How many times the dialog opened; each opening reads the rules and the runs again. 0 reads
   * nothing.
   *
   * @type {number}
   * @readonly
   */
  readonly _opening: number;

  /**
   * Property _read
   *
   * @description
   * The newest complete read of the rules, or null before the first one.
   *
   * @type {AutomationRulesRead | null}
   * @readonly
   */
  readonly _read: AutomationRulesRead | null;

  /**
   * Property _writes
   *
   * @description
   * How many writes have settled, the clock that orders reads and writes.
   *
   * @type {number}
   * @readonly
   */
  readonly _writes: number;

  /**
   * Property _written
   *
   * @description
   * The last rule each write of this dialog returned, by rule id.
   *
   * @type {Readonly<Partial<Record<string, AutomationWritten>>>}
   * @readonly
   */
  readonly _written: Readonly<Partial<Record<string, AutomationWritten>>>;

  /**
   * Property _deleted
   *
   * @description
   * The rules this dialog confirmed gone, by rule id.
   *
   * @type {Readonly<Partial<Record<string, AutomationDeleted>>>}
   * @readonly
   */
  readonly _deleted: Readonly<Partial<Record<string, AutomationDeleted>>>;

  /**
   * Property _desired
   *
   * @description
   * The state each switch shows while its write is pending, by rule id.
   *
   * @type {Readonly<Partial<Record<string, boolean>>>}
   * @readonly
   */
  readonly _desired: Readonly<Partial<Record<string, boolean>>>;

  /**
   * Property _removed
   *
   * @description
   * Rules hidden while their deletion is pending.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly _removed: readonly string[];

  /**
   * Property _draft
   *
   * @description
   * Key of the last submitted draft, until it is created or discarded.
   *
   * @type {AutomationDraftKey | null}
   * @readonly
   */
  readonly _draft: AutomationDraftKey | null;

  /**
   * Property _unresolved
   *
   * @description
   * The rules whose switch or deletion did not settle, by rule id.
   *
   * @type {Readonly<Partial<Record<string, AutomationUnresolved>>>}
   * @readonly
   */
  readonly _unresolved: Readonly<Partial<Record<string, AutomationUnresolved>>>;

  /**
   * Property creating
   *
   * @description
   * Whether a rule is being created.
   *
   * @type {boolean}
   * @readonly
   */
  readonly creating: boolean;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * Nothing read, nothing pending.
 *
 * @type {AutomationsState}
 */
const initialState: AutomationsState = {
  _opening: 0,
  _read: null,
  _writes: 0,
  _written: {},
  _deleted: {},
  _desired: {},
  _removed: [],
  _draft: null,
  _unresolved: {},
  creating: false,
};

/**
 * Interface AutomationsStoreInstance
 *
 * @description
 * The public API of the `Automations` dialog's store.
 */
export interface AutomationsStoreInstance {
  // #region Properties
  /**
   * Property rules
   *
   * @description
   * The read of the organization's rules: its failure is the dialog's inline error, whose Retry
   * calls `reload()`. Its value is the raw read; `confirmedRules` is what the gateway confirmed.
   *
   * @type {ResourceRef<readonly AutomationRule[] | undefined>}
   * @readonly
   */
  readonly rules: ResourceRef<readonly AutomationRule[] | undefined>;

  /**
   * Property confirmedRules
   *
   * @description
   * The rules as the gateway last confirmed them, undefined before the first read of the
   * organization: the newest read, with the results of this dialog's writes that settled after
   * it started applied over it (a newer version, a created rule, a deleted one). It keeps its
   * value while the rules are read again.
   *
   * @type {Signal<readonly AutomationRule[] | undefined>}
   * @readonly
   */
  readonly confirmedRules: Signal<readonly AutomationRule[] | undefined>;

  /**
   * Property shownRules
   *
   * @description
   * The rules as shown: a pending switch shows its new state at once and a pending deletion hides
   * its rule.
   *
   * @type {Signal<readonly AutomationRule[]>}
   * @readonly
   */
  readonly shownRules: Signal<readonly AutomationRule[]>;

  /**
   * Property activeCount
   *
   * @description
   * Shown rules that are enabled (`<n> active`).
   *
   * @type {Signal<number>}
   * @readonly
   */
  readonly activeCount: Signal<number>;

  /**
   * Property runs
   *
   * @description
   * The eight most recent executions, a secondary read.
   *
   * @type {ResourceRef<readonly AutomationRun[] | undefined>}
   * @readonly
   */
  readonly runs: ResourceRef<readonly AutomationRun[] | undefined>;

  /**
   * Property members
   *
   * @description
   * The organization's members: the people a rule assigns or notifies, and their names.
   *
   * @type {ResourceRef<readonly ListMember[] | undefined>}
   * @readonly
   */
  readonly members: ResourceRef<readonly ListMember[] | undefined>;

  /**
   * Property creating
   *
   * @description
   * Whether a rule is being created.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly creating: Signal<boolean>;

  /**
   * Property creationUnknown
   *
   * @description
   * Whether the last creation may have been recorded: its answers were lost and its draft and
   * key are kept for the next submission.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly creationUnknown: Signal<boolean>;

  /**
   * Property unresolvedRuleIds
   *
   * @description
   * The rules whose switch or deletion did not settle: they take no other write until a read of
   * the rules settles them.
   *
   * @type {Signal<readonly string[]>}
   * @readonly
   */
  readonly unresolvedRuleIds: Signal<readonly string[]>;
  // #endregion

  // #region Methods
  /**
   * Method load
   *
   * @description
   * Reads the rules and the runs again, and the members the first time; the dialog calls it each
   * time it opens.
   */
  load(): void;

  /**
   * Method toggle
   *
   * @description
   * Turns a rule on or off at once and records it. The writes of a rule are sent one after the
   * other, each from the version the previous one left; only the last state asked is sent, and
   * coming back to the recorded state sends nothing. Each write uses the newest version known,
   * from the reads and from the earlier writes. A definite refusal (`4xx`) shows the recorded
   * state again and reads the rules again when they were out of date. A lost answer (network,
   * timeout, `5xx`) may still be applied, so the same write is resent with the same `If-Match`
   * version, after growing waits (`AUTOMATION_RETRY_DELAYS`): success applies it, and a `412`
   * means the version moved, so a read of the rules tells whether the wanted state holds. When
   * the resends do not settle it, the outcome is `unknown`, the wanted state stays shown and the
   * rule takes no other write until a read started afterwards settles it. A rule in that state
   * answers `unknown` without sending anything.
   *
   * @param {AutomationRule} rule - The rule, as shown.
   * @returns {Promise<AutomationWriteOutcome>} What became of the change.
   */
  toggle(rule: AutomationRule): Promise<AutomationWriteOutcome>;

  /**
   * Method remove
   *
   * @description
   * Hides a rule at once and deletes it, after the pending writes of the same rule, from the
   * newest version known. It is always sent, even while the rules are read again. A definite
   * refusal shows it again. A lost answer is resent with the same version, like a switch: a
   * `404` (already gone) means it applied, a `412` that the rule is still there. Unsettled, it
   * stays hidden and takes no other write until a read started afterwards settles it.
   *
   * @param {AutomationRule} rule - The rule.
   * @returns {Promise<AutomationWriteOutcome>} `applied` once the gateway deleted the rule or
   * reported it absent.
   */
  remove(rule: AutomationRule): Promise<AutomationWriteOutcome>;

  /**
   * Method create
   *
   * @description
   * Creates an enabled rule and adds it last. A retry of the same draft reuses its idempotency
   * key, so it never creates the rule twice; another draft or organization takes a new key. A
   * lost answer (network, timeout, `5xx`, `409 idempotency.request-in-progress`) is resent with
   * the same key, which the gateway replays; when the resends do not settle it, the rules are
   * read again and the draft and its key are kept, even past `discardDraft`. A later creation
   * first resends that draft with its key, so it is never recorded twice.
   *
   * @param {AutomationDraft} draft - The rule to create.
   * @returns {Promise<AutomationCreateOutcome>} What became of the creation.
   */
  create(draft: AutomationDraft): Promise<AutomationCreateOutcome>;

  /**
   * Method discardDraft
   *
   * @description
   * Forgets the key of the submitted draft once the builder closes, unless the gateway may have
   * recorded it.
   */
  discardDraft(): void;
  // #endregion
}

/**
 * Function latest
 *
 * @description
 * The newer of two known states of a rule.
 *
 * @param {AutomationRule} rule - A known state.
 * @param {AutomationRule | undefined} other - Another one, if any.
 * @returns {AutomationRule} The one with the higher version.
 */
function latest(rule: AutomationRule, other: AutomationRule | undefined): AutomationRule {
  return other && other.version > rule.version ? other : rule;
}

/**
 * Function reconcile
 *
 * @description
 * Applies the writes that settled after a read started over that read: a newer version replaces
 * the one read, a deleted rule leaves and a created rule is added last. A write that settled
 * before the read started is already in it, so the read wins.
 *
 * @param {AutomationRulesRead} read - The read.
 * @param {Readonly<Partial<Record<string, AutomationWritten>>>} written - The writes' results.
 * @param {Readonly<Partial<Record<string, AutomationDeleted>>>} deleted - The deletions.
 * @returns {readonly AutomationRule[]} The confirmed rules.
 */
function reconcile(
  read: AutomationRulesRead,
  written: Readonly<Partial<Record<string, AutomationWritten>>>,
  deleted: Readonly<Partial<Record<string, AutomationDeleted>>>,
): readonly AutomationRule[] {
  const ours: (entry: { organizationId: string } | undefined) => boolean = (
    entry: { organizationId: string } | undefined,
  ): boolean => entry?.organizationId === read.organizationId;
  const gone: (id: string) => boolean = (id: string): boolean => {
    const deletion: AutomationDeleted | undefined = deleted[id];
    return ours(deletion) && deletion !== undefined && deletion.settledAt > read.epoch;
  };
  const items: AutomationRule[] = read.items
    .filter((rule: AutomationRule): boolean => !gone(rule.id))
    .map((rule: AutomationRule): AutomationRule => {
      const write: AutomationWritten | undefined = written[rule.id];
      return ours(write) && write ? latest(rule, write.rule) : rule;
    });
  const known: ReadonlySet<string> = new Set(read.items.map((rule: AutomationRule) => rule.id));
  const created: AutomationRule[] = Object.values(written)
    .filter(
      (write: AutomationWritten | undefined): write is AutomationWritten =>
        ours(write) &&
        write !== undefined &&
        write.created &&
        write.settledAt > read.epoch &&
        !known.has(write.rule.id) &&
        deleted[write.rule.id] === undefined,
    )
    .sort((a: AutomationWritten, b: AutomationWritten): number => a.settledAt - b.settledAt)
    .map((write: AutomationWritten): AutomationRule => write.rule);
  return [...items, ...created];
}

/**
 * Function createAutomationsStore
 *
 * @description
 * Creates the automations store.
 *
 * @returns {Type<AutomationsStoreInstance>} Injectable store constructor.
 */
function createAutomationsStore(): Type<AutomationsStoreInstance> {
  return signalStore(
    withState(initialState),
    withProps((store) => {
      const api: AutomationsApi = inject(AutomationsApi);
      const lists: ListsApi = inject(ListsApi);
      const workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);
      const organizationId: Signal<string> = computed((): string => workspace.organization().id);
      const byOpening: () => { organizationId: string; opening: number } | undefined = () => {
        const opening: number = store._opening();
        return opening === 0 ? undefined : { organizationId: organizationId(), opening };
      };
      const started: Signal<boolean> = computed((): boolean => store._opening() > 0);
      const record: (read: AutomationRulesRead) => void = (read: AutomationRulesRead): void => {
        if (read.organizationId !== organizationId()) return;
        const current: AutomationRulesRead | null = store._read();
        if (current?.organizationId === read.organizationId && current.epoch > read.epoch) return;
        const unresolved: Readonly<Partial<Record<string, AutomationUnresolved>>> =
          store._unresolved();
        const settled: ReadonlySet<string> = new Set(
          Object.entries(unresolved)
            .filter(
              ([, entry]: [string, AutomationUnresolved | undefined]): boolean =>
                entry?.organizationId === read.organizationId && entry.since <= read.epoch,
            )
            .map(([id]: [string, AutomationUnresolved | undefined]): string => id),
        );
        const keep: <T>(
          record: Readonly<Partial<Record<string, T>>>,
        ) => Partial<Record<string, T>> = <T>(
          record: Readonly<Partial<Record<string, T>>>,
        ): Partial<Record<string, T>> =>
          Object.fromEntries(
            Object.entries(record).filter(
              ([id]: [string, T | undefined]): boolean => !settled.has(id),
            ),
          );
        patchState(store, {
          _read: read,
          ...(settled.size > 0
            ? {
                _unresolved: keep(unresolved),
                _desired: keep(store._desired()),
                _removed: store._removed().filter((id: string): boolean => !settled.has(id)),
              }
            : {}),
        });
      };
      return {
        _api: api,
        _organizationId: organizationId,
        _chains: new Map<string, Promise<unknown>>(),
        _record: record,
        _retryDelays: inject(AUTOMATION_RETRY_DELAYS),
        rules: resource({
          params: byOpening,
          loader: async ({
            params,
            abortSignal,
          }: {
            params: { organizationId: string };
            abortSignal: AbortSignal;
          }): Promise<readonly AutomationRule[]> => {
            const epoch: number = store._writes();
            const items: readonly AutomationRule[] = await api.rules(abortSignal);
            record({ organizationId: params.organizationId, items, epoch });
            return items;
          },
        }),
        runs: resource({
          params: byOpening,
          loader: ({
            abortSignal,
          }: {
            abortSignal: AbortSignal;
          }): Promise<readonly AutomationRun[]> => api.runs(abortSignal),
        }),
        members: resource({
          params: () => (started() ? { organizationId: organizationId() } : undefined),
          loader: ({ abortSignal }: { abortSignal: AbortSignal }): Promise<readonly ListMember[]> =>
            lists.organizationMembers(abortSignal),
        }),
      };
    }),
    withComputed((store) => {
      const confirmedRules: Signal<readonly AutomationRule[] | undefined> = computed(
        (): readonly AutomationRule[] | undefined => {
          const read: AutomationRulesRead | null = store._read();
          if (read?.organizationId !== store._organizationId()) return undefined;
          return reconcile(read, store._written(), store._deleted());
        },
      );
      const shownRules: Signal<readonly AutomationRule[]> = computed(
        (): readonly AutomationRule[] => {
          const desired: Readonly<Partial<Record<string, boolean>>> = store._desired();
          const removed: readonly string[] = store._removed();
          return (confirmedRules() ?? [])
            .filter((rule: AutomationRule): boolean => !removed.includes(rule.id))
            .map((rule: AutomationRule): AutomationRule => {
              const wanted: boolean | undefined = desired[rule.id];
              return wanted === undefined ? rule : { ...rule, enabled: wanted };
            });
        },
      );
      return {
        confirmedRules,
        shownRules,
        creationUnknown: computed((): boolean => store._draft()?.uncertain === true),
        unresolvedRuleIds: computed((): readonly string[] => {
          const organizationId: string = store._organizationId();
          return Object.entries(store._unresolved())
            .filter(
              ([, entry]: [string, AutomationUnresolved | undefined]): boolean =>
                entry?.organizationId === organizationId,
            )
            .map(([id]: [string, AutomationUnresolved | undefined]): string => id);
        }),
        activeCount: computed(
          (): number => shownRules().filter((rule: AutomationRule): boolean => rule.enabled).length,
        ),
      };
    }),
    withMethods((store) => {
      const confirmedRule: (id: string) => AutomationRule | undefined = (
        id: string,
      ): AutomationRule | undefined =>
        store.confirmedRules()?.find((rule: AutomationRule): boolean => rule.id === id);
      const tick: () => number = (): number => {
        const settledAt: number = store._writes() + 1;
        patchState(store, { _writes: settledAt });
        return settledAt;
      };
      const confirm: (rule: AutomationRule, organizationId: string, created: boolean) => void = (
        rule: AutomationRule,
        organizationId: string,
        created: boolean,
      ): void => {
        const settledAt: number = tick();
        const previous: AutomationWritten | undefined = store._written()[rule.id];
        patchState(store, {
          _written: {
            ...store._written(),
            [rule.id]: {
              organizationId,
              rule: previous ? latest(rule, previous.rule) : rule,
              settledAt,
              created: created || previous?.created === true,
            },
          },
        });
      };
      const markDeleted: (id: string, organizationId: string) => void = (
        id: string,
        organizationId: string,
      ): void => {
        const settledAt: number = tick();
        patchState(store, {
          _deleted: { ...store._deleted(), [id]: { organizationId, settledAt } },
        });
      };
      const settle: (id: string, enabled: boolean) => void = (
        id: string,
        enabled: boolean,
      ): void => {
        const desired: Readonly<Partial<Record<string, boolean>>> = store._desired();
        if (desired[id] !== enabled) return;
        patchState(store, {
          _desired: Object.fromEntries(
            Object.entries(desired).filter(
              ([key]: [string, boolean | undefined]): boolean => key !== id,
            ),
          ),
        });
      };
      const unhide: (id: string) => void = (id: string): void => {
        patchState(store, {
          _removed: store._removed().filter((item: string): boolean => item !== id),
        });
      };
      const serialize: <T>(id: string, task: () => Promise<T>) => Promise<T> = <T>(
        id: string,
        task: () => Promise<T>,
      ): Promise<T> => {
        const previous: Promise<unknown> = store._chains.get(id) ?? Promise.resolve();
        const next: Promise<T> = previous.then(task, task);
        store._chains.set(id, next);
        return next;
      };
      const readAgain: (organizationId: string) => Promise<void> = async (
        organizationId: string,
      ): Promise<void> => {
        const epoch: number = store._writes();
        const items: readonly AutomationRule[] = await store._api.rules();
        store._record({ organizationId, items, epoch });
      };
      const unresolve: (id: string, organizationId: string) => void = (
        id: string,
        organizationId: string,
      ): void => {
        const since: number = tick();
        patchState(store, {
          _unresolved: { ...store._unresolved(), [id]: { organizationId, since } },
        });
        store.rules.reload();
      };
      const resendToggle: (
        known: AutomationRule,
        enabled: boolean,
        organizationId: string,
      ) => Promise<AutomationWriteOutcome> = async (
        known: AutomationRule,
        enabled: boolean,
        organizationId: string,
      ): Promise<AutomationWriteOutcome> => {
        let conflicted: boolean = false;
        for (const delay of store._retryDelays) {
          await wait(delay);
          if (store._organizationId() !== organizationId) return 'unknown';
          if (!conflicted) {
            try {
              const updated: AutomationRule = await store._api.setEnabled(known, enabled);
              confirm(updated, organizationId, false);
              return 'applied';
            } catch (error: unknown) {
              if (isUncertainAutomationWrite(error)) continue;
              if (!isStaleAutomationRule(error)) return 'refused';
              conflicted = true;
            }
          }
          try {
            await readAgain(organizationId);
            return confirmedRule(known.id)?.enabled === enabled ? 'applied' : 'not-applied';
          } catch {
            continue;
          }
        }
        return 'unknown';
      };
      const resendDelete: (
        known: AutomationRule,
        organizationId: string,
      ) => Promise<AutomationWriteOutcome> = async (
        known: AutomationRule,
        organizationId: string,
      ): Promise<AutomationWriteOutcome> => {
        for (const delay of store._retryDelays) {
          await wait(delay);
          if (store._organizationId() !== organizationId) return 'unknown';
          try {
            await store._api.delete(known);
            markDeleted(known.id, organizationId);
            return 'applied';
          } catch (error: unknown) {
            if (isUncertainAutomationWrite(error)) continue;
            return isStaleAutomationRule(error) ? 'not-applied' : 'refused';
          }
        }
        return 'unknown';
      };
      const sendDraft: (
        draft: AutomationDraft,
        key: string,
        organizationId: string,
      ) => Promise<AutomationCreateOutcome> = async (
        draft: AutomationDraft,
        key: string,
        organizationId: string,
      ): Promise<AutomationCreateOutcome> => {
        const body: string = JSON.stringify(draft);
        patchState(store, {
          _draft: { key, body, organizationId, uncertain: store._draft()?.uncertain === true },
        });
        for (const delay of [null, ...store._retryDelays]) {
          if (delay !== null) await wait(delay);
          if (store._organizationId() !== organizationId) return { status: 'unknown' };
          try {
            const created: AutomationRule = await store._api.create(draft, key);
            confirm(created, organizationId, true);
            patchState(store, { _draft: null });
            return { status: 'created', rule: created };
          } catch (error: unknown) {
            if (isUncertainAutomationCreate(error)) continue;
            patchState(store, { _draft: null });
            return { status: 'refused' };
          }
        }
        patchState(store, { _draft: { key, body, organizationId, uncertain: true } });
        try {
          await readAgain(organizationId);
        } catch {
          store.rules.reload();
        }
        return { status: 'unknown' };
      };
      return {
        load(): void {
          patchState(store, { _opening: store._opening() + 1 });
        },
        toggle(rule: AutomationRule): Promise<AutomationWriteOutcome> {
          if (store._unresolved()[rule.id]) return Promise.resolve('unknown');
          const organizationId: string = store._organizationId();
          const shown: AutomationRule | undefined = store
            .shownRules()
            .find((item: AutomationRule): boolean => item.id === rule.id);
          const enabled: boolean = !(shown ?? rule).enabled;
          patchState(store, { _desired: { ...store._desired(), [rule.id]: enabled } });
          return serialize(rule.id, async (): Promise<AutomationWriteOutcome> => {
            if (store._desired()[rule.id] !== enabled) return 'applied';
            if (store._organizationId() !== organizationId) {
              settle(rule.id, enabled);
              return 'refused';
            }
            const known: AutomationRule = latest(rule, confirmedRule(rule.id));
            if (known.enabled === enabled) {
              settle(rule.id, enabled);
              return 'applied';
            }
            try {
              const updated: AutomationRule = await store._api.setEnabled(known, enabled);
              if (store._organizationId() === organizationId) {
                confirm(updated, organizationId, false);
              }
              settle(rule.id, enabled);
              return 'applied';
            } catch (error: unknown) {
              if (isUncertainAutomationWrite(error)) {
                const outcome: AutomationWriteOutcome = await resendToggle(
                  known,
                  enabled,
                  organizationId,
                );
                if (outcome === 'unknown') {
                  unresolve(rule.id, organizationId);
                } else {
                  settle(rule.id, enabled);
                }
                return outcome;
              }
              settle(rule.id, enabled);
              if (isStaleAutomationRule(error)) store.rules.reload();
              return 'refused';
            }
          });
        },
        remove(rule: AutomationRule): Promise<AutomationWriteOutcome> {
          if (store._unresolved()[rule.id]) return Promise.resolve('unknown');
          const organizationId: string = store._organizationId();
          patchState(store, { _removed: [...store._removed(), rule.id] });
          return serialize(rule.id, async (): Promise<AutomationWriteOutcome> => {
            if (store._organizationId() !== organizationId) {
              unhide(rule.id);
              return 'refused';
            }
            const known: AutomationRule = latest(rule, confirmedRule(rule.id));
            try {
              await store._api.delete(known);
              markDeleted(rule.id, organizationId);
              unhide(rule.id);
              return 'applied';
            } catch (error: unknown) {
              if (isUncertainAutomationWrite(error)) {
                const outcome: AutomationWriteOutcome = await resendDelete(known, organizationId);
                if (outcome === 'unknown') {
                  unresolve(rule.id, organizationId);
                } else {
                  unhide(rule.id);
                }
                return outcome;
              }
              unhide(rule.id);
              if (isStaleAutomationRule(error)) store.rules.reload();
              return 'refused';
            }
          });
        },
        async create(draft: AutomationDraft): Promise<AutomationCreateOutcome> {
          if (store.creating()) return { status: 'busy' };
          const organizationId: string = store._organizationId();
          const body: string = JSON.stringify(draft);
          patchState(store, { creating: true });
          try {
            const previous: AutomationDraftKey | null = store._draft();
            const reusable: boolean = previous?.organizationId === organizationId;
            if (previous && reusable && previous.uncertain && previous.body !== body) {
              const earlier: AutomationCreateOutcome = await sendDraft(
                JSON.parse(previous.body) as AutomationDraft,
                previous.key,
                organizationId,
              );
              if (earlier.status === 'unknown') return earlier;
            }
            const current: AutomationDraftKey | null = store._draft();
            const key: string =
              current?.body === body && current.organizationId === organizationId
                ? current.key
                : crypto.randomUUID();
            return await sendDraft(draft, key, organizationId);
          } finally {
            patchState(store, { creating: false });
          }
        },
        discardDraft(): void {
          if (store._draft()?.uncertain === true) return;
          patchState(store, { _draft: null });
        },
      };
    }),
  );
}

/**
 * Constant AutomationsStore
 *
 * @description
 * The organization's "when… then…" rules for the `Automations` dialog, provided by the dialog
 * so its state dies with it. Nothing is read until the dialog opens (`load`); each opening reads
 * the rules and the last runs again, the members once, and another organization reads them
 * all again. Switches and deletions are optimistic and restore the recorded state when refused.
 * A lost answer (network, timeout, `5xx`) is not a refusal: the same write is resent, with the
 * same version or idempotency key, a bounded number of times; until that settles it, the change
 * stays pending and the rule takes no other write. The rules confirmed by the gateway live apart from the read in flight: the writes keep using
 * the newest version while the dialog reads again, and a read started before a write settled
 * gets that write's result applied over it.
 *
 * @type {ReturnType<typeof createAutomationsStore>}
 */
export const AutomationsStore: ReturnType<typeof createAutomationsStore> = createAutomationsStore();
