import type {
  BulkTaskAction,
  BulkTaskActionValue,
  CountTaskGroupsParams,
  ExportListTasksParams,
  ListTasksQuery,
  PriorityKey as PriorityKeyDto,
  SavedView as SavedViewDto,
  SavedViewConfigurationInput,
  SavedViewConfigurationPatch,
  SavedViewFilters,
  SavedViewPresentation,
  SavedViewPresentationPatch,
  SavedViewPresentationValue,
  StatusKey as StatusKeyDto,
} from '@cadenway/api-client';

import { SHEET_COLUMNS } from '../../../constants/sheet-columns/sheet-columns.constants';
import { PRIORITY_ORDER } from '../../../constants/statuses/statuses.constants';
import { VIEW_LAYOUTS } from '../../../constants/view-layouts/view-layouts.constants';
import type { BulkAction, BulkSelection } from '../../../models/bulk-action/bulk-action.interface';
import type {
  ListGroupBy,
  ListGroupQuery,
  ListTaskQuery,
  ListViewConfig,
  ListViewPresentation,
  PriorityKey,
  SheetColumn,
  SheetExportSort,
  SortDirection,
  StatusKey,
} from '../../../models/list-view-config/list-view-config.interface';
import type {
  SavedView,
  UnknownPresentation,
  ViewLayout,
} from '../../../models/saved-view/saved-view.interface';
import {
  fromSortKey,
  presentationFor,
  toSortKey,
} from '../../../utils/list-view-query/list-view-query.util';
import { isStatusKey, toLookIcon } from '../space/space.adapter';

/**
 * Function isSheetColumn
 *
 * @description
 * Whether a stored column key is one of the sheet's built-in columns.
 *
 * @param {string} key - Stored key.
 * @returns {boolean} Whether it is known.
 */
function isSheetColumn(key: string): key is SheetColumn {
  return (SHEET_COLUMNS as readonly string[]).includes(key);
}

/**
 * Function isDirection
 *
 * @description
 * Whether a stored direction is `asc` or `desc`.
 *
 * @param {string} value - Stored direction.
 * @returns {boolean} Whether it is known.
 */
function isDirection(value: string): value is SortDirection {
  return value === 'asc' || value === 'desc';
}

/**
 * Function toPresentation
 *
 * @description
 * Reads a stored presentation; unknown statuses, columns and directions, which the contract lets
 * future clients write, are dropped.
 *
 * @param {SavedViewPresentationValue | undefined} dto - Stored presentation, absent for none.
 * @returns {ListViewPresentation} The presentation.
 */
function toPresentation(dto: SavedViewPresentationValue | undefined): ListViewPresentation {
  const sheet: SavedViewPresentationValue['sheetSort'] = dto?.sheetSort;
  const custom: SavedViewPresentationValue['customFieldSort'] = dto?.customFieldSort;
  return {
    hiddenBoardStatusKeys: (dto?.hiddenBoardStatusKeys ?? []).filter(
      (key: string): key is StatusKey => isStatusKey(key),
    ),
    hiddenSheetColumns: (dto?.hiddenSheetColumns ?? []).filter(isSheetColumn),
    hiddenCustomFieldIds: [...(dto?.hiddenCustomFieldIds ?? [])],
    sheetSort:
      sheet && isSheetColumn(sheet.column) && isDirection(sheet.direction)
        ? { column: sheet.column, direction: sheet.direction }
        : null,
    customFieldSort:
      custom && isDirection(custom.direction)
        ? { fieldId: custom.fieldId, direction: custom.direction }
        : null,
  };
}

/**
 * Function toUnknownPresentation
 *
 * @description
 * The stored presentation values `toPresentation` drops, or undefined when there are none.
 *
 * @param {SavedViewPresentationValue | undefined} dto - Stored presentation, absent for none.
 * @returns {UnknownPresentation | undefined} The unknown values.
 */
function toUnknownPresentation(
  dto: SavedViewPresentationValue | undefined,
): UnknownPresentation | undefined {
  const sheet: SavedViewPresentationValue['sheetSort'] = dto?.sheetSort;
  const custom: SavedViewPresentationValue['customFieldSort'] = dto?.customFieldSort;
  const unknown: UnknownPresentation = {
    hiddenBoardStatusKeys: (dto?.hiddenBoardStatusKeys ?? []).filter(
      (key: string): boolean => !isStatusKey(key),
    ),
    hiddenSheetColumns: (dto?.hiddenSheetColumns ?? []).filter(
      (key: string): boolean => !isSheetColumn(key),
    ),
    sheetSort:
      sheet && !(isSheetColumn(sheet.column) && isDirection(sheet.direction))
        ? { column: sheet.column, direction: sheet.direction }
        : null,
    customFieldSort:
      custom && !isDirection(custom.direction)
        ? { fieldId: custom.fieldId, direction: custom.direction }
        : null,
  };
  return unknown.hiddenBoardStatusKeys.length > 0 ||
    unknown.hiddenSheetColumns.length > 0 ||
    unknown.sheetSort !== null ||
    unknown.customFieldSort !== null
    ? unknown
    : undefined;
}

/**
 * Function storedPresentation
 *
 * @description
 * The members a layout writes (`presentationFor`: the hidden status columns on the board, the
 * sheet's members on the sheet, none elsewhere), each the current value merged with the unknown
 * values read: unknown hidden columns are appended, and an unknown sort stays unless the user
 * chose a known one. An empty member is null.
 *
 * @param {ViewLayout} layout - Layout of the view.
 * @param {ListViewPresentation} presentation - Current presentation.
 * @param {UnknownPresentation | undefined} unknown - Unknown values read with the view.
 * @returns {SavedViewPresentationPatch} The layout's members.
 */
function storedPresentation(
  layout: ViewLayout,
  presentation: ListViewPresentation,
  unknown: UnknownPresentation | undefined,
): SavedViewPresentationPatch {
  const used: ListViewPresentation = presentationFor(layout, presentation);
  if (layout === 'board') {
    return {
      hiddenBoardStatusKeys: nonEmpty([
        ...used.hiddenBoardStatusKeys,
        ...(unknown?.hiddenBoardStatusKeys ?? []),
      ] as StatusKeyDto[]),
    };
  }
  if (layout !== 'table') return {};
  const sheetSort: { readonly column: string; readonly direction: string } | null =
    used.sheetSort ?? unknown?.sheetSort ?? null;
  const customFieldSort: { readonly fieldId: string; readonly direction: string } | null =
    used.customFieldSort ?? unknown?.customFieldSort ?? null;
  return {
    hiddenSheetColumns: nonEmpty([
      ...used.hiddenSheetColumns,
      ...(unknown?.hiddenSheetColumns ?? []),
    ] as SheetColumn[]),
    hiddenCustomFieldIds: nonEmpty(used.hiddenCustomFieldIds),
    sheetSort: sheetSort ? ({ ...sheetSort } as SavedViewPresentation['sheetSort']) : null,
    customFieldSort: customFieldSort
      ? ({ ...customFieldSort } as SavedViewPresentation['customFieldSort'])
      : null,
  };
}

/**
 * Function toPresentationInput
 *
 * @description
 * The stored presentation of a new view: the layout's members (`storedPresentation`) without the
 * empty ones; undefined when nothing is hidden or sorted.
 *
 * @param {ViewLayout} layout - Layout of the view.
 * @param {ListViewPresentation} presentation - Current presentation.
 * @param {UnknownPresentation | undefined} unknown - Unknown values to keep, from a view read.
 * @returns {SavedViewPresentation | undefined} The gateway presentation.
 */
function toPresentationInput(
  layout: ViewLayout,
  presentation: ListViewPresentation,
  unknown: UnknownPresentation | undefined,
): SavedViewPresentation | undefined {
  const stored: SavedViewPresentationPatch = storedPresentation(layout, presentation, unknown);
  const input: SavedViewPresentation = {
    ...(stored.hiddenBoardStatusKeys
      ? { hiddenBoardStatusKeys: stored.hiddenBoardStatusKeys }
      : {}),
    ...(stored.hiddenSheetColumns ? { hiddenSheetColumns: stored.hiddenSheetColumns } : {}),
    ...(stored.hiddenCustomFieldIds ? { hiddenCustomFieldIds: stored.hiddenCustomFieldIds } : {}),
    ...(stored.sheetSort
      ? { sheetSort: stored.sheetSort as SavedViewPresentation['sheetSort'] }
      : {}),
    ...(stored.customFieldSort
      ? { customFieldSort: stored.customFieldSort as SavedViewPresentation['customFieldSort'] }
      : {}),
  };
  return Object.keys(input).length > 0 ? input : undefined;
}

/**
 * Function nonEmpty
 *
 * @description
 * A copy of a list, or null when it is empty (a merge patch removes a member with null).
 *
 * @param {readonly T[]} values - The list.
 * @returns {T[] | null} The copy, or null.
 */
function nonEmpty<T>(values: readonly T[]): T[] | null {
  return values.length > 0 ? [...values] : null;
}

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
  const unknownPresentation: UnknownPresentation | undefined = toUnknownPresentation(
    dto.configuration.presentation,
  );
  return {
    id: dto.id,
    listId: dto.listId,
    name: dto.name,
    icon: toLookIcon(dto.icon),
    layout: (VIEW_LAYOUTS as readonly string[]).includes(dto.configuration.layout)
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
      presentation: toPresentation(dto.configuration.presentation),
    },
    ...(unknownPresentation ? { unknownPresentation } : {}),
    version: dto.version,
  };
}

/**
 * Function toSavedViewConfiguration
 *
 * @description
 * The stored configuration of a new view: layout, filters, sort, grouping and the layout's
 * presentation (absent when nothing is hidden or sorted), with the unknown values of the view it
 * restores. The search, the milestones switch and the subtask display stay local, as the
 * contract requires.
 *
 * @param {ViewLayout} layout - Layout of the view.
 * @param {ListViewConfig} config - Current configuration.
 * @param {UnknownPresentation | undefined} unknown - Unknown values to keep, from a view read.
 * @returns {SavedViewConfigurationInput} The gateway configuration.
 */
export function toSavedViewConfiguration(
  layout: ViewLayout,
  config: ListViewConfig,
  unknown?: UnknownPresentation,
): SavedViewConfigurationInput {
  const presentation: SavedViewPresentation | undefined = toPresentationInput(
    layout,
    config.presentation,
    unknown,
  );
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
    ...(presentation ? { presentation } : {}),
  };
}

/**
 * Function toSavedViewConfigurationPatch
 *
 * @description
 * The configuration patch of `Save` on an applied view: the same members as a new view, and, as
 * a merge patch, the presentation members the layout writes (`storedPresentation`), an empty one
 * null so a column shown again or a sort removed is removed from the stored view too. The unknown
 * values read with the view are merged back, and the members of other layouts are left out, so
 * the gateway keeps them as stored.
 *
 * @param {ViewLayout} layout - Layout of the view.
 * @param {ListViewConfig} config - Current configuration.
 * @param {UnknownPresentation | undefined} unknown - Unknown values read with the view.
 * @returns {SavedViewConfigurationPatch} The gateway patch.
 */
export function toSavedViewConfigurationPatch(
  layout: ViewLayout,
  config: ListViewConfig,
  unknown?: UnknownPresentation,
): SavedViewConfigurationPatch {
  const created: SavedViewConfigurationInput = toSavedViewConfiguration(layout, config);
  const presentation: SavedViewPresentationPatch = storedPresentation(
    layout,
    config.presentation,
    unknown,
  );
  return {
    layout: created.layout,
    filters: created.filters,
    sort: created.sort,
    groupBy: created.groupBy,
    ...(Object.keys(presentation).length > 0 ? { presentation } : {}),
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
 * holds what the list shows, and the sheet's own sort when the sheet has one.
 *
 * @param {ListTaskQuery} query - Task query.
 * @param {SheetExportSort | null} sheetSort - The sheet's sort, or null.
 * @returns {ExportListTasksParams} The gateway parameters.
 */
export function toExportParams(
  query: ListTaskQuery,
  sheetSort: SheetExportSort | null = null,
): ExportListTasksParams {
  return {
    ...(sheetSort
      ? {
          sheetSortColumn: sheetSort.column,
          sheetSortDirection: sheetSort.direction,
        }
      : {}),
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
 * The body of `executeBulkTaskAction`; `Mark done` is the `done` status.
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
