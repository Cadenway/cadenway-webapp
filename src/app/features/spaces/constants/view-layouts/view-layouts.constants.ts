import type { ViewLayout } from '../../models/saved-view/saved-view.interface';
import type { ViewTool } from '../../models/view-tool/view-tool.type';

/**
 * Constant VIEW_LAYOUTS
 *
 * @description
 * The nine layouts in the mockup's order (`VIEW_DEFS` of `App.dc.html`), as the tabs list them.
 *
 * @type {readonly ViewLayout[]}
 */
export const VIEW_LAYOUTS: readonly ViewLayout[] = [
  'list',
  'board',
  'calendar',
  'gantt',
  'workload',
  'table',
  'form',
  'activity',
  'timesheet',
];

/**
 * Constant LAYOUT_SEGMENTS
 *
 * @description
 * The route segment of each layout below `l/:listId`. The segment is the layout key, except the
 * saved views' `table`, whose English address follows its tab name, `sheet`.
 *
 * @type {Readonly<Record<ViewLayout, string>>}
 */
export const LAYOUT_SEGMENTS: Readonly<Record<ViewLayout, string>> = {
  list: 'list',
  board: 'board',
  calendar: 'calendar',
  gantt: 'gantt',
  workload: 'workload',
  table: 'sheet',
  form: 'form',
  activity: 'activity',
  timesheet: 'timesheet',
};

/**
 * Constant ALL_TOOLS
 *
 * @description
 * The tools of a task layout grouped by `Group by`.
 *
 * @type {readonly ViewTool[]}
 */
const ALL_TOOLS: readonly ViewTool[] = [
  'milestones',
  'filter',
  'sort',
  'group',
  'search',
  'subtasks',
  'create',
  'save',
];

/**
 * Constant LAYOUT_TOOLS
 *
 * @description
 * The view tools each layout shows. The board's columns are statuses, so `Columns` (its hidden
 * columns) replaces `Group by` (`App.dc.html` line 9217); `Form` and `Activity` hide the tools
 * (line 7811); every other layout, `Timesheet` included, shows them all, as the mockup does. An
 * empty list hides the toolbar and the `Active filters` row.
 *
 * @type {Readonly<Record<ViewLayout, readonly ViewTool[]>>}
 */
export const LAYOUT_TOOLS: Readonly<Record<ViewLayout, readonly ViewTool[]>> = {
  list: ALL_TOOLS,
  board: ALL_TOOLS.map((tool: ViewTool): ViewTool => (tool === 'group' ? 'columns' : tool)),
  calendar: ALL_TOOLS,
  gantt: ALL_TOOLS,
  workload: ALL_TOOLS,
  table: ALL_TOOLS,
  form: [],
  activity: [],
  timesheet: ALL_TOOLS,
};
