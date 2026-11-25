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
        'fr',
      ),
    ).toBe('Liste · 1 filtre · tri : échéance · groupée par priorité');
    expect(
      viewSummary(
        'list',
        {
          filters: { status: ['todo'], priority: ['haute'], assignee: [], label: [] },
          sort: { field: 'manual', direction: 'asc' },
          groupBy: 'status',
          subtasks: 'nested',
        },
        'fr',
      ),
    ).toBe('Liste · 2 filtres');
  });
});
