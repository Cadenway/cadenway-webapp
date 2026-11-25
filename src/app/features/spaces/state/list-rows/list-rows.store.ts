import { MediaMatcher } from '@angular/cdk/layout';
import {
  computed,
  DestroyRef,
  inject,
  resource,
  type ResourceRef,
  type ResourceStatus,
  type Signal,
  type Type,
  untracked,
} from '@angular/core';
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
  addEntities,
  removeAllEntities,
  setAllEntities,
  withEntities,
} from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  catchError,
  debounceTime,
  EMPTY,
  filter,
  type Observable,
  pipe,
  Subject,
  switchMap,
  tap,
} from 'rxjs';

import { type RealtimeChange, RealtimeConnection } from '@core/realtime';
import {
  type CreatedTask,
  TaskCreate,
  type TaskStatusChange,
  TaskStatusChangesStore,
  type TaskSummary,
} from '@features/task';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { ListTasksApi } from '../../data-access/services/list-tasks-api/list-tasks-api.service';
import type {
  GroupProgress,
  ListRow,
  ListRowsQuery,
  ListTaskPage,
} from '../../models/list-rows/list-rows.interface';
import type {
  ListGroupQuery,
  SubtaskMode,
} from '../../models/list-view-config/list-view-config.interface';
import {
  advanceGroup,
  groupValuesOf,
  nextGroup,
  rowsKey,
  startGroups,
} from '../../utils/list-rows/list-rows.util';

/**
 * Constant LIST_PAGE_SIZE
 *
 * @description
 * Tasks per page read; the first read fills at least one page of open groups.
 *
 * @type {number}
 */
export const LIST_PAGE_SIZE: number = 50;

/**
 * Constant SUBTASK_DEPTH
 *
 * @description
 * Deepest subtask level shown under a task (`KID_MAX_DEPTH` of `App.dc.html`).
 *
 * @type {number}
 */
const SUBTASK_DEPTH: number = 2;

/**
 * Constant ENTER_MS
 *
 * @description
 * How long a row that joined its group keeps its entry motion (`rowInTimer` of `App.dc.html`),
 * in milliseconds.
 *
 * @type {number}
 */
const ENTER_MS: number = 520;

/**
 * Constant NOTICE_DEBOUNCE_MS
 *
 * @description
 * Quiet time after the last realtime notice or completed status write of the list before the rows are read again, in
 * milliseconds.
 *
 * @type {number}
 */
const NOTICE_DEBOUNCE_MS: number = 300;

/**
 * Constant CHILD_READS
 *
 * @description
 * Subtask reads in flight at most when « Dépliées sous leur parent » opens every task.
 *
 * @type {number}
 */
const CHILD_READS: number = 4;

/**
 * Interface RowsParams
 *
 * @description
 * A read of the rows: the view's query in the committed organization, with its key.
 */
interface RowsParams extends ListRowsQuery {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * The committed organization.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property key
   *
   * @description
   * Identity of the read (`rowsKey`).
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;
  // #endregion
}

/**
 * Interface RowsSnapshot
 *
 * @description
 * What the primary read of the rows answers: the group progress and the tasks read so far.
 */
export interface RowsSnapshot {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Identity of the read.
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;

  /**
   * Property groups
   *
   * @description
   * How far each group is read.
   *
   * @type {readonly GroupProgress[]}
   * @readonly
   */
  readonly groups: readonly GroupProgress[];

  /**
   * Property groupKeys
   *
   * @description
   * Task keys in the order returned for each group.
   *
   * @type {Readonly<Record<string, readonly string[]>>}
   * @readonly
   */
  readonly groupKeys: Readonly<Record<string, readonly string[]>>;

  /**
   * Property tasks
   *
   * @description
   * The tasks read, in the groups' order then the view's order.
   *
   * @type {readonly TaskSummary[]}
   * @readonly
   */
  readonly tasks: readonly TaskSummary[];
  // #endregion
}

/**
 * Interface ChildRows
 *
 * @description
 * The subtasks of one task, as read.
 */
interface ChildRows {
  // #region Properties
  /**
   * Property status
   *
   * @description
   * Whether the read is running, succeeded or failed.
   *
   * @type {'loading' | 'loaded' | 'failed'}
   * @readonly
   */
  readonly status: 'loading' | 'loaded' | 'failed';

  /**
   * Property tasks
   *
   * @description
   * The subtasks last read; kept while they are read again.
   *
   * @type {readonly TaskSummary[]}
   * @readonly
   */
  readonly tasks: readonly TaskSummary[];
  // #endregion
}

/**
 * Interface ListRowsState
 *
 * @description
 * The rows shown and what is left to read.
 */
interface ListRowsState {
  // #region Properties
  /**
   * Property loadingMore
   *
   * @description
   * Whether a next page is being read.
   *
   * @type {boolean}
   * @readonly
   */
  readonly loadingMore: boolean;

  /**
   * Property moreFailed
   *
   * @description
   * Whether reading the next page failed; the page offers « Réessayer ».
   *
   * @type {boolean}
   * @readonly
   */
  readonly moreFailed: boolean;

  /**
   * Property _query
   *
   * @description
   * The list and the view's query, null before `load`.
   *
   * @type {ListRowsQuery | null}
   * @readonly
   */
  readonly _query: ListRowsQuery | null;

  /**
   * Property _scope
   *
   * @description
   * Organization and list of the rows shown; another one empties them at once.
   *
   * @type {string | null}
   * @readonly
   */
  readonly _scope: string | null;

  /**
   * Property _key
   *
   * @description
   * Key of the read the rows come from, null before the first answer.
   *
   * @type {string | null}
   * @readonly
   */
  readonly _key: string | null;

  /**
   * Property _groups
   *
   * @description
   * How far each group is read.
   *
   * @type {readonly GroupProgress[]}
   * @readonly
   */
  readonly _groups: readonly GroupProgress[];

  /**
   * Property _groupKeys
   *
   * @description
   * Loaded task keys in each group's gateway sort order.
   *
   * @type {Readonly<Record<string, readonly string[]>>}
   * @readonly
   */
  readonly _groupKeys: Readonly<Record<string, readonly string[]>>;

  /**
   * Property _collapsed
   *
   * @description
   * Folded group values by grouping field (`all` without grouping).
   *
   * @type {Readonly<Partial<Record<string, readonly string[]>>>}
   * @readonly
   */
  readonly _collapsed: Readonly<Partial<Record<string, readonly string[]>>>;

  /**
   * Property _subtasks
   *
   * @description
   * The subtask display of the view.
   *
   * @type {SubtaskMode}
   * @readonly
   */
  readonly _subtasks: SubtaskMode;

  /**
   * Property _open
   *
   * @description
   * Tasks whose subtasks were opened or closed by hand, by key.
   *
   * @type {Readonly<Partial<Record<string, boolean>>>}
   * @readonly
   */
  readonly _open: Readonly<Partial<Record<string, boolean>>>;

  /**
   * Property _children
   *
   * @description
   * Subtasks read, by parent key.
   *
   * @type {Readonly<Partial<Record<string, ChildRows>>>}
   * @readonly
   */
  readonly _children: Readonly<Partial<Record<string, ChildRows>>>;

  /**
   * Property _entering
   *
   * @description
   * Keys of the tasks that just joined their group.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly _entering: readonly string[];

  /**
   * Property _hidden
   *
   * @description
   * Statuses the space no longer uses, whose groups the view hides.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly _hidden: readonly string[];
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * Nothing read, « Repliées sous leur parent ».
 *
 * @type {ListRowsState}
 */
const initialState: ListRowsState = {
  loadingMore: false,
  moreFailed: false,
  _query: null,
  _scope: null,
  _key: null,
  _groups: [],
  _groupKeys: {},
  _collapsed: {},
  _subtasks: 'nested',
  _open: {},
  _children: {},
  _entering: [],
  _hidden: [],
};

/**
 * Function groupingOf
 *
 * @description
 * The field a read groups by, null when it does not group.
 *
 * @param {ListRowsQuery | null | undefined} query - The read.
 * @returns {ListGroupQuery['groupBy'] | null} The grouping field.
 */
function groupingOf(query: ListRowsQuery | null | undefined): ListGroupQuery['groupBy'] | null {
  return query?.groupQuery?.groupBy ?? null;
}

/**
 * Function collapsedOf
 *
 * @description
 * The folded groups of a grouping: what the user folded, else « Annulé » when grouping by
 * status (collapsed by default, as in `App.dc.html`).
 *
 * @param {Readonly<Partial<Record<string, readonly string[]>>>} collapsed - Folded groups by grouping.
 * @param {ListGroupQuery['groupBy'] | null} groupBy - The grouping field.
 * @returns {readonly string[]} The folded group values.
 */
function collapsedOf(
  collapsed: Readonly<Partial<Record<string, readonly string[]>>>,
  groupBy: ListGroupQuery['groupBy'] | null,
): readonly string[] {
  return collapsed[groupBy ?? 'all'] ?? (groupBy === 'status' ? ['cancelled'] : []);
}

/**
 * Function uniqueTasks
 *
 * @description
 * The tasks without repeats, first occurrence kept: a task moved into a group read later comes
 * back with that group.
 *
 * @param {readonly TaskSummary[]} tasks - Tasks in reading order.
 * @returns {TaskSummary[]} The tasks, each once.
 */
function uniqueTasks(tasks: readonly TaskSummary[]): TaskSummary[] {
  const seen: Set<string> = new Set<string>();
  return tasks.filter((task: TaskSummary): boolean => {
    if (seen.has(task.id)) return false;
    seen.add(task.id);
    return true;
  });
}

/**
 * Function loadSnapshot
 *
 * @description
 * The primary read of the rows: the group counts, then pages of the groups in order until
 * `want` tasks of visible open groups are read; a folded group met on the way gets its first page
 * so its header shows. Hidden status groups are left unread.
 *
 * @param {ListTasksApi} api - The rows' data access.
 * @param {RowsParams} params - The read.
 * @param {readonly string[]} collapsed - Folded group values.
 * @param {readonly string[]} hidden - Hidden status group values.
 * @param {number} want - Tasks of open groups to read at least.
 * @param {AbortSignal} signal - Cancels a superseded read.
 * @returns {Promise<RowsSnapshot>} What was read.
 */
async function loadSnapshot(
  api: ListTasksApi,
  params: RowsParams,
  collapsed: readonly string[],
  hidden: readonly string[],
  want: number,
  signal: AbortSignal,
): Promise<RowsSnapshot> {
  const grouping: ListGroupQuery | null = params.groupQuery;
  let groups: GroupProgress[] = startGroups(
    grouping ? await api.groups(params.listId, grouping, signal) : null,
  );
  const tasks: TaskSummary[] = [];
  const groupKeys: Record<string, string[]> = {};
  let shown: number = 0;
  for (
    let target: GroupProgress | null = nextGroup(
      groups.filter((group) => !hidden.includes(group.value)),
      collapsed,
    );
    target !== null;
    target = nextGroup(
      groups.filter((group) => !hidden.includes(group.value)),
      collapsed,
    )
  ) {
    const folded: boolean = collapsed.includes(target.value);
    if (!folded && shown >= want) break;
    const page: ListTaskPage = await api.page(
      params.listId,
      params.query,
      grouping ? { groupBy: grouping.groupBy, value: target.value } : null,
      target.cursor,
      LIST_PAGE_SIZE,
      signal,
    );
    groups = advanceGroup(groups, target.value, page);
    tasks.push(...page.items);
    (groupKeys[target.value] ??= []).push(...page.items.map((task: TaskSummary) => task.key));
    if (!folded) shown += page.items.length;
  }
  return { key: params.key, groups, tasks, groupKeys };
}

/**
 * Interface ListRowsStoreInstance
 *
 * @description
 * Public API of `ListRowsStore`.
 */
export interface ListRowsStoreInstance {
  // #region Properties
  /**
   * Property primary
   *
   * @description
   * The primary read of the rows: a failure reaches the route's error boundary through its
   * `value()`. A reload keeps the rows in place.
   *
   * @type {ResourceRef<RowsSnapshot | undefined>}
   * @readonly
   */
  readonly primary: ResourceRef<RowsSnapshot | undefined>;

  /**
   * Property rows
   *
   * @description
   * The rows in reading order, subtasks under their parent, each in its group.
   *
   * @type {Signal<readonly ListRow[]>}
   * @readonly
   */
  readonly rows: Signal<readonly ListRow[]>;

  /**
   * Property groupBy
   *
   * @description
   * The field the rows are grouped by, null when the view does not group.
   *
   * @type {Signal<ListGroupQuery['groupBy'] | null>}
   * @readonly
   */
  readonly groupBy: Signal<ListGroupQuery['groupBy'] | null>;

  /**
   * Property groupOrder
   *
   * @description
   * Group values in the gateway's order.
   *
   * @type {Signal<readonly string[]>}
   * @readonly
   */
  readonly groupOrder: Signal<readonly string[]>;

  /**
   * Property collapsed
   *
   * @description
   * Folded group values; « Annulé » by default when grouping by status.
   *
   * @type {Signal<readonly string[]>}
   * @readonly
   */
  readonly collapsed: Signal<readonly string[]>;

  /**
   * Property initialLoading
   *
   * @description
   * Whether the first read runs with no row to show: the table draws its skeleton.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly initialLoading: Signal<boolean>;

  /**
   * Property seekingRows
   *
   * @description
   * Whether visible groups remain unread while no renderable rows are available.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly seekingRows: Signal<boolean>;

  /**
   * Property hasCurrentSnapshot
   *
   * @description
   * Whether the current query has already produced rows, including an empty result.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly hasCurrentSnapshot: Signal<boolean>;

  /**
   * Property empty
   *
   * @description
   * Whether the read succeeded with no task: the empty state, never a failure.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly empty: Signal<boolean>;

  /**
   * Property loadingMore
   *
   * @description
   * Whether a next page is being read.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly loadingMore: Signal<boolean>;

  /**
   * Property moreFailed
   *
   * @description
   * Whether reading the next page failed.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly moreFailed: Signal<boolean>;
  // #endregion

  // #region Methods
  /**
   * Method load
   *
   * @description
   * Follows the list and the view's query. Another query reads again and keeps the rows until
   * the answer; another list or organization empties them at once.
   *
   * @param {Signal<ListRowsQuery> | ListRowsQuery} query - The list and the view's query.
   */
  load(query: Signal<ListRowsQuery> | ListRowsQuery): void;

  /**
   * Method useSubtasks
   *
   * @description
   * Follows the subtask display; a change forgets the subtasks opened or closed by hand.
   *
   * @param {Signal<SubtaskMode> | SubtaskMode} mode - The subtask display.
   */
  useSubtasks(mode: Signal<SubtaskMode> | SubtaskMode): void;

  /**
   * Method hideStatuses
   *
   * @description
   * Follows the statuses the space no longer uses, whose groups the view hides.
   *
   * @param {Signal<readonly string[]> | readonly string[]} keys - The hidden status keys.
   */
  hideStatuses(keys: Signal<readonly string[]> | readonly string[]): void;

  /**
   * Method groupCount
   *
   * @description
   * Tasks of a group from `countTaskGroups`, null without grouping or for an unknown group.
   *
   * @param {string} value - The group value.
   * @returns {number | null} The count.
   */
  groupCount(value: string): number | null;

  /**
   * Method setCollapsed
   *
   * @description
   * Folds the given groups; an opened group that is not read to its end reads its next page.
   *
   * @param {readonly string[]} values - The folded group values.
   */
  setCollapsed(values: readonly string[]): void;

  /**
   * Method loadMore
   *
   * @description
   * Reads the next page of the rows, when one is left and none is being read or failed.
   */
  loadMore(): void;

  /**
   * Method retryMore
   *
   * @description
   * « Réessayer » after a failed next page.
   */
  retryMore(): void;

  /**
   * Method toggleSubtasks
   *
   * @description
   * Opens or closes the subtasks of a task.
   *
   * @param {string} taskKey - The parent task.
   */
  toggleSubtasks(taskKey: string): void;

  /**
   * Method retrySubtasks
   *
   * @description
   * « Réessayer » after a failed read of the subtasks of a task.
   *
   * @param {string} taskKey - The parent task.
   */
  retrySubtasks(taskKey: string): void;

  /**
   * Method reload
   *
   * @description
   * Reads the rows again in place, as deep as they are read; queued while a read runs.
   */
  reload(): void;
  // #endregion
}

/**
 * Function createListRowsStore
 *
 * @description
 * Creates the store of the rows of the « Liste » view.
 *
 * @returns {Type<ListRowsStoreInstance>} Injectable store constructor.
 */
function createListRowsStore(): Type<ListRowsStoreInstance> {
  return signalStore(
    withEntities<TaskSummary>(),
    withState(initialState),
    withProps((store) => {
      const api: ListTasksApi = inject(ListTasksApi);
      const workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);
      const params: Signal<RowsParams | undefined> = computed(
        (): RowsParams | undefined => {
          const query: ListRowsQuery | null = store._query();
          if (!query) return undefined;
          const organizationId: string = workspace.organization().id;
          return { ...query, organizationId, key: rowsKey(organizationId, query) };
        },
        { equal: (a: RowsParams | undefined, b: RowsParams | undefined) => a?.key === b?.key },
      );
      const primary: ResourceRef<RowsSnapshot | undefined> = resource({
        params: () => params(),
        loader: ({
          params: read,
          abortSignal,
        }: {
          params: RowsParams;
          abortSignal: AbortSignal;
        }): Promise<RowsSnapshot> => {
          const sameKey: boolean = untracked(store._key) === read.key;
          const collapsed: readonly string[] = untracked(() =>
            collapsedOf(store._collapsed(), groupingOf(read)),
          );
          const hidden: readonly string[] =
            groupingOf(read) === 'status' ? untracked(store._hidden) : [];
          const want: number = Math.max(
            LIST_PAGE_SIZE,
            sameKey
              ? untracked(
                  () =>
                    store
                      .entities()
                      .filter((task: TaskSummary): boolean =>
                        groupValuesOf(task, groupingOf(read)).some(
                          (group: string): boolean =>
                            !collapsed.includes(group) && !hidden.includes(group),
                        ),
                      ).length,
                )
              : 0,
          );
          return loadSnapshot(api, read, collapsed, hidden, want, abortSignal);
        },
      });
      return {
        _api: api,
        _reloadRequests: new Subject<void>(),
        _params: params,
        _status: inject(TaskStatusChangesStore),
        _reduceMotion: inject(MediaMatcher).matchMedia('(prefers-reduced-motion: reduce)').matches,
        _taskCreate: inject(TaskCreate),
        _realtime: inject(RealtimeConnection, { optional: true }),
        primary,
      };
    }),
    withComputed((store) => {
      const effective: (task: TaskSummary) => TaskSummary = (task: TaskSummary): TaskSummary => {
        const settled: TaskSummary = store._status.settledTask(task);
        return store._reduceMotion
          ? { ...settled, status: store._status.displayedStatus(settled) }
          : settled;
      };
      const groupBy: () => ListGroupQuery['groupBy'] | null = () => groupingOf(store._params());
      return {
        groupBy,
        groupOrder: (): readonly string[] =>
          store._groups().map((group: GroupProgress): string => group.value),
        collapsed: (): readonly string[] => collapsedOf(store._collapsed(), groupBy()),
        initialLoading: (): boolean => store._key() === null && store._params() !== undefined,
        hasCurrentSnapshot: (): boolean =>
          store._params() !== undefined && store._key() === store._params()?.key,
        rows: (): readonly ListRow[] => {
          const grouping: ListGroupQuery['groupBy'] | null = groupBy();
          const mode: SubtaskMode = store._subtasks();
          const hidden: readonly string[] = grouping === 'status' ? store._hidden() : [];
          const open: Readonly<Partial<Record<string, boolean>>> = store._open();
          const children: Readonly<Partial<Record<string, ChildRows>>> = store._children();
          const entering: readonly string[] = store._entering();
          const entities: Readonly<Partial<Record<string, TaskSummary>>> = store.entityMap();
          const rows: ListRow[] = [];
          const walk: (task: TaskSummary, group: string, depth: number) => void = (
            task: TaskSummary,
            group: string,
            depth: number,
          ): void => {
            const shown: TaskSummary = effective(task);
            const expandable: boolean =
              mode !== 'separate' && depth < SUBTASK_DEPTH && shown.subtasks.total > 0;
            const expanded: boolean = expandable && (open[shown.key] ?? mode === 'expanded');
            const kids: ChildRows | undefined = children[shown.key];
            let actualDepth: number = depth;
            if (mode === 'separate') {
              let parent: string | null = shown.parentKey;
              while (parent !== null && actualDepth < SUBTASK_DEPTH) {
                const ancestor: TaskSummary | undefined = entities[parent];
                if (!ancestor) {
                  actualDepth = SUBTASK_DEPTH;
                  break;
                }
                actualDepth++;
                parent = ancestor.parentKey;
              }
            }
            rows.push({
              id: grouping === 'assignee' ? `${group}/${shown.key}` : shown.key,
              group,
              task: shown,
              status: store._status.displayedStatus(shown),
              depth,
              canAddSubtask: actualDepth < SUBTASK_DEPTH && shown.subtasks.total < 25,
              expandable,
              expanded,
              childrenFailed: expanded && kids?.status === 'failed',
              entering: depth === 0 && entering.includes(shown.key),
            });
            if (expanded && kids) {
              for (const child of kids.tasks) walk(child, group, depth + 1);
            }
          };
          if (grouping === 'assignee') {
            for (const group of store._groups()) {
              for (const key of store._groupKeys()[group.value] ?? []) {
                const task: TaskSummary | undefined = entities[key];
                if (task) walk(task, group.value, 0);
              }
            }
          } else {
            for (const task of store.entities()) {
              for (const group of groupValuesOf(effective(task), grouping)) {
                if (!hidden.includes(group)) walk(task, group, 0);
              }
            }
          }
          return rows;
        },
      };
    }),
    withComputed((store) => ({
      _hasMoreVisible: (): boolean => {
        const hidden: readonly string[] = store.groupBy() === 'status' ? store._hidden() : [];
        return store
          ._groups()
          .some((group: GroupProgress) => !hidden.includes(group.value) && !group.done);
      },
      _visibleChildren: (): readonly string[] => {
        const collapsed: readonly string[] = store.collapsed();
        return [
          ...new Set(
            store
              .rows()
              .filter((row: ListRow): boolean => row.expanded && !collapsed.includes(row.group))
              .map((row: ListRow): string => row.task.key),
          ),
        ];
      },
    })),
    withComputed((store) => ({
      seekingRows: (): boolean =>
        store.hasCurrentSnapshot() &&
        store.rows().length === 0 &&
        store._hasMoreVisible() &&
        !store.moreFailed(),
      empty: (): boolean =>
        store.hasCurrentSnapshot() && store.rows().length === 0 && !store._hasMoreVisible(),
    })),
    withMethods((store) => {
      let moreController: AbortController | null = null;
      let reloadQueued: boolean = false;
      const childQueue: string[] = [];
      const childVersions: Map<string, number> = new Map<string, number>();
      const childInFlight: Set<string> = new Set<string>();
      let childVersion: number = 0;
      let childReads: number = 0;

      const abortMore: () => void = (): void => {
        moreController?.abort();
        moreController = null;
      };

      const pumpChildren: () => void = (): void => {
        while (childReads < CHILD_READS) {
          const index: number = childQueue.findIndex((key: string) => !childInFlight.has(key));
          if (index < 0) return;
          const taskKey: string = childQueue.splice(index, 1)[0];
          const version: number | undefined = childVersions.get(taskKey);
          if (version === undefined) continue;
          const scope: string | null = store._scope();
          childInFlight.add(taskKey);
          childReads++;
          store._api
            .subtasks(taskKey)
            .then(
              (tasks: readonly TaskSummary[]): void => {
                if (scope !== store._scope() || childVersions.get(taskKey) !== version) return;
                patchState(store, (state: ListRowsState): Partial<ListRowsState> => ({
                  _children: { ...state._children, [taskKey]: { status: 'loaded', tasks } },
                }));
              },
              (): void => {
                if (scope !== store._scope() || childVersions.get(taskKey) !== version) return;
                patchState(store, (state: ListRowsState): Partial<ListRowsState> => ({
                  _children: {
                    ...state._children,
                    [taskKey]: { status: 'failed', tasks: state._children[taskKey]?.tasks ?? [] },
                  },
                }));
              },
            )
            .finally((): void => {
              childInFlight.delete(taskKey);
              childReads--;
              pumpChildren();
            });
        }
      };

      const readChildren: (taskKey: string, refresh?: boolean) => void = (
        taskKey: string,
        refresh: boolean = false,
      ): void => {
        if (
          childQueue.includes(taskKey) ||
          (!refresh && childInFlight.has(taskKey) && childVersions.has(taskKey))
        )
          return;
        childVersions.set(taskKey, ++childVersion);
        patchState(store, (state: ListRowsState): Partial<ListRowsState> => ({
          _children: {
            ...state._children,
            [taskKey]: { status: 'loading', tasks: state._children[taskKey]?.tasks ?? [] },
          },
        }));
        childQueue.push(taskKey);
        pumpChildren();
      };

      const loadMore: () => void = (): void => {
        const params: RowsParams | undefined = store._params();
        const key: string | null = store._key();
        if (
          params?.key !== key ||
          store.loadingMore() ||
          store.moreFailed() ||
          store.primary.isLoading()
        )
          return;
        const collapsed: readonly string[] = store.collapsed();
        const hidden: readonly string[] = store.groupBy() === 'status' ? store._hidden() : [];
        const target: GroupProgress | null = nextGroup(
          store._groups().filter((group: GroupProgress) => !hidden.includes(group.value)),
          store.rows().length === 0 ? [] : collapsed,
        );
        if (!target) return;
        const folded: boolean = collapsed.includes(target.value);
        const grouping: ListGroupQuery | null = params.groupQuery;
        const controller: AbortController = new AbortController();
        moreController = controller;
        patchState(store, { loadingMore: true });
        store._api
          .page(
            params.listId,
            params.query,
            grouping ? { groupBy: grouping.groupBy, value: target.value } : null,
            target.cursor,
            LIST_PAGE_SIZE,
            controller.signal,
          )
          .then(
            (page: ListTaskPage): void => {
              if (controller.signal.aborted || store._key() !== key) return;
              moreController = null;
              patchState(
                store,
                addEntities([...page.items]),
                (state: ListRowsState): Partial<ListRowsState> => ({
                  loadingMore: false,
                  _groups: advanceGroup(state._groups, target.value, page),
                  _groupKeys: {
                    ...state._groupKeys,
                    [target.value]: [
                      ...(state._groupKeys[target.value] ?? []),
                      ...page.items.map((task: TaskSummary) => task.key),
                    ],
                  },
                }),
              );
              if (folded) loadMore();
            },
            (): void => {
              if (controller.signal.aborted || store._key() !== key) return;
              moreController = null;
              patchState(store, { loadingMore: false, moreFailed: true });
            },
          );
      };

      const reload: () => void = (): void => {
        if (!store.primary.reload() && store._params() !== undefined) reloadQueued = true;
      };

      return {
        _follow: signalMethod<RowsParams | undefined>((params: RowsParams | undefined): void => {
          if (!params) return;
          const scope: string = `${params.organizationId}\u0000${params.listId}`;
          if (scope === store._scope()) return;
          abortMore();
          childQueue.length = 0;
          childVersions.clear();
          patchState(store, removeAllEntities(), {
            _scope: scope,
            _key: null,
            _groups: [],
            _groupKeys: {},
            _children: {},
            _open: {},
            _entering: [],
            loadingMore: false,
            moreFailed: false,
          });
        }),
        _apply: signalMethod<RowsSnapshot | undefined>(
          (snapshot: RowsSnapshot | undefined): void => {
            if (!snapshot || snapshot.key !== store._params()?.key) return;
            const sameKey: boolean = snapshot.key === store._key();
            abortMore();
            patchState(store, setAllEntities(uniqueTasks(snapshot.tasks)), {
              _key: snapshot.key,
              _groups: snapshot.groups,
              _groupKeys: snapshot.groupKeys,
              loadingMore: false,
              moreFailed: false,
            });
            if (sameKey) {
              for (const taskKey of store._visibleChildren()) {
                if (store._children()[taskKey]) readChildren(taskKey, true);
              }
            }
          },
        ),
        _flushReload: signalMethod<ResourceStatus>((status: ResourceStatus): void => {
          if (status !== 'loading' && status !== 'reloading' && reloadQueued) {
            reloadQueued = false;
            store.primary.reload();
          }
        }),
        _fillEmpty: signalMethod<boolean>((needed: boolean): void => {
          if (needed) loadMore();
        }),
        _syncChildren: signalMethod<readonly string[]>((keys: readonly string[]): void => {
          const visible: Set<string> = new Set<string>(keys);
          const stale: string[] = Object.keys(store._children()).filter(
            (key: string) => !visible.has(key),
          );
          if (stale.length > 0) {
            for (const key of stale) {
              childVersions.delete(key);
              const index: number = childQueue.indexOf(key);
              if (index >= 0) childQueue.splice(index, 1);
            }
            patchState(store, (state: ListRowsState): Partial<ListRowsState> => ({
              _children: Object.fromEntries(
                Object.entries(state._children).filter(([key]: [string, ChildRows | undefined]) =>
                  visible.has(key),
                ),
              ),
            }));
          }
          for (const key of keys) if (!store._children()[key]) readChildren(key);
        }),
        _watch: rxMethod<string | null>(
          pipe(
            switchMap((listId: string | null): Observable<RealtimeChange> =>
              listId === null || !store._realtime
                ? EMPTY
                : store._realtime.watch({ kind: 'list', listId }).pipe(catchError(() => EMPTY)),
            ),
            filter((notice: RealtimeChange): boolean => {
              const data: unknown = notice.data;
              const listId: string | undefined = store._params()?.listId;
              return (
                typeof data === 'object' &&
                data !== null &&
                (!('listId' in data) || data.listId === listId)
              );
            }),
            tap((): void => {
              store._reloadRequests.next();
            }),
          ),
        ),
        _entered(change: TaskStatusChange): void {
          if (groupingOf(store._params()) !== 'status' || change.from === change.to) return;
          patchState(store, (state: ListRowsState): Partial<ListRowsState> => ({
            _entering: [
              ...state._entering.filter((key: string): boolean => key !== change.taskId),
              change.taskId,
            ],
          }));
        },
        _settledEntry(taskKey: string): void {
          patchState(store, (state: ListRowsState): Partial<ListRowsState> => ({
            _entering: state._entering.filter((key: string): boolean => key !== taskKey),
          }));
        },
        load: signalMethod<ListRowsQuery>((query: ListRowsQuery): void => {
          patchState(store, { _query: query });
        }),
        useSubtasks: signalMethod<SubtaskMode>((mode: SubtaskMode): void => {
          if (mode !== store._subtasks()) patchState(store, { _subtasks: mode, _open: {} });
        }),
        hideStatuses: signalMethod<readonly string[]>((keys: readonly string[]): void => {
          patchState(store, { _hidden: keys });
        }),
        groupCount(value: string): number | null {
          return (
            store._groups().find((group: GroupProgress): boolean => group.value === value)?.count ??
            null
          );
        },
        setCollapsed(values: readonly string[]): void {
          const grouping: string = groupingOf(store._params()) ?? 'all';
          patchState(store, (state: ListRowsState): Partial<ListRowsState> => ({
            _collapsed: { ...state._collapsed, [grouping]: [...values] },
          }));
          loadMore();
        },
        loadMore,
        retryMore(): void {
          patchState(store, { moreFailed: false });
          loadMore();
        },
        toggleSubtasks(taskKey: string): void {
          const row: ListRow | undefined = store
            .rows()
            .find((item: ListRow): boolean => item.task.key === taskKey);
          if (!row?.expandable) return;
          patchState(store, (state: ListRowsState): Partial<ListRowsState> => ({
            _open: { ...state._open, [taskKey]: !row.expanded },
          }));
        },
        retrySubtasks(taskKey: string): void {
          readChildren(taskKey);
        },
        reload,
      };
    }),
    withHooks({
      onInit(store): void {
        const destroyRef: DestroyRef = inject(DestroyRef);
        const timers: Set<ReturnType<typeof setTimeout>> = new Set<ReturnType<typeof setTimeout>>();
        store._follow(store._params);
        store._apply(
          computed((): RowsSnapshot | undefined =>
            store.primary.hasValue() ? store.primary.value() : undefined,
          ),
        );
        store._flushReload(store.primary.status);
        store._fillEmpty(
          computed(
            (): boolean =>
              store.seekingRows() && !store.loadingMore() && !store.primary.isLoading(),
          ),
        );
        store._syncChildren(store._visibleChildren);
        const reloads: { unsubscribe: () => void } = store._reloadRequests
          .pipe(debounceTime(NOTICE_DEBOUNCE_MS))
          .subscribe((): void => {
            store.reload();
          });
        store._watch(computed((): string | null => store._params()?.listId ?? null));
        const completions: { unsubscribe: () => void } = store._status.completed.subscribe(
          ({
            task,
            organizationId,
          }: {
            task: TaskSummary;
            organizationId: string | null;
          }): void => {
            const params: RowsParams | undefined = store._params();
            if (task.listId === params?.listId && organizationId === params.organizationId)
              store._reloadRequests.next();
          },
        );
        const changes: { unsubscribe: () => void } = store._status.changed.subscribe(
          (change: TaskStatusChange): void => {
            store._entered(change);
            const timer: ReturnType<typeof setTimeout> = setTimeout((): void => {
              timers.delete(timer);
              store._settledEntry(change.taskId);
            }, ENTER_MS);
            timers.add(timer);
          },
        );
        const created: { unsubscribe: () => void } = store._taskCreate.created.subscribe(
          (task: CreatedTask): void => {
            if (task.listId === store._params()?.listId) store.reload();
          },
        );
        destroyRef.onDestroy((): void => {
          changes.unsubscribe();
          completions.unsubscribe();
          reloads.unsubscribe();
          store._reloadRequests.complete();
          created.unsubscribe();
          for (const timer of timers) clearTimeout(timer);
        });
      },
    }),
  );
}

/**
 * Constant ListRowsStore
 *
 * @description
 * The rows of the « Liste » view, provided by the `list` route with `TaskStatusChangesStore`. Grouping is a filter: the primary read takes the group counts
 * (`countTaskGroups`), then cursor pages of each group in order (`queryListTasks` with the
 * group's value); `loadMore` reads the next page as the table scrolls, and a folded group reads
 * its first page only, so its header shows. A row is filed under its settled status, so it joins
 * its new group 460 ms after the last click while its icon and word change at once. Subtasks are
 * read under each opened parent (`listSubtasks`), two levels deep. A realtime notice of the list
 * reads the rows again in place, after 300 ms of quiet; the status store keeps pending
 * and in-flight changes over what it reads. The rows follow the committed organization: a switch
 * or another list empties them at once and drops late answers.
 *
 * @type {Type<ListRowsStoreInstance>}
 */
export const ListRowsStore: Type<ListRowsStoreInstance> = createListRowsStore();
