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
} from '../../data-access/services/automations-api/automations-api.service';
import { ListsApi } from '../../data-access/services/lists-api/lists-api.service';
import type {
  AutomationDraft,
  AutomationRule,
  AutomationRun,
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
   * The organization's rules as the gateway confirmed them. Its failure is the dialog's inline
   * error, whose Retry calls `reload()`.
   *
   * @type {ResourceRef<readonly AutomationRule[] | undefined>}
   * @readonly
   */
  readonly rules: ResourceRef<readonly AutomationRule[] | undefined>;

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
   * coming back to the recorded state sends nothing. A refusal shows the recorded state again and
   * reads the rules again when they were out of date.
   *
   * @param {AutomationRule} rule - The rule, as shown.
   * @returns {Promise<boolean>} Whether the gateway recorded the change (or nothing had to be sent).
   */
  toggle(rule: AutomationRule): Promise<boolean>;

  /**
   * Method remove
   *
   * @description
   * Hides a rule at once and deletes it, after the pending writes of the same rule. A refusal
   * shows it again.
   *
   * @param {AutomationRule} rule - The rule.
   * @returns {Promise<boolean>} Whether the rule is gone.
   */
  remove(rule: AutomationRule): Promise<boolean>;

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
      return {
        _api: api,
        _organizationId: organizationId,
        _chains: new Map<string, Promise<unknown>>(),
        rules: resource({
          params: byOpening,
          loader: ({
            abortSignal,
          }: {
            abortSignal: AbortSignal;
          }): Promise<readonly AutomationRule[]> => api.rules(abortSignal),
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
      const shownRules: Signal<readonly AutomationRule[]> = computed(
        (): readonly AutomationRule[] => {
          const confirmed: readonly AutomationRule[] = store.rules.hasValue()
            ? store.rules.value()
            : [];
          const desired: Readonly<Partial<Record<string, boolean>>> = store._desired();
          const removed: readonly string[] = store._removed();
          return confirmed
            .filter((rule: AutomationRule): boolean => !removed.includes(rule.id))
            .map((rule: AutomationRule): AutomationRule => {
              const wanted: boolean | undefined = desired[rule.id];
              return wanted === undefined ? rule : { ...rule, enabled: wanted };
            });
        },
      );
      return {
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
        store.rules.hasValue()
          ? store.rules.value().find((rule: AutomationRule): boolean => rule.id === id)
          : undefined;
      const replaceRule: (rule: AutomationRule) => void = (rule: AutomationRule): void => {
        if (!store.rules.hasValue()) return;
        store.rules.set(
          store.rules
            .value()
            .map((item: AutomationRule): AutomationRule => (item.id === rule.id ? rule : item)),
        );
      };
      const dropRule: (id: string) => void = (id: string): void => {
        if (!store.rules.hasValue()) return;
        store.rules.set(
          store.rules.value().filter((item: AutomationRule): boolean => item.id !== id),
        );
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
      return {
        load(): void {
          patchState(store, { _opening: store._opening() + 1 });
        },
        toggle(rule: AutomationRule): Promise<boolean> {
          const organizationId: string = store._organizationId();
          const shown: AutomationRule | undefined = store
            .shownRules()
            .find((item: AutomationRule): boolean => item.id === rule.id);
          const enabled: boolean = !(shown ?? rule).enabled;
          patchState(store, { _desired: { ...store._desired(), [rule.id]: enabled } });
          return serialize(rule.id, async (): Promise<boolean> => {
            if (store._desired()[rule.id] !== enabled) return true;
            const confirmed: AutomationRule | undefined = confirmedRule(rule.id);
            if (!confirmed || store._organizationId() !== organizationId) {
              settle(rule.id, enabled);
              return false;
            }
            if (confirmed.enabled === enabled) {
              settle(rule.id, enabled);
              return true;
            }
            try {
              const updated: AutomationRule = await store._api.setEnabled(confirmed, enabled);
              if (store._organizationId() === organizationId) replaceRule(updated);
              settle(rule.id, enabled);
              return true;
            } catch (error: unknown) {
              settle(rule.id, enabled);
              if (isStaleAutomationRule(error)) store.rules.reload();
              return false;
            }
          });
        },
        remove(rule: AutomationRule): Promise<boolean> {
          const organizationId: string = store._organizationId();
          patchState(store, { _removed: [...store._removed(), rule.id] });
          return serialize(rule.id, async (): Promise<boolean> => {
            const confirmed: AutomationRule | undefined = confirmedRule(rule.id);
            if (store._organizationId() !== organizationId) {
              unhide(rule.id);
              return false;
            }
            if (!confirmed) {
              unhide(rule.id);
              return true;
            }
            try {
              await store._api.delete(confirmed);
              dropRule(rule.id);
              unhide(rule.id);
              return true;
            } catch (error: unknown) {
              unhide(rule.id);
              if (isStaleAutomationRule(error)) store.rules.reload();
              return false;
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
            if (store._organizationId() === organizationId) {
              if (store.rules.hasValue()) {
                const current: readonly AutomationRule[] = store.rules.value();
                if (!current.some((item: AutomationRule): boolean => item.id === created.id)) {
                  store.rules.set([...current, created]);
                }
              } else {
                store.rules.reload();
              }
            }
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
 *
 * @type {ReturnType<typeof createAutomationsStore>}
 */
export const AutomationsStore: ReturnType<typeof createAutomationsStore> = createAutomationsStore();
