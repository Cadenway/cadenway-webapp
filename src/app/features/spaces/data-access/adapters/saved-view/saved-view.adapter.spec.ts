import type { SavedView as SavedViewDto } from '@cadenway/api-client';
import { describe, expect, it } from 'vitest';

import type { ListViewConfig } from '../../../models/list-view-config/list-view-config.interface';
import type { SavedView } from '../../../models/saved-view/saved-view.interface';
import {
  DEFAULT_PRESENTATION,
  DEFAULT_VIEW_CONFIG,
  toTaskQuery,
} from '../../../utils/list-view-query/list-view-query.util';
import {
  toBulkTaskAction,
  toCountTaskGroupsParams,
  toExportParams,
  toListTasksQuery,
  toRestoredSavedViewConfiguration,
  toSavedView,
  toSavedViewConfiguration,
  toSavedViewConfigurationPatch,
} from './saved-view.adapter';

/**
 * Constant criticalBugs
 *
 * @description
 * The mockup's `Critical bugs` view (`SAVED_INIT`), as the gateway answers it.
 *
 * @type {SavedViewDto}
 */
const criticalBugs: SavedViewDto = {
  id: 'sv-bugs',
  listId: 'l-bugs',
  name: 'Critical bugs',
  icon: 'bug',
  configuration: {
    layout: 'list',
    filters: { priority: ['urgente', 'haute', 'extreme' as never], status: ['todo'] },
    sort: 'dueDate',
    groupBy: 'status',
  },
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
  version: 2,
};

/**
 * Constant filtered
 *
 * @description
 * A configuration with filters, a descending sort and the separate subtasks.
 *
 * @type {ListViewConfig}
 */
const filtered: ListViewConfig = {
  filters: { status: ['todo'], priority: ['haute'], assignee: ['me', 'none'], label: ['Bug'] },
  sort: { field: 'dueDate', direction: 'desc' },
  groupBy: 'priority',
  subtasks: 'separate',
  presentation: DEFAULT_PRESENTATION,
};

/**
 * Constant hiddenColumns
 *
 * @description
 * The default configuration with hidden board and sheet columns and a sheet sort.
 *
 * @type {ListViewConfig}
 */
const hiddenColumns: ListViewConfig = {
  ...DEFAULT_VIEW_CONFIG,
  presentation: {
    hiddenBoardStatusKeys: ['backlog'],
    hiddenSheetColumns: ['spent', 'client'],
    hiddenCustomFieldIds: ['cf-points'],
    sheetSort: { column: 'due', direction: 'desc' },
    customFieldSort: null,
  },
};

describe('saved view adapter', () => {
  it('maps a saved view, dropping unknown priorities', () => {
    expect(toSavedView(criticalBugs)).toEqual({
      id: 'sv-bugs',
      listId: 'l-bugs',
      name: 'Critical bugs',
      icon: 'bug',
      layout: 'list',
      config: {
        filters: { status: ['todo'], priority: ['urgente', 'haute'], assignee: [], label: [] },
        sort: { field: 'dueDate', direction: 'asc' },
        groupBy: 'status',
        subtasks: 'nested',
        presentation: DEFAULT_PRESENTATION,
      },
      version: 2,
    });
  });

  it('reads a stored presentation, dropping unknown statuses, columns and directions', () => {
    const board: SavedViewDto = {
      ...criticalBugs,
      configuration: {
        ...criticalBugs.configuration,
        layout: 'board',
        presentation: {
          hiddenBoardStatusKeys: ['backlog', 'archived' as never],
          hiddenSheetColumns: ['spent', 'future'],
          hiddenCustomFieldIds: ['cf-points'],
          sheetSort: { column: 'future', direction: 'asc' },
          customFieldSort: { fieldId: 'cf-points', direction: 'desc' },
        },
      },
    };
    expect(toSavedView(board).config.presentation).toEqual({
      hiddenBoardStatusKeys: ['backlog'],
      hiddenSheetColumns: ['spent'],
      hiddenCustomFieldIds: ['cf-points'],
      sheetSort: null,
      customFieldSort: { fieldId: 'cf-points', direction: 'desc' },
    });
    expect(toSavedView(board).layout).toBe('board');
  });

  it("stores and patches only the layout's presentation, an empty member as null", () => {
    expect(toSavedViewConfiguration('board', hiddenColumns).presentation).toEqual({
      hiddenBoardStatusKeys: ['backlog'],
    });
    expect(toSavedViewConfiguration('table', hiddenColumns).presentation).toEqual({
      hiddenSheetColumns: ['spent', 'client'],
      hiddenCustomFieldIds: ['cf-points'],
      sheetSort: { column: 'due', direction: 'desc' },
    });
    expect(toSavedViewConfiguration('list', hiddenColumns)).not.toHaveProperty('presentation');
    expect(toSavedViewConfigurationPatch('board', hiddenColumns)).toEqual({
      layout: 'board',
      filters: { status: [], priority: [], assignee: [], label: [] },
      sort: 'manual',
      groupBy: 'status',
      presentation: { hiddenBoardStatusKeys: ['backlog'] },
    });
    expect(
      toSavedViewConfigurationPatch('table', {
        ...hiddenColumns,
        presentation: { ...hiddenColumns.presentation, hiddenSheetColumns: [], sheetSort: null },
      }).presentation,
    ).toEqual({
      hiddenSheetColumns: null,
      hiddenCustomFieldIds: ['cf-points'],
      sheetSort: null,
      customFieldSort: null,
    });
    expect(toSavedViewConfigurationPatch('list', hiddenColumns)).not.toHaveProperty('presentation');
  });

  it('keeps the unknown presentation values it read, unless a known sort replaces them', () => {
    const view: SavedView = toSavedView({
      ...criticalBugs,
      configuration: {
        ...criticalBugs.configuration,
        layout: 'board',
        presentation: {
          hiddenBoardStatusKeys: ['backlog', 'archived' as never],
          sheetSort: { column: 'future', direction: 'asc' },
          customFieldSort: { fieldId: 'cf-points', direction: 'random' as never },
        },
      },
    });
    expect(view.unknownPresentation).toEqual({
      hiddenBoardStatusKeys: ['archived'],
      hiddenSheetColumns: [],
      sheetSort: { column: 'future', direction: 'asc' },
      customFieldSort: { fieldId: 'cf-points', direction: 'random' },
    });
    expect(toSavedView(criticalBugs)).not.toHaveProperty('unknownPresentation');

    expect(
      toSavedViewConfigurationPatch('board', view.config, view.unknownPresentation).presentation,
    ).toEqual({ hiddenBoardStatusKeys: ['backlog', 'archived'] });
    expect(
      toSavedViewConfigurationPatch('table', view.config, view.unknownPresentation).presentation,
    ).toEqual({
      hiddenSheetColumns: null,
      hiddenCustomFieldIds: null,
      sheetSort: { column: 'future', direction: 'asc' },
      customFieldSort: { fieldId: 'cf-points', direction: 'random' },
    });
    expect(
      toSavedViewConfigurationPatch(
        'table',
        {
          ...view.config,
          presentation: {
            ...view.config.presentation,
            sheetSort: { column: 'due', direction: 'desc' },
          },
        },
        view.unknownPresentation,
      ).presentation?.sheetSort,
    ).toEqual({ column: 'due', direction: 'desc' });
  });

  it("restores a deleted view with every layout's presentation, known and unknown", () => {
    const settings: NonNullable<SavedViewDto['configuration']['presentation']> = {
      hiddenBoardStatusKeys: ['backlog', 'archived' as never],
      hiddenSheetColumns: ['spent', 'future-column'],
      hiddenCustomFieldIds: ['cf-points'],
      sheetSort: { column: 'due', direction: 'desc' },
      customFieldSort: { fieldId: 'cf-client', direction: 'random' as never },
    };
    for (const layout of ['board', 'list', 'table'] as const) {
      const view: SavedView = toSavedView({
        ...criticalBugs,
        configuration: { ...criticalBugs.configuration, layout, presentation: settings },
      });
      expect(toSavedViewConfiguration(layout, view.config).presentation, layout).not.toEqual(
        settings,
      );
      expect(toRestoredSavedViewConfiguration(view), layout).toEqual({
        layout,
        filters: { status: ['todo'], priority: ['urgente', 'haute'], assignee: [], label: [] },
        sort: 'dueDate',
        groupBy: 'status',
        presentation: settings,
      });
    }
    expect(toRestoredSavedViewConfiguration(toSavedView(criticalBugs))).not.toHaveProperty(
      'presentation',
    );
  });

  it('stores layout, filters, signed sort and grouping, never the subtask display', () => {
    expect(toSavedViewConfiguration('list', filtered)).toEqual({
      layout: 'list',
      filters: { status: ['todo'], priority: ['haute'], assignee: ['me', 'none'], label: ['Bug'] },
      sort: '-dueDate',
      groupBy: 'priority',
    });
  });

  it('maps the task query to queryListTasks, countTaskGroups and the export', () => {
    const query: ReturnType<typeof toTaskQuery> = toTaskQuery(filtered, '  sso ', true);

    expect(toListTasksQuery(query, 'c2', 50)).toEqual({
      status: ['todo'],
      priority: ['haute'],
      assignee: ['me', 'none'],
      label: ['Bug'],
      search: 'sso',
      milestone: true,
      level: 'all',
      sort: '-dueDate',
      cursor: 'c2',
      limit: 50,
    });
    expect(toCountTaskGroupsParams({ groupBy: 'priority', query })).toEqual({
      groupBy: 'priority',
      status: ['todo'],
      priority: ['haute'],
      assignee: ['me', 'none'],
      label: ['Bug'],
      search: 'sso',
      milestone: true,
      level: 'all',
    });
    expect(toExportParams(toTaskQuery(DEFAULT_VIEW_CONFIG, '', false))).toEqual({
      level: 'roots',
      sort: 'manual',
    });
    expect(
      toExportParams(toTaskQuery(DEFAULT_VIEW_CONFIG, '', false), {
        column: 'due',
        direction: 'desc',
      }),
    ).toEqual({
      level: 'roots',
      sort: 'manual',
      sheetSortColumn: 'due',
      sheetSortDirection: 'desc',
    });
  });

  it('maps each bulk action', () => {
    const selection: { taskKey: string; version?: number }[] = [
      { taskKey: 'CAD-482', version: 3 },
      { taskKey: 'CAD-479' },
    ];

    expect(toBulkTaskAction(selection, { type: 'done' })).toEqual({
      selection: [{ taskKey: 'CAD-482', version: 3 }, { taskKey: 'CAD-479' }],
      action: { type: 'status', status: 'done' },
    });
    expect(
      toBulkTaskAction(selection, {
        type: 'status',
        status: 'cancelled',
        cancelReason: 'obsolete',
        cancelNote: 'Replaced',
      }).action,
    ).toEqual({
      type: 'status',
      status: 'cancelled',
      cancelReason: 'obsolete',
      cancelNote: 'Replaced',
    });
    expect(toBulkTaskAction(selection, { type: 'assign', userId: 'u1' }).action).toEqual({
      type: 'assign',
      userId: 'u1',
    });
    expect(toBulkTaskAction(selection, { type: 'move', listId: 'l2' }).action).toEqual({
      type: 'move',
      listId: 'l2',
    });
    expect(toBulkTaskAction(selection, { type: 'trash' }).action).toEqual({ type: 'trash' });
  });
});
