import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { delay, type Observable, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceOrganization,
} from '@features/workspace/ports/workspace-context';

import { SearchApi } from '../../data-access/services/search-api/search-api.service';
import type { SearchResult } from '../../models/search-result/search-result.interface';
import { CommandPaletteStore, DEBOUNCE_MS } from './command-palette.store';

/**
 * Constant results
 *
 * @description
 * Matches of `sso` in the mockup: a task, then a list.
 *
 * @type {readonly SearchResult[]}
 */
const results: readonly SearchResult[] = [
  { kind: 'task', key: 'CAD-482', name: 'Review of the SSO flow', status: 'review' },
  { kind: 'list', listId: 'l1', name: 'Sprint 14', spaceName: 'Product' },
];

/**
 * Function organization
 *
 * @description
 * An organization of the mockup as the workspace port shows it.
 *
 * @param {string} id - Organization id.
 * @returns {WorkspaceOrganization} The organization.
 */
function organization(id: string): WorkspaceOrganization {
  return { id, slug: id, name: id, initials: 'AN', role: 'owner', plan: 'team' };
}

describe('CommandPaletteStore', () => {
  let search: Mock<(query: string) => Observable<readonly SearchResult[]>>;
  let current: WritableSignal<WorkspaceOrganization>;
  let store: InstanceType<typeof CommandPaletteStore>;

  beforeEach(() => {
    vi.useFakeTimers();
    search = vi.fn(() => of(results));
    current = signal(organization('atelier-nord'));
    TestBed.configureTestingModule({
      providers: [
        CommandPaletteStore,
        { provide: SearchApi, useValue: { search } },
        { provide: WORKSPACE_CONTEXT, useValue: { organization: current } },
      ],
    });
    store = TestBed.inject(CommandPaletteStore);
    TestBed.tick();
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

  it('drops an old answer that arrives inside the pause of the next text', async () => {
    search.mockImplementation((query: string) =>
      of(query === 'sso' ? results : []).pipe(delay(200)),
    );
    store.search('sso');
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 100);
    expect(search).toHaveBeenCalledWith('sso');

    store.search('zzz');
    expect(store.tasks()).toEqual([]);
    await vi.advanceTimersByTimeAsync(150);

    expect(store.tasks()).toEqual([]);
    expect(store.loading()).toBe(true);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 200);
    expect(store.loading()).toBe(false);
    expect(store.query()).toBe('zzz');
    expect(store.tasks()).toEqual([]);
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

  it('cancels and clears everything on an organization switch', async () => {
    search.mockImplementation(() => of(results).pipe(delay(200)));
    store.search('sso');
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 100);

    current.set(organization('lumen'));
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(500);

    expect(store.query()).toBe('');
    expect(store.tasks()).toEqual([]);
    expect(store.loading()).toBe(false);
  });
});
