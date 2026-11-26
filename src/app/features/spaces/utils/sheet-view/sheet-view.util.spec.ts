import { describe, expect, it } from 'vitest';

import type { TaskSummary } from '@features/task';

import type { ListViewPresentation } from '../../models/list-view-config/list-view-config.interface';
import type { SheetCustomField, SheetRow } from '../../models/sheet-view/sheet-view.interface';
import {
  presentationOfOrder,
  type SheetSortContext,
  sheetOrderOf,
  sheetTotals,
  sortSheetRows,
} from './sheet-view.util';

/**
 * Function row
 *
 * @description
 * A row of Sprint 14 in the `Product` space of Atelier Nord.
 *
 * @param {string} key - Task key.
 * @param {Partial<SheetRow>} [changes] - Other members of the row.
 * @param {Partial<TaskSummary>} [task] - Other members of the task.
 * @returns {SheetRow} The row.
 */
function row(
  key: string,
  changes: Partial<SheetRow> = {},
  task: Partial<TaskSummary> = {},
): SheetRow {
  return {
    id: key,
    task: {
      id: key,
      key,
      name: key,
      status: 'todo',
      cancelReason: null,
      priority: 'haute',
      assigneeIds: [],
      due: null,
      start: null,
      labels: [],
      subtasks: { closed: 0, total: 0 },
      checklist: { closed: 0, total: 0 },
      comments: null,
      parentKey: null,
      milestone: false,
      recurrence: 'none',
      listId: 'sprint-14',
      spaceId: 'product',
      version: 1,
      ...task,
    },
    status: 'todo',
    estimateMinutes: null,
    customFieldValues: {},
    spentMinutes: null,
    ...changes,
  };
}

/**
 * Constant points
 *
 * @description
 * The `Points` field of the `Product` space.
 *
 * @type {SheetCustomField}
 */
const points: SheetCustomField = {
  id: 'f-points',
  name: 'Points',
  type: 'number',
  position: 0,
  sprintPoints: true,
};

/**
 * Constant client
 *
 * @description
 * The `Client` field of the `Product` space.
 *
 * @type {SheetCustomField}
 */
const client: SheetCustomField = {
  id: 'f-client',
  name: 'Client',
  type: 'text',
  position: 1,
  sprintPoints: false,
};

/**
 * Constant presentation
 *
 * @description
 * A presentation hiding nothing and sorting nothing.
 *
 * @type {ListViewPresentation}
 */
const presentation: ListViewPresentation = {
  hiddenBoardStatusKeys: [],
  hiddenSheetColumns: [],
  hiddenCustomFieldIds: [],
  sheetSort: null,
  customFieldSort: null,
};

/**
 * Constant context
 *
 * @description
 * The names of Atelier Nord's members and of Sprint 14.
 *
 * @type {SheetSortContext}
 */
const context: SheetSortContext = {
  locale: 'en',
  personName: (userId: string): string =>
    ({ 'u-camille': 'Camille Martin', 'u-ines': 'Inès Robert' })[userId] ?? '',
  listName: (): string => 'Sprint 14',
};

/**
 * Function keysOf
 *
 * @description
 * The task keys of rows, in order.
 *
 * @param {readonly SheetRow[]} rows - The rows.
 * @returns {readonly string[]} The keys.
 */
function keysOf(rows: readonly SheetRow[]): readonly string[] {
  return rows.map((item: SheetRow) => item.id);
}

describe('sheetOrderOf', () => {
  it('prefers the custom field sort while the list still has the field', () => {
    expect(
      sheetOrderOf(
        {
          ...presentation,
          sheetSort: { column: 'due', direction: 'asc' },
          customFieldSort: { fieldId: 'f-points', direction: 'desc' },
        },
        [points],
      ),
    ).toEqual({ key: 'field:f-points', direction: 'desc' });
  });

  it('falls back to the column sort once the field is retired, and ignores undrawn columns', () => {
    const sorted: ListViewPresentation = {
      ...presentation,
      sheetSort: { column: 'due', direction: 'asc' },
      customFieldSort: { fieldId: 'f-retired', direction: 'desc' },
    };
    expect(sheetOrderOf(sorted, [points])).toEqual({ key: 'due', direction: 'asc' });
    expect(
      sheetOrderOf({ ...presentation, sheetSort: { column: 'points', direction: 'asc' } }, []),
    ).toBeNull();
  });
});

describe('presentationOfOrder', () => {
  it('stores a field order or a column order, the other cleared', () => {
    expect(presentationOfOrder({ key: 'field:f-points', direction: 'asc' })).toEqual({
      sheetSort: null,
      customFieldSort: { fieldId: 'f-points', direction: 'asc' },
    });
    expect(presentationOfOrder({ key: 'estimate', direction: 'desc' })).toEqual({
      sheetSort: { column: 'estimate', direction: 'desc' },
      customFieldSort: null,
    });
    expect(presentationOfOrder(null)).toEqual({ sheetSort: null, customFieldSort: null });
  });
});

describe('sortSheetRows', () => {
  const rows: readonly SheetRow[] = [
    row('CAD-482', { status: 'progress', estimateMinutes: 240 }, { due: '2026-11-27' }),
    row('CAD-479', { status: 'todo' }, { due: null, assigneeIds: ['u-ines'] }),
    row('CAD-475', { status: 'blocked', estimateMinutes: 60 }, { due: '2026-11-20' }),
    row('CAD-488', { status: 'todo', estimateMinutes: 120 }, { assigneeIds: ['u-camille'] }),
  ];

  it('keeps the read order without an order', () => {
    expect(sortSheetRows(rows, null, context)).toBe(rows);
  });

  it('sorts statuses in workflow order and keeps the read order between equals', () => {
    expect(keysOf(sortSheetRows(rows, { key: 'status', direction: 'asc' }, context))).toEqual([
      'CAD-479',
      'CAD-488',
      'CAD-482',
      'CAD-475',
    ]);
  });

  it('puts empty cells last in both directions', () => {
    expect(keysOf(sortSheetRows(rows, { key: 'estimate', direction: 'asc' }, context))).toEqual([
      'CAD-475',
      'CAD-488',
      'CAD-482',
      'CAD-479',
    ]);
    expect(keysOf(sortSheetRows(rows, { key: 'due', direction: 'desc' }, context))).toEqual([
      'CAD-482',
      'CAD-475',
      'CAD-479',
      'CAD-488',
    ]);
  });

  it('sorts assignees by the first assignee name and custom fields by their value', () => {
    expect(keysOf(sortSheetRows(rows, { key: 'people', direction: 'asc' }, context))).toEqual([
      'CAD-488',
      'CAD-479',
      'CAD-482',
      'CAD-475',
    ]);
    const valued: readonly SheetRow[] = [
      row('CAD-482', { customFieldValues: { 'f-points': 5 } }),
      row('CAD-479', { customFieldValues: { 'f-points': 3 } }),
      row('CAD-475'),
    ];
    expect(
      keysOf(sortSheetRows(valued, { key: 'field:f-points', direction: 'desc' }, context)),
    ).toEqual(['CAD-482', 'CAD-479', 'CAD-475']);
  });
});

describe('sheetTotals', () => {
  it('counts the tasks and those done, sums estimates and numeric fields', () => {
    expect(
      sheetTotals(
        [
          row('CAD-482', {
            status: 'done',
            estimateMinutes: 240,
            spentMinutes: 90,
            customFieldValues: { 'f-points': 5, 'f-client': 'Studio Pivot' },
          }),
          row('CAD-479', {
            estimateMinutes: 60,
            spentMinutes: 30,
            customFieldValues: { 'f-points': 3 },
          }),
        ],
        [points, client],
      ),
    ).toEqual({
      count: 2,
      done: 1,
      estimateMinutes: 300,
      spentMinutes: 120,
      fieldSums: { 'f-points': 8 },
    });
  });

  it('leaves the time spent unknown until every row has it', () => {
    expect(
      sheetTotals([row('CAD-482', { spentMinutes: 90 }), row('CAD-479')], []).spentMinutes,
    ).toBeNull();
  });
});
