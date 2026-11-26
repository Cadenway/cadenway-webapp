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
  isUncertainAutomationWrite,
} from '../../data-access/services/automations-api/automations-api.service';
import { ListsApi } from '../../data-access/services/lists-api/lists-api.service';
import type {
  AutomationDraft,
  AutomationRule,
  AutomationRun,
  AutomationWriteOutcome,
} from '../../models/automation-rule/automation-rule.interface';
import type { ListMember } from '../../models/list-member/list-member.interface';

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
  // #endregion
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
   * timeout, `5xx`) may have been applied: the rules are read again and show the state the
   * gateway confirms.
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
   * refusal shows it again; after a lost answer, the rules are read again to learn whether it
   * is gone.
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
   * key, so it never creates the rule twice; another draft or organization takes a new key.
   *
   * @param {AutomationDraft} draft - The rule to create.
   * @returns {Promise<AutomationRule | null>} The created rule, or null when it was refused or
   * a creation is already in flight.
   */
  create(draft: AutomationDraft): Promise<AutomationRule | null>;

  /**
   * Method discardDraft
   *
   * @description
   * Forgets the key of the submitted draft once the builder closes.
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
        patchState(store, { _read: read });
      };
      return {
        _api: api,
        _organizationId: organizationId,
        _chains: new Map<string, Promise<unknown>>(),
        _record: record,
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
      const uncertain: (
        organizationId: string,
        applied: () => boolean,
      ) => Promise<AutomationWriteOutcome> = async (
        organizationId: string,
        applied: () => boolean,
      ): Promise<AutomationWriteOutcome> => {
        tick();
        try {
          await readAgain(organizationId);
          if (store._organizationId() !== organizationId) return 'unknown';
          return applied() ? 'applied' : 'not-applied';
        } catch {
          store.rules.reload();
          return 'unknown';
        }
      };
      return {
        load(): void {
          patchState(store, { _opening: store._opening() + 1 });
        },
        toggle(rule: AutomationRule): Promise<AutomationWriteOutcome> {
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
                const outcome: AutomationWriteOutcome = await uncertain(
                  organizationId,
                  (): boolean => confirmedRule(rule.id)?.enabled === enabled,
                );
                settle(rule.id, enabled);
                return outcome;
              }
              settle(rule.id, enabled);
              if (isStaleAutomationRule(error)) store.rules.reload();
              return 'refused';
            }
          });
        },
        remove(rule: AutomationRule): Promise<AutomationWriteOutcome> {
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
                const outcome: AutomationWriteOutcome = await uncertain(
                  organizationId,
                  (): boolean => confirmedRule(rule.id) === undefined,
                );
                unhide(rule.id);
                return outcome;
              }
              unhide(rule.id);
              if (isStaleAutomationRule(error)) store.rules.reload();
              return 'refused';
            }
          });
        },
        async create(draft: AutomationDraft): Promise<AutomationRule | null> {
          if (store.creating()) return null;
          const organizationId: string = store._organizationId();
          const body: string = JSON.stringify(draft);
          const previous: AutomationDraftKey | null = store._draft();
          const key: string =
            previous?.body === body && previous.organizationId === organizationId
              ? previous.key
              : crypto.randomUUID();
          patchState(store, { creating: true, _draft: { key, body, organizationId } });
          try {
            const created: AutomationRule = await store._api.create(draft, key);
            if (store._organizationId() === organizationId) confirm(created, organizationId, true);
            patchState(store, { _draft: null });
            return created;
          } catch {
            return null;
          } finally {
            patchState(store, { creating: false });
          }
        },
        discardDraft(): void {
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
 * A lost answer (network, timeout, `5xx`) is not a refusal: the rules are read again and show
 * what the gateway confirms. The rules confirmed by the gateway live apart from the read in flight: the writes keep using
 * the newest version while the dialog reads again, and a read started before a write settled
 * gets that write's result applied over it.
 *
 * @type {ReturnType<typeof createAutomationsStore>}
 */
export const AutomationsStore: ReturnType<typeof createAutomationsStore> = createAutomationsStore();
