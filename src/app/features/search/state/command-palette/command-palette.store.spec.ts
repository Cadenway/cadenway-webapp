import { TestBed } from '@angular/core/testing';
import { delay, type Observable, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { SearchApi } from '../../data-access/services/search-api/search-api.service';
import type { SearchResult } from '../../models/search-result/search-result.interface';
import { CommandPaletteStore, DEBOUNCE_MS } from './command-palette.store';

/**
 * Constant results
 *
 * @description
 * Matches of « sso » in the mockup: a task, then a list.
 *
 * @type {readonly SearchResult[]}
 */
const results: readonly SearchResult[] = [
  { kind: 'task', key: 'CAD-482', name: 'Relecture du parcours SSO', status: 'review' },
  { kind: 'list', listId: 'l1', name: 'Sprint 14', spaceName: 'Produit' },
];

describe('CommandPaletteStore', () => {
  let search: Mock<(query: string) => Observable<readonly SearchResult[]>>;
  let store: InstanceType<typeof CommandPaletteStore>;

  beforeEach(() => {
    vi.useFakeTimers();
    search = vi.fn(() => of(results));
    TestBed.configureTestingModule({
      providers: [CommandPaletteStore, { provide: SearchApi, useValue: { search } }],
    });
    store = TestBed.inject(CommandPaletteStore);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('searches once, after the pause in typing, and splits tasks from lists', async () => {
    store.search('s');
    store.search('ss');
    store.search(' sso ');
    expect(store.loading()).toBe(true);
    expect(search).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

    expect(search).toHaveBeenCalledExactlyOnceWith('sso');
    expect(store.loading()).toBe(false);
    expect(store.tasks().map((task) => task.key)).toEqual(['CAD-482']);
    expect(store.lists().map((list) => list.name)).toEqual(['Sprint 14']);
  });

  it('cancels a running search when the text changes', async () => {
    search.mockImplementation((query: string) =>
      of(query === 'sso' ? results : []).pipe(delay(1_000)),
    );
    store.search('sso');
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 100);
    store.search('zzz');
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 1_000);

    expect(store.tasks()).toEqual([]);
    expect(store.query()).toBe('zzz');
  });

  it('clears the results for a blank text without searching', async () => {
    store.search('sso');
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    store.search('  ');
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

    expect(search).toHaveBeenCalledOnce();
    expect(store.tasks()).toEqual([]);
    expect(store.loading()).toBe(false);
  });

  it('flags a failed search, then retries it', async () => {
    search.mockReturnValueOnce(throwError(() => new Error('unavailable')));
    store.search('sso');
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

    expect(store.failed()).toBe(true);
    expect(store.tasks()).toEqual([]);

    store.retry();
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

    expect(search).toHaveBeenCalledTimes(2);
    expect(store.failed()).toBe(false);
    expect(store.tasks()).toHaveLength(1);
  });
});
