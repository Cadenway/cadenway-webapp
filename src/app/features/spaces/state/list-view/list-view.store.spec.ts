import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import type { SavedView } from '../../models/saved-view/saved-view.interface';
import { ListViewStore } from './list-view.store';

/**
 * Constant bugsCritiques
 *
 * @description
 * The mockup's « Bugs critiques »: urgent and high priorities, by due date.
 *
 * @type {SavedView}
 */
const bugsCritiques: SavedView = {
  id: 'sv-bugs',
  listId: 'l-bugs',
  name: 'Bugs critiques',
  icon: 'bug',
  layout: 'list',
  config: {
    filters: { status: [], priority: ['urgente', 'haute'], assignee: [], label: [] },
    sort: { field: 'dueDate', direction: 'asc' },
    groupBy: 'status',
    subtasks: 'nested',
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
    store.applySaved(bugsCritiques);

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
    store.markSaved({ ...bugsCritiques, config: store.config() });

    expect(store.savedView()?.id).toBe('sv-bugs');
    expect(store.modified()).toBe(false);

    store.reset();
    expect(store.savedView()).toBeNull();
    expect(store.filterCount()).toBe(0);
  });
});
