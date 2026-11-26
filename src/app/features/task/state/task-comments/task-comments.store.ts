import { computed, inject, type Signal, type Type } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { CwToastService } from '@cadenway/ui/components/toast';
import { distinctUntilChanged, filter, pipe, skip, tap } from 'rxjs';

import {
  type TaskCommentDraft,
  TaskSectionsApi,
} from '../../data-access/services/task-sections-api/task-sections-api.service';
import type { TaskComment, TaskCommentPage } from '../../models/task-detail/task-detail.interface';
import {
  codePointLength,
  COMMENT_MAX_LENGTH,
  mentionSpans,
} from '../../utils/task-detail-sections/task-detail-sections.util';
import { TaskDetailStore } from '../task-detail/task-detail.store';

/**
 * Type TaskParticipantsState
 *
 * @description
 * The read of who a comment or the description may mention.
 *
 * @type {'idle' | 'loading' | 'ready' | 'failed'}
 */
export type TaskParticipantsState = 'idle' | 'loading' | 'ready' | 'failed';

/**
 * Interface TaskCommentCountChange
 *
 * @description
 * A comment posted (`+1`) or deleted (`-1`) here, counted over the first page it was written
 * against: once the detail reads the first page again, its total already carries the write.
 */
interface TaskCommentCountChange {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * The comment.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property delta
   *
   * @description
   * `1` for a comment posted, `-1` for one deleted.
   *
   * @type {1 | -1}
   * @readonly
   */
  readonly delta: 1 | -1;

  /**
   * Property base
   *
   * @description
   * The first page shown when the write was made.
   *
   * @type {TaskCommentPage | null}
   * @readonly
   */
  readonly base: TaskCommentPage | null;
  // #endregion
}

/**
 * Interface TaskCommentsState
 *
 * @description
 * State of the comments tab over the detail's first comment page.
 */
interface TaskCommentsState {
  // #region Properties
  /**
   * Property later
   *
   * @description
   * The comments of the pages read after the first one.
   *
   * @type {readonly TaskComment[]}
   * @readonly
   */
  readonly later: readonly TaskComment[];

  /**
   * Property laterPages
   *
   * @description
   * How many later pages were read.
   *
   * @type {number}
   * @readonly
   */
  readonly laterPages: number;

  /**
   * Property laterCursor
   *
   * @description
   * Cursor after the last later page, or undefined while none was read (the first page's
   * cursor applies).
   *
   * @type {string | null | undefined}
   * @readonly
   */
  readonly laterCursor: string | null | undefined;

  /**
   * Property loadingMore
   *
   * @description
   * Whether a later page is being read.
   *
   * @type {boolean}
   * @readonly
   */
  readonly loadingMore: boolean;

  /**
   * Property moreFailed
   *
   * @description
   * Whether the last later page read failed.
   *
   * @type {boolean}
   * @readonly
   */
  readonly moreFailed: boolean;

  /**
   * Property added
   *
   * @description
   * The comments posted here, shown until a page read carries them.
   *
   * @type {readonly TaskComment[]}
   * @readonly
   */
  readonly added: readonly TaskComment[];

  /**
   * Property hidden
   *
   * @description
   * Comments deleted here (shown as gone at once).
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly hidden: readonly string[];

  /**
   * Property countChanges
   *
   * @description
   * The posts and deletions made here, applied to the count while the first page they were made
   * against is still the one shown.
   *
   * @type {readonly TaskCommentCountChange[]}
   * @readonly
   */
  readonly countChanges: readonly TaskCommentCountChange[];

  /**
   * Property sending
   *
   * @description
   * Whether a comment is being posted.
   *
   * @type {boolean}
   * @readonly
   */
  readonly sending: boolean;

  /**
   * Property sendFailed
   *
   * @description
   * Whether the last post failed (the composer keeps the text and offers `Retry`).
   *
   * @type {boolean}
   * @readonly
   */
  readonly sendFailed: boolean;

  /**
   * Property participants
   *
   * @description
   * Accounts a comment may mention.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly participants: readonly string[];

  /**
   * Property participantsState
   *
   * @description
   * The read of the participants.
   *
   * @type {TaskParticipantsState}
   * @readonly
   */
  readonly participantsState: TaskParticipantsState;

  /**
   * Property sendKey
   *
   * @description
   * The `Idempotency-Key` of the comment being sent, reused while the same body is sent again as
   * an answer to the same comment (another body or another reply target is another request).
   *
   * @type {{ readonly body: string; readonly replyTo: string | null; readonly key: string } | null}
   * @readonly
   */
  readonly sendKey: {
    readonly body: string;
    readonly replyTo: string | null;
    readonly key: string;
  } | null;
  // #endregion
}

/**
 * Interface TaskCommentsStoreInstance
 *
 * @description
 * Public API of `TaskCommentsStore`.
 */
export interface TaskCommentsStoreInstance {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * The comments shown, oldest first: the first page, later pages and the ones posted here,
   * without duplicates or the ones deleted here.
   *
   * @type {Signal<readonly TaskComment[]>}
   * @readonly
   */
  readonly items: Signal<readonly TaskComment[]>;

  /**
   * Property total
   *
   * @description
   * Live comments of the task (the tab's count), or null while the first page is missing: the
   * first page's total, corrected by the posts and deletions made since that page was read.
   *
   * @type {Signal<number | null>}
   * @readonly
   */
  readonly total: Signal<number | null>;

  /**
   * Property hasMore
   *
   * @description
   * Whether later (newer) pages remain to be read after the ones shown.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly hasMore: Signal<boolean>;

  /**
   * Property loadingMore
   *
   * @description
   * Whether a later page is being read.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly loadingMore: Signal<boolean>;

  /**
   * Property moreFailed
   *
   * @description
   * Whether the last later page read failed.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly moreFailed: Signal<boolean>;

  /**
   * Property sending
   *
   * @description
   * Whether a comment is being posted.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly sending: Signal<boolean>;

  /**
   * Property sendFailed
   *
   * @description
   * Whether the last post failed.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly sendFailed: Signal<boolean>;

  /**
   * Property participants
   *
   * @description
   * Accounts a comment or the description may mention, empty until read (or when the read
   * failed).
   *
   * @type {Signal<readonly string[]>}
   * @readonly
   */
  readonly participants: Signal<readonly string[]>;
  // #endregion

  // #region Methods
  /**
   * Method start
   *
   * @description
   * Reads the participants once, when the tab opens or a `@` menu first searches; later calls
   * share that read. A caller without the comment right (`TaskDetailStore.canComment`) reads
   * nothing.
   *
   * @returns {Promise<void>} Resolves once the participants are read or the read failed.
   */
  start(): Promise<void>;

  /**
   * Method loadMore
   *
   * @description
   * Reads the next page of comments.
   *
   * @returns {Promise<void>} Resolves once read.
   */
  loadMore(): Promise<void>;

  /**
   * Method send
   *
   * @description
   * Posts a comment with its mention spans (the `@[Name](id)` tokens) under an
   * `Idempotency-Key` kept while the same body is sent again to the same reply target, then reads the detail again for the
   * task's new version and the first page. A body over 5,000 code points is not sent.
   *
   * @param {string} body - The Markdown.
   * @param {string | null} replyTo - The comment it answers, or null.
   * @returns {Promise<boolean>} Whether it was posted.
   */
  send(body: string, replyTo: string | null): Promise<boolean>;

  /**
   * Method remove
   *
   * @description
   * Deletes one of the caller's comments at once; a refusal shows it again with the failure
   * toast. The success toast's `Undo` posts it again (the contract has no restore), as a new
   * comment at the end with its mentions and reply, to the task it was deleted from even when
   * another task is open by then; the visible comments change only while that task is still open.
   *
   * @param {TaskComment} comment - The comment.
   * @returns {Promise<boolean>} Whether it was deleted.
   */
  remove(comment: TaskComment): Promise<boolean>;
  // #endregion
}

/**
 * Function uniqueComments
 *
 * @description
 * Concatenates comment lists without repeating an id, keeping the first occurrence.
 *
 * @param {readonly (readonly TaskComment[])[]} lists - The lists, in order.
 * @returns {readonly TaskComment[]} The comments.
 */
function uniqueComments(lists: readonly (readonly TaskComment[])[]): readonly TaskComment[] {
  const seen: Set<string> = new Set<string>();
  const comments: TaskComment[] = [];
  for (const list of lists) {
    for (const comment of list) {
      if (seen.has(comment.id)) continue;
      seen.add(comment.id);
      comments.push(comment);
    }
  }
  return comments;
}

/**
 * Function createTaskCommentsStore
 *
 * @description
 * Builds the comments store.
 *
 * @returns {Type<TaskCommentsStoreInstance>} Injectable store constructor.
 */
function createTaskCommentsStore(): Type<TaskCommentsStoreInstance> {
  const initialState: TaskCommentsState = {
    later: [],
    laterPages: 0,
    laterCursor: undefined,
    loadingMore: false,
    moreFailed: false,
    added: [],
    hidden: [],
    countChanges: [],
    sending: false,
    sendFailed: false,
    participants: [],
    participantsState: 'idle',
    sendKey: null,
  };
  return signalStore(
    withState(initialState),
    withProps(() => ({
      _api: inject(TaskSectionsApi),
      _detail: inject(TaskDetailStore),
      _toasts: inject(CwToastService),
    })),
    withComputed((store) => ({
      items: computed((): readonly TaskComment[] => {
        const hidden: ReadonlySet<string> = new Set<string>(store.hidden());
        return uniqueComments([
          store._detail.comments()?.items ?? [],
          store.later(),
          store.added(),
        ]).filter((comment: TaskComment): boolean => !hidden.has(comment.id));
      }),
      total: computed((): number | null => {
        const first: TaskCommentPage | null = store._detail.comments();
        if (first === null) return null;
        const pending: number = store
          .countChanges()
          .filter((change: TaskCommentCountChange): boolean => change.base === first)
          .reduce((sum: number, change: TaskCommentCountChange): number => sum + change.delta, 0);
        return Math.max(0, first.total + pending);
      }),
      _cursor: computed((): string | null => {
        const cursor: string | null | undefined = store.laterCursor();
        return cursor === undefined ? (store._detail.comments()?.nextCursor ?? null) : cursor;
      }),
    })),
    withComputed((store) => ({
      hasMore: computed((): boolean => store._cursor() !== null),
    })),
    withMethods((store) => {
      let participantsRead: Promise<void> | null = null;
      const readParticipants: () => Promise<void> = async (): Promise<void> => {
        const key: string | null = store._detail.taskKey();
        if (key === null) return;
        patchState(store, { participantsState: 'loading' });
        try {
          const ids: readonly string[] = await store._api.participants(key);
          patchState(store, { participants: ids, participantsState: 'ready' });
        } catch {
          patchState(store, { participantsState: 'failed' });
        }
      };
      const post: (
        taskKey: string,
        draft: TaskCommentDraft,
        idempotencyKey: string,
      ) => Promise<TaskComment> = async (
        taskKey: string,
        draft: TaskCommentDraft,
        idempotencyKey: string,
      ): Promise<TaskComment> => {
        const comment: TaskComment = await store._api.comment(taskKey, draft, idempotencyKey);
        if (store._detail.taskKey() === taskKey) {
          patchState(store, {
            added: [...store.added(), comment],
            countChanges: [
              ...store.countChanges(),
              { id: comment.id, delta: 1, base: store._detail.comments() },
            ],
          });
          void store._detail.reload();
        }
        return comment;
      };
      const refreshLater: () => Promise<void> = async (): Promise<void> => {
        const key: string | null = store._detail.taskKey();
        const pages: number = store.laterPages();
        let cursor: string | null = store._detail.comments()?.nextCursor ?? null;
        if (key === null || pages === 0) return;
        const later: TaskComment[] = [];
        let read: number = 0;
        try {
          while (cursor !== null && read <= pages) {
            const page: TaskCommentPage = await store._api.comments(key, cursor);
            later.push(...page.items);
            cursor = page.nextCursor;
            read++;
          }
          patchState(store, { later, laterPages: read, laterCursor: cursor });
        } catch {
          patchState(store, { moreFailed: true });
        }
      };
      return {
        start(): Promise<void> {
          if (participantsRead === null && store._detail.canComment()) {
            participantsRead = readParticipants();
          }
          return participantsRead ?? Promise.resolve();
        },

        async loadMore(): Promise<void> {
          const key: string | null = store._detail.taskKey();
          const cursor: string | null = store._cursor();
          if (key === null || cursor === null || store.loadingMore()) return;
          patchState(store, { loadingMore: true, moreFailed: false });
          try {
            const page: TaskCommentPage = await store._api.comments(key, cursor);
            patchState(store, {
              later: [...store.later(), ...page.items],
              laterPages: store.laterPages() + 1,
              laterCursor: page.nextCursor,
              loadingMore: false,
            });
          } catch {
            patchState(store, { loadingMore: false, moreFailed: true });
          }
        },

        async send(body: string, replyTo: string | null): Promise<boolean> {
          const text: string = body.trim();
          if (text === '' || codePointLength(text) > COMMENT_MAX_LENGTH || store.sending()) {
            return false;
          }
          const key: string | null = store._detail.taskKey();
          if (key === null) return false;
          const held: TaskCommentsState['sendKey'] = store.sendKey();
          const idempotencyKey: string =
            held?.body === text && held.replyTo === replyTo ? held.key : crypto.randomUUID();
          patchState(store, {
            sending: true,
            sendFailed: false,
            sendKey: { body: text, replyTo, key: idempotencyKey },
          });
          try {
            await post(key, { body: text, mentions: mentionSpans(text), replyTo }, idempotencyKey);
            patchState(store, { sending: false, sendKey: null });
            return true;
          } catch {
            patchState(store, { sending: false, sendFailed: true });
            return false;
          }
        },

        async remove(comment: TaskComment): Promise<boolean> {
          const key: string | null = store._detail.taskKey();
          if (key === null) return false;
          patchState(store, {
            hidden: [...store.hidden(), comment.id],
            countChanges: [
              ...store.countChanges(),
              { id: comment.id, delta: -1, base: store._detail.comments() },
            ],
          });
          try {
            await store._api.deleteComment(key, comment);
            void store._detail.reload();
            store._toasts.success($localize`:@@task.comments.deleted:Comment deleted`, {
              undo: (): void => {
                post(
                  key,
                  {
                    body: comment.body,
                    mentions: mentionSpans(comment.body),
                    replyTo: comment.replyToCommentId,
                  },
                  crypto.randomUUID(),
                ).catch((): void => {
                  store._toasts.error(
                    $localize`:@@task.comments.restore-failed:Could not restore the comment`,
                  );
                });
              },
            });
            return true;
          } catch {
            patchState(store, {
              hidden: store.hidden().filter((id: string): boolean => id !== comment.id),
              countChanges: store
                .countChanges()
                .filter(
                  (change: TaskCommentCountChange): boolean =>
                    change.id !== comment.id || change.delta !== -1,
                ),
            });
            store._toasts.error(
              $localize`:@@task.comments.delete-failed:Could not delete the comment`,
              {
                description: $localize`:@@task.detail.failed-text:The server did not answer. Try again in a moment.`,
              },
            );
            return false;
          }
        },

        _followRevision: rxMethod<number>(
          pipe(
            distinctUntilChanged(),
            skip(1),
            filter((): boolean => store.laterPages() > 0),
            tap((): void => {
              void refreshLater();
            }),
          ),
        ),
      };
    }),
    withHooks({
      onInit(store): void {
        store._followRevision(store._detail.commentsRevision);
      },
    }),
  );
}

/**
 * Constant TaskCommentsStore
 *
 * @description
 * The comments of the open task (`App.dc.html` lines 2305-2366), provided by
 * `cw-task-detail-tabs`. The first page is `TaskDetailStore.comments` (its inline error and
 * `reloadComments` when it is missing); later pages are read with `Show more comments`, and read again up
 * to the same depth when a comment notice arrives (`commentsRevision`). Posting and deleting
 * change the task's version, so both read the detail again. Deletion is shown at once and put
 * back on refusal; its `Undo` posts the comment again. The participants read, made when the tab
 * first opens or a `@` menu first searches, gives the mention menus of the composer and the
 * description; the comment right is the detail's (`TaskDetailStore.canComment`).
 *
 * @type {Type<TaskCommentsStoreInstance>}
 */
export const TaskCommentsStore: Type<TaskCommentsStoreInstance> = createTaskCommentsStore();
