import { DOCUMENT } from '@angular/common';
import {
  computed,
  inject,
  resource,
  type ResourceRef,
  type Signal,
  signal,
  type Type,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CwToastService } from '@cadenway/ui/components/toast';
import {
  patchState,
  signalMethod,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { auditTime, EMPTY, filter, fromEvent, merge, type Observable } from 'rxjs';

import { hasProblemCode, OrganizationSwitchPendingError } from '@core/api';
import { RealtimeConnection } from '@core/realtime';
import { LIST_DIRECTORY, type ListDirectoryEntry } from '@features/spaces/ports/list-directory';
import { SPACE_DIRECTORY, type SpaceDirectoryEntry } from '@features/spaces/ports/space-directory';
import { type Person, TaskDetailOpener } from '@features/task';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import {
  GoalsApi,
  isGone,
  isUncertainWrite,
  isVersionMismatch,
  type KeyResultWrite,
} from '../../data-access/services/goals-api/goals-api.service';
import type {
  Goal,
  GoalDraft,
  GoalList,
  GoalSpaceOption,
  GoalStats,
  GoalView,
  KeyResult,
  KeyResultDraft,
  Quarter,
} from '../../models/goal/goal.interface';
import { quarterOf, todayIso } from '../../utils/quarter/quarter.util';

/**
 * Constant REFRESH_AUDIT_MS
 *
 * @description
 * Window, in milliseconds, opened by the first background trigger of a burst (a focus and a
 * visibility change arrive together); the goals are read once at its end.
 *
 * @type {number}
 */
export const REFRESH_AUDIT_MS: number = 300;

/**
 * Type GoalWrite
 *
 * @description
 * A write the gateway confirmed, kept over the read goals until a read issued after it lands:
 * `goal` puts a goal as written or read again (a new one first), `removed` takes one out,
 * `result` puts a key result with the goal version its `ETag` named, `result-removed` takes one
 * out. `after` is the number of reads issued when it was confirmed; a read whose issue number is
 * greater reflects it.
 *
 * @type {{ readonly organizationId: string; readonly after: number } & ({ readonly kind: 'goal'; readonly goal: Goal } | { readonly kind: 'removed'; readonly goalId: string } | { readonly kind: 'result'; readonly goalId: string; readonly result: KeyResult; readonly version: number | null } | { readonly kind: 'result-removed'; readonly goalId: string; readonly resultId: string })}
 */
type GoalWrite = { readonly organizationId: string; readonly after: number } & (
  | { readonly kind: 'goal'; readonly goal: Goal }
  | { readonly kind: 'removed'; readonly goalId: string }
  | {
      readonly kind: 'result';
      readonly goalId: string;
      readonly result: KeyResult;
      readonly version: number | null;
    }
  | { readonly kind: 'result-removed'; readonly goalId: string; readonly resultId: string }
);

/**
 * Interface GoalsState
 *
 * @description
 * The writes of the goals page: those in progress, the edits shown before the gateway confirms
 * them, and the confirmed writes no read reflects yet.
 */
interface GoalsState {
  // #region Properties
  /**
   * Property creating
   *
   * @description
   * Whether a goal creation is waiting for the gateway.
   *
   * @type {boolean}
   */
  creating: boolean;

  /**
   * Property deletingId
   *
   * @description
   * The goal whose deletion is waiting for the gateway, or null.
   *
   * @type {string | null}
   */
  deletingId: string | null;

  /**
   * Property addingTo
   *
   * @description
   * The goal a key result is being added to, or null.
   *
   * @type {string | null}
   */
  addingTo: string | null;

  /**
   * Property _edits
   *
   * @description
   * The value shown for each key result whose change is on its way: the current value of a number,
   * the state of a checkbox. Only the last value of a burst of clicks is sent.
   *
   * @type {Readonly<Record<string, number | boolean>>}
   */
  _edits: Readonly<Record<string, number | boolean>>;

  /**
   * Property _hidden
   *
   * @description
   * Key results whose removal is on its way, hidden at once.
   *
   * @type {readonly string[]}
   */
  _hidden: readonly string[];

  /**
   * Property _writes
   *
   * @description
   * The confirmed writes no read issued after them has reflected yet, oldest first.
   *
   * @type {readonly GoalWrite[]}
   */
  _writes: readonly GoalWrite[];

  /**
   * Property _readsIssued
   *
   * @description
   * How many reads of the goals have been issued.
   *
   * @type {number}
   */
  _readsIssued: number;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * Nothing in progress, nothing waiting for a read.
 *
 * @type {GoalsState}
 */
const initialState: GoalsState = {
  creating: false,
  deletingId: null,
  addingTo: null,
  _edits: {},
  _hidden: [],
  _writes: [],
  _readsIssued: 0,
};

/**
 * Interface GoalsLoads
 *
 * @description
 * How the next read of the goals is sent and whether one waits for the running read to settle.
 */
interface GoalsLoads {
  // #region Properties
  /**
   * Property background
   *
   * @description
   * Whether the next read was triggered in the background (a focus, a reconnection, a write
   * elsewhere); its failure keeps the goals shown instead of reaching the error boundary.
   *
   * @type {boolean}
   */
  background: boolean;

  /**
   * Property queued
   *
   * @description
   * Whether a read was asked for while one was running; it is sent once that one settles.
   *
   * @type {boolean}
   */
  queued: boolean;

  /**
   * Property last
   *
   * @description
   * The last list read and its organization, kept when a background read fails.
   *
   * @type {{ readonly organizationId: string; readonly list: GoalList } | null}
   */
  last: { readonly organizationId: string; readonly list: GoalList } | null;
  // #endregion
}

/**
 * Class WriteDroppedError
 *
 * @description
 * A write that is no longer wanted: the workspace now shows another organization than the one it
 * started in, or its goal is no longer shown. It is not sent, and nothing is shown.
 */
class WriteDroppedError extends Error {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Names the error.
   *
   * @constructor
   */
  public constructor() {
    super('The write is no longer wanted.');
    this.name = 'WriteDroppedError';
  }
  // #endregion
}

/**
 * Function numberProgress
 *
 * @description
 * The progress of a number key result for a value being sent, with the contract's rule
 * (`goals.yaml` info), so its bar moves at once; the gateway's own value replaces it once
 * confirmed.
 *
 * @param {number} start - Start value.
 * @param {number} current - Value shown.
 * @param {number} target - Target value.
 * @returns {number} The progress, from 0 to 100.
 */
function numberProgress(start: number, current: number, target: number): number {
  if (start === target) return current === target ? 100 : 0;
  return Math.min(1, Math.max(0, (current - start) / (target - start))) * 100;
}

/**
 * Function applyWrites
 *
 * @description
 * The read goals of an organization with its confirmed writes on top.
 *
 * @param {readonly Goal[]} goals - The goals as last read.
 * @param {readonly GoalWrite[]} writes - The writes not reflected yet, oldest first.
 * @param {string} organizationId - The organization of the goals.
 * @returns {readonly Goal[]} The goals to show.
 */
function applyWrites(
  goals: readonly Goal[],
  writes: readonly GoalWrite[],
  organizationId: string,
): readonly Goal[] {
  return writes
    .filter((write: GoalWrite): boolean => write.organizationId === organizationId)
    .reduce((list: readonly Goal[], write: GoalWrite): readonly Goal[] => {
      switch (write.kind) {
        case 'goal':
          return list.some((goal: Goal): boolean => goal.id === write.goal.id)
            ? list.map((goal: Goal): Goal => (goal.id === write.goal.id ? write.goal : goal))
            : [write.goal, ...list];
        case 'removed':
          return list.filter((goal: Goal): boolean => goal.id !== write.goalId);
        case 'result':
          return list.map((goal: Goal): Goal => {
            if (goal.id !== write.goalId) return goal;
            const known: boolean = goal.results.some(
              (result: KeyResult): boolean => result.id === write.result.id,
            );
            return {
              ...goal,
              version: write.version ?? goal.version,
              results: known
                ? goal.results.map((result: KeyResult): KeyResult =>
                    result.id === write.result.id ? write.result : result,
                  )
                : [...goal.results, write.result],
            };
          });
        case 'result-removed':
          return list.map((goal: Goal): Goal =>
            goal.id === write.goalId
              ? {
                  ...goal,
                  results: goal.results.filter(
                    (result: KeyResult): boolean => result.id !== write.resultId,
                  ),
                }
              : goal,
          );
      }
    }, goals);
}

/**
 * Function applyEdits
 *
 * @description
 * A goal's key results with the values being sent and without those being removed.
 *
 * @param {Goal} goal - The goal with its confirmed writes.
 * @param {Readonly<Record<string, number | boolean>>} edits - The values being sent.
 * @param {ReadonlySet<string>} hidden - The key results being removed.
 * @returns {Goal} The goal to show.
 */
function applyEdits(
  goal: Goal,
  edits: Readonly<Record<string, number | boolean>>,
  hidden: ReadonlySet<string>,
): Goal {
  return {
    ...goal,
    results: goal.results
      .filter((result: KeyResult): boolean => !hidden.has(result.id))
      .map((result: KeyResult): KeyResult => {
        const edit: number | boolean | undefined = edits[result.id];
        if (result.kind === 'number' && typeof edit === 'number')
          return {
            ...result,
            currentValue: edit,
            progressPercent: numberProgress(result.startValue, edit, result.targetValue),
          };
        if (result.kind === 'checkbox' && typeof edit === 'boolean')
          return { ...result, checked: edit, progressPercent: edit ? 100 : 0 };
        return result;
      }),
  };
}

/**
 * Interface GoalsStoreInstance
 *
 * @description
 * The goals of the current quarter in the workspace's organization, their figures and their writes.
 */
export interface GoalsStoreInstance {
  // #region Properties
  /**
   * Property goals
   *
   * @description
   * The read of the goals, again after an organization switch; its error reaches the route's
   * error boundary through the page's read of `list()`.
   *
   * @type {ResourceRef<GoalList | undefined>}
   * @readonly
   */
  readonly goals: ResourceRef<GoalList | undefined>;

  /**
   * Property list
   *
   * @description
   * The goals to show, or undefined while the first read of the organization loads. Reading it
   * throws the read's error.
   *
   * @type {Signal<readonly GoalView[] | undefined>}
   * @readonly
   */
  readonly list: Signal<readonly GoalView[] | undefined>;

  /**
   * Property quarter
   *
   * @description
   * The quarter shown, or null before the first read.
   *
   * @type {Signal<Quarter | null>}
   * @readonly
   */
  readonly quarter: Signal<Quarter | null>;

  /**
   * Property stats
   *
   * @description
   * The figures of the statistics strip.
   *
   * @type {Signal<GoalStats>}
   * @readonly
   */
  readonly stats: Signal<GoalStats>;

  /**
   * Property isEmpty
   *
   * @description
   * Whether the read succeeded and no goal is shown.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly isEmpty: Signal<boolean>;

  /**
   * Property canCreate
   *
   * @description
   * Whether the caller may create a goal: an owner or administrator (a goal of the organization),
   * or a person with `edit` on at least one space (gap G-G3).
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly canCreate: Signal<boolean>;

  /**
   * Property spaceOptions
   *
   * @description
   * The spaces a goal may be created in, or null when it belongs to the organization (an owner or
   * administrator creates goals of the organization, so no space is asked).
   *
   * @type {Signal<readonly GoalSpaceOption[] | null>}
   * @readonly
   */
  readonly spaceOptions: Signal<readonly GoalSpaceOption[] | null>;

  /**
   * Property owners
   *
   * @description
   * The people who may own a new goal; only the caller while the members are read or when their
   * read failed.
   *
   * @type {Signal<readonly Person[]>}
   * @readonly
   */
  readonly owners: Signal<readonly Person[]>;

  /**
   * Property userId
   *
   * @description
   * The caller, the default owner of a new goal (`App.dc.html` line 5190).
   *
   * @type {Signal<string>}
   * @readonly
   */
  readonly userId: Signal<string>;

  /**
   * Property listNames
   *
   * @description
   * The names of the lists the sidebar shows, by id (gap G-G2); an archived list has none.
   *
   * @type {Signal<ReadonlyMap<string, string>>}
   * @readonly
   */
  readonly listNames: Signal<ReadonlyMap<string, string>>;

  /**
   * Property milestoneKeys
   *
   * @description
   * The keys of the milestone tasks of the goals shown, sorted, without duplicates.
   *
   * @type {Signal<readonly string[]>}
   * @readonly
   */
  readonly milestoneKeys: Signal<readonly string[]>;

  /**
   * Property creating
   *
   * @description
   * Whether a goal creation is in progress.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly creating: Signal<boolean>;

  /**
   * Property deletingId
   *
   * @description
   * The goal being deleted, or null.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  readonly deletingId: Signal<string | null>;

  /**
   * Property addingTo
   *
   * @description
   * The goal a key result is being added to, or null.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  readonly addingTo: Signal<string | null>;
  // #endregion

  // #region Methods
  /**
   * Method refresh
   *
   * @description
   * Reads the goals again in the background, keeping them shown; a read asked for while one runs
   * is sent once it settles, and a failure keeps the goals shown.
   */
  refresh(): void;

  /**
   * Method create
   *
   * @description
   * Creates a goal in the quarter shown, in the organization the workspace shows when it starts,
   * and toasts `Goal created` with its name. A refusal toasts the failure. When the answer is lost
   * or the gateway fails (`5xx`), the goals are read again: a new goal of that name counts as
   * created, otherwise nothing is reported and the form keeps its values. Nothing is patched or
   * toasted once the workspace shows another organization. Ignored while a creation runs.
   *
   * @param {GoalDraft} draft - What the form submitted.
   * @returns {Promise<string | null>} The id of the new goal, or null when none is known.
   */
  create(draft: GoalDraft): Promise<string | null>;

  /**
   * Method remove
   *
   * @description
   * Deletes a goal after its confirmation, from the version shown (once more from the current
   * version after a `412`), and toasts `Goal deleted` with its name; a goal already gone counts
   * as deleted. An unknown outcome reads the goal again: gone, it counts as deleted, otherwise it
   * stays without a report. A refusal toasts the failure. Ignored while a deletion runs.
   *
   * @param {string} goalId - Id of the goal.
   * @returns {Promise<boolean>} Whether the goal left the list shown.
   */
  remove(goalId: string): Promise<boolean>;

  /**
   * Method step
   *
   * @description
   * Moves a number key result by one step (`max(1, round(|target - start| / 20))`, reversed for
   * a decreasing target, `App.dc.html` lines 5142-5152), shown at once. The changes of one goal are
   * sent one after the other, each from the version the previous one returned, and only the last
   * value of a burst is sent. A refusal shows the confirmed value again and toasts the failure; an
   * unknown outcome shows it again and reads the goals again.
   *
   * @param {string} goalId - Id of the goal.
   * @param {string} resultId - Id of the key result.
   * @param {1 | -1} direction - `1` for `Increase`, `-1` for `Decrease`.
   */
  step(goalId: string, resultId: string, direction: 1 | -1): void;

  /**
   * Method toggle
   *
   * @description
   * Ticks or unticks a checkbox key result, shown at once, sent like `step`.
   *
   * @param {string} goalId - Id of the goal.
   * @param {string} resultId - Id of the key result.
   */
  toggle(goalId: string, resultId: string): void;

  /**
   * Method addResult
   *
   * @description
   * Adds a number key result from 0 towards its target, after the goal's other writes. An unknown
   * outcome reads the goal again: a new key result of that label counts as added, otherwise
   * nothing is reported. A refusal toasts the failure.
   *
   * @param {string} goalId - Id of the goal.
   * @param {KeyResultDraft} draft - What the form submitted.
   * @returns {Promise<boolean>} Whether the key result is known to be added.
   */
  addResult(goalId: string, draft: KeyResultDraft): Promise<boolean>;

  /**
   * Method removeResult
   *
   * @description
   * Removes a key result, hidden at once, without undo (`App.dc.html` line 5156). A refusal shows
   * it again and toasts the failure; an unknown outcome shows it again and reads the goals again.
   *
   * @param {string} goalId - Id of the goal.
   * @param {string} resultId - Id of the key result.
   */
  removeResult(goalId: string, resultId: string): void;
  // #endregion
}

/**
 * Function createGoalsStore
 *
 * @description
 * Creates the goals store.
 *
 * @returns {Type<GoalsStoreInstance>} Injectable store constructor.
 */
function createGoalsStore(): Type<GoalsStoreInstance> {
  return signalStore(
    withState(initialState),
    withProps((store) => {
      const api: GoalsApi = inject(GoalsApi);
      const workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);
      const loads: GoalsLoads = { background: false, queued: false, last: null };
      return {
        _api: api,
        _workspace: workspace,
        _loads: loads,
        _toasts: inject(CwToastService),
        _document: inject(DOCUMENT),
        _realtime: inject(RealtimeConnection, { optional: true }),
        _opener: inject(TaskDetailOpener),
        _spaces: inject(SPACE_DIRECTORY, { optional: true })?.spaces ?? signal([]),
        _lists: inject(LIST_DIRECTORY, { optional: true })?.lists ?? signal([]),
        goals: resource({
          params: (): { organizationId: string } => ({
            organizationId: workspace.organization().id,
          }),
          loader: async ({ params }: { params: { organizationId: string } }): Promise<GoalList> => {
            const background: boolean = loads.background;
            loads.background = false;
            const issued: number = store._readsIssued() + 1;
            patchState(store, { _readsIssued: issued });
            const now: Date = new Date();
            try {
              const list: GoalList = await api.list(quarterOf(now), todayIso(now), background);
              loads.last = { organizationId: params.organizationId, list };
              patchState(store, {
                _writes: store
                  ._writes()
                  .filter(
                    (write: GoalWrite): boolean =>
                      write.organizationId !== params.organizationId || write.after >= issued,
                  ),
              });
              return list;
            } catch (error: unknown) {
              if (background && loads.last?.organizationId === params.organizationId)
                return loads.last.list;
              throw error;
            }
          },
        }),
        _people: resource({
          params: (): { organizationId: string } => ({
            organizationId: workspace.organization().id,
          }),
          loader: (): Promise<readonly Person[]> => api.owners(false),
        }),
      };
    }),
    withComputed((store) => {
      const organizationId: () => string = (): string => store._workspace.organization().id;
      const people: Signal<ReadonlyMap<string, string> | null> = computed(() =>
        store._people.hasValue()
          ? new Map<string, string>(
              store._people
                .value()
                .map((person: Person): [string, string] => [person.id, person.name]),
            )
          : null,
      );
      const roles: Signal<ReadonlyMap<string, SpaceDirectoryEntry>> = computed(
        () =>
          new Map<string, SpaceDirectoryEntry>(
            store
              ._spaces()
              .map((space: SpaceDirectoryEntry): [string, SpaceDirectoryEntry] => [
                space.id,
                space,
              ]),
          ),
      );
      const canWrite: (goal: Goal) => boolean = (goal: Goal): boolean =>
        goal.spaceId === null
          ? store._workspace.can('admin')
          : roles().get(goal.spaceId)?.callerRole === 'edit';
      const confirmed: Signal<readonly Goal[] | undefined> = computed(() => {
        const list: GoalList | undefined = store.goals.value();
        return list === undefined
          ? undefined
          : applyWrites(list.goals, store._writes(), organizationId());
      });
      const list: Signal<readonly GoalView[] | undefined> = computed(() => {
        const goals: readonly Goal[] | undefined = confirmed();
        if (goals === undefined) return undefined;
        const names: ReadonlyMap<string, string> | null = people();
        const user: { id: string; name: string } = store._workspace.user();
        const hidden: ReadonlySet<string> = new Set<string>(store._hidden());
        const edits: Readonly<Record<string, number | boolean>> = store._edits();
        return goals.map((goal: Goal): GoalView => ({
          goal: applyEdits(goal, edits, hidden),
          ownerName:
            names?.get(goal.ownerUserId) ??
            (goal.ownerUserId === user.id
              ? user.name
              : names === null
                ? null
                : $localize`:@@goals.goal.former-member:Former member`),
          canWrite: canWrite(goal),
        }));
      });
      return {
        _confirmed: confirmed,
        list,
        quarter: computed((): Quarter | null =>
          store.goals.hasValue() ? store.goals.value().quarter : null,
        ),
        stats: computed((): GoalStats => {
          const goals: readonly GoalView[] = (store.goals.hasValue() ? list() : undefined) ?? [];
          const count: number = goals.length;
          const health: (...values: readonly string[]) => number = (
            ...values: readonly string[]
          ): number =>
            goals.filter((view: GoalView): boolean => values.includes(view.goal.health ?? ''))
              .length;
          return {
            count,
            averagePercent:
              count === 0
                ? 0
                : Math.round(
                    goals.reduce(
                      (sum: number, view: GoalView): number => sum + view.goal.progressPercent,
                      0,
                    ) / count,
                  ),
            expectedPercent: store.goals.hasValue()
              ? Math.round(store.goals.value().expectedProgressPercent)
              : 0,
            onTrack: health('achieved', 'on-track'),
            achieved: health('achieved'),
            atRisk: health('at-risk', 'behind'),
          };
        }),
        isEmpty: computed(
          (): boolean => store.goals.hasValue() && (confirmed() ?? []).length === 0,
        ),
        spaceOptions: computed((): readonly GoalSpaceOption[] | null =>
          store._workspace.can('admin')
            ? null
            : store
                ._spaces()
                .filter((space: SpaceDirectoryEntry): boolean => space.callerRole === 'edit')
                .map((space: SpaceDirectoryEntry): GoalSpaceOption => ({
                  id: space.id,
                  name: space.name,
                })),
        ),
        owners: computed((): readonly Person[] => {
          if (store._people.hasValue() && store._people.value().length > 0)
            return store._people.value();
          const user: { id: string; name: string; initials: string } = store._workspace.user();
          return [{ id: user.id, name: user.name, initials: user.initials, avatar: null }];
        }),
        userId: computed((): string => store._workspace.user().id),
        listNames: computed(
          (): ReadonlyMap<string, string> =>
            new Map<string, string>(
              store
                ._lists()
                .map((entry: ListDirectoryEntry): [string, string] => [entry.id, entry.name]),
            ),
        ),
        milestoneKeys: computed(
          (): readonly string[] => {
            const keys: Set<string> = new Set<string>();
            for (const goal of (store.goals.hasValue() ? confirmed() : undefined) ?? [])
              for (const result of goal.results)
                if (result.kind === 'milestone') keys.add(result.taskKey);
            return [...keys].sort();
          },
          {
            equal: (a: readonly string[], b: readonly string[]): boolean =>
              a.length === b.length && a.every((key: string, index: number) => key === b[index]),
          },
        ),
      };
    }),
    withComputed((store) => ({
      canCreate: computed(
        (): boolean => store._workspace.can('admin') || (store.spaceOptions() ?? []).length > 0,
      ),
    })),
    withMethods((store) => {
      const organizationId: () => string = (): string => store._workspace.organization().id;
      const today: () => string = (): string => todayIso(new Date());
      const ensureOrganization: (organization: string) => void = (organization: string): void => {
        if (organization !== organizationId()) throw new WriteDroppedError();
      };
      const mismatched: (error: unknown, organization: string) => boolean = (
        error: unknown,
        organization: string,
      ): boolean =>
        error instanceof WriteDroppedError ||
        error instanceof OrganizationSwitchPendingError ||
        hasProblemCode(error, 'organization.context-changed') ||
        organization !== organizationId();
      const record: (write: GoalWrite) => void = (write: GoalWrite): void => {
        patchState(store, { _writes: [...store._writes(), write] });
      };
      const shown: (goalId: string) => Goal | undefined = (goalId: string): Goal | undefined =>
        (store.goals.hasValue() ? store._confirmed() : undefined)?.find(
          (goal: Goal): boolean => goal.id === goalId,
        );
      const resultOf: (goalId: string, resultId: string) => KeyResult | undefined = (
        goalId: string,
        resultId: string,
      ): KeyResult | undefined =>
        shown(goalId)?.results.find((result: KeyResult): boolean => result.id === resultId);
      const failed: (title: string) => void = (title: string): void => {
        store._toasts.error(title, {
          description: $localize`:@@goals.toast.failed-text:Try again in a moment.`,
        });
      };
      const dropEdit: (resultId: string) => void = (resultId: string): void => {
        patchState(store, {
          _edits: Object.fromEntries(
            Object.entries(store._edits()).filter(
              ([id]: [string, number | boolean]) => id !== resultId,
            ),
          ),
        });
      };
      const unhide: (resultId: string) => void = (resultId: string): void => {
        patchState(store, {
          _hidden: store._hidden().filter((id: string): boolean => id !== resultId),
        });
      };
      const refresh: () => void = (): void => {
        if (store.goals.isLoading()) {
          store._loads.queued = true;
          return;
        }
        if (!store.goals.hasValue()) return;
        store._loads.background = true;
        store.goals.reload();
      };

      const lanes: Map<string, Promise<void>> = new Map<string, Promise<void>>();
      const dirty: Set<string> = new Set<string>();
      const scheduled: Set<string> = new Set<string>();
      const reread: (goalId: string, organization: string) => Promise<void> = async (
        goalId: string,
        organization: string,
      ): Promise<void> => {
        try {
          ensureOrganization(organization);
          const goal: Goal = await store._api.get(goalId, today());
          if (organization !== organizationId()) return;
          record({ organizationId: organization, after: store._readsIssued(), kind: 'goal', goal });
        } catch (error: unknown) {
          if (organization !== organizationId()) return;
          if (isGone(error))
            record({
              organizationId: organization,
              after: store._readsIssued(),
              kind: 'removed',
              goalId,
            });
          else refresh();
        }
      };
      const inLane: (goalId: string, task: () => Promise<void>) => Promise<void> = (
        goalId: string,
        task: () => Promise<void>,
      ): Promise<void> => {
        const organization: string = organizationId();
        const run: Promise<void> = (lanes.get(goalId) ?? Promise.resolve()).then(task);
        const tail: Promise<void> = run.catch((): void => undefined);
        lanes.set(goalId, tail);
        void tail.then((): void => {
          if (lanes.get(goalId) !== tail) return;
          lanes.delete(goalId);
          if (!dirty.delete(goalId) || organization !== organizationId()) return;
          void inLane(goalId, () => reread(goalId, organization));
        });
        return run;
      };
      const send: <T>(
        organization: string,
        goalId: string,
        operation: (version: number) => Promise<T>,
      ) => Promise<T> = async <T>(
        organization: string,
        goalId: string,
        operation: (version: number) => Promise<T>,
      ): Promise<T> => {
        ensureOrganization(organization);
        const goal: Goal | undefined = shown(goalId);
        if (goal === undefined) throw new WriteDroppedError();
        try {
          return await operation(goal.version);
        } catch (error: unknown) {
          if (!isVersionMismatch(error)) throw error;
          const fresh: Goal = await store._api.get(goalId, today());
          ensureOrganization(organization);
          record({
            organizationId: organization,
            after: store._readsIssued(),
            kind: 'goal',
            goal: fresh,
          });
          return operation(fresh.version);
        }
      };
      const flush: (
        goalId: string,
        resultId: string,
        organization: string,
      ) => Promise<void> = async (
        goalId: string,
        resultId: string,
        organization: string,
      ): Promise<void> => {
        scheduled.delete(resultId);
        if (organization !== organizationId()) return;
        const edits: Readonly<Record<string, number | boolean>> = store._edits();
        if (!(resultId in edits)) return;
        const wanted: number | boolean = edits[resultId];
        const result: KeyResult | undefined = resultOf(goalId, resultId);
        if (
          result === undefined ||
          (result.kind === 'number' && result.currentValue === wanted) ||
          (result.kind === 'checkbox' && result.checked === wanted)
        ) {
          dropEdit(resultId);
          return;
        }
        try {
          const write: KeyResultWrite = await send(organization, goalId, (version: number) =>
            store._api.updateResult(
              goalId,
              resultId,
              version,
              typeof wanted === 'number' ? { currentValue: wanted } : { checked: wanted },
            ),
          );
          if (organization !== organizationId()) return;
          if (write.result !== null)
            record({
              organizationId: organization,
              after: store._readsIssued(),
              kind: 'result',
              goalId,
              result: write.result,
              version: write.version,
            });
          dirty.add(goalId);
          if (store._edits()[resultId] === wanted) dropEdit(resultId);
        } catch (error: unknown) {
          if (mismatched(error, organization)) return;
          dropEdit(resultId);
          if (isUncertainWrite(error) || isGone(error)) {
            refresh();
            return;
          }
          failed(
            $localize`:@@goals.toast.result-update-failed:The key result could not be updated`,
          );
        }
      };
      const schedule: (goalId: string, resultId: string) => void = (
        goalId: string,
        resultId: string,
      ): void => {
        if (scheduled.has(resultId)) return;
        scheduled.add(resultId);
        const organization: string = organizationId();
        void inLane(goalId, () => flush(goalId, resultId, organization));
      };

      return {
        refresh,
        async create(draft: GoalDraft): Promise<string | null> {
          const quarter: Quarter | null = store.quarter();
          if (store.creating() || quarter === null) return null;
          const organization: string = organizationId();
          const known: ReadonlySet<string> = new Set<string>(
            (store._confirmed() ?? []).map((goal: Goal): string => goal.id),
          );
          patchState(store, { creating: true });
          try {
            ensureOrganization(organization);
            const goal: Goal = await store._api.create(
              draft,
              quarter,
              today(),
              crypto.randomUUID(),
            );
            if (organization !== organizationId()) return null;
            record({
              organizationId: organization,
              after: store._readsIssued(),
              kind: 'goal',
              goal,
            });
            store._toasts.success($localize`:@@goals.toast.created:Goal created`, {
              description: goal.name,
            });
            return goal.id;
          } catch (error: unknown) {
            if (mismatched(error, organization)) return null;
            if (!isUncertainWrite(error)) {
              failed(
                hasProblemCode(error, 'goal.owner-ineligible')
                  ? $localize`:@@goals.toast.owner-ineligible:This person cannot read the goal`
                  : $localize`:@@goals.toast.create-failed:The goal could not be created`,
              );
              return null;
            }
            try {
              const now: Date = new Date();
              const list: GoalList = await store._api.list(quarter, todayIso(now), false);
              if (organization !== organizationId()) return null;
              const goal: Goal | undefined = list.goals.find(
                (item: Goal): boolean => item.name === draft.name && !known.has(item.id),
              );
              if (goal === undefined) return null;
              record({
                organizationId: organization,
                after: store._readsIssued(),
                kind: 'goal',
                goal,
              });
              store._toasts.success($localize`:@@goals.toast.created:Goal created`, {
                description: goal.name,
              });
              return goal.id;
            } catch {
              return null;
            }
          } finally {
            patchState(store, { creating: false });
          }
        },
        async remove(goalId: string): Promise<boolean> {
          const goal: Goal | undefined = shown(goalId);
          if (store.deletingId() !== null || goal === undefined) return false;
          const organization: string = organizationId();
          const removed: () => boolean = (): boolean => {
            record({
              organizationId: organization,
              after: store._readsIssued(),
              kind: 'removed',
              goalId,
            });
            store._toasts.success($localize`:@@goals.toast.deleted:Goal deleted`, {
              description: goal.name,
            });
            return true;
          };
          patchState(store, { deletingId: goalId });
          let outcome: boolean = false;
          await inLane(goalId, async (): Promise<void> => {
            try {
              await send(organization, goalId, (version: number) =>
                store._api.delete(goalId, version),
              );
              if (organization === organizationId()) outcome = removed();
            } catch (error: unknown) {
              if (mismatched(error, organization)) return;
              if (isGone(error)) {
                outcome = removed();
                return;
              }
              if (!isUncertainWrite(error)) {
                failed($localize`:@@goals.toast.delete-failed:The goal could not be deleted`);
                return;
              }
              try {
                const fresh: Goal = await store._api.get(goalId, today());
                if (organization !== organizationId()) return;
                record({
                  organizationId: organization,
                  after: store._readsIssued(),
                  kind: 'goal',
                  goal: fresh,
                });
              } catch (reread: unknown) {
                if (organization === organizationId() && isGone(reread)) outcome = removed();
              }
            }
          });
          if (organization === organizationId()) patchState(store, { deletingId: null });
          return outcome;
        },
        step(goalId: string, resultId: string, direction: 1 | -1): void {
          const result: KeyResult | undefined = resultOf(goalId, resultId);
          const goal: Goal | undefined = shown(goalId);
          if (result?.kind !== 'number' || goal === undefined) return;
          const edit: number | boolean | undefined = store._edits()[resultId];
          const base: number = typeof edit === 'number' ? edit : result.currentValue;
          const size: number = Math.max(
            1,
            Math.round(Math.abs(result.targetValue - result.startValue) / 20),
          );
          const down: boolean = result.targetValue < result.startValue;
          patchState(store, {
            _edits: { ...store._edits(), [resultId]: base + direction * (down ? -size : size) },
          });
          schedule(goalId, resultId);
        },
        toggle(goalId: string, resultId: string): void {
          const result: KeyResult | undefined = resultOf(goalId, resultId);
          if (result?.kind !== 'checkbox') return;
          const edit: number | boolean | undefined = store._edits()[resultId];
          const checked: boolean = typeof edit === 'boolean' ? edit : result.checked;
          patchState(store, { _edits: { ...store._edits(), [resultId]: !checked } });
          schedule(goalId, resultId);
        },
        async addResult(goalId: string, draft: KeyResultDraft): Promise<boolean> {
          if (store.addingTo() !== null || shown(goalId) === undefined) return false;
          const organization: string = organizationId();
          const known: ReadonlySet<string> = new Set<string>(
            shown(goalId)?.results.map((result: KeyResult): string => result.id) ?? [],
          );
          const idempotencyKey: string = crypto.randomUUID();
          let outcome: boolean = false;
          patchState(store, { addingTo: goalId });
          await inLane(goalId, async (): Promise<void> => {
            try {
              const write: KeyResultWrite = await send(organization, goalId, (version: number) =>
                store._api.createResult(goalId, version, draft, idempotencyKey),
              );
              if (organization !== organizationId()) return;
              if (write.result !== null)
                record({
                  organizationId: organization,
                  after: store._readsIssued(),
                  kind: 'result',
                  goalId,
                  result: write.result,
                  version: write.version,
                });
              dirty.add(goalId);
              outcome = true;
            } catch (error: unknown) {
              if (mismatched(error, organization)) return;
              if (!isUncertainWrite(error)) {
                if (isGone(error)) refresh();
                failed(
                  hasProblemCode(error, 'goal.result-limit-reached')
                    ? $localize`:@@goals.toast.result-limit:This goal already has 20 key results`
                    : $localize`:@@goals.toast.result-add-failed:The key result could not be added`,
                );
                return;
              }
              try {
                const fresh: Goal = await store._api.get(goalId, today());
                if (organization !== organizationId()) return;
                record({
                  organizationId: organization,
                  after: store._readsIssued(),
                  kind: 'goal',
                  goal: fresh,
                });
                outcome = fresh.results.some(
                  (result: KeyResult): boolean =>
                    !known.has(result.id) && result.label === draft.label,
                );
              } catch {
                refresh();
              }
            }
          });
          if (organization === organizationId()) patchState(store, { addingTo: null });
          return outcome;
        },
        removeResult(goalId: string, resultId: string): void {
          if (resultOf(goalId, resultId) === undefined || store._hidden().includes(resultId))
            return;
          const organization: string = organizationId();
          patchState(store, { _hidden: [...store._hidden(), resultId] });
          void inLane(goalId, async (): Promise<void> => {
            try {
              await send(organization, goalId, (version: number) =>
                store._api.deleteResult(goalId, resultId, version),
              );
              if (organization !== organizationId()) return;
              record({
                organizationId: organization,
                after: store._readsIssued(),
                kind: 'result-removed',
                goalId,
                resultId,
              });
              dirty.add(goalId);
              unhide(resultId);
            } catch (error: unknown) {
              if (mismatched(error, organization)) return;
              unhide(resultId);
              if (isUncertainWrite(error) || isGone(error)) {
                refresh();
                return;
              }
              failed(
                $localize`:@@goals.toast.result-remove-failed:The key result could not be removed`,
              );
            }
          });
        },
        _settled: signalMethod<boolean>((loading: boolean): void => {
          if (loading || !store._loads.queued) return;
          store._loads.queued = false;
          refresh();
        }),
        _followOrganization: signalMethod<string>((): void => {
          patchState(store, { _edits: {}, _hidden: [], deletingId: null, addingTo: null });
          scheduled.clear();
          dirty.clear();
          store._loads.queued = false;
        }),
      };
    }),
    withHooks({
      onInit(store): void {
        store._followOrganization(computed((): string => store._workspace.organization().id));
        store._settled(computed((): boolean => store.goals.isLoading()));
        const view: Window | null = store._document.defaultView;
        const triggers: Observable<unknown>[] = [
          store._realtime?.reconnected ?? EMPTY,
          store._opener.closed,
          store._opener.changed,
          fromEvent(store._document, 'visibilitychange').pipe(
            filter((): boolean => store._document.visibilityState === 'visible'),
          ),
        ];
        if (view !== null) triggers.push(fromEvent(view, 'focus'));
        merge(...triggers)
          .pipe(auditTime(REFRESH_AUDIT_MS), takeUntilDestroyed())
          .subscribe((): void => {
            store.refresh();
          });
      },
    }),
  );
}

/**
 * Constant GoalsStore
 *
 * @description
 * State of the goals page, provided by its page. It reads every goal of the current quarter of the
 * workspace's organization once, again after a switch, and in the background on a focus, a
 * visible tab, a realtime reconnection (no goal notice exists, gap G-R2) and when a task detail
 * closes or reports a change (milestones and lists move with task writes elsewhere). A background
 * read keeps the goals shown while it runs and when it fails; only the first read of an
 * organization reaches the error boundary. Its own confirmed writes stay over the read goals until
 * a read issued after them lands, so neither a read in progress nor an older one hides them. The
 * writes of one goal are sent one after the other, each from the version the previous one
 * returned (`If-Match`), with one retry from the current version after a `412`; once a goal's
 * writes settle, the goal is read again for its progress and health. Every write is bound to the
 * organization it started in: after a switch nothing more is sent, patched or toasted. An unknown
 * outcome (no answer, a `5xx`) is settled by a read, never reported as a failure.
 *
 * @type {ReturnType<typeof createGoalsStore>}
 */
export const GoalsStore: ReturnType<typeof createGoalsStore> = createGoalsStore();
