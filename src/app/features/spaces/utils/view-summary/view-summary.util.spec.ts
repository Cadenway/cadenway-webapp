import { describe, expect, it } from 'vitest';

import type { ListViewConfig } from '../../models/list-view-config/list-view-config.interface';
import { DEFAULT_PRESENTATION, DEFAULT_VIEW_CONFIG } from '../list-view-query/list-view-query.util';
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
          presentation: DEFAULT_PRESENTATION,
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
          presentation: DEFAULT_PRESENTATION,
        },
        'en',
      ),
    ).toBe('List · 2 filters');
  });

  it('counts the hidden columns of the board and the sheet only', () => {
    const config: ListViewConfig = {
      ...DEFAULT_VIEW_CONFIG,
      presentation: {
        ...DEFAULT_PRESENTATION,
        hiddenBoardStatusKeys: ['backlog', 'waiting'],
        hiddenSheetColumns: ['spent'],
      },
    };
    expect(viewSummary('board', config, 'en')).toBe('Board · no filter · 2 columns hidden');
    expect(viewSummary('table', config, 'en')).toBe('Sheet · no filter · 1 column hidden');
    expect(viewSummary('list', config, 'en')).toBe('List · no filter');
  });

  it("names the sheet's own sort on the sheet, the active custom field's first", () => {
    const config: ListViewConfig = {
      ...DEFAULT_VIEW_CONFIG,
      sort: { field: 'dueDate', direction: 'asc' },
      presentation: {
        ...DEFAULT_PRESENTATION,
        sheetSort: { column: 'spent', direction: 'desc' },
        customFieldSort: { fieldId: 'cf-points', direction: 'asc' },
      },
    };
    expect(viewSummary('table', config, 'en')).toBe('Sheet · no filter · sort: time spent');
    expect(viewSummary('table', config, 'en', [{ id: 'cf-points', name: 'Points' }])).toBe(
      'Sheet · no filter · sort: points',
    );
    expect(viewSummary('table', config, 'en', [{ id: 'cf-client', name: 'Client' }])).toBe(
      'Sheet · no filter · sort: time spent',
    );
    expect(viewSummary('list', config, 'en')).toBe('List · no filter · sort: due date');
    expect(
      viewSummary(
        'table',
        { ...config, presentation: { ...DEFAULT_PRESENTATION, customFieldSort: null } },
        'en',
      ),
    ).toBe('Sheet · no filter · sort: due date');
  });

  it('leaves the hidden columns of retired custom fields out once the fields are known', () => {
    const config: ListViewConfig = {
      ...DEFAULT_VIEW_CONFIG,
      presentation: { ...DEFAULT_PRESENTATION, hiddenCustomFieldIds: ['cf-points', 'cf-old'] },
    };
    expect(viewSummary('table', config, 'en')).toBe('Sheet · no filter · 2 columns hidden');
    expect(viewSummary('table', config, 'en', [{ id: 'cf-points', name: 'Points' }])).toBe(
      'Sheet · no filter · 1 column hidden',
    );
  });
});
