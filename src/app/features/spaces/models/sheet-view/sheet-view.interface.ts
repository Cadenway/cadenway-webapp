import type { StatusKey } from '@cadenway/contracts';

import type { TaskSummary } from '@features/task';

import type { SheetColumn, SortDirection } from '../list-view-config/list-view-config.interface';

/**
 * Type SheetFieldType
 *
 * @description
 * The kinds of custom field the sheet shows and edits: the contract's delivery supports numeric
 * and text values (`CustomFieldDefinition.type`).
 *
 * @type {'number' | 'text'}
 */
export type SheetFieldType = 'number' | 'text';

/**
 * Type SheetFieldValue
 *
 * @description
 * A custom field value of a task: a number for a numeric field, a text for a text field.
 *
 * @type {number | string}
 */
export type SheetFieldValue = number | string;

/**
 * Interface SheetCustomField
 *
 * @description
 * An active custom field of the list's space (`listListCustomFields`), one sheet column after the
 * built-in ones (`Points` and `Client` in the mockup, `TBL_COLS` of `App.dc.html`).
 */
export interface SheetCustomField {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Stable id of the field, the key of its values on a task.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * Name of the field, its column header.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property type
   *
   * @description
   * Kind of value: numbers are aligned at the end and summed in the footer.
   *
   * @type {SheetFieldType}
   * @readonly
   */
  readonly type: SheetFieldType;

  /**
   * Property position
   *
   * @description
   * Zero-based position among the active fields of the space: the column order.
   *
   * @type {number}
   * @readonly
   */
  readonly position: number;

  /**
   * Property sprintPoints
   *
   * @description
   * Whether this numeric field holds the sprint points, summed in the sheet's title.
   *
   * @type {boolean}
   * @readonly
   */
  readonly sprintPoints: boolean;
  // #endregion
}

/**
 * Interface SheetTaskFacts
 *
 * @description
 * What the sheet shows of a task beyond its summary (`TaskSummary` carries neither): its
 * estimate and its custom field values, as `queryListTasks` answered them at a version.
 */
export interface SheetTaskFacts {
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
   * Property version
   *
   * @description
   * Version of the task these values were read at: an older read never replaces a newer one.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;

  /**
   * Property estimateMinutes
   *
   * @description
   * Estimate in whole minutes, null when there is none.
   *
   * @type {number | null}
   * @readonly
   */
  readonly estimateMinutes: number | null;

  /**
   * Property customFieldValues
   *
   * @description
   * Custom field values by field id; a field without a value is absent.
   *
   * @type {Readonly<Partial<Record<string, SheetFieldValue>>>}
   * @readonly
   */
  readonly customFieldValues: Readonly<Partial<Record<string, SheetFieldValue>>>;
  // #endregion
}

/**
 * Interface SheetFactChanges
 *
 * @description
 * An edit of the sheet the task summary cannot show: a new estimate or custom field values
 * (null clears), shown at once while it is pending and until a read reaches its version.
 */
export interface SheetFactChanges {
  // #region Properties
  /**
   * Property estimateMinutes
   *
   * @description
   * New estimate in minutes, or null to remove it.
   *
   * @type {number | null | undefined}
   * @readonly
   */
  readonly estimateMinutes?: number | null;

  /**
   * Property customFieldValues
   *
   * @description
   * New custom field values by field id; null clears that field.
   *
   * @type {Readonly<Record<string, SheetFieldValue | null>> | undefined}
   * @readonly
   */
  readonly customFieldValues?: Readonly<Record<string, SheetFieldValue | null>>;
  // #endregion
}

/**
 * Interface SheetRow
 *
 * @description
 * One row of the sheet: a task as the view shows it, with its estimate, its custom field values
 * and its time spent once read.
 */
export interface SheetRow {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Identity of the row: the task key, after its group (`<group>/<key>`) while the view groups
   * (a task with two assignees has a row in each assignee's group).
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property group
   *
   * @description
   * The group the row shows in: a status, a priority, an assignee (`none` for unassigned), empty
   * while the view does not group.
   *
   * @type {string}
   * @readonly
   */
  readonly group: string;

  /**
   * Property task
   *
   * @description
   * The task as shown, the view's writes applied (name, due date, status, priority, assignees).
   *
   * @type {TaskSummary}
   * @readonly
   */
  readonly task: TaskSummary;

  /**
   * Property status
   *
   * @description
   * The status the task shows.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;

  /**
   * Property estimateMinutes
   *
   * @description
   * Estimate in minutes, an edit of the sheet applied; null when there is none.
   *
   * @type {number | null}
   * @readonly
   */
  readonly estimateMinutes: number | null;

  /**
   * Property customFieldValues
   *
   * @description
   * Custom field values by field id, the edits of the sheet applied.
   *
   * @type {Readonly<Partial<Record<string, SheetFieldValue>>>}
   * @readonly
   */
  readonly customFieldValues: Readonly<Partial<Record<string, SheetFieldValue>>>;

  /**
   * Property spentMinutes
   *
   * @description
   * Time logged on the task in minutes (`getTaskTimeSummary`, read once its row shows), null
   * until read.
   *
   * @type {number | null}
   * @readonly
   */
  readonly spentMinutes: number | null;
  // #endregion
}

/**
 * Interface SheetTotals
 *
 * @description
 * The aggregates of the footer row and of the title, over every row of the sheet.
 */
export interface SheetTotals {
  // #region Properties
  /**
   * Property count
   *
   * @description
   * Rows of the sheet.
   *
   * @type {number}
   * @readonly
   */
  readonly count: number;

  /**
   * Property done
   *
   * @description
   * Rows whose task shows `done`.
   *
   * @type {number}
   * @readonly
   */
  readonly done: number;

  /**
   * Property estimateMinutes
   *
   * @description
   * Sum of the estimates, in minutes.
   *
   * @type {number}
   * @readonly
   */
  readonly estimateMinutes: number;

  /**
   * Property spentMinutes
   *
   * @description
   * Sum of the time spent in minutes once every row's is read, null before (gap G6).
   *
   * @type {number | null}
   * @readonly
   */
  readonly spentMinutes: number | null;

  /**
   * Property fieldSums
   *
   * @description
   * Sum of each numeric custom field, by field id.
   *
   * @type {Readonly<Partial<Record<string, number>>>}
   * @readonly
   */
  readonly fieldSums: Readonly<Partial<Record<string, number>>>;
  // #endregion
}

/**
 * Type SheetColumnKey
 *
 * @description
 * Key of a sheet column in the table: a built-in column, or `field:<id>` for a custom field.
 *
 * @type {SheetColumn | `field:${string}`}
 */
export type SheetColumnKey = SheetColumn | `field:${string}`;

/**
 * Interface SheetOrder
 *
 * @description
 * The order the sheet shows: a column and a direction, from the presentation's `customFieldSort`
 * (while the list has the field) or `sheetSort`.
 */
export interface SheetOrder {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Key of the sorted column.
   *
   * @type {SheetColumnKey}
   * @readonly
   */
  readonly key: SheetColumnKey;

  /**
   * Property direction
   *
   * @description
   * Sort direction.
   *
   * @type {SortDirection}
   * @readonly
   */
  readonly direction: SortDirection;
  // #endregion
}
