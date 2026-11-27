import { DOCUMENT } from '@angular/common';
import {
  computed,
  DestroyRef,
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

  /**
   * Property _peopleRequest
   *
   * @description
   * How many times the members were asked for again (after a failure, or for owners they did not
   * name); each change reads them again.
   *
   * @type {number}
   */
  _peopleRequest: number;
  // #endregion
}

/**
 * Constant RETRY_DELAY_MS
 *
 * @description
 * Wait, in milliseconds, before a creation of unknown outcome is sent again with its idempotency
 * key, so a request still running on the gateway (`409 idempotency.request-in-progress`) can end.
 *
 * @type {number}
 */
export const RETRY_DELAY_MS: number = 1000;

/**
 * Constant CREATE_ATTEMPTS
 *
 * @description
 * Sends of one creation, the first included, before its outcome is reported as unknown.
 *
 * @type {number}
 */
export const CREATE_ATTEMPTS: number = 3;

/**
 * Interface GoalsContext
 *
 * @description
 * Which organization generation the writes belong to and whether the page is gone.
 */
interface GoalsContext {
  // #region Properties
  /**
   * Property generation
   *
   * @description
   * Organization switches so far; a write of an older generation sends, patches and toasts
   * nothing more, even after switching back.
   *
   * @type {number}
   */
  generation: number;

  /**
   * Property destroyed
   *
   * @description
   * Whether the page that provided the store is gone: the writes already queued are still sent,
   * but nothing is read again.
   *
   * @type {boolean}
   */
  destroyed: boolean;
  // #endregion
}

/**
 * Interface GoalLane
 *
 * @description
 * The write queue of one goal: its last write and the last version the gateway named for it.
 */
interface GoalLane {
  // #region Properties
  /**
   * Property tail
   *
   * @description
   * Settles once the last queued write of the goal settled.
   *
   * @type {Promise<void>}
   */
  tail: Promise<void>;

  /**
   * Property version
   *
   * @description
   * The goal's last known version, sent as `If-Match`; the newer of the goal shown and the last
   * write or read of the queue, kept once the page is gone.
   *
   * @type {number | null}
   */
  version: number | null;

  /**
   * Property dirty
   *
   * @description
   * Whether a write changed the goal's key results since it was last read; the goal is read again
   * once its queue is idle.
   *
   * @type {boolean}
   */
  dirty: boolean;
  // #endregion
}

/**
 * Interface EditRecord
 *
 * @description
 * What a key result edit started from and what the gateway last confirmed for it.
 */
interface EditRecord {
  // #region Properties
  /**
   * Property start
   *
   * @description
   * The confirmed value when the edit started; a stale version retries only while the goal read
   * again still shows it.
   *
   * @type {number | boolean}
   */
  start: number | boolean;

  /**
   * Property confirmed
   *
   * @description
   * The value the gateway last confirmed.
   *
   * @type {number | boolean}
   */
  confirmed: number | boolean;
  // #endregion
}

/**
 * Interface PeopleRead
 *
 * @description
 * A read of the members, with the owner ids it was asked to check.
 */
interface PeopleRead {
  // #region Properties
  /**
   * Property people
   *
   * @description
   * The members who may own a goal.
   *
   * @type {readonly Person[]}
   * @readonly
   */
  readonly people: readonly Person[];

  /**
   * Property checked
   *
   * @description
   * Owner ids the read was sent for; those it does not name are former members.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly checked: readonly string[];
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
  _peopleRequest: 0,
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

  /**
   * Property landed
   *
   * @description
   * Issue number of the newest read that landed; a snapshot of one goal sent before it is already
   * reflected, so it is not kept over the goals.
   *
   * @type {number}
   */
  landed: number;
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
   * Creates a goal in the quarter shown and toasts `Goal created` with its name. The draft keeps
   * one idempotency key until a definitive answer: after an unknown outcome or
   * `409 idempotency.request-in-progress`, the same request is sent again with it after
   * `RETRY_DELAY_MS`, up to `CREATE_ATTEMPTS` sends, then the warning `The goal could not be
   * confirmed` asks to create it again, which reuses the key so it is never created twice. A
   * refusal toasts the failure. Bound to the organization generation it started in. Ignored while
   * a creation runs.
   *
   * @param {GoalDraft} draft - What the form submitted.
   * @returns {Promise<string | null>} The id of the new goal, or null when none is known.
   */
  create(draft: GoalDraft): Promise<string | null>;

  /**
   * Method remove
   *
   * @description
   * Deletes a goal after its confirmation, from the version its queue knows (once more from the
   * current version after a `412`), and toasts `Goal deleted` with its name; a goal already gone
   * counts as deleted. An unknown outcome reads the goal again: gone, it counts as deleted;
   * still there, the warning `The deletion could not be confirmed` shows. A refusal toasts the
   * failure. Ignored while a deletion runs.
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
   * Adds a number key result from 0 towards its target, after the goal's other writes, with an
   * idempotency key kept like `create`'s (a new one after a `412`, which reads the goal first). An
   * outcome still unknown after the retries shows `The key result could not be confirmed`. A
   * refusal toasts the failure.
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
 * Function isUncertainCreation
 *
 * @description
 * Whether a creation sent with an idempotency key may still be recorded: an unknown outcome, or
 * the same key still running on the gateway (`409 idempotency.request-in-progress`).
 *
 * @param {unknown} error - The failure.
 * @returns {boolean} Whether to send it again with the same key.
 */
function isUncertainCreation(error: unknown): boolean {
  return isUncertainWrite(error) || hasProblemCode(error, 'idempotency.request-in-progress');
}

/**
 * Function wait
 *
 * @description
 * Resolves after a delay.
 *
 * @param {number} ms - The delay, in milliseconds.
 * @returns {Promise<void>} Resolves once elapsed.
 */
function wait(ms: number): Promise<void> {
  return new Promise<void>((done: () => void): void => {
    setTimeout(done, ms);
  });
}

/**
 * Function valueOf
 *
 * @description
 * The editable value of a key result: the current value of a number, the state of a checkbox.
 *
 * @param {KeyResult | undefined} result - The key result.
 * @returns {number | boolean | null} Its value, or null for another kind or none.
 */
function valueOf(result: KeyResult | undefined): number | boolean | null {
  if (result?.kind === 'number') return result.currentValue;
  if (result?.kind === 'checkbox') return result.checked;
  return null;
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
      const loads: GoalsLoads = { background: false, queued: false, last: null, landed: 0 };
      const context: GoalsContext = { generation: 0, destroyed: false };
      inject(DestroyRef).onDestroy((): void => {
        context.destroyed = true;
      });
      let ownersAsked: readonly string[] = [];
      return {
        _api: api,
        _workspace: workspace,
        _loads: loads,
        _context: context,
        _toasts: inject(CwToastService),
        _document: inject(DOCUMENT),
        _realtime: inject(RealtimeConnection, { optional: true }),
        _opener: inject(TaskDetailOpener),
        _spaces: inject(SPACE_DIRECTORY, { optional: true })?.spaces ?? signal([]),
        _lists: inject(LIST_DIRECTORY, { optional: true })?.lists ?? signal([]),
        _askOwners(ids: readonly string[]): void {
          ownersAsked = ids;
        },
        goals: resource({
          params: (): { organizationId: string } => ({
            organizationId: workspace.organization().id,
          }),
          loader: async ({
            params,
            abortSignal,
          }: {
            params: { organizationId: string };
            abortSignal: AbortSignal;
          }): Promise<GoalList> => {
            const background: boolean = loads.background;
            loads.background = false;
            const issued: number = store._readsIssued() + 1;
            patchState(store, { _readsIssued: issued });
            const now: Date = new Date();
            try {
              const list: GoalList = await api.list(
                quarterOf(now),
                todayIso(now),
                background,
                abortSignal,
              );
              if (abortSignal.aborted) return list;
              loads.last = { organizationId: params.organizationId, list };
              loads.landed = Math.max(loads.landed, issued);
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
              if (
                !abortSignal.aborted &&
                background &&
                loads.last?.organizationId === params.organizationId
              )
                return loads.last.list;
              throw error;
            }
          },
        }),
        _people: resource({
          params: (): { organizationId: string; request: number } => ({
            organizationId: workspace.organization().id,
            request: store._peopleRequest(),
          }),
          loader: async (): Promise<PeopleRead> => {
            const checked: readonly string[] = ownersAsked;
            return { people: await api.owners(false), checked };
          },
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
                .people.map((person: Person): [string, string] => [person.id, person.name]),
            )
          : null,
      );
      const former: Signal<ReadonlySet<string>> = computed((): ReadonlySet<string> => {
        const names: ReadonlyMap<string, string> | null = people();
        if (names === null || !store._people.hasValue()) return new Set<string>();
        return new Set<string>(
          store._people.value().checked.filter((id: string): boolean => !names.has(id)),
        );
      });
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
        const gone: ReadonlySet<string> = former();
        const user: { id: string; name: string } = store._workspace.user();
        const hidden: ReadonlySet<string> = new Set<string>(store._hidden());
        const edits: Readonly<Record<string, number | boolean>> = store._edits();
        return goals.map((goal: Goal): GoalView => {
          const owner: string = goal.ownerUserId;
          return {
            goal: applyEdits(goal, edits, hidden),
            ownerName:
              names?.get(owner) ??
              (owner === user.id
                ? user.name
                : gone.has(owner)
                  ? $localize`:@@goals.goal.former-member:Former member`
                  : null),
            canWrite: canWrite(goal),
          };
        });
      });
      return {
        _confirmed: confirmed,
        _unknownOwners: computed((): string | null => {
          if (!store.goals.hasValue() || store._people.isLoading()) return null;
          const names: ReadonlyMap<string, string> = people() ?? new Map<string, string>();
          const user: string = store._workspace.user().id;
          const ids: Set<string> = new Set<string>();
          for (const goal of confirmed() ?? [])
            if (!names.has(goal.ownerUserId) && goal.ownerUserId !== user)
              ids.add(goal.ownerUserId);
          return ids.size === 0 ? null : [...ids].sort().join(' ');
        }),
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
          if (store._people.hasValue() && store._people.value().people.length > 0)
            return store._people.value().people;
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
      const context: GoalsContext = store._context;
      const today: () => string = (): string => todayIso(new Date());
      const current: (generation: number) => boolean = (generation: number): boolean =>
        generation === context.generation;
      const alive: (generation: number) => boolean = (generation: number): boolean =>
        current(generation) && !context.destroyed;
      const guard: (generation: number) => void = (generation: number): void => {
        if (!current(generation)) throw new WriteDroppedError();
      };
      const dropped: (error: unknown, generation: number) => boolean = (
        error: unknown,
        generation: number,
      ): boolean =>
        error instanceof WriteDroppedError ||
        error instanceof OrganizationSwitchPendingError ||
        hasProblemCode(error, 'organization.context-changed') ||
        !current(generation);
      const organizationId: () => string = (): string => store._workspace.organization().id;
      const record: (write: GoalWrite) => void = (write: GoalWrite): void => {
        patchState(store, { _writes: [...store._writes(), write] });
      };
      const shown: (goalId: string) => Goal | undefined = (goalId: string): Goal | undefined =>
        (context.destroyed || !store.goals.hasValue() ? undefined : store._confirmed())?.find(
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
      const records: Map<string, EditRecord> = new Map<string, EditRecord>();
      let lastAsked: string | null = null;
      const dropEdit: (resultId: string, only?: number | boolean) => boolean = (
        resultId: string,
        only?: number | boolean,
      ): boolean => {
        const edits: Readonly<Record<string, number | boolean>> = store._edits();
        if (!(resultId in edits) || (only !== undefined && edits[resultId] !== only)) return false;
        records.delete(resultId);
        patchState(store, {
          _edits: Object.fromEntries(
            Object.entries(edits).filter(([id]: [string, number | boolean]) => id !== resultId),
          ),
        });
        return true;
      };
      const unhide: (resultId: string) => void = (resultId: string): void => {
        patchState(store, {
          _hidden: store._hidden().filter((id: string): boolean => id !== resultId),
        });
      };
      const refresh: () => void = (): void => {
        if (context.destroyed) return;
        if (store._people.status() === 'error')
          patchState(store, { _peopleRequest: store._peopleRequest() + 1 });
        if (store.goals.isLoading()) {
          store._loads.queued = true;
          return;
        }
        if (!store.goals.hasValue()) return;
        store._loads.background = true;
        store.goals.reload();
      };

      const lanes: Map<string, GoalLane> = new Map<string, GoalLane>();
      const scheduled: Set<string> = new Set<string>();
      const laneOf: (goalId: string) => GoalLane = (goalId: string): GoalLane => {
        let lane: GoalLane | undefined = lanes.get(goalId);
        if (lane === undefined) {
          lane = { tail: Promise.resolve(), version: null, dirty: false };
          lanes.set(goalId, lane);
        }
        const version: number | undefined = shown(goalId)?.version;
        if (version !== undefined && (lane.version === null || version > lane.version))
          lane.version = version;
        return lane;
      };
      const fresh: (goalId: string, generation: number) => Promise<Goal> = async (
        goalId: string,
        generation: number,
      ): Promise<Goal> => {
        guard(generation);
        const issued: number = store._readsIssued();
        const goal: Goal = await store._api.get(goalId, today());
        guard(generation);
        laneOf(goalId).version = goal.version;
        if (store._loads.landed <= issued)
          record({ organizationId: organizationId(), after: issued, kind: 'goal', goal });
        return goal;
      };
      const reread: (goalId: string, generation: number) => Promise<void> = async (
        goalId: string,
        generation: number,
      ): Promise<void> => {
        try {
          await fresh(goalId, generation);
        } catch (error: unknown) {
          if (!alive(generation) || dropped(error, generation)) return;
          if (isGone(error))
            record({
              organizationId: organizationId(),
              after: store._readsIssued(),
              kind: 'removed',
              goalId,
            });
          else refresh();
        }
      };
      const inLane: (
        goalId: string,
        generation: number,
        task: () => Promise<void>,
      ) => Promise<void> = (
        goalId: string,
        generation: number,
        task: () => Promise<void>,
      ): Promise<void> => {
        const lane: GoalLane = laneOf(goalId);
        const run: Promise<void> = lane.tail.then(task);
        const tail: Promise<void> = run.catch((): void => undefined);
        lane.tail = tail;
        void tail.then((): void => {
          if (lane.tail !== tail || !lane.dirty || !alive(generation)) return;
          lane.dirty = false;
          void inLane(goalId, generation, () => reread(goalId, generation));
        });
        return run;
      };
      const send: <T>(
        generation: number,
        goalId: string,
        operation: (version: number) => Promise<T>,
      ) => Promise<T> = <T>(
        generation: number,
        goalId: string,
        operation: (version: number) => Promise<T>,
      ): Promise<T> => {
        guard(generation);
        const version: number | null = laneOf(goalId).version;
        if (version === null) throw new WriteDroppedError();
        return operation(version);
      };
      const created: <T>(generation: number, operation: () => Promise<T>) => Promise<T> = async <T>(
        generation: number,
        operation: () => Promise<T>,
      ): Promise<T> => {
        for (let attempt: number = 1; ; attempt += 1) {
          guard(generation);
          try {
            return await operation();
          } catch (error: unknown) {
            if (!isUncertainCreation(error) || attempt >= CREATE_ATTEMPTS) throw error;
          }
          await wait(RETRY_DELAY_MS);
        }
      };
      const createKeys: Map<string, string> = new Map<string, string>();
      const keyOf: (draft: string) => string = (draft: string): string => {
        const known: string | undefined = createKeys.get(draft);
        if (known !== undefined) return known;
        const key: string = crypto.randomUUID();
        createKeys.set(draft, key);
        return key;
      };
      const settleUncertain: (
        goalId: string,
        resultId: string,
        generation: number,
        edit: EditRecord,
        sent: number | boolean,
      ) => Promise<void> = async (
        goalId: string,
        resultId: string,
        generation: number,
        edit: EditRecord,
        sent: number | boolean,
      ): Promise<void> => {
        let value: number | boolean | null;
        try {
          value = valueOf(
            (await fresh(goalId, generation)).results.find(
              (result: KeyResult): boolean => result.id === resultId,
            ),
          );
        } catch (error: unknown) {
          if (dropped(error, generation)) return;
          dropEdit(resultId, sent);
          refresh();
          return;
        }
        if (value === null) {
          dropEdit(resultId);
          return;
        }
        if (value === sent) {
          edit.start = sent;
          edit.confirmed = sent;
          dropEdit(resultId, sent);
          return;
        }
        const edits: Readonly<Record<string, number | boolean>> = store._edits();
        edit.start = value;
        edit.confirmed = value;
        if (!(resultId in edits) || edits[resultId] === sent) {
          dropEdit(resultId);
          return;
        }
        const latest: number | boolean = edits[resultId];
        const rebased: number | boolean =
          typeof latest === 'number' && typeof sent === 'number' && typeof value === 'number'
            ? value + (latest - sent)
            : latest;
        if (rebased === value) {
          dropEdit(resultId);
          return;
        }
        patchState(store, { _edits: { ...store._edits(), [resultId]: rebased } });
      };
      const flush: (goalId: string, resultId: string, generation: number) => Promise<void> = async (
        goalId: string,
        resultId: string,
        generation: number,
      ): Promise<void> => {
        scheduled.delete(resultId);
        if (!current(generation)) return;
        const edits: Readonly<Record<string, number | boolean>> = store._edits();
        if (!(resultId in edits)) return;
        const edit: EditRecord | undefined = records.get(resultId);
        let wanted: number | boolean = edits[resultId];
        if (edit === undefined || wanted === edit.confirmed) {
          dropEdit(resultId, wanted);
          return;
        }
        const update: (version: number) => Promise<KeyResultWrite> = (version: number) =>
          store._api.updateResult(
            goalId,
            resultId,
            version,
            typeof wanted === 'number' ? { currentValue: wanted } : { checked: wanted },
          );
        try {
          let write: KeyResultWrite;
          try {
            write = await send(generation, goalId, update);
          } catch (error: unknown) {
            if (!isVersionMismatch(error)) throw error;
            const goal: Goal = await fresh(goalId, generation);
            const value: number | boolean | null = valueOf(
              goal.results.find((result: KeyResult): boolean => result.id === resultId),
            );
            if (value === null) {
              dropEdit(resultId);
              return;
            }
            if (value !== edit.start) {
              if (typeof value !== 'number' || typeof wanted !== 'number') {
                dropEdit(resultId);
                store._toasts.warning(
                  $localize`:@@goals.toast.changed-elsewhere:This key result changed elsewhere`,
                  {
                    description: $localize`:@@goals.toast.changed-elsewhere-text:It now shows its latest state.`,
                  },
                );
                return;
              }
              const start: number = edit.start as number;
              const latest: number | boolean | undefined = store._edits()[resultId];
              wanted = value + (wanted - start);
              edit.start = value;
              edit.confirmed = value;
              patchState(store, {
                _edits: {
                  ...store._edits(),
                  [resultId]: typeof latest === 'number' ? value + (latest - start) : wanted,
                },
              });
            }
            write = await send(generation, goalId, update);
          }
          if (!current(generation)) return;
          const lane: GoalLane = laneOf(goalId);
          lane.version = write.version ?? lane.version;
          lane.dirty = true;
          if (write.result !== null)
            record({
              organizationId: organizationId(),
              after: store._readsIssued(),
              kind: 'result',
              goalId,
              result: write.result,
              version: write.version,
            });
          edit.start = wanted;
          edit.confirmed = wanted;
          dropEdit(resultId, wanted);
        } catch (error: unknown) {
          if (dropped(error, generation)) return;
          if (isUncertainWrite(error)) {
            await settleUncertain(goalId, resultId, generation, edit, wanted);
            return;
          }
          dropEdit(resultId, wanted);
          if (isGone(error)) {
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
        const generation: number = context.generation;
        void inLane(goalId, generation, () => flush(goalId, resultId, generation));
      };
      const edit: (
        goalId: string,
        resultId: string,
        next: (value: number | boolean) => number | boolean,
      ) => void = (
        goalId: string,
        resultId: string,
        next: (value: number | boolean) => number | boolean,
      ): void => {
        const value: number | boolean | null = valueOf(resultOf(goalId, resultId));
        if (value === null) return;
        if (!records.has(resultId)) records.set(resultId, { start: value, confirmed: value });
        const edits: Readonly<Record<string, number | boolean>> = store._edits();
        const base: number | boolean = resultId in edits ? edits[resultId] : value;
        patchState(store, { _edits: { ...edits, [resultId]: next(base) } });
        schedule(goalId, resultId);
      };

      return {
        refresh,
        async create(draft: GoalDraft): Promise<string | null> {
          const quarter: Quarter | null = store.quarter();
          if (store.creating() || quarter === null) return null;
          const generation: number = context.generation;
          const draftKey: string = JSON.stringify([quarter.key, draft]);
          const idempotencyKey: string = keyOf(draftKey);
          patchState(store, { creating: true });
          try {
            const goal: Goal = await created(generation, () =>
              store._api.create(draft, quarter, today(), idempotencyKey),
            );
            createKeys.delete(draftKey);
            if (!current(generation)) return null;
            record({
              organizationId: organizationId(),
              after: store._readsIssued(),
              kind: 'goal',
              goal,
            });
            store._toasts.success($localize`:@@goals.toast.created:Goal created`, {
              description: goal.name,
            });
            return goal.id;
          } catch (error: unknown) {
            if (dropped(error, generation)) return null;
            if (isUncertainCreation(error)) {
              store._toasts.warning(
                $localize`:@@goals.toast.create-unknown:The goal could not be confirmed`,
                {
                  description: $localize`:@@goals.toast.create-unknown-text:Create it again: it will not be created twice.`,
                },
              );
              return null;
            }
            createKeys.delete(draftKey);
            failed(
              hasProblemCode(error, 'goal.owner-ineligible')
                ? $localize`:@@goals.toast.owner-ineligible:This person cannot read the goal`
                : $localize`:@@goals.toast.create-failed:The goal could not be created`,
            );
            return null;
          } finally {
            if (current(generation)) patchState(store, { creating: false });
          }
        },
        async remove(goalId: string): Promise<boolean> {
          const goal: Goal | undefined = shown(goalId);
          if (store.deletingId() !== null || goal === undefined) return false;
          const generation: number = context.generation;
          const removed: () => boolean = (): boolean => {
            record({
              organizationId: organizationId(),
              after: store._readsIssued(),
              kind: 'removed',
              goalId,
            });
            store._toasts.success($localize`:@@goals.toast.deleted:Goal deleted`, {
              description: goal.name,
            });
            return true;
          };
          const deletion: (version: number) => Promise<void> = (version: number) =>
            store._api.delete(goalId, version);
          patchState(store, { deletingId: goalId });
          let outcome: boolean = false;
          await inLane(goalId, generation, async (): Promise<void> => {
            try {
              try {
                await send(generation, goalId, deletion);
              } catch (error: unknown) {
                if (!isVersionMismatch(error)) throw error;
                await fresh(goalId, generation);
                await send(generation, goalId, deletion);
              }
              if (current(generation)) outcome = removed();
            } catch (error: unknown) {
              if (dropped(error, generation)) return;
              if (isGone(error)) {
                outcome = removed();
                return;
              }
              if (!isUncertainWrite(error)) {
                failed($localize`:@@goals.toast.delete-failed:The goal could not be deleted`);
                return;
              }
              try {
                await fresh(goalId, generation);
                store._toasts.warning(
                  $localize`:@@goals.toast.delete-unknown:The deletion could not be confirmed`,
                  {
                    description: $localize`:@@goals.toast.delete-unknown-text:The goal is still shown. Try again in a moment.`,
                  },
                );
              } catch (reread: unknown) {
                if (dropped(reread, generation)) return;
                if (isGone(reread)) {
                  outcome = removed();
                  return;
                }
                store._toasts.warning(
                  $localize`:@@goals.toast.delete-unknown:The deletion could not be confirmed`,
                  {
                    description: $localize`:@@goals.toast.delete-unknown-text:The goal is still shown. Try again in a moment.`,
                  },
                );
                refresh();
              }
            }
          });
          if (current(generation)) patchState(store, { deletingId: null });
          return outcome;
        },
        step(goalId: string, resultId: string, direction: 1 | -1): void {
          const result: KeyResult | undefined = resultOf(goalId, resultId);
          if (result?.kind !== 'number') return;
          const size: number = Math.max(
            1,
            Math.round(Math.abs(result.targetValue - result.startValue) / 20),
          );
          const down: boolean = result.targetValue < result.startValue;
          edit(
            goalId,
            resultId,
            (value: number | boolean): number =>
              (value as number) + direction * (down ? -size : size),
          );
        },
        toggle(goalId: string, resultId: string): void {
          if (resultOf(goalId, resultId)?.kind !== 'checkbox') return;
          edit(goalId, resultId, (value: number | boolean): boolean => !(value as boolean));
        },
        async addResult(goalId: string, draft: KeyResultDraft): Promise<boolean> {
          if (store.addingTo() !== null || shown(goalId) === undefined) return false;
          const generation: number = context.generation;
          const draftKey: string = JSON.stringify([goalId, draft]);
          let idempotencyKey: string = keyOf(draftKey);
          let outcome: boolean = false;
          const creation: (version: number) => Promise<KeyResultWrite> = (version: number) =>
            created(generation, () =>
              store._api.createResult(goalId, version, draft, idempotencyKey),
            );
          patchState(store, { addingTo: goalId });
          await inLane(goalId, generation, async (): Promise<void> => {
            try {
              let write: KeyResultWrite;
              try {
                write = await send(generation, goalId, creation);
              } catch (error: unknown) {
                if (!isVersionMismatch(error)) throw error;
                createKeys.delete(draftKey);
                idempotencyKey = keyOf(draftKey);
                await fresh(goalId, generation);
                write = await send(generation, goalId, creation);
              }
              createKeys.delete(draftKey);
              if (!current(generation)) return;
              const lane: GoalLane = laneOf(goalId);
              lane.version = write.version ?? lane.version;
              lane.dirty = true;
              if (write.result !== null)
                record({
                  organizationId: organizationId(),
                  after: store._readsIssued(),
                  kind: 'result',
                  goalId,
                  result: write.result,
                  version: write.version,
                });
              outcome = true;
            } catch (error: unknown) {
              if (dropped(error, generation)) return;
              if (isUncertainCreation(error)) {
                store._toasts.warning(
                  $localize`:@@goals.toast.result-add-unknown:The key result could not be confirmed`,
                  {
                    description: $localize`:@@goals.toast.result-add-unknown-text:Add it again: it will not be added twice.`,
                  },
                );
                return;
              }
              createKeys.delete(draftKey);
              if (isGone(error)) refresh();
              failed(
                hasProblemCode(error, 'goal.result-limit-reached')
                  ? $localize`:@@goals.toast.result-limit:This goal already has 20 key results`
                  : $localize`:@@goals.toast.result-add-failed:The key result could not be added`,
              );
            }
          });
          if (current(generation)) patchState(store, { addingTo: null });
          return outcome;
        },
        removeResult(goalId: string, resultId: string): void {
          if (resultOf(goalId, resultId) === undefined || store._hidden().includes(resultId))
            return;
          const generation: number = context.generation;
          const removal: (version: number) => Promise<void> = (version: number) =>
            store._api.deleteResult(goalId, resultId, version);
          patchState(store, { _hidden: [...store._hidden(), resultId] });
          void inLane(goalId, generation, async (): Promise<void> => {
            try {
              try {
                await send(generation, goalId, removal);
              } catch (error: unknown) {
                if (!isVersionMismatch(error)) throw error;
                await fresh(goalId, generation);
                await send(generation, goalId, removal);
              }
              if (!current(generation)) return;
              record({
                organizationId: organizationId(),
                after: store._readsIssued(),
                kind: 'result-removed',
                goalId,
                resultId,
              });
              laneOf(goalId).dirty = true;
              unhide(resultId);
            } catch (error: unknown) {
              if (dropped(error, generation)) return;
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
        _checkOwners: signalMethod<string | null>((ids: string | null): void => {
          if (ids === null) return;
          if (ids === lastAsked) return;
          lastAsked = ids;
          store._askOwners(ids.split(' '));
          patchState(store, { _peopleRequest: store._peopleRequest() + 1 });
        }),
        _followOrganization: signalMethod<string>((): void => {
          context.generation += 1;
          lastAsked = null;
          records.clear();
          scheduled.clear();
          createKeys.clear();
          store._loads.queued = false;
          patchState(store, {
            _edits: {},
            _hidden: [],
            deletingId: null,
            addingTo: null,
            creating: false,
          });
        }),
      };
    }),
    withHooks({
      onInit(store): void {
        store._followOrganization(computed((): string => store._workspace.organization().id));
        store._settled(computed((): boolean => store.goals.isLoading()));
        store._checkOwners(store._unknownOwners);
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
 * workspace's organization once, again after a switch, and in the background on a focus, a visible
 * tab, a realtime reconnection (no goal notice exists, gap G-R2) and when a task detail closes or
 * reports a change (milestones and lists move with task writes elsewhere). A superseded read is
 * aborted between its pages. A background read keeps the goals shown while it runs and when it
 * fails; only the first read of an organization reaches the error boundary. Its own confirmed
 * writes stay over the read goals until a read issued after them lands, a snapshot read of one goal
 * counting from when it was sent, so neither a read in progress nor an older one hides them. The
 * writes of one goal are sent one after the other from the version its queue last knew
 * (`If-Match`), kept once the page is gone so the last value of a burst is still sent; once a
 * goal's writes settle, it is read again for its progress and health, unless the page is gone. A
 * `412` reads the goal: an edit is sent again only while the goal still shows the value it started
 * from, a number moves by the same steps from a newer value, and a checkbox changed elsewhere is
 * dropped with a warning. A confirmed write moves the value an edit counts its steps from, so a
 * queued edit keeps only its unsent steps. A change of unknown outcome is settled by reading its
 * goal inside its queue, before any later edit of it is sent: recorded, the later edits follow it;
 * not recorded, only the steps made after it are kept, from the value read. Every write is bound to
 * the organization generation it started in: after a switch, even back to the same organization,
 * nothing more is sent, patched or toasted. A creation keeps its idempotency key until a definitive
 * answer and is sent again with it after an unknown outcome or
 * `409 idempotency.request-in-progress`, up to three times, then reported as unconfirmed; a resubmitted
 * identical draft reuses the key. The members are read again after a failure and for owners they
 * did not name, which read as former members only once a read says so.
 *
 * @type {ReturnType<typeof createGoalsStore>}
 */
export const GoalsStore: ReturnType<typeof createGoalsStore> = createGoalsStore();
