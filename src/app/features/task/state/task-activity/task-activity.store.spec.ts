import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { TaskSectionsApi } from '../../data-access/services/task-sections-api/task-sections-api.service';
import type {
  TaskActivityEntry,
  TaskActivityPage,
} from '../../models/task-detail-sections/task-detail-sections.interface';
import { TaskDetailStore } from '../task-detail/task-detail.store';
import { TaskActivityStore, type TaskActivityStoreInstance } from './task-activity.store';

/**
 * Function page
 *
 * @description
 * A page of the activity of CAD-482.
 *
 * @param {readonly string[]} ids - Its entries.
 * @param {string | null} nextCursor - Cursor of the next page.
 * @returns {TaskActivityPage} The page.
 */
function page(ids: readonly string[], nextCursor: string | null): TaskActivityPage {
  return {
    total: 3,
    nextCursor,
    items: ids.map((id: string): TaskActivityEntry => ({
      id,
      at: '2026-11-06T09:00:00Z',
      actor: { type: 'git', id: 'github', provider: 'github' },
      change: { kind: 'status', from: 'progress', to: 'review' },
    })),
  };
}

describe('TaskActivityStore', () => {
  let version: WritableSignal<number>;
  let api: Record<string, Mock>;
  let store: TaskActivityStoreInstance;

  beforeEach(() => {
    version = signal(4);
    api = {
      activityPage: vi.fn((_key: string, cursor: string | null) =>
        Promise.resolve(cursor === null ? page(['e1', 'e2'], 'p2') : page(['e3'], null)),
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        TaskActivityStore,
        {
          provide: TaskDetailStore,
          useValue: { taskKey: signal('CAD-482'), confirmedTask: () => ({ version: version() }) },
        },
        { provide: TaskSectionsApi, useValue: api },
      ],
    });
    store = TestBed.inject(TaskActivityStore);
  });

  it('reads nothing until the tab is shown, then pages', async () => {
    TestBed.tick();
    expect(api['activityPage']).not.toHaveBeenCalled();

    store.show(true);
    await vi.waitFor(() => {
      expect(store.items()).toHaveLength(2);
    });
    expect(store.hasMore()).toBe(true);

    await store.loadMore();
    expect(store.items().map((entry: TaskActivityEntry) => entry.id)).toEqual(['e1', 'e2', 'e3']);
    expect(store.hasMore()).toBe(false);
  });

  it('shows a failed read and reads again on Retry', async () => {
    api['activityPage'].mockRejectedValueOnce(new Error('offline'));
    store.show(true);
    await vi.waitFor(() => {
      expect(store.failed()).toBe(true);
    });

    await store.load();

    expect(store.failed()).toBe(false);
    expect(store.items()).toHaveLength(2);
  });

  it('reads again when the task version moves while the tab is shown', async () => {
    TestBed.tick();
    store.show(true);
    await vi.waitFor(() => {
      expect(store.items()).toHaveLength(2);
    });

    version.set(5);
    TestBed.tick();

    await vi.waitFor(() => {
      expect(api['activityPage']).toHaveBeenCalledTimes(2);
    });
  });
});
