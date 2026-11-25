import type { LookIcon } from '../look/look.type';
import type { ListViewConfig } from '../list-view-config/list-view-config.interface';

/**
 * Type ViewLayout
 *
 * @description
 * The nine view layouts of a list (`VIEW_DEFS` of `App.dc.html`); only `list` is built in step 4a.
 *
 * @type {'list' | 'board' | 'calendar' | 'gantt' | 'workload' | 'table' | 'form' | 'activity' | 'timesheet'}
 */
export type ViewLayout =
  | 'list'
  | 'board'
  | 'calendar'
  | 'gantt'
  | 'workload'
  | 'table'
  | 'form'
  | 'activity'
  | 'timesheet';

/**
 * Interface SavedView
 *
 * @description
 * A view saved on a list and shared by its readers: a layout with its filters, sort and grouping.
 */
export interface SavedView {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * View identifier, also the `?savedView=` of its address.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property listId
   *
   * @description
   * List of the view.
   *
   * @type {string}
   * @readonly
   */
  readonly listId: string;

  /**
   * Property name
   *
   * @description
   * View name (`Critical bugs`).
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property icon
   *
   * @description
   * Icon key, or null for the layout's icon.
   *
   * @type {LookIcon}
   * @readonly
   */
  readonly icon: LookIcon;

  /**
   * Property layout
   *
   * @description
   * Layout the view opens.
   *
   * @type {ViewLayout}
   * @readonly
   */
  readonly layout: ViewLayout;

  /**
   * Property config
   *
   * @description
   * Stored filters, sort and grouping; the subtask display is always `nested` here.
   *
   * @type {ListViewConfig}
   * @readonly
   */
  readonly config: ListViewConfig;

  /**
   * Property version
   *
   * @description
   * Version sent with `If-Match`.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;
  // #endregion
}

/**
 * Interface SavedViewDraft
 *
 * @description
 * What the `Save the view` dialog submits.
 */
export interface SavedViewDraft {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * Trimmed, non-empty name.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property icon
   *
   * @description
   * Chosen icon, or null for the layout's icon.
   *
   * @type {LookIcon}
   * @readonly
   */
  readonly icon: LookIcon;
  // #endregion
}
