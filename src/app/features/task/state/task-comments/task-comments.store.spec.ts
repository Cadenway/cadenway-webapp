import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CwToastService, type CwToastOptions } from '@cadenway/ui/components/toast';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { TaskSectionsApi } from '../../data-access/services/task-sections-api/task-sections-api.service';
import type { TaskComment, TaskCommentPage } from '../../models/task-detail/task-detail.interface';
import { TaskDetailStore } from '../task-detail/task-detail.store';
import { TaskCommentsStore, type TaskCommentsStoreInstance } from './task-comments.store';

/**
 * Function comment
 *
 * @description
 * A comment of CAD-482.
 *
 * @param {string} id - Its id.
 * @param {string} authorId - Its author.
 * @param {string} body - Its Markdown.
 * @returns {TaskComment} The comment.
 */
function comment(id: string, authorId: string, body: string): TaskComment {
  return {
    id,
    author: { type: 'user', id: authorId },
    body,
    createdAt: '2026-11-06T09:00:00Z',
    editedAt: null,
    version: 1,
    replyToCommentId: null,
  };
}

describe('TaskCommentsStore', () => {
  let first: WritableSignal<TaskCommentPage | null>;
  let canComment: WritableSignal<boolean>;
  let detail: Record<string, unknown>;
  let api: Record<string, Mock>;
  let toasts: { success: Mock; error: Mock };
  let store: TaskCommentsStoreInstance;

  beforeEach(() => {
    first = signal<TaskCommentPage | null>({
      items: [comment('c1', 'u2', 'Export ready for review.')],
      total: 2,
      nextCursor: 'p2',
    });
    canComment = signal(true);
    detail = {
      taskKey: signal('CAD-482'),
      comments: first,
      canEdit: signal(true),
      canComment,
      commentsRevision: signal(0),
      reload: vi.fn(() => Promise.resolve()),
    };
    api = {
      participants: vi.fn(() => Promise.resolve(['u1', 'u2'])),
      comments: vi.fn(() =>
        Promise.resolve({ items: [comment('c2', 'u1', 'Merged.')], total: 2, nextCursor: null }),
      ),
      comment: vi.fn(),
      deleteComment: vi.fn(() => Promise.resolve()),
    };
    toasts = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        TaskCommentsStore,
        { provide: TaskDetailStore, useValue: detail },
        { provide: TaskSectionsApi, useValue: api },
        { provide: CwToastService, useValue: toasts },
      ],
    });
    store = TestBed.inject(TaskCommentsStore);
  });

  it('shows the first page, then the next one, with the total', async () => {
    expect(store.items().map((item: TaskComment) => item.id)).toEqual(['c1']);
    expect(store.hasMore()).toBe(true);

    await store.loadMore();

    expect(api['comments']).toHaveBeenCalledWith('CAD-482', 'p2');
    expect(store.items().map((item: TaskComment) => item.id)).toEqual(['c1', 'c2']);
    expect(store.hasMore()).toBe(false);
    expect(store.total()).toBe(2);
  });

  it('keeps a failed next page apart from the list', async () => {
    api['comments'].mockRejectedValueOnce(new Error('offline'));

    await store.loadMore();

    expect(store.moreFailed()).toBe(true);
    expect(store.items()).toHaveLength(1);
  });

  it('posts a comment with its mention spans and reads the detail again', async () => {
    api['comment'].mockResolvedValue(comment('c3', 'u1', 'Thanks @[Hugo Dubois](u2)'));

    await expect(store.send(' Thanks @[Hugo Dubois](u2) ', 'c1')).resolves.toBe(true);

    expect(api['comment']).toHaveBeenCalledWith(
      'CAD-482',
      {
        body: 'Thanks @[Hugo Dubois](u2)',
        mentions: [{ userId: 'u2', start: 7, end: 25 }],
        replyTo: 'c1',
      },
      expect.any(String),
    );
    expect(store.items().map((item: TaskComment) => item.id)).toEqual(['c1', 'c3']);
    expect(store.total()).toBe(3);
    expect(detail['reload']).toHaveBeenCalled();
  });

  it('keeps the idempotency key when the same comment is sent again after a failure', async () => {
    api['comment'].mockRejectedValueOnce(new Error('offline'));
    await store.send('Hello', null);
    expect(store.sendFailed()).toBe(true);
    api['comment'].mockResolvedValue(comment('c3', 'u1', 'Hello'));

    await store.send('Hello', null);

    const keys: unknown[] = api['comment'].mock.calls.map((call: unknown[]) => call[2]);
    expect(keys[0]).toBe(keys[1]);
    expect(store.sendFailed()).toBe(false);
  });

  it('refuses a comment over 5,000 characters', async () => {
    await expect(store.send('x'.repeat(5001), null)).resolves.toBe(false);
    expect(api['comment']).not.toHaveBeenCalled();
  });

  it('hides a deleted comment at once and shows it again when refused', async () => {
    let refuse: (error: unknown) => void = () => undefined;
    api['deleteComment'].mockReturnValue(
      new Promise((_resolve: unknown, reject: (error: unknown) => void) => {
        refuse = reject;
      }),
    );

    const removed: Promise<boolean> = store.remove(comment('c1', 'u2', 'Export ready for review.'));

    expect(store.items()).toHaveLength(0);
    refuse(new Error('refused'));
    await expect(removed).resolves.toBe(false);
    expect(store.items()).toHaveLength(1);
    expect(toasts.error).toHaveBeenCalled();
  });

  it('posts a deleted comment again from the toast Undo', async () => {
    const mine: TaskComment = comment('c1', 'u2', 'Export ready for review.');
    api['comment'].mockResolvedValue(comment('c9', 'u2', mine.body));

    await store.remove(mine);
    const options: CwToastOptions = toasts.success.mock.calls[0][1] as CwToastOptions;
    options.undo?.();

    await vi.waitFor(() => {
      expect(store.items().map((item: TaskComment) => item.id)).toEqual(['c9']);
    });
    expect(api['comment']).toHaveBeenCalledWith(
      'CAD-482',
      { body: mine.body, mentions: [], replyTo: null },
      expect.any(String),
    );
  });

  it('posts the Undo to the task it was deleted from once another task is open', async () => {
    const mine: TaskComment = comment('c1', 'u2', 'Export ready for review.');
    api['comment'].mockResolvedValue(comment('c9', 'u2', mine.body));
    await store.remove(mine);
    (detail['reload'] as Mock).mockClear();
    (detail['taskKey'] as WritableSignal<string>).set('CAD-490');

    const options: CwToastOptions = toasts.success.mock.calls[0][1] as CwToastOptions;
    options.undo?.();

    await vi.waitFor(() => {
      expect(api['comment']).toHaveBeenCalledWith(
        'CAD-482',
        { body: mine.body, mentions: [], replyTo: null },
        expect.any(String),
      );
    });
    expect(store.items()).toEqual([]);
    expect(detail['reload']).not.toHaveBeenCalled();
  });

  it('uses a new idempotency key when the same body answers another comment', async () => {
    api['comment'].mockRejectedValueOnce(new Error('offline'));
    await store.send('Hello', 'c1');
    api['comment'].mockResolvedValue(comment('c3', 'u1', 'Hello'));

    await store.send('Hello', null);

    const keys: unknown[] = api['comment'].mock.calls.map((call: unknown[]) => call[2]);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('counts a post beyond the first page once the first page is read again', async () => {
    first.set({
      items: [comment('c1', 'u2', 'Export ready for review.')],
      total: 30,
      nextCursor: 'p2',
    });
    api['comment'].mockResolvedValue(comment('c31', 'u1', 'Merged.'));
    await store.send('Merged.', null);
    expect(store.total()).toBe(31);

    first.set({
      items: [comment('c1', 'u2', 'Export ready for review.')],
      total: 31,
      nextCursor: 'p2',
    });

    expect(store.total()).toBe(31);
    expect(store.items().map((item: TaskComment) => item.id)).toEqual(['c1', 'c31']);
  });

  it('counts a deletion from a later page once the first page is read again', async () => {
    first.set({
      items: [comment('c1', 'u2', 'Export ready for review.')],
      total: 30,
      nextCursor: 'p2',
    });
    await store.loadMore();
    await store.remove(comment('c2', 'u1', 'Merged.'));
    expect(store.total()).toBe(29);

    first.set({
      items: [comment('c1', 'u2', 'Export ready for review.')],
      total: 29,
      nextCursor: 'p2',
    });

    expect(store.total()).toBe(29);
    expect(store.items().map((item: TaskComment) => item.id)).toEqual(['c1']);
  });

  it('reads the participants once, however many menus ask', async () => {
    await Promise.all([store.start(), store.start()]);
    await store.start();

    expect(api['participants']).toHaveBeenCalledOnce();
    expect(store.participants()).toEqual(['u1', 'u2']);
  });

  it('reads no participants for a caller without the comment right', async () => {
    canComment.set(false);

    await store.start();

    expect(api['participants']).not.toHaveBeenCalled();
    expect(store.participants()).toEqual([]);
  });

  it('offers no one to mention after a failed participants read', async () => {
    api['participants'].mockRejectedValueOnce(new Error('offline'));

    await store.start();

    expect(store.participants()).toEqual([]);
  });
});
