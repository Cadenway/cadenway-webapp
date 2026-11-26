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
   * Property unknownPresentation
   *
   * @description
   * Stored presentation values this client does not read (a newer client's statuses, columns or
   * sort), absent when there are none; written back with the view's next `Save`.
   *
   * @type {UnknownPresentation | undefined}
   * @readonly
   */
  readonly unknownPresentation?: UnknownPresentation;

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
 * Interface SavedViewCreationDraft
 *
 * @description
 * What a new saved view stores: its name and icon, the layout and the configuration, and, for a
 * view restored after its deletion, the presentation values its read did not understand.
 */
export interface SavedViewCreationDraft {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * View name.
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
   * Configuration to store.
   *
   * @type {ListViewConfig}
   * @readonly
   */
  readonly config: ListViewConfig;

  /**
   * Property unknownPresentation
   *
   * @description
   * Unknown presentation values to keep, absent for a new view.
   *
   * @type {UnknownPresentation | undefined}
   * @readonly
   */
  readonly unknownPresentation?: UnknownPresentation;
  // #endregion
}

/**
 * Interface UnknownPresentation
 *
 * @description
 * The part of a stored presentation `ListViewPresentation` cannot hold: the contract lets future
 * clients store statuses, sheet columns and sort values this client does not know. They are kept
 * as read and merged back on writing, so saving a view never erases them.
 */
export interface UnknownPresentation {
  // #region Properties
  /**
   * Property hiddenBoardStatusKeys
   *
   * @description
   * Hidden board columns of unknown statuses.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly hiddenBoardStatusKeys: readonly string[];

  /**
   * Property hiddenSheetColumns
   *
   * @description
   * Hidden sheet columns of unknown keys.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly hiddenSheetColumns: readonly string[];

  /**
   * Property sheetSort
   *
   * @description
   * A sheet sort by an unknown column or in an unknown direction, or null.
   *
   * @type {{ readonly column: string; readonly direction: string } | null}
   * @readonly
   */
  readonly sheetSort: { readonly column: string; readonly direction: string } | null;

  /**
   * Property customFieldSort
   *
   * @description
   * A custom-field sort in an unknown direction, or null.
   *
   * @type {{ readonly fieldId: string; readonly direction: string } | null}
   * @readonly
   */
  readonly customFieldSort: { readonly fieldId: string; readonly direction: string } | null;
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
