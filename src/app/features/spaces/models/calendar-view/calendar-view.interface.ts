import type { ListTaskQuery } from '../list-view-config/list-view-config.interface';

/**
 * Type CalendarMode
 *
 * @description
 * What the `Calendar` view shows: the month grid of six weeks (the mockup's only mode) or one
 * week, which `cw-calendar-view` also offers.
 *
 * @type {'month' | 'week'}
 */
export type CalendarMode = 'month' | 'week';

/**
 * Interface CalendarRead
 *
 * @description
 * What the `Calendar` view reads: the list and the view's query (`ListViewStore.taskQuery`); the
 * view adds its own due window.
 */
export interface CalendarRead {
  // #region Properties
  /**
   * Property listId
   *
   * @description
   * The list.
   *
   * @type {string}
   * @readonly
   */
  readonly listId: string;

  /**
   * Property query
   *
   * @description
   * The view's filters, search, milestones, level and sort.
   *
   * @type {ListTaskQuery}
   * @readonly
   */
  readonly query: ListTaskQuery;
  // #endregion
}
