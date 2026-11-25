import { describe, expect, it } from 'vitest';

import {
  DEFAULT_VIEW_CONFIG,
  filterCount,
  fromSortKey,
  sameSavedSettings,
  toGroupQuery,
  toSortKey,
  toTaskQuery,
} from './list-view-query.util';

describe('list view query', () => {
  it('signs and reads sort keys', () => {
    expect(toSortKey({ field: 'priority', direction: 'desc' })).toBe('-priority');
    expect(fromSortKey('-createdAt')).toEqual({ field: 'createdAt', direction: 'desc' });
    expect(fromSortKey('points')).toEqual({ field: 'manual', direction: 'asc' });
  });

  it('maps the default view to roots in manual order, grouped by status', () => {
    const query: ReturnType<typeof toTaskQuery> = toTaskQuery(DEFAULT_VIEW_CONFIG, ' ', false);

    expect(query).toEqual({ level: 'roots', sort: 'manual' });
    expect(toGroupQuery(DEFAULT_VIEW_CONFIG, query)).toEqual({ groupBy: 'status', query });
    expect(toGroupQuery({ ...DEFAULT_VIEW_CONFIG, groupBy: null }, query)).toBeNull();
  });

  it('counts fields and compares saved settings in any order, subtasks aside', () => {
    const first: typeof DEFAULT_VIEW_CONFIG = {
      ...DEFAULT_VIEW_CONFIG,
      filters: { status: ['todo', 'done'], priority: [], assignee: ['me'], label: [] },
    };
    const second: typeof DEFAULT_VIEW_CONFIG = {
      ...first,
      filters: { ...first.filters, status: ['done', 'todo'] },
      subtasks: 'separate',
    };

    expect(filterCount(first.filters)).toBe(2);
    expect(sameSavedSettings(first, second)).toBe(true);
    expect(sameSavedSettings(first, { ...second, groupBy: null })).toBe(false);
    expect(sameSavedSettings(first, { ...second, sort: { field: 'name', direction: 'asc' } })).toBe(
      false,
    );
  });
});
