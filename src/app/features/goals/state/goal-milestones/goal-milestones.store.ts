import { inject, type Signal, type Type } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  patchState,
  signalMethod,
  signalStore,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { EMPTY, filter, map, merge, mergeMap, type Observable, Subject, takeUntil } from 'rxjs';

import { RealtimeConnection } from '@core/realtime';
import { TaskDetailOpener } from '@features/task';

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
 * Interface MilestoneRequest
 *
 * @description
 * A read of one milestone task; only the newest read of a key settles it.
 */
interface MilestoneRequest {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Key of the task.
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;

  /**
   * Property sequence
   *
   * @description
   * Reads of that key asked for so far, this one included.
   *
   * @type {number}
   * @readonly
   */
  readonly sequence: number;
  // #endregion
}

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
   * The milestone tasks of the goals shown, by key; `unknown` until read.
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
   * Follows the milestone keys of the goals shown: a new key is read, a key that left is
   * forgotten and its read cancelled.
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
    withProps(() => ({
      _api: inject(GoalsApi),
      _opener: inject(TaskDetailOpener),
      _realtime: inject(RealtimeConnection, { optional: true }),
      _requests: new Subject<MilestoneRequest>(),
      _sequences: new Map<string, number>(),
      _forgotten: new Subject<string>(),
    })),
    withMethods((store) => {
      const tracked: () => readonly string[] = (): readonly string[] =>
        Object.keys(store.milestones());
      const request: (key: string) => void = (key: string): void => {
        const sequence: number = (store._sequences.get(key) ?? 0) + 1;
        store._sequences.set(key, sequence);
        store._requests.next({ key, sequence });
      };
      return {
        follow: signalMethod<readonly string[]>((keys: readonly string[]): void => {
          const known: Readonly<Record<string, MilestoneState>> = store.milestones();
          const wanted: ReadonlySet<string> = new Set<string>(keys);
          const added: readonly string[] = keys.filter((key: string): boolean => !(key in known));
          for (const key of Object.keys(known)) if (!wanted.has(key)) store._forgotten.next(key);
          patchState(store, {
            milestones: Object.fromEntries(
              keys.map((key: string): [string, MilestoneState] => [key, known[key] ?? 'unknown']),
            ),
          });
          for (const key of added) request(key);
        }),
        _again(keys: readonly string[]): void {
          const current: ReadonlySet<string> = new Set<string>(tracked());
          for (const key of keys) if (current.has(key)) request(key);
        },
        _settle(key: string, sequence: number, state: MilestoneState): void {
          if (store._sequences.get(key) === sequence && key in store.milestones())
            patchState(store, { milestones: { ...store.milestones(), [key]: state } });
        },
        _tracked: tracked,
      };
    }),
    withHooks({
      onInit(store): void {
        store._requests
          .pipe(
            mergeMap(
              ({
                key,
                sequence,
              }: MilestoneRequest): Observable<[MilestoneRequest, MilestoneState]> =>
                !store._tracked().includes(key) || store._sequences.get(key) !== sequence
                  ? EMPTY
                  : store._api.milestone(key).pipe(
                      takeUntil(
                        merge(
                          store._forgotten.pipe(filter((gone: string): boolean => gone === key)),
                          store._requests.pipe(
                            filter((newer: MilestoneRequest): boolean => newer.key === key),
                          ),
                        ),
                      ),
                      map((state: MilestoneState): [MilestoneRequest, MilestoneState] => [
                        { key, sequence },
                        state,
                      ]),
                    ),
              MILESTONE_CONCURRENCY,
            ),
            takeUntilDestroyed(),
          )
          .subscribe(([{ key, sequence }, state]: [MilestoneRequest, MilestoneState]): void => {
            store._settle(key, sequence, state);
          });
        merge(store._opener.closed, store._opener.changed)
          .pipe(takeUntilDestroyed())
          .subscribe((key: string): void => {
            store._again([key]);
          });
        (store._realtime?.reconnected ?? EMPTY).pipe(takeUntilDestroyed()).subscribe((): void => {
          store._again(store._tracked());
        });
      },
    }),
  );
}

/**
 * Constant GoalMilestonesStore
 *
 * @description
 * Page-scoped store of the milestone tasks the goals link to (gap G-G1: a milestone key result
 * carries only its key and whether it is reached, so its due date and lateness need one
 * `getTask` per milestone). At most four tasks are read at once. Only the new keys of a changed set
 * are read; a key that left is forgotten and its read, queued or in flight, cancelled. A task
 * detail that closes or reports a change reads only that task again, a realtime reconnection every
 * task; a newer read of a key cancels the older one, and only the newest settles it. A task the
 * gateway answers `404` for is `missing`; any other failure leaves it `unknown`,
 * shown as upcoming. An organization switch empties the goals, so every key leaves; the reads stop
 * with the page.
 *
 * @type {ReturnType<typeof createGoalMilestonesStore>}
 */
export const GoalMilestonesStore: ReturnType<typeof createGoalMilestonesStore> =
  createGoalMilestonesStore();
