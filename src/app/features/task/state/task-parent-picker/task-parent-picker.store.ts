import { computed, inject, type Signal, type Type } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { from, map, type Observable, of, pipe, switchMap, tap, timer } from 'rxjs';

import { TaskDetailApi } from '../../data-access/services/task-detail-api/task-detail-api.service';
import type { TaskParentCandidate } from '../../models/task-detail/task-detail.interface';

/**
 * Constant SUBTASK_MAX_DEPTH
 *
 * @description
 * Deepest level of a subtask below its top-level task (`KID_MAX_DEPTH`, `App.dc.html` line 3963):
 * three levels in all.
 *
 * @type {number}
 */
export const SUBTASK_MAX_DEPTH: number = 2;

/**
 * Constant SUBTASK_MAX_COUNT
 *
 * @description
 * Direct subtasks a task takes at most (`KID_MAX_COUNT`, line 3964).
 *
 * @type {number}
 */
export const SUBTASK_MAX_COUNT: number = 25;

/**
 * Constant PARENT_OPTIONS
 *
 * @description
 * Candidates the picker shows at most (`App.dc.html` line 8448).
 *
 * @type {number}
 */
export const PARENT_OPTIONS: number = 12;

/**
 * Constant SEARCH_DEBOUNCE_MS
 *
 * @description
 * Pause after typing before the candidates are read.
 *
 * @type {number}
 */
export const SEARCH_DEBOUNCE_MS: number = 200;

/**
 * Interface TaskParentContext
 *
 * @description
 * The task that changes parent and what the limits need of it.
 */
export interface TaskParentContext {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Key of the open task.
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;

  /**
   * Property listId
   *
   * @description
   * Its list, whose tasks come first.
   *
   * @type {string}
   * @readonly
   */
  readonly listId: string;

  /**
   * Property parentKey
   *
   * @description
   * Its current parent, left out, or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly parentKey: string | null;

  /**
   * Property childKeys
   *
   * @description
   * Its direct subtasks, left out with their own subtasks.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly childKeys: readonly string[];

  /**
   * Property height
   *
   * @description
   * Levels below it: 0 without subtasks, 1 with subtasks, 2 when a subtask has its own.
   *
   * @type {number}
   * @readonly
   */
  readonly height: number;
  // #endregion
}

/**
 * Interface TaskParentPickerState
 *
 * @description
 * The search of the parent picker.
 */
interface TaskParentPickerState {
  // #region Properties
  /**
   * Property context
   *
   * @description
   * The task that changes parent, or null before the picker opens.
   *
   * @type {TaskParentContext | null}
   * @readonly
   */
  readonly context: TaskParentContext | null;

  /**
   * Property query
   *
   * @description
   * The typed text.
   *
   * @type {string}
   * @readonly
   */
  readonly query: string;

  /**
   * Property candidates
   *
   * @description
   * What the last read returned.
   *
   * @type {readonly TaskParentCandidate[]}
   * @readonly
   */
  readonly candidates: readonly TaskParentCandidate[];

  /**
   * Property loading
   *
   * @description
   * Whether the candidates are being read.
   *
   * @type {boolean}
   * @readonly
   */
  readonly loading: boolean;

  /**
   * Property failed
   *
   * @description
   * Whether the last read failed (`Retry`, never an empty result).
   *
   * @type {boolean}
   * @readonly
   */
  readonly failed: boolean;
  // #endregion
}

/**
 * Interface TaskParentPickerStoreInstance
 *
 * @description
 * The public API of the parent picker's store.
 */
export interface TaskParentPickerStoreInstance {
  // #region Properties
  /**
   * Property query
   *
   * @description
   * The typed text.
   *
   * @type {Signal<string>}
   * @readonly
   */
  readonly query: Signal<string>;

  /**
   * Property loading
   *
   * @description
   * Whether the candidates are being read.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly loading: Signal<boolean>;

  /**
   * Property failed
   *
   * @description
   * Whether the last read failed.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly failed: Signal<boolean>;

  /**
   * Property options
   *
   * @description
   * The candidates the limits allow, the open task's list first, 12 at most.
   *
   * @type {Signal<readonly TaskParentCandidate[]>}
   * @readonly
   */
  readonly options: Signal<readonly TaskParentCandidate[]>;
  // #endregion

  // #region Methods
  /**
   * Method start
   *
   * @description
   * Starts over for a task: empty text, the first tasks of its list read at once.
   *
   * @param {TaskParentContext} context - The task that changes parent.
   */
  start(context: TaskParentContext): void;

  /**
   * Method search
   *
   * @description
   * Reads the candidates matching a text, 200 ms after the last keystroke.
   *
   * @param {string} query - The typed text.
   */
  search(query: string): void;

  /**
   * Method retry
   *
   * @description
   * Reads the candidates of the current text again.
   */
  retry(): void;
  // #endregion
}

/**
 * Interface LoadRequest
 *
 * @description
 * A read of the candidates: the text, and whether to wait for the typing to pause.
 */
interface LoadRequest {
  // #region Properties
  /**
   * Property query
   *
   * @description
   * The typed text.
   *
   * @type {string}
   * @readonly
   */
  readonly query: string;

  /**
   * Property delay
   *
   * @description
   * Whether the read waits `SEARCH_DEBOUNCE_MS` (typing) or starts at once (opening, `Retry`).
   *
   * @type {boolean}
   * @readonly
   */
  readonly delay: boolean;
  // #endregion
}

/**
 * Function depthOf
 *
 * @description
 * The level of a candidate below its top-level task, from the parents the read candidates name:
 * a parent the read does not hold counts one level, so a deeper task the client cannot see is
 * left to the gateway's refusal.
 *
 * @param {TaskParentCandidate} candidate - The candidate.
 * @param {ReadonlyMap<string, TaskParentCandidate>} byKey - The read candidates by key.
 * @returns {number} Its level, 0 for a top-level task.
 */
function depthOf(
  candidate: TaskParentCandidate,
  byKey: ReadonlyMap<string, TaskParentCandidate>,
): number {
  let depth: number = 0;
  let parentKey: string | null | undefined = candidate.parentKey;
  while (parentKey && depth <= SUBTASK_MAX_DEPTH) {
    depth++;
    parentKey = byKey.get(parentKey)?.parentKey;
  }
  return depth;
}

/**
 * Function allowedParents
 *
 * @description
 * The candidates the open task may become a subtask of (`App.dc.html` lines 8437-8462): not the
 * task itself, its current parent or one of its subtasks (nor their subtasks the read shows),
 * without 25 subtasks already, and deep enough room for the task and the levels below it; the
 * open task's list first, 12 at most. A search hit from another list carries neither its depth
 * nor its size: the gateway refuses it beyond the limits.
 *
 * @param {TaskParentContext} context - The task that changes parent.
 * @param {readonly TaskParentCandidate[]} candidates - The read candidates.
 * @returns {readonly TaskParentCandidate[]} The options.
 */
export function allowedParents(
  context: TaskParentContext,
  candidates: readonly TaskParentCandidate[],
): readonly TaskParentCandidate[] {
  const byKey: Map<string, TaskParentCandidate> = new Map<string, TaskParentCandidate>(
    candidates.map((candidate: TaskParentCandidate) => [candidate.key, candidate]),
  );
  const below: Set<string> = new Set<string>([context.key, ...context.childKeys]);
  for (let grew: boolean = true; grew;) {
    grew = false;
    for (const candidate of candidates) {
      if (candidate.parentKey && below.has(candidate.parentKey) && !below.has(candidate.key)) {
        below.add(candidate.key);
        grew = true;
      }
    }
  }
  return candidates
    .filter(
      (candidate: TaskParentCandidate): boolean =>
        !below.has(candidate.key) &&
        candidate.key !== context.parentKey &&
        (candidate.children ?? 0) < SUBTASK_MAX_COUNT &&
        depthOf(candidate, byKey) + 1 + context.height <= SUBTASK_MAX_DEPTH,
    )
    .sort(
      (a: TaskParentCandidate, b: TaskParentCandidate): number =>
        Number(b.sameList) - Number(a.sameList),
    )
    .slice(0, PARENT_OPTIONS);
}

/**
 * Function mergeCandidates
 *
 * @description
 * The tasks of the open task's list first, then the search hits of other lists, each key once.
 *
 * @param {readonly TaskParentCandidate[]} list - Tasks of the list.
 * @param {readonly TaskParentCandidate[]} hits - Search hits.
 * @returns {readonly TaskParentCandidate[]} The candidates.
 */
function mergeCandidates(
  list: readonly TaskParentCandidate[],
  hits: readonly TaskParentCandidate[],
): readonly TaskParentCandidate[] {
  const keys: Set<string> = new Set<string>(list.map((task: TaskParentCandidate) => task.key));
  return [...list, ...hits.filter((hit: TaskParentCandidate): boolean => !keys.has(hit.key))];
}

/**
 * Function createTaskParentPickerStore
 *
 * @description
 * Builds the parent picker's store.
 *
 * @returns {Type<TaskParentPickerStoreInstance>} Injectable store constructor.
 */
function createTaskParentPickerStore(): Type<TaskParentPickerStoreInstance> {
  const initialState: TaskParentPickerState = {
    context: null,
    query: '',
    candidates: [],
    loading: false,
    failed: false,
  };
  return signalStore(
    withState(initialState),
    withComputed((store) => ({
      options: computed((): readonly TaskParentCandidate[] => {
        const context: TaskParentContext | null = store.context();
        return context ? allowedParents(context, store.candidates()) : [];
      }),
    })),
    withMethods((store, api: TaskDetailApi = inject(TaskDetailApi)) => {
      const read: (
        context: TaskParentContext,
        query: string,
      ) => Promise<readonly TaskParentCandidate[]> = async (
        context: TaskParentContext,
        query: string,
      ): Promise<readonly TaskParentCandidate[]> => {
        const text: string = query.trim();
        const found: [readonly TaskParentCandidate[], readonly TaskParentCandidate[]] =
          await Promise.all([
            api.listCandidates(context.listId, text),
            text === '' ? Promise.resolve([]) : api.searchCandidates(text),
          ]);
        return mergeCandidates(found[0], found[1]);
      };
      const load: ReturnType<typeof rxMethod<LoadRequest>> = rxMethod<LoadRequest>(
        pipe(
          tap((): void => {
            patchState(store, { loading: true, failed: false });
          }),
          switchMap(({ query, delay }: LoadRequest): Observable<void> =>
            (delay ? timer(SEARCH_DEBOUNCE_MS) : of(0)).pipe(
              map((): string => query),
              switchMap((text: string): Observable<void> => {
                const context: TaskParentContext | null = store.context();
                if (!context) return of(undefined);
                return from(
                  read(context, text).then(
                    (candidates: readonly TaskParentCandidate[]): void => {
                      if (store.context() === context && store.query() === text) {
                        patchState(store, { candidates, loading: false, failed: false });
                      }
                    },
                    (): void => {
                      if (store.context() === context && store.query() === text) {
                        patchState(store, { loading: false, failed: true });
                      }
                    },
                  ),
                );
              }),
            ),
          ),
        ),
      );
      return {
        start(context: TaskParentContext): void {
          patchState(store, { ...initialState, context });
          load({ query: '', delay: false });
        },
        search(query: string): void {
          if (query === store.query()) return;
          patchState(store, { query });
          load({ query, delay: true });
        },
        retry(): void {
          load({ query: store.query(), delay: false });
        },
      };
    }),
  );
}

/**
 * Constant TaskParentPickerStore
 *
 * @description
 * The search of the parent picker (`Become a subtask of…`), provided by the picker dialog: one
 * page of the open task's list (`listTasks`, subtasks included, so the limits apply to them) and,
 * once a text is typed, the matching tasks of other lists (`search`); the latest text wins. The
 * options leave out what would break the three levels or the 25 subtasks (`allowedParents`).
 *
 * @type {Type<TaskParentPickerStoreInstance>}
 */
export const TaskParentPickerStore: Type<TaskParentPickerStoreInstance> =
  createTaskParentPickerStore();
