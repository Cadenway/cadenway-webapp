import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import type { SavedView } from '../../models/saved-view/saved-view.interface';
import { LAYOUT_TOOLS } from '../../constants/view-layouts/view-layouts.constants';
import { DEFAULT_PRESENTATION } from '../../utils/list-view-query/list-view-query.util';
import { ListViewStore } from './list-view.store';

/**
 * Constant criticalBugs
 *
 * @description
 * The mockup's `Critical bugs`: urgent and high priorities, by due date.
 *
 * @type {SavedView}
 */
const criticalBugs: SavedView = {
  id: 'sv-bugs',
  listId: 'l-bugs',
  name: 'Critical bugs',
  icon: 'bug',
  layout: 'list',
  config: {
    filters: { status: [], priority: ['urgente', 'haute'], assignee: [], label: [] },
    sort: { field: 'dueDate', direction: 'asc' },
    groupBy: 'status',
    subtasks: 'nested',
    presentation: DEFAULT_PRESENTATION,
  },
  version: 1,
};

describe('ListViewStore', () => {
  let store: InstanceType<typeof ListViewStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ListViewStore] });
    store = TestBed.inject(ListViewStore);
  });

  it('starts with the default view mapped to its queries', () => {
    expect(store.filterCount()).toBe(0);
    expect(store.canSave()).toBe(false);
    expect(store.layout()).toBe('list');
    expect(store.taskQuery()).toEqual({ level: 'roots', sort: 'manual' });
    expect(store.groupQuery()).toEqual({ groupBy: 'status', query: store.taskQuery() });
  });

  it('maps filters, search, milestones, sort, grouping and subtasks to the queries', () => {
    store.toggleFilter('status', 'todo');
    store.toggleFilter('assignee', 'me');
    store.toggleFilter('assignee', 'none');
    store.toggleFilter('assignee', 'none');
    store.setSearch(' sso ');
    store.toggleMilestones();
    store.setSort('priority');
    store.toggleSortDirection();
    store.setGroupBy(null);
    store.setSubtasks('separate');

    expect(store.filterCount()).toBe(2);
    expect(store.canSave()).toBe(true);
    expect(store.taskQuery()).toEqual({
      status: ['todo'],
      assignee: ['me'],
      search: 'sso',
      milestone: true,
      level: 'all',
      sort: '-priority',
    });
    expect(store.groupQuery()).toBeNull();

    store.clearFilter('status');
    expect(store.config().filters.status).toEqual([]);
    store.clearFilters();
    expect(store.filterCount()).toBe(0);
  });

  it('applies a saved view over the standard tab and gives the tab back on leaving', () => {
    store.setGroupBy('assignee');
    store.setSubtasks('expanded');
    store.applySaved(criticalBugs);

    expect(store.savedView()?.id).toBe('sv-bugs');
    expect(store.config().filters.priority).toEqual(['urgente', 'haute']);
    expect(store.config().subtasks).toBe('expanded');
    expect(store.modified()).toBe(false);
    expect(store.canSave()).toBe(false);

    store.setSubtasks('separate');
    store.setSearch('x');
    expect(store.modified()).toBe(false);

    store.setGroupBy('priority');
    expect(store.modified()).toBe(true);
    store.revert();
    expect(store.modified()).toBe(false);

    store.leaveSaved();
    expect(store.savedView()).toBeNull();
    expect(store.config().groupBy).toBe('assignee');
    expect(store.config().subtasks).toBe('separate');
  });

  it('records a saved view as applied and starts over with reset', () => {
    store.toggleFilter('priority', 'haute');
    store.markSaved({ ...criticalBugs, config: store.config() });

    expect(store.savedView()?.id).toBe('sv-bugs');
    expect(store.modified()).toBe(false);

    store.reset();
    expect(store.savedView()).toBeNull();
    expect(store.filterCount()).toBe(0);
  });

  it('follows the routed layout and its tools, keeping it on reset', () => {
    store.followRows({ visibleCount: 3, hasSubtasks: false });
    TestBed.tick();
    store.showLayout('board');
    TestBed.tick();

    expect(store.layout()).toBe('board');
    expect(store.tools()).toContain('columns');
    expect(store.tools()).not.toContain('group');
    expect(store.rows()).toEqual({ visibleCount: null, hasSubtasks: null });

    store.showLayout('timesheet');
    TestBed.tick();
    expect(store.tools()).toEqual(LAYOUT_TOOLS.list);
    store.showLayout('form');
    TestBed.tick();
    expect(store.tools()).toEqual([]);
    store.showLayout('activity');
    TestBed.tick();
    expect(store.tools()).toEqual([]);

    store.reset();
    expect(store.layout()).toBe('activity');
  });

  it("counts only the shown layout's presentation for saving and Modified", () => {
    store.setPresentation({ hiddenBoardStatusKeys: ['backlog'] });
    expect(store.canSave()).toBe(false);
    store.showLayout('board');
    TestBed.tick();
    expect(store.canSave()).toBe(true);
    expect(store.presentation().hiddenBoardStatusKeys).toEqual(['backlog']);

    store.applySaved({ ...criticalBugs, layout: 'board' });
    expect(store.presentation().hiddenBoardStatusKeys).toEqual([]);
    expect(store.modified()).toBe(false);
    store.setPresentation({ hiddenBoardStatusKeys: ['waiting'] });
    expect(store.modified()).toBe(true);
    store.revert();
    expect(store.modified()).toBe(false);

    store.leaveSaved();
    expect(store.presentation().hiddenBoardStatusKeys).toEqual(['backlog']);
  });

  it('gives the export the sheet sort on the sheet only, the custom field first', () => {
    store.setPresentation({ sheetSort: { column: 'due', direction: 'desc' } });
    expect(store.sheetExportSort()).toBeNull();
    store.showLayout('table');
    TestBed.tick();
    expect(store.sheetExportSort()).toEqual({ column: 'due', direction: 'desc' });
    expect(store.canSave()).toBe(true);
    store.setPresentation({ customFieldSort: { fieldId: 'cf-points', direction: 'asc' } });
    expect(store.sheetExportSort()).toEqual({ column: 'cf-points', direction: 'asc' });
  });

  it('keeps the same queries when only the presentation changes', () => {
    const taskQuery: ReturnType<typeof store.taskQuery> = store.taskQuery();
    const groupQuery: ReturnType<typeof store.groupQuery> = store.groupQuery();

    store.setPresentation({ hiddenBoardStatusKeys: ['backlog'] });
    store.setPresentation({ sheetSort: { column: 'due', direction: 'asc' } });
    expect(store.taskQuery()).toBe(taskQuery);
    expect(store.groupQuery()).toBe(groupQuery);

    store.toggleFilter('priority', 'haute');
    expect(store.taskQuery()).not.toBe(taskQuery);
    expect(store.taskQuery().priority).toEqual(['haute']);
    expect(store.groupQuery()).not.toBe(groupQuery);
  });

  it('exports by the built-in column once the sorted custom field is known to be retired', () => {
    store.showLayout('table');
    store.setPresentation({
      sheetSort: { column: 'due', direction: 'desc' },
      customFieldSort: { fieldId: 'cf-old', direction: 'asc' },
    });
    expect(store.customFields()).toBeNull();
    expect(store.sheetExportSort()).toEqual({ column: 'cf-old', direction: 'asc' });

    store.followCustomFields([{ id: 'cf-points', name: 'Points' }]);
    TestBed.tick();
    expect(store.sheetExportSort()).toEqual({ column: 'due', direction: 'desc' });

    store.followCustomFields([{ id: 'cf-old', name: 'Old' }]);
    TestBed.tick();
    expect(store.sheetExportSort()).toEqual({ column: 'cf-old', direction: 'asc' });

    store.reset();
    expect(store.customFields()).toBeNull();
  });
});
