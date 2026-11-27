import { computed, inject, type Signal, type Type } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  combineLatest,
  EMPTY,
  from,
  map,
  merge,
  mergeMap,
  type Observable,
  of,
  startWith,
  switchMap,
} from 'rxjs';

import { RealtimeConnection } from '@core/realtime';
import { TaskDetailOpener } from '@features/task';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { GoalsApi } from '../../data-access/services/goals-api/goals-api.service';
import type { MilestoneState } from '../../models/goal/goal.interface';

/**
 * Constant MILESTONE_CONCURRENCY
 *
 * @description
 * Milestone tasks read at the same time; the others wait for one of them to settle.
 *
 * @type {number}
 */
export const MILESTONE_CONCURRENCY: number = 4;

/**
 * Interface GoalMilestonesState
 *
 * @description
 * What is known of each milestone task, by key.
 */
interface GoalMilestonesState {
  // #region Properties
  /**
   * Property milestones
   *
   * @description
   * The milestone tasks read, by key; a key not read yet is absent.
   *
   * @type {Readonly<Record<string, MilestoneState>>}
   */
  milestones: Readonly<Record<string, MilestoneState>>;
  // #endregion
}

/**
 * Interface GoalMilestonesStoreInstance
 *
 * @description
 * The due dates of the milestone tasks of the goals shown (gap G-G1).
 */
export interface GoalMilestonesStoreInstance {
  // #region Properties
  /**
   * Property milestones
   *
   * @description
   * What is known of each milestone task, by key.
   *
   * @type {Signal<Readonly<Record<string, MilestoneState>>>}
   * @readonly
   */
  readonly milestones: Signal<Readonly<Record<string, MilestoneState>>>;
  // #endregion

  // #region Methods
  /**
   * Method follow
   *
   * @description
   * Reads the tasks of the given milestone keys, and again whenever they change.
   *
   * @param {Signal<readonly string[]>} keys - The sorted keys of the goals shown.
   */
  follow(keys: Signal<readonly string[]>): void;
  // #endregion
}

/**
 * Function createGoalMilestonesStore
 *
 * @description
 * Creates the milestones store.
 *
 * @returns {Type<GoalMilestonesStoreInstance>} Injectable store constructor.
 */
function createGoalMilestonesStore(): Type<GoalMilestonesStoreInstance> {
  return signalStore(
    withState<GoalMilestonesState>({ milestones: {} }),
    withMethods((store) => {
      const api: GoalsApi = inject(GoalsApi);
      const workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);
      const opener: TaskDetailOpener = inject(TaskDetailOpener);
      const realtime: RealtimeConnection | null = inject(RealtimeConnection, { optional: true });
      const again: Observable<null> = merge(
        realtime?.reconnected ?? EMPTY,
        opener.closed,
        opener.changed,
      ).pipe(
        map((): null => null),
        startWith(null),
      );
      const organization: Signal<string> = computed((): string => workspace.organization().id);
      return {
        follow: rxMethod<readonly string[]>((keys: Observable<readonly string[]>) =>
          combineLatest([keys, again]).pipe(
            switchMap(([list]: [readonly string[], null]) => {
              const current: string = organization();
              const known: Readonly<Record<string, MilestoneState>> = store.milestones();
              patchState(store, {
                milestones: Object.fromEntries(
                  list.map((key: string): [string, MilestoneState] => [
                    key,
                    known[key] ?? 'unknown',
                  ]),
                ),
              });
              if (list.length === 0) return of(null);
              return from(list).pipe(
                mergeMap(
                  (key: string) =>
                    api
                      .milestone(key)
                      .pipe(map((state: MilestoneState): [string, MilestoneState] => [key, state])),
                  MILESTONE_CONCURRENCY,
                ),
                map(([key, state]: [string, MilestoneState]): null => {
                  if (current === organization())
                    patchState(store, { milestones: { ...store.milestones(), [key]: state } });
                  return null;
                }),
              );
            }),
          ),
        ),
      };
    }),
  );
}

/**
 * Constant GoalMilestonesStore
 *
 * @description
 * Page-scoped store of the milestone tasks the goals link to (gap G-G1: a milestone key result
 * carries only its key and whether it is reached, so its due date and lateness need one
 * `getTask` per milestone). At most four tasks are read at once; a new set of keys, a realtime
 * reconnection or a task detail closing or reporting a change cancels the reads in flight and
 * starts again, keeping what is known meanwhile. A task the gateway answers `404` for is
 * `missing`; any other failure leaves it `unknown`, shown as upcoming. Answers for an organization
 * the workspace has left change nothing, and the reads stop with the page.
 *
 * @type {ReturnType<typeof createGoalMilestonesStore>}
 */
export const GoalMilestonesStore: ReturnType<typeof createGoalMilestonesStore> =
  createGoalMilestonesStore();
