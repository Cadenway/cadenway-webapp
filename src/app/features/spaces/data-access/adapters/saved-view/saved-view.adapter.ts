import type {
  BulkTaskAction,
  BulkTaskActionValue,
  CountTaskGroupsParams,
  ExportListTasksParams,
  ListTasksQuery,
  PriorityKey as PriorityKeyDto,
  SavedView as SavedViewDto,
  SavedViewConfigurationInput,
  SavedViewFilters,
  StatusKey as StatusKeyDto,
} from '@cadenway/api-client';

import { PRIORITY_ORDER } from '../../../constants/statuses/statuses.constants';
import type { BulkAction, BulkSelection } from '../../../models/bulk-action/bulk-action.interface';
import type {
  ListGroupBy,
  ListGroupQuery,
  ListTaskQuery,
  ListViewConfig,
  PriorityKey,
  StatusKey,
} from '../../../models/list-view-config/list-view-config.interface';
import type { SavedView, ViewLayout } from '../../../models/saved-view/saved-view.interface';
import { fromSortKey, toSortKey } from '../../../utils/list-view-query/list-view-query.util';
import { isStatusKey, toLookIcon } from '../space/space.adapter';

/**
 * Constant LAYOUTS
 *
 * @description
 * Layouts the contract declares.
 *
 * @type {readonly ViewLayout[]}
 */
const LAYOUTS: readonly ViewLayout[] = [
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
 * Function toGroupBy
 *
 * @description
 * Reads a stored grouping; null or an unknown value is no grouping.
 *
 * @param {string | null} value - Gateway grouping.
 * @returns {ListGroupBy} The grouping.
 */
function toGroupBy(value: string | null): ListGroupBy {
  return value === 'status' || value === 'priority' || value === 'assignee' ? value : null;
}

/**
 * Function toSavedView
 *
 * @description
 * Maps a saved view; unknown statuses, priorities and layouts are dropped or read as `list`.
 *
 * @param {SavedViewDto} dto - Gateway view.
 * @returns {SavedView} The display model.
 */
export function toSavedView(dto: SavedViewDto): SavedView {
  const filters: SavedViewFilters = dto.configuration.filters;
  return {
    id: dto.id,
    listId: dto.listId,
    name: dto.name,
    icon: toLookIcon(dto.icon),
    layout: (LAYOUTS as readonly string[]).includes(dto.configuration.layout)
      ? (dto.configuration.layout as ViewLayout)
      : 'list',
    config: {
      filters: {
        status: (filters.status ?? []).filter((key: string): key is StatusKey => isStatusKey(key)),
        priority: (filters.priority ?? []).filter((key: string): key is PriorityKey =>
          (PRIORITY_ORDER as readonly string[]).includes(key),
        ),
        assignee: [...(filters.assignee ?? [])],
        label: [...(filters.label ?? [])],
      },
      sort: fromSortKey(dto.configuration.sort),
      groupBy: toGroupBy(dto.configuration.groupBy),
      subtasks: 'nested',
    },
    version: dto.version,
  };
}

/**
 * Function toSavedViewConfiguration
 *
 * @description
 * The stored configuration of a view: layout, filters, sort and grouping. The search, the
 * milestones switch and the subtask display stay local, as the contract requires.
 *
 * @param {ViewLayout} layout - Layout of the view.
 * @param {ListViewConfig} config - Current configuration.
 * @returns {SavedViewConfigurationInput} The gateway configuration.
 */
export function toSavedViewConfiguration(
  layout: ViewLayout,
  config: ListViewConfig,
): SavedViewConfigurationInput {
  return {
    layout,
    filters: {
      status: [...config.filters.status] as StatusKeyDto[],
      priority: [...config.filters.priority] as PriorityKeyDto[],
      assignee: [...config.filters.assignee],
      label: [...config.filters.label],
    },
    sort: toSortKey(config.sort) as SavedViewConfigurationInput['sort'],
    groupBy: config.groupBy,
  };
}

/**
 * Function toListTasksQuery
 *
 * @description
 * The body of `queryListTasks` for a view's task query and an optional page.
 *
 * @param {ListTaskQuery} query - Task query.
 * @param {string | undefined} cursor - Page cursor, absent for the first page.
 * @param {number | undefined} limit - Page size, absent for the gateway default.
 * @returns {ListTasksQuery} The gateway body.
 */
export function toListTasksQuery(
  query: ListTaskQuery,
  cursor?: string,
  limit?: number,
): ListTasksQuery {
  return {
    ...(query.status ? { status: [...query.status] as StatusKeyDto[] } : {}),
    ...(query.priority ? { priority: [...query.priority] as PriorityKeyDto[] } : {}),
    ...(query.assignee ? { assignee: [...query.assignee] } : {}),
    ...(query.label ? { label: [...query.label] } : {}),
    ...(query.search ? { search: query.search } : {}),
    ...(query.milestone ? { milestone: true } : {}),
    level: query.level,
    sort: query.sort as ListTasksQuery['sort'],
    ...(cursor ? { cursor } : {}),
    ...(limit ? { limit } : {}),
  };
}

/**
 * Function toCountTaskGroupsParams
 *
 * @description
 * The parameters of `countTaskGroups` for a view's group query; its sort is not sent.
 *
 * @param {ListGroupQuery} group - Group query.
 * @returns {CountTaskGroupsParams} The gateway parameters.
 */
export function toCountTaskGroupsParams(group: ListGroupQuery): CountTaskGroupsParams {
  const query: ListTaskQuery = group.query;
  return {
    groupBy: group.groupBy,
    ...(query.status ? { status: [...query.status] as StatusKeyDto[] } : {}),
    ...(query.priority ? { priority: [...query.priority] as PriorityKeyDto[] } : {}),
    ...(query.assignee ? { assignee: [...query.assignee] } : {}),
    ...(query.label ? { label: [...query.label] } : {}),
    ...(query.search ? { search: query.search } : {}),
    ...(query.milestone ? { milestone: true } : {}),
    level: query.level,
  };
}

/**
 * Function toExportParams
 *
 * @description
 * The parameters of `exportListTasks`: the same filters, sort and level as the view, so the file
 * holds what the list shows.
 *
 * @param {ListTaskQuery} query - Task query.
 * @returns {ExportListTasksParams} The gateway parameters.
 */
export function toExportParams(query: ListTaskQuery): ExportListTasksParams {
  return {
    ...(query.status ? { status: [...query.status] as StatusKeyDto[] } : {}),
    ...(query.priority ? { priority: [...query.priority] as PriorityKeyDto[] } : {}),
    ...(query.assignee ? { assignee: [...query.assignee] } : {}),
    ...(query.label ? { label: [...query.label] } : {}),
    ...(query.search ? { search: query.search } : {}),
    ...(query.milestone ? { milestone: true } : {}),
    level: query.level,
    sort: query.sort as ExportListTasksParams['sort'],
  };
}

/**
 * Function toBulkTaskAction
 *
 * @description
 * The body of `executeBulkTaskAction`; « Marquer terminé » is the `done` status.
 *
 * @param {readonly BulkSelection[]} selection - Selected tasks.
 * @param {BulkAction} action - Action.
 * @returns {BulkTaskAction} The gateway body.
 */
export function toBulkTaskAction(
  selection: readonly BulkSelection[],
  action: BulkAction,
): BulkTaskAction {
  let value: BulkTaskActionValue;
  switch (action.type) {
    case 'done':
      value = { type: 'status', status: 'done' };
      break;
    case 'status':
      value =
        action.status === 'cancelled'
          ? {
              type: 'status',
              status: action.status,
              cancelReason: action.cancelReason,
              cancelNote: action.cancelNote,
            }
          : { type: 'status', status: action.status };
      break;
    case 'assign':
      value = { type: 'assign', userId: action.userId };
      break;
    case 'move':
      value = { type: 'move', listId: action.listId };
      break;
    case 'trash':
      value = { type: 'trash' };
      break;
  }
  return {
    selection: selection.map((item: BulkSelection) =>
      item.version === undefined
        ? { taskKey: item.taskKey }
        : { taskKey: item.taskKey, version: item.version },
    ),
    action: value,
  };
}
