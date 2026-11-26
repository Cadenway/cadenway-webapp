import { describe, expect, it } from 'vitest';

import { viewSummary } from './view-summary.util';

describe('view summary', () => {
  it('describes a view in the mockup words', () => {
    expect(
      viewSummary(
        'list',
        {
          filters: { status: [], priority: ['urgente', 'haute'], assignee: [], label: [] },
          sort: { field: 'dueDate', direction: 'asc' },
          groupBy: 'priority',
          subtasks: 'nested',
        },
        'en',
      ),
    ).toBe('List · 1 filter · sort: due date · grouped by priority');
    expect(
      viewSummary(
        'list',
        {
          filters: { status: ['todo'], priority: ['haute'], assignee: [], label: [] },
          sort: { field: 'manual', direction: 'asc' },
          groupBy: 'status',
          subtasks: 'nested',
        },
        'en',
      ),
    ).toBe('List · 2 filters');
  });
});
