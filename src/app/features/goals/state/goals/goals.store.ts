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
import {
  auditTime,
  EMPTY,
  filter,
  fromEvent,
  merge,
  type Observable,
  type Subscription,
} from 'rxjs';

import { hasProblemCode, OrganizationPin, OrganizationSwitchPendingError } from '@core/api';
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
import { GOAL_EDIT_BURST_MS, GOAL_SETTLE_BACKOFF_MS } from './goals-timing.token';

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
 * Which organization and generation the writes belong to, whether the workspace left that
 * organization, and whether the page is gone.
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
   * Property organizationId
   *
   * @description
   * The organization of the current generation, the one the goals were read for: a write is sent,
   * and its answer applied, only while the workspace and `OrganizationPin` both still name it.
   *
   * @type {string}
   */
  organizationId: string;

  /**
   * Property left
   *
   * @description
   * Whether the pin was committed to another organization, or cleared, since the store adopted
   * its organization. `OrganizationPin.organizationChanges` sets it synchronously, and only a
   * reset of a live store clears it, so a write is never sent again once the workspace left the
   * organization, even back to it, within one tick or after the page is gone. A re-verification of
   * the same organization does not set it, so it drops nothing.
   *
   * @type {boolean}
   */
  left: boolean;

  /**
   * Property destroyed
   *
   * @description
   * Whether the page that provided the store is gone: the writes already queued are still sent,
   * with the reads of one goal they need (after a `412` or an unknown outcome), while the
   * workspace and the pin still name its organization and it was never left; the goals and a goal
   * whose queue went idle are not read again, and no background read is sent.
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
 * Interface PendingEdit
 *
 * @description
 * A key result edit waiting for the end of its burst of clicks.
 */
interface PendingEdit {
  // #region Properties
  /**
   * Property goalId
   *
   * @description
   * Goal of the key result.
   *
   * @type {string}
   * @readonly
   */
  readonly goalId: string;

  /**
   * Property generation
   *
   * @description
   * Organization generation of the clicks.
   *
   * @type {number}
   * @readonly
   */
  readonly generation: number;

  /**
   * Property handle
   *
   * @description
   * Timer that ends the burst.
   *
   * @type {ReturnType<typeof setTimeout>}
   * @readonly
   */
  readonly handle: ReturnType<typeof setTimeout>;
  // #endregion
}

/**
 * Interface Reconciliation
 *
 * @description
 * A catch-up read the goals shown still owe: a write completed while the workspace was away from
 * its organization, so only a read of the goals issued after it shows what it changed. A background
 * read that fails keeps the older goals, so the catch-up stays owed until a read issued after it
 * lands for that organization.
 */
interface Reconciliation {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * The organization whose goals must be read again.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property after
   *
   * @description
   * Reads of the goals issued when the catch-up was asked for; only a read with a greater issue
   * number is sent after the write completed.
   *
   * @type {number}
   * @readonly
   */
  readonly after: number;

  /**
   * Property attempt
   *
   * @description
   * Retries already scheduled after a failed catch-up read, bounded by `GOAL_SETTLE_BACKOFF_MS`.
   *
   * @type {number}
   */
  attempt: number;
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
   * Deletes a goal after its confirmation, from the version shown when it was confirmed, and toasts
   * `Goal deleted` with its name; a goal already gone counts as deleted. A `412` is a conflict: the
   * goal is not deleted, `This goal changed since you confirmed` asks to check it and delete it
   * again, and it is read again, so a new confirmation is made against its current version. An unknown outcome reads the goal again: gone, it counts as deleted;
   * still there, the warning `The deletion could not be confirmed` shows. A refusal toasts the
   * failure. Ignored while a deletion runs.
   *
   * @param {string} goalId - Id of the goal.
   * @param {number} version - The version shown when the deletion was confirmed.
   * @returns {Promise<boolean>} Whether the goal left the list shown.
   */
  remove(goalId: string, version: number): Promise<boolean>;

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
      const pin: OrganizationPin = inject(OrganizationPin);
      const loads: GoalsLoads = { background: false, queued: false, last: null, landed: 0 };
      const context: GoalsContext = {
        generation: 0,
        organizationId: workspace.organization().id,
        left: false,
        destroyed: false,
      };
      inject(DestroyRef).onDestroy((): void => {
        context.destroyed = true;
      });
      let ownersAsked: readonly string[] = [];
      return {
        _api: api,
        _workspace: workspace,
        _pin: pin,
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
      // `current` only says whether `_followOrganization` has yet to reset a generation, so it
      // guards the flags that reset owns. The resolver commits another organization (workspace
      // context and pin) synchronously, before that effect moves the generation, and a destroyed
      // store keeps its generation while the global pin moves on: `live` also checks both against
      // the organization the store adopted, and that the pin never left it since, so nothing is
      // sent under another organization's pin or applied in between, nor after a switch and back.
      const current: (generation: number) => boolean = (generation: number): boolean =>
        generation === context.generation;
      const live: (generation: number) => boolean = (generation: number): boolean =>
        current(generation) &&
        !context.left &&
        store._workspace.organization().id === context.organizationId &&
        store._pin.current() === context.organizationId;
      // The writes still running, queued in a goal's lane or creating a goal. The store hears the
      // organization changes until the page is gone and they all settled, so `left` keeps fencing
      // the writes a gone page still sends.
      let running: number = 0;
      const changes: Subscription = store._pin.organizationChanges.subscribe((): void => {
        context.left = true;
      });
      const hold: () => void = (): void => {
        running += 1;
      };
      const free: () => void = (): void => {
        running -= 1;
        if (context.destroyed && running === 0) changes.unsubscribe();
      };
      const alive: (generation: number) => boolean = (generation: number): boolean =>
        live(generation) && !context.destroyed;
      const guard: (generation: number) => void = (generation: number): void => {
        if (!live(generation)) throw new WriteDroppedError();
      };
      const dropped: (error: unknown, generation: number) => boolean = (
        error: unknown,
        generation: number,
      ): boolean =>
        error instanceof WriteDroppedError ||
        error instanceof OrganizationSwitchPendingError ||
        hasProblemCode(error, 'organization.context-changed') ||
        !live(generation);
      const organizationId: () => string = (): string => context.organizationId;
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

      // A catch-up read is a background read, whose failure keeps the goals of before the write:
      // it stays owed (`reconciling`) until a read issued after it lands for its organization. A
      // failed one is sent again after each wait of `GOAL_SETTLE_BACKOFF_MS`, then on the page's
      // next refresh occasion (a focus, a visible tab, a realtime reconnection, a task detail that
      // closes or changes); a new catch-up starts the waits again. A switch to another
      // organization drops it, since that organization's goals are read anew.
      const backoff: readonly number[] = inject(GOAL_SETTLE_BACKOFF_MS);
      let reconciling: Reconciliation | null = null;
      let catchUpRetry: ReturnType<typeof setTimeout> | null = null;
      const stopCatchUp: () => void = (): void => {
        reconciling = null;
        if (catchUpRetry !== null) clearTimeout(catchUpRetry);
        catchUpRetry = null;
      };
      const startCatchUp: () => void = (): void => {
        stopCatchUp();
        reconciling = {
          organizationId: context.organizationId,
          after: store._readsIssued(),
          attempt: 0,
        };
        refresh();
      };
      const caughtUp: (owed: Reconciliation) => boolean = (owed: Reconciliation): boolean =>
        store._loads.landed > owed.after &&
        store._loads.last?.organizationId === owed.organizationId;
      const retryCatchUp: () => void = (): void => {
        const owed: Reconciliation | null = reconciling;
        if (owed === null || catchUpRetry !== null || owed.attempt >= backoff.length) return;
        if (context.destroyed || !store.goals.hasValue()) return;
        catchUpRetry = setTimeout((): void => {
          catchUpRetry = null;
          if (reconciling === owed) refresh();
        }, backoff[owed.attempt]);
        owed.attempt += 1;
      };
      inject(DestroyRef).onDestroy(stopCatchUp);

      // A write that settles once the workspace left its organization may have been recorded, but
      // its answer is not applied. Back on that organization the goals are read once more instead,
      // coalesced with a read in flight: at once for a write of an older generation, at the reset
      // for one that settled before it (`unseen`), since the goals read may end on the same
      // organization and not be sent again.
      let unseen: boolean = false;
      const settledBefore: (generation: number, origin: string) => void = (
        generation: number,
        origin: string,
      ): void => {
        if (current(generation) && context.left) unseen = true;
        else if (
          !current(generation) &&
          alive(context.generation) &&
          origin === context.organizationId
        )
          startCatchUp();
      };

      // A definitive answer to a creation (created, or refused by the gateway) ends its idempotency
      // key, even once its generation is no longer live; an unknown outcome, or a send the store or
      // the pin stopped, keeps it so the same draft is never created twice.
      const definitive: (error: unknown) => boolean = (error: unknown): boolean =>
        !isUncertainCreation(error) &&
        !(error instanceof WriteDroppedError) &&
        !(error instanceof OrganizationSwitchPendingError) &&
        !hasProblemCode(error, 'organization.context-changed');

      const lanes: Map<string, GoalLane> = new Map<string, GoalLane>();
      const scheduled: Set<string> = new Set<string>();
      const bursts: Map<string, PendingEdit> = new Map<string, PendingEdit>();
      const burst: number = inject(GOAL_EDIT_BURST_MS);
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
        const origin: string = context.organizationId;
        hold();
        const run: Promise<void> = lane.tail.then(task);
        const tail: Promise<void> = run.then(free, free);
        lane.tail = tail;
        void tail.then((): void => {
          settledBefore(generation, origin);
          if (lane.tail !== tail || !lane.dirty || !alive(generation)) return;
          for (const pending of bursts.values()) if (pending.goalId === goalId) return;
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
      // One attempt per draft at a time. A resubmission made while an earlier attempt of the same
      // draft runs (a switch away and back ends the `creating` and `addingTo` flags, not the
      // attempt) sends nothing until that attempt settles: created, its answer is taken; otherwise
      // the draft is sent again with the key it kept (an unknown outcome) or a new one (it released
      // its key). Only the attempt running on a key releases it, so no other attempt is left
      // sending with a key that is gone.
      const attempts: Map<string, Promise<unknown>> = new Map<string, Promise<unknown>>();
      const once: <T>(
        draftKey: string,
        prior: Promise<unknown> | undefined,
        attempt: (key: string) => Promise<T>,
      ) => Promise<T> = async <T>(
        draftKey: string,
        prior: Promise<unknown> | undefined,
        attempt: (key: string) => Promise<T>,
      ): Promise<T> => {
        for (let waiting: Promise<unknown> | undefined = prior; waiting !== undefined;) {
          try {
            return (await waiting) as T;
          } catch {
            // Not created: sent again below, with the key the attempt kept or a new one.
          }
          const next: Promise<unknown> | undefined = attempts.get(draftKey);
          waiting = next === waiting ? undefined : next;
        }
        const running: Promise<T> = attempt(keyOf(draftKey));
        attempts.set(draftKey, running);
        try {
          const value: T = await running;
          createKeys.delete(draftKey);
          return value;
        } catch (error: unknown) {
          if (definitive(error)) createKeys.delete(draftKey);
          throw error;
        } finally {
          if (attempts.get(draftKey) === running) attempts.delete(draftKey);
        }
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
        let value: number | boolean | null = null;
        let settled: boolean = false;
        for (let attempt: number = 0; !settled; attempt += 1) {
          try {
            value = valueOf(
              (await fresh(goalId, generation)).results.find(
                (result: KeyResult): boolean => result.id === resultId,
              ),
            );
            settled = true;
          } catch (error: unknown) {
            if (dropped(error, generation)) return;
            if (attempt >= backoff.length) {
              dropEdit(resultId);
              store._toasts.warning(
                $localize`:@@goals.toast.result-update-unknown:The key result change could not be confirmed`,
                {
                  description: $localize`:@@goals.toast.result-update-unknown-text:Its current value shows once the goals are read again.`,
                },
              );
              refresh();
              return;
            }
            await wait(backoff[attempt]);
          }
        }
        if (!live(generation)) return;
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
        if (!live(generation)) return;
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
            if (!live(generation)) return;
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
          if (!live(generation)) return;
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
      const enter: (resultId: string) => void = (resultId: string): void => {
        const pending: PendingEdit | undefined = bursts.get(resultId);
        if (pending === undefined) return;
        clearTimeout(pending.handle);
        bursts.delete(resultId);
        if (scheduled.has(resultId)) return;
        scheduled.add(resultId);
        void inLane(pending.goalId, pending.generation, () =>
          flush(pending.goalId, resultId, pending.generation),
        );
      };
      const schedule: (goalId: string, resultId: string) => void = (
        goalId: string,
        resultId: string,
      ): void => {
        laneOf(goalId);
        const known: PendingEdit | undefined = bursts.get(resultId);
        if (known !== undefined) clearTimeout(known.handle);
        bursts.set(resultId, {
          goalId,
          generation: context.generation,
          handle: setTimeout((): void => {
            enter(resultId);
          }, burst),
        });
      };
      inject(DestroyRef).onDestroy((): void => {
        for (const resultId of [...bursts.keys()]) enter(resultId);
        if (running === 0) changes.unsubscribe();
      });
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
          const origin: string = context.organizationId;
          const draftKey: string = JSON.stringify(['goal', origin, quarter.key, draft]);
          const prior: Promise<unknown> | undefined = attempts.get(draftKey);
          patchState(store, { creating: true });
          hold();
          try {
            const goal: Goal = await once(draftKey, prior, (key: string) =>
              created(generation, () => store._api.create(draft, quarter, today(), key)),
            );
            if (!live(generation)) return null;
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
            failed(
              hasProblemCode(error, 'goal.owner-ineligible')
                ? $localize`:@@goals.toast.owner-ineligible:This person cannot read the goal`
                : $localize`:@@goals.toast.create-failed:The goal could not be created`,
            );
            return null;
          } finally {
            if (current(generation)) patchState(store, { creating: false });
            free();
            settledBefore(generation, origin);
          }
        },
        async remove(goalId: string, version: number): Promise<boolean> {
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
          patchState(store, { deletingId: goalId });
          let outcome: boolean = false;
          await inLane(goalId, generation, async (): Promise<void> => {
            try {
              guard(generation);
              await store._api.delete(goalId, version);
              if (live(generation)) outcome = removed();
            } catch (error: unknown) {
              if (dropped(error, generation)) return;
              if (isGone(error)) {
                outcome = removed();
                return;
              }
              if (isVersionMismatch(error)) {
                store._toasts.warning(
                  $localize`:@@goals.toast.delete-conflict:This goal changed since you confirmed`,
                  {
                    description: $localize`:@@goals.toast.delete-conflict-text:It was not deleted. Check it, then delete it again.`,
                  },
                );
                try {
                  await fresh(goalId, generation);
                } catch (reread: unknown) {
                  if (dropped(reread, generation)) return;
                  if (isGone(reread)) outcome = removed();
                  else refresh();
                }
                return;
              }
              if (!isUncertainWrite(error)) {
                failed($localize`:@@goals.toast.delete-failed:The goal could not be deleted`);
                return;
              }
              try {
                await fresh(goalId, generation);
                if (!live(generation)) return;
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
          const draftKey: string = JSON.stringify([
            'result',
            context.organizationId,
            goalId,
            draft,
          ]);
          const prior: Promise<unknown> | undefined = attempts.get(draftKey);
          let outcome: boolean = false;
          const attempt: (key: string) => Promise<KeyResultWrite> = async (
            key: string,
          ): Promise<KeyResultWrite> => {
            let idempotencyKey: string = key;
            const creation: (version: number) => Promise<KeyResultWrite> = (version: number) =>
              created(generation, () =>
                store._api.createResult(goalId, version, draft, idempotencyKey),
              );
            try {
              return await send(generation, goalId, creation);
            } catch (error: unknown) {
              if (!isVersionMismatch(error)) throw error;
              createKeys.delete(draftKey);
              idempotencyKey = keyOf(draftKey);
              await fresh(goalId, generation);
              return send(generation, goalId, creation);
            }
          };
          patchState(store, { addingTo: goalId });
          await inLane(goalId, generation, async (): Promise<void> => {
            try {
              const write: KeyResultWrite = await once(draftKey, prior, attempt);
              if (!live(generation)) return;
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
              if (!live(generation)) return;
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
          if (loading) return;
          if (reconciling !== null && caughtUp(reconciling)) stopCatchUp();
          if (store._loads.queued) {
            store._loads.queued = false;
            refresh();
            return;
          }
          retryCatchUp();
        }),
        _checkOwners: signalMethod<string | null>((ids: string | null): void => {
          if (ids === null) return;
          if (ids === lastAsked) return;
          lastAsked = ids;
          store._askOwners(ids.split(' '));
          patchState(store, { _peopleRequest: store._peopleRequest() + 1 });
        }),
        _followOrganization: signalMethod<{ organizationId: string; revision: number }>(
          ({ organizationId }: { organizationId: string; revision: number }): void => {
            if (organizationId === context.organizationId && !context.left) return;
            // Back on the same organization, a write that settled while it was left, or a
            // catch-up read still owed, is read again from the reset; another organization drops
            // the catch-up, since its goals are read anew.
            const catchUp: boolean =
              (unseen || reconciling !== null) && organizationId === context.organizationId;
            unseen = false;
            stopCatchUp();
            context.generation += 1;
            context.organizationId = organizationId;
            context.left = false;
            lastAsked = null;
            records.clear();
            scheduled.clear();
            for (const pending of bursts.values()) clearTimeout(pending.handle);
            bursts.clear();
            store._loads.queued = false;
            patchState(store, {
              _edits: {},
              _hidden: [],
              deletingId: null,
              addingTo: null,
              creating: false,
            });
            if (catchUp) startCatchUp();
          },
        ),
      };
    }),
    withHooks({
      onInit(store): void {
        // The pin's revision moves on every commit: a switch and back within one tick leaves the
        // organization unchanged, and only the revision makes the store react and reset.
        store._followOrganization(
          computed((): { organizationId: string; revision: number } => ({
            organizationId: store._workspace.organization().id,
            revision: store._pin.revision(),
          })),
        );
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
 * (`If-Match`), kept once the page is gone so the last value of a burst is still sent; a key
 * result's value enters that queue once its burst of clicks ends (`GOAL_EDIT_BURST_MS`), at once
 * when the page is left; once a
 * goal's writes settle, it is read again for its progress and health, unless the page is gone
 * (the reads of one goal a queued write needs, after a `412` or an unknown outcome, still run). A
 * `412` reads the goal: an edit is sent again only while the goal still shows the value it started
 * from, a number moves by the same steps from a newer value, and a checkbox changed elsewhere is
 * dropped with a warning. A confirmed write moves the value an edit counts its steps from, so a
 * queued edit keeps only its unsent steps. A change of unknown outcome is settled by reading its
 * goal inside its queue, before any later edit of it is sent: recorded, the later edits follow it;
 * not recorded, only the steps made after it are kept, from the value read; the queue stays held
 * while that read is retried (`GOAL_SETTLE_BACKOFF_MS`), and if it never answers the later edits
 * are dropped with a warning. A deletion is sent from the version confirmed, and a `412` keeps the
 * goal, warns and reads it again, so deleting it takes a new confirmation. Every write is bound to
 * the organization generation it started in: after a switch, even back to the same organization,
 * nothing more is sent, patched or toasted. It is also sent, and its answer applied, only while the
 * workspace and `OrganizationPin` both name the organization the goals were read for and the pin
 * was not committed to another organization, or cleared, since (`organizationChanges`, heard until
 * the page is gone and its writes settled; a re-verification of the same organization drops
 * nothing). So a write queued or answered once the resolver committed another organization,
 * before the store reacts, after the page is gone, after a switch and back, or once the workspace
 * is left (the pin cleared), is dropped instead of reaching the gateway under another
 * `If-Organization-Match`. After a switch away and back the goals are read again, and once more
 * when a write started before it settles, so what it completed shows; that catch-up stays owed
 * until a read issued after it lands, a failed one being sent again after each wait of
 * `GOAL_SETTLE_BACKOFF_MS`, then on the next background occasion, and a switch to another
 * organization drops it. A creation keeps its
 * idempotency key, per organization and across a switch and back, until a definitive
 * answer (created or refused, even once a switch dropped it) and is sent again with it after an
 * unknown outcome or
 * `409 idempotency.request-in-progress`, up to three times, then reported as unconfirmed; a resubmitted
 * identical draft reuses the key, and one submitted while an earlier attempt of it runs waits for it
 * and takes what it created instead of sending a second request. The members are read again after
 * a failure and for owners they
 * did not name, which read as former members only once a read says so.
 *
 * @type {ReturnType<typeof createGoalsStore>}
 */
export const GoalsStore: ReturnType<typeof createGoalsStore> = createGoalsStore();
