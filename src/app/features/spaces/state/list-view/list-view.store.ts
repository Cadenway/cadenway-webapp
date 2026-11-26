import type { Signal, Type } from '@angular/core';
import {
  patchState,
  signalMethod,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';

import { LAYOUT_TOOLS } from '../../constants/view-layouts/view-layouts.constants';
import type {
  FilterField,
  ListGroupBy,
  ListGroupQuery,
  ListSortField,
  ListTaskQuery,
  ListViewConfig,
  ListViewFilters,
  ListViewPresentation,
  SheetExportSort,
  SubtaskMode,
} from '../../models/list-view-config/list-view-config.interface';
import type { ListRowsSummary } from '../../models/list-rows/list-rows.interface';
import type { SavedView, ViewLayout } from '../../models/saved-view/saved-view.interface';
import type { ViewTool } from '../../models/view-tool/view-tool.type';
import {
  DEFAULT_PRESENTATION,
  DEFAULT_VIEW_CONFIG,
  EMPTY_FILTERS,
  filterCount,
  presentationFor,
  samePresentation,
  sameSavedSettings,
  sheetExportSort,
  toGroupQuery,
  toTaskQuery,
} from '../../utils/list-view-query/list-view-query.util';

/**
 * Interface ListViewState
 *
 * @description
 * What the views of the open list show, and the saved view it came from.
 */
interface ListViewState {
  // #region Properties
  /**
   * Property config
   *
   * @description
   * Filters, sort, grouping and subtask display.
   *
   * @type {ListViewConfig}
   * @readonly
   */
  readonly config: ListViewConfig;

  /**
   * Property search
   *
   * @description
   * Text typed in `Search`.
   *
   * @type {string}
   * @readonly
   */
  readonly search: string;

  /**
   * Property milestonesOnly
   *
   * @description
   * Whether `Milestones` keeps only the milestones.
   *
   * @type {boolean}
   * @readonly
   */
  readonly milestonesOnly: boolean;

  /**
   * Property savedView
   *
   * @description
   * The saved view applied, as last saved, or null for a standard tab.
   *
   * @type {SavedView | null}
   * @readonly
   */
  readonly savedView: SavedView | null;

  /**
   * Property layout
   *
   * @description
   * Layout of the routed view, which the list page publishes (`showLayout`).
   *
   * @type {ViewLayout}
   * @readonly
   */
  readonly layout: ViewLayout;

  /**
   * Property rows
   *
   * @description
   * What the rows of the view shown tell `Filter` and `Subtasks`, published by that view.
   *
   * @type {ListRowsSummary}
   * @readonly
   */
  readonly rows: ListRowsSummary;

  /**
   * Property _before
   *
   * @description
   * Configuration of the standard tab before a saved view was applied, restored on leaving it.
   *
   * @type {ListViewConfig | null}
   * @readonly
   */
  readonly _before: ListViewConfig | null;
  // #endregion
}

/**
 * Interface ListViewStoreInstance
 *
 * @description
 * The view configuration of the open list and the queries it maps to. The rows pass reads
 * `taskQuery` and `groupQuery` and sends them through its data-access service.
 */
export interface ListViewStoreInstance {
  // #region Properties
  /**
   * Property config
   *
   * @description
   * Filters, sort, grouping and subtask display.
   *
   * @type {Signal<ListViewConfig>}
   * @readonly
   */
  readonly config: Signal<ListViewConfig>;

  /**
   * Property search
   *
   * @description
   * Text typed in `Search`.
   *
   * @type {Signal<string>}
   * @readonly
   */
  readonly search: Signal<string>;

  /**
   * Property milestonesOnly
   *
   * @description
   * Whether `Milestones` keeps only the milestones.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly milestonesOnly: Signal<boolean>;

  /**
   * Property savedView
   *
   * @description
   * The saved view applied, or null.
   *
   * @type {Signal<SavedView | null>}
   * @readonly
   */
  readonly savedView: Signal<SavedView | null>;

  /**
   * Property layout
   *
   * @description
   * Layout of the routed view: the one a saved view opened, the standard tab picked, or `list`
   * when either is not released.
   *
   * @type {Signal<ViewLayout>}
   * @readonly
   */
  readonly layout: Signal<ViewLayout>;

  /**
   * Property tools
   *
   * @description
   * The view tools the layout shows (`LAYOUT_TOOLS`); empty hides the toolbar and the chips.
   *
   * @type {Signal<readonly ViewTool[]>}
   * @readonly
   */
  readonly tools: Signal<readonly ViewTool[]>;

  /**
   * Property presentation
   *
   * @description
   * Hidden columns and the sheet's own sort, shared by the board and the sheet with the saved
   * view applied.
   *
   * @type {Signal<ListViewPresentation>}
   * @readonly
   */
  readonly presentation: Signal<ListViewPresentation>;

  /**
   * Property sheetExportSort
   *
   * @description
   * The sheet's sort the CSV export follows, or null outside the sheet or without one.
   *
   * @type {Signal<SheetExportSort | null>}
   * @readonly
   */
  readonly sheetExportSort: Signal<SheetExportSort | null>;

  /**
   * Property filterCount
   *
   * @description
   * Fields that filter something.
   *
   * @type {Signal<number>}
   * @readonly
   */
  readonly filterCount: Signal<number>;

  /**
   * Property modified
   *
   * @description
   * Whether the applied saved view differs from what it saved (`Modified`): its filters, sort,
   * grouping or the presentation of the layout shown.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly modified: Signal<boolean>;

  /**
   * Property canSave
   *
   * @description
   * Whether a standard tab differs from the default, so `Save the view` shows: its filters,
   * sort or grouping, or hidden columns on the board or the sheet (`App.dc.html` line 7883).
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly canSave: Signal<boolean>;

  /**
   * Property taskQuery
   *
   * @description
   * The `queryListTasks` body of the view, without cursor and limit.
   *
   * @type {Signal<ListTaskQuery>}
   * @readonly
   */
  readonly taskQuery: Signal<ListTaskQuery>;

  /**
   * Property groupQuery
   *
   * @description
   * The `countTaskGroups` parameters of the view, or null when it is not grouped.
   *
   * @type {Signal<ListGroupQuery | null>}
   * @readonly
   */
  readonly groupQuery: Signal<ListGroupQuery | null>;

  /**
   * Property rows
   *
   * @description
   * What the rows of the view shown tell `Filter` and `Subtasks`: unknown until a view
   * publishes it with `followRows`.
   *
   * @type {Signal<ListRowsSummary>}
   * @readonly
   */
  readonly rows: Signal<ListRowsSummary>;
  // #endregion

  // #region Methods
  /**
   * Method followRows
   *
   * @description
   * Publishes the summary of the shown view's rows to the list page, until the caller is destroyed.
   *
   * @param {Signal<ListRowsSummary> | ListRowsSummary} summary - The rows' summary.
   */
  followRows(summary: Signal<ListRowsSummary> | ListRowsSummary): void;

  /**
   * Method showLayout
   *
   * @description
   * Records the layout of the routed view, which the list page follows; another layout forgets
   * the rows' summary until its view publishes one.
   *
   * @param {Signal<ViewLayout> | ViewLayout} layout - The routed layout.
   */
  showLayout(layout: Signal<ViewLayout> | ViewLayout): void;

  /**
   * Method setPresentation
   *
   * @description
   * Changes members of the presentation (hidden columns, sheet sort), keeping the others.
   *
   * @param {Partial<ListViewPresentation>} change - Members to change.
   */
  setPresentation(change: Partial<ListViewPresentation>): void;

  /**
   * Method toggleFilter
   *
   * @description
   * Adds a value to a filter field, or removes it when kept already.
   *
   * @param {FilterField} field - Filter field.
   * @param {string} value - Status, priority, assignee (`me`, `none`, account id) or label.
   */
  toggleFilter(field: FilterField, value: string): void;

  /**
   * Method clearFilter
   *
   * @description
   * Removes one filter field (the chip's cross).
   *
   * @param {FilterField} field - Filter field.
   */
  clearFilter(field: FilterField): void;

  /**
   * Method clearFilters
   *
   * @description
   * Removes every filter (`Clear all`).
   */
  clearFilters(): void;

  /**
   * Method setSort
   *
   * @description
   * Sorts by a criterion, keeping the direction.
   *
   * @param {ListSortField} field - Criterion.
   */
  setSort(field: ListSortField): void;

  /**
   * Method toggleSortDirection
   *
   * @description
   * Switches between `ascending` and `descending`.
   */
  toggleSortDirection(): void;

  /**
   * Method setGroupBy
   *
   * @description
   * Groups by a field, or not at all.
   *
   * @param {ListGroupBy} groupBy - Grouping.
   */
  setGroupBy(groupBy: ListGroupBy): void;

  /**
   * Method setSubtasks
   *
   * @description
   * Changes the subtask display.
   *
   * @param {SubtaskMode} mode - Display.
   */
  setSubtasks(mode: SubtaskMode): void;

  /**
   * Method setSearch
   *
   * @description
   * Changes the search text.
   *
   * @param {string} search - Typed text.
   */
  setSearch(search: string): void;

  /**
   * Method toggleMilestones
   *
   * @description
   * Presses or releases `Milestones`.
   */
  toggleMilestones(): void;

  /**
   * Method applySaved
   *
   * @description
   * Shows a saved view: its filters, sort and grouping, keeping the subtask display. The standard
   * tab's configuration is kept for when the view is left.
   *
   * @param {SavedView} view - Saved view.
   */
  applySaved(view: SavedView): void;

  /**
   * Method leaveSaved
   *
   * @description
   * Returns to the standard tab with the configuration it had before the saved view.
   */
  leaveSaved(): void;

  /**
   * Method revert
   *
   * @description
   * Puts back what the applied saved view saved (`Revert`).
   */
  revert(): void;

  /**
   * Method markSaved
   *
   * @description
   * Records that a view now saves the current configuration: after creating it (the view becomes
   * the applied one) or after `Save`.
   *
   * @param {SavedView} view - The saved view as the gateway answered.
   */
  markSaved(view: SavedView): void;

  /**
   * Method reset
   *
   * @description
   * Starts over with the default configuration, for another list; the routed layout stays.
   */
  reset(): void;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * The default configuration, no search, no saved view.
 *
 * @type {ListViewState}
 */
const initialState: ListViewState = {
  config: DEFAULT_VIEW_CONFIG,
  search: '',
  milestonesOnly: false,
  savedView: null,
  layout: 'list',
  rows: { visibleCount: null, hasSubtasks: null },
  _before: null,
};

/**
 * Function createListViewStore
 *
 * @description
 * Creates the list view store.
 *
 * @returns {Type<ListViewStoreInstance>} Injectable store constructor.
 */
function createListViewStore(): Type<ListViewStoreInstance> {
  return signalStore(
    withState(initialState),
    withComputed((store) => ({
      tools: (): readonly ViewTool[] => LAYOUT_TOOLS[store.layout()],
      presentation: (): ListViewPresentation => store.config().presentation,
      sheetExportSort: (): SheetExportSort | null =>
        sheetExportSort(store.layout(), store.config().presentation),
      filterCount: (): number => filterCount(store.config().filters),
      modified: (): boolean => {
        const saved: SavedView | null = store.savedView();
        return (
          saved !== null &&
          (!sameSavedSettings(store.config(), saved.config) ||
            !samePresentation(
              presentationFor(store.layout(), store.config().presentation),
              presentationFor(store.layout(), saved.config.presentation),
            ))
        );
      },
      canSave: (): boolean =>
        store.savedView() === null &&
        (!sameSavedSettings(store.config(), DEFAULT_VIEW_CONFIG) ||
          !samePresentation(
            presentationFor(store.layout(), store.config().presentation),
            DEFAULT_PRESENTATION,
          )),
      taskQuery: (): ListTaskQuery =>
        toTaskQuery(store.config(), store.search(), store.milestonesOnly()),
    })),
    withComputed((store) => ({
      groupQuery: (): ListGroupQuery | null => toGroupQuery(store.config(), store.taskQuery()),
    })),
    withMethods((store) => {
      const setFilters: (filters: ListViewFilters) => void = (filters: ListViewFilters): void => {
        patchState(store, { config: { ...store.config(), filters } });
      };
      return {
        toggleFilter(field: FilterField, value: string): void {
          const current: readonly string[] = store.config().filters[field];
          const next: readonly string[] = current.includes(value)
            ? current.filter((item: string): boolean => item !== value)
            : [...current, value];
          setFilters({ ...store.config().filters, [field]: next });
        },
        clearFilter(field: FilterField): void {
          setFilters({ ...store.config().filters, [field]: [] });
        },
        clearFilters(): void {
          setFilters(EMPTY_FILTERS);
        },
        setSort(field: ListSortField): void {
          patchState(store, {
            config: { ...store.config(), sort: { ...store.config().sort, field } },
          });
        },
        toggleSortDirection(): void {
          const sort: ListViewConfig['sort'] = store.config().sort;
          patchState(store, {
            config: {
              ...store.config(),
              sort: { ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' },
            },
          });
        },
        setGroupBy(groupBy: ListGroupBy): void {
          patchState(store, { config: { ...store.config(), groupBy } });
        },
        setSubtasks(subtasks: SubtaskMode): void {
          patchState(store, { config: { ...store.config(), subtasks } });
        },
        setSearch(search: string): void {
          patchState(store, { search });
        },
        toggleMilestones(): void {
          patchState(store, { milestonesOnly: !store.milestonesOnly() });
        },
        applySaved(view: SavedView): void {
          patchState(store, {
            _before: store.savedView() === null ? store.config() : store._before(),
            savedView: view,
            config: { ...view.config, subtasks: store.config().subtasks },
          });
        },
        leaveSaved(): void {
          if (store.savedView() === null) return;
          patchState(store, {
            savedView: null,
            config: {
              ...(store._before() ?? DEFAULT_VIEW_CONFIG),
              subtasks: store.config().subtasks,
            },
            _before: null,
          });
        },
        revert(): void {
          const saved: SavedView | null = store.savedView();
          if (!saved) return;
          patchState(store, { config: { ...saved.config, subtasks: store.config().subtasks } });
        },
        markSaved(view: SavedView): void {
          patchState(store, {
            _before: store.savedView() === null ? DEFAULT_VIEW_CONFIG : store._before(),
            savedView: view,
          });
        },
        setPresentation(change: Partial<ListViewPresentation>): void {
          patchState(store, {
            config: {
              ...store.config(),
              presentation: { ...store.config().presentation, ...change },
            },
          });
        },
        reset(): void {
          patchState(store, { ...initialState, layout: store.layout() });
        },
        followRows: signalMethod<ListRowsSummary>((rows: ListRowsSummary): void => {
          patchState(store, { rows });
        }),
        showLayout: signalMethod<ViewLayout>((layout: ViewLayout): void => {
          if (layout === store.layout()) return;
          patchState(store, { layout, rows: initialState.rows });
        }),
      };
    }),
  );
}

/**
 * Constant ListViewStore
 *
 * @description
 * The view configuration of the open list, provided by the `l/:listId` route so every view of the
 * list shares it: switching view never changes the data shown. It maps the configuration to the
 * `queryListTasks` body (`taskQuery`) and the `countTaskGroups` parameters (`groupQuery`) for the
 * rows. A saved view is applied over the standard tab, which gets its configuration back when the
 * view is left; the subtask display, the search and `Milestones` stay local and never make a saved
 * view `Modified`. It also holds the routed layout (`showLayout`, published by the list page),
 * the tools that layout shows (`tools`) and the presentation (`setPresentation`: the board's
 * hidden columns, the sheet's hidden columns and sort), of which only the shown layout's part
 * counts for `canSave` and `modified`.
 *
 * @type {ReturnType<typeof createListViewStore>}
 */
export const ListViewStore: ReturnType<typeof createListViewStore> = createListViewStore();
