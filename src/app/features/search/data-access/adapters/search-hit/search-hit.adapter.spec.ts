import { describe, expect, it } from 'vitest';

import { toSearchResult } from './search-hit.adapter';

describe('toSearchResult', () => {
  it('maps a task hit', () => {
    expect(
      toSearchResult({
        kind: 'task',
        taskKey: 'CAD-482',
        name: 'Relecture du parcours SSO',
        status: 'review',
      }),
    ).toEqual({
      kind: 'task',
      key: 'CAD-482',
      name: 'Relecture du parcours SSO',
      status: 'review',
    });
  });

  it('maps a list hit with or without its space', () => {
    expect(
      toSearchResult({ kind: 'list', listId: 'l1', name: 'Sprint 14', spaceName: 'Produit' }),
    ).toEqual({ kind: 'list', listId: 'l1', name: 'Sprint 14', spaceName: 'Produit' });
    expect(toSearchResult({ kind: 'list', listId: 'l2', name: 'Bugs' })).toEqual({
      kind: 'list',
      listId: 'l2',
      name: 'Bugs',
      spaceName: null,
    });
  });
});
