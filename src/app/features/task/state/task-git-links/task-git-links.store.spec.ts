import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { TaskGitLinksApi } from '../../data-access/services/task-git-links-api/task-git-links-api.service';
import type {
  TaskGitLink,
  TaskGitLinkPage,
} from '../../models/task-git-link/task-git-link.interface';
import { TaskDetailStore } from '../task-detail/task-detail.store';
import { TaskGitLinksStore, type TaskGitLinksStoreInstance } from './task-git-links.store';

/**
 * Function link
 *
 * @description
 * A pull request of `atelier-nord/cadenway-web` linked to CAD-482.
 *
 * @param {string} id - Its identifier.
 * @returns {TaskGitLink} The link.
 */
function link(id: string): TaskGitLink {
  return {
    id,
    provider: 'github',
    kind: 'pull-request',
    state: 'open',
    title: `feat(auth): ${id}`,
    number: 214,
    url: 'https://github.com/atelier-nord/cadenway-web/pull/214',
    repository: {
      fullName: 'atelier-nord/cadenway-web',
      url: 'https://github.com/atelier-nord/cadenway-web',
    },
    branch: 'cad-482-sso-sign-in-screen',
    author: { login: 'cmartin', name: 'Camille Martin' },
    checks: { state: 'running', total: null, failed: null },
    checksCompletedAt: null,
    reviewRequested: true,
    additions: 418,
    deletions: 132,
    linkSource: 'branch',
    createdAt: '2026-11-08T08:40:00Z',
  };
}

/**
 * Function page
 *
 * @description
 * A page of the links of CAD-482.
 *
 * @param {readonly string[]} ids - Its links.
 * @param {string | null} nextCursor - Cursor of the next page.
 * @returns {TaskGitLinkPage} The page.
 */
function page(ids: readonly string[], nextCursor: string | null): TaskGitLinkPage {
  return { items: ids.map(link), nextCursor };
}

/**
 * Function ids
 *
 * @description
 * The identifiers of the links listed.
 *
 * @param {TaskGitLinksStoreInstance} store - The store.
 * @returns {string[]} Their identifiers.
 */
function ids(store: TaskGitLinksStoreInstance): string[] {
  return store.items().map((item: TaskGitLink) => item.id);
}

describe('TaskGitLinksStore', () => {
  let taskKey: WritableSignal<string | null>;
  let ready: WritableSignal<boolean>;
  let development: WritableSignal<TaskGitLinkPage | null>;
  let partial: WritableSignal<readonly string[]>;
  let gitRevision: WritableSignal<number>;
  let api: { page: Mock<(key: string, cursor: string | null) => Promise<TaskGitLinkPage>> };

  /**
   * Function create
   *
   * @description
   * The store over the faked detail, its first reactions run.
   *
   * @returns {TaskGitLinksStoreInstance} The store.
   */
  function create(): TaskGitLinksStoreInstance {
    const store: TaskGitLinksStoreInstance = TestBed.inject(TaskGitLinksStore);
    TestBed.tick();
    return store;
  }

  beforeEach(() => {
    taskKey = signal<string | null>('CAD-482');
    ready = signal(true);
    development = signal<TaskGitLinkPage | null>(page(['g1', 'g2'], 'c2'));
    partial = signal<readonly string[]>([]);
    gitRevision = signal(3);
    api = {
      page: vi.fn((_key: string, cursor: string | null) =>
        Promise.resolve(cursor === null ? page(['g0', 'g1', 'g2'], 'c2') : page(['g3'], null)),
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        TaskGitLinksStore,
        {
          provide: TaskDetailStore,
          useValue: { taskKey, ready, development, partial, gitRevision },
        },
        { provide: TaskGitLinksApi, useValue: api },
      ],
    });
  });

  it('seeds the list from the detail without reading it again', () => {
    const store: TaskGitLinksStoreInstance = create();

    expect(ids(store)).toEqual(['g1', 'g2']);
    expect(store.ready()).toBe(true);
    expect(store.failed()).toBe(false);
    expect(store.hasMore()).toBe(true);
    expect(api.page).not.toHaveBeenCalled();
  });

  it('reads later pages with Show more, without repeating a link', async () => {
    api.page.mockResolvedValueOnce(page(['g2', 'g3'], null));
    const store: TaskGitLinksStoreInstance = create();

    await store.loadMore();

    expect(api.page).toHaveBeenCalledWith('CAD-482', 'c2');
    expect(ids(store)).toEqual(['g1', 'g2', 'g3']);
    expect(store.hasMore()).toBe(false);
  });

  it('keeps the links shown when a later page fails, and retries it', async () => {
    api.page.mockRejectedValueOnce(new Error('offline'));
    const store: TaskGitLinksStoreInstance = create();

    await store.loadMore();

    expect(store.moreFailed()).toBe(true);
    expect(ids(store)).toEqual(['g1', 'g2']);
    await store.loadMore();
    expect(store.moreFailed()).toBe(false);
    expect(ids(store)).toEqual(['g1', 'g2', 'g3']);
  });

  it('shows a partial detail as failed until Retry reads the links', async () => {
    development.set(null);
    partial.set(['development']);
    const store: TaskGitLinksStoreInstance = create();

    expect(store.failed()).toBe(true);
    expect(store.ready()).toBe(false);
    expect(api.page).not.toHaveBeenCalled();

    api.page.mockRejectedValueOnce(new Error('offline'));
    await store.load();
    expect(store.failed()).toBe(true);

    await store.load();
    expect(store.failed()).toBe(false);
    expect(ids(store)).toEqual(['g0', 'g1', 'g2']);
  });

  it('distinguishes an empty list from a failed read', () => {
    development.set({ items: [], nextCursor: null });
    const store: TaskGitLinksStoreInstance = create();

    expect(store.items()).toEqual([]);
    expect(store.ready()).toBe(true);
    expect(store.failed()).toBe(false);
  });

  it('reads the links itself when the detail neither carries nor misses them', async () => {
    development.set(null);
    const store: TaskGitLinksStoreInstance = create();

    await vi.waitFor(() => {
      expect(ids(store)).toEqual(['g0', 'g1', 'g2']);
    });
    expect(api.page).toHaveBeenCalledWith('CAD-482', null);
  });

  it('reads again to the depth shown on a pushed Git change', async () => {
    const store: TaskGitLinksStoreInstance = create();
    await store.loadMore();
    api.page.mockClear();

    gitRevision.set(4);
    TestBed.tick();

    await vi.waitFor(() => {
      expect(ids(store)).toEqual(['g0', 'g1', 'g2', 'g3']);
    });
    expect(api.page.mock.calls).toEqual([
      ['CAD-482', null],
      ['CAD-482', 'c2'],
    ]);
  });

  it('keeps the links shown when a pushed reread fails, then retries', async () => {
    const store: TaskGitLinksStoreInstance = create();
    api.page.mockRejectedValueOnce(new Error('offline'));

    gitRevision.set(4);
    TestBed.tick();

    await vi.waitFor(() => {
      expect(store.failed()).toBe(true);
    });
    expect(ids(store)).toEqual(['g1', 'g2']);
    await store.load();
    expect(store.failed()).toBe(false);
    expect(ids(store)).toEqual(['g0', 'g1', 'g2']);
  });

  it('does not take a later detail read over the links it already shows', () => {
    const store: TaskGitLinksStoreInstance = create();

    development.set(page(['g9'], null));
    TestBed.tick();

    expect(ids(store)).toEqual(['g1', 'g2']);
  });

  it('starts afresh for another task and drops the answer of the previous one', async () => {
    let answer: (value: TaskGitLinkPage) => void = (): void => undefined;
    api.page.mockReturnValueOnce(
      new Promise<TaskGitLinkPage>((resolve: (value: TaskGitLinkPage) => void) => {
        answer = resolve;
      }),
    );
    const store: TaskGitLinksStoreInstance = create();
    const reading: Promise<void> = store.load();

    taskKey.set('CAD-479');
    development.set(page(['b1'], null));
    TestBed.tick();
    answer(page(['late'], null));
    await reading;

    expect(ids(store)).toEqual(['b1']);
    expect(store.hasMore()).toBe(false);
  });
});
