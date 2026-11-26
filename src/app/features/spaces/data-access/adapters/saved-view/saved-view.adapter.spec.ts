import type { SavedView as SavedViewDto } from '@cadenway/api-client';
import { describe, expect, it } from 'vitest';

import type { ListViewConfig } from '../../../models/list-view-config/list-view-config.interface';
import {
  DEFAULT_VIEW_CONFIG,
  toTaskQuery,
} from '../../../utils/list-view-query/list-view-query.util';
import {
  toBulkTaskAction,
  toCountTaskGroupsParams,
  toExportParams,
  toListTasksQuery,
  toSavedView,
  toSavedViewConfiguration,
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
      },
      version: 2,
    });
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
