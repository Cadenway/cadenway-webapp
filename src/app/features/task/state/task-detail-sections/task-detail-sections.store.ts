import { DOCUMENT } from '@angular/common';
import { computed, inject, type Signal, type Type } from '@angular/core';
import {
  patchState,
  signalMethod,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { CwToastService } from '@cadenway/ui/components/toast';

import { hasProblemCode } from '@core/api';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { TaskSectionsApi } from '../../data-access/services/task-sections-api/task-sections-api.service';
import type { Person } from '../../models/person/person.interface';
import type {
  TaskChecklistItem,
  TaskDetailPatch,
  TaskDetailTask,
} from '../../models/task-detail/task-detail.interface';
import { mentionSpans } from '../../utils/task-detail-sections/task-detail-sections.util';
import { TaskDetailStore } from '../task-detail/task-detail.store';

/**
 * Constant UNVERSIONED_WRITE
 *
 * @description
 * The `write` fallback of the checklist writes, which send no `If-Match`: they still queue behind
 * the task's other writes, but need no confirmed version to be sent.
 *
 * @type {number}
 */
const UNVERSIONED_WRITE: number = 0;

/**
 * Constant DESCRIPTION_DRAFT_PREFIX
 *
 * @description
 * Prefix of the device storage key of a description draft not confirmed yet, followed by the
 * organization, the user and the task key (another account on the device never reads it): the draft outlives the detail, so a save that failed or
 * conflicted after the caller closed the detail or opened another task is offered again.
 *
 * @type {string}
 */
export const DESCRIPTION_DRAFT_PREFIX: string = 'cadenway-task-description-draft';

/**
 * Interface StoredDescriptionDraft
 *
 * @description
 * A description draft kept on the device until its write is confirmed.
 */
interface StoredDescriptionDraft {
  // #region Properties
  /**
   * Property markdown
   *
   * @description
   * The text typed.
   *
   * @type {string}
   * @readonly
   */
  readonly markdown: string;

  /**
   * Property base
   *
   * @description
   * The description the text was typed over.
   *
   * @type {string}
   * @readonly
   */
  readonly base: string;
  // #endregion
}

/**
 * Constant DESCRIPTION_SAVE_MS
 *
 * @description
 * Quiet time after the last keystroke before the description is saved.
 *
 * @type {number}
 */
export const DESCRIPTION_SAVE_MS: number = 800;

/**
 * Constant SUBTASK_LIMIT
 *
 * @description
 * Direct subtasks a task holds at most.
 *
 * @type {number}
 */
export const SUBTASK_LIMIT: number = 25;

/**
 * Constant SUBTASK_DEPTH
 *
 * @description
 * Depth of the deepest task that may still get subtasks: 0 for a task, 1 for a subtask (its
 * subtasks are the third level).
 *
 * @type {number}
 */
export const SUBTASK_DEPTH: number = 1;

/**
 * Type SubtaskLimit
 *
 * @description
 * Why no subtask can be added: three levels reached, or 25 subtasks.
 *
 * @type {'depth' | 'count'}
 */
export type SubtaskLimit = 'depth' | 'count';

/**
 * Interface TaskDetailSectionsState
 *
 * @description
 * State of the detail's own writes and of the member directory.
 */
interface TaskDetailSectionsState {
  // #region Properties
  /**
   * Property people
   *
   * @description
   * The organization's members, guests included.
   *
   * @type {readonly Person[]}
   * @readonly
   */
  readonly people: readonly Person[];

  /**
   * Property checklistPending
   *
   * @description
   * Ticks shown before the gateway confirms them, by item.
   *
   * @type {Readonly<Record<string, boolean>>}
   * @readonly
   */
  readonly checklistPending: Readonly<Record<string, boolean>>;

  /**
   * Property depth
   *
   * @description
   * Level of the open task (0 at the first level), or null while unknown.
   *
   * @type {number | null}
   * @readonly
   */
  readonly depth: number | null;

  /**
   * Property refusedLimit
   *
   * @description
   * The limit a refused creation named, until the task moves under another parent or its
   * subtask count changes.
   *
   * @type {SubtaskLimit | null}
   * @readonly
   */
  readonly refusedLimit: SubtaskLimit | null;

  /**
   * Property restoredDraft
   *
   * @description
   * A description draft of the open task restored from the device (its save failed or
   * conflicted earlier), shown in the editor until it is saved or discarded, or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly restoredDraft: string | null;

  /**
   * Property restoredChanged
   *
   * @description
   * Whether the description changed since the restored draft was typed: the draft is then not
   * saved by itself, only through `keepDraft`.
   *
   * @type {boolean}
   * @readonly
   */
  readonly restoredChanged: boolean;

  /**
   * Property creating
   *
   * @description
   * Whether a subtask is being created.
   *
   * @type {boolean}
   * @readonly
   */
  readonly creating: boolean;
  // #endregion
}

/**
 * Interface TaskDetailSectionsStoreInstance
 *
 * @description
 * Public API of `TaskDetailSectionsStore`.
 */
export interface TaskDetailSectionsStoreInstance {
  // #region Properties
  /**
   * Property people
   *
   * @description
   * The organization's members.
   *
   * @type {Signal<readonly Person[]>}
   * @readonly
   */
  readonly people: Signal<readonly Person[]>;

  /**
   * Property peopleById
   *
   * @description
   * The members by account.
   *
   * @type {Signal<ReadonlyMap<string, Person>>}
   * @readonly
   */
  readonly peopleById: Signal<ReadonlyMap<string, Person>>;

  /**
   * Property checklist
   *
   * @description
   * The checklist items with the pending ticks over the confirmed ones.
   *
   * @type {Signal<readonly TaskChecklistItem[]>}
   * @readonly
   */
  readonly checklist: Signal<readonly TaskChecklistItem[]>;

  /**
   * Property subtaskLimit
   *
   * @description
   * Why no subtask can be added, or null.
   *
   * @type {Signal<SubtaskLimit | null>}
   * @readonly
   */
  readonly subtaskLimit: Signal<SubtaskLimit | null>;

  /**
   * Property creating
   *
   * @description
   * Whether a subtask is being created.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly creating: Signal<boolean>;

  /**
   * Property restoredDraft
   *
   * @description
   * The description draft restored from the device for the open task (shown in the editor with
   * the `Discard` notice until it is saved or discarded), or null.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  readonly restoredDraft: Signal<string | null>;

  /**
   * Property restoredChanged
   *
   * @description
   * Whether the task's description changed since the restored draft was typed (`Keep my version`
   * is then offered and nothing is saved by itself).
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly restoredChanged: Signal<boolean>;
  // #endregion

  // #region Methods
  /**
   * Method editDescription
   *
   * @description
   * Saves the description `DESCRIPTION_SAVE_MS` after the last change, through
   * `TaskDetailStore.update` (pending value at once, `If-Match`, rolled back on refusal) with
   * the spans of its `@` mentions (`descriptionMentions`); an empty text clears it. The draft
   * belongs to the task it was typed in: when another task is open by the time it is saved (the
   * address switched before the pause, or the detail closes on another task), it is written to
   * its own task (`update` with that key, against its recorded version), never to the task now
   * shown. Each draft sent waits in the device storage (`DESCRIPTION_DRAFT_PREFIX`) until its write
   * is confirmed: a failed or conflicting save keeps it (the toast says so), and the next opening
   * of that task restores it in the editor with a `Discard` notice. It is saved after the pause
   * only when the description is still the one it was typed over; when the description changed
   * since, nothing is saved by itself and the notice offers `Keep my version` (`keepDraft`).
   * The draft is stored per organization, user and task. A draft is compared with the last description sent for its task while
   * that write is queued or in flight (not only the confirmed one), so a text reverted during a
   * save is sent after it rather than dropped.
   *
   * @param {string} markdown - The edited description.
   */
  editDescription(markdown: string): void;

  /**
   * Method flushDescription
   *
   * @description
   * Saves a waiting description at once (the editor lost the focus, or the detail closes).
   */
  flushDescription(): void;

  /**
   * Method discardDraft
   *
   * @description
   * Drops the restored description draft of the open task: the device forgets it and the editor
   * shows the confirmed description again.
   */
  discardDraft(): void;

  /**
   * Method keepDraft
   *
   * @description
   * Saves the restored description draft of the open task at once, against its current
   * version, over a description that changed since (`Keep my version`).
   */
  keepDraft(): void;

  /**
   * Method toggleItem
   *
   * @description
   * Ticks or unticks a checklist item at once, then confirms the task the gateway answers; a
   * failure puts the confirmed tick back and shows the failure toast.
   *
   * @param {TaskChecklistItem} item - The item as shown.
   * @returns {Promise<void>} Resolves once settled.
   */
  toggleItem(item: TaskChecklistItem): Promise<void>;

  /**
   * Method addItem
   *
   * @description
   * Adds an item at the end of the checklist.
   *
   * @param {string} text - The item, trimmed and not blank.
   * @returns {Promise<boolean>} Whether it was added.
   */
  addItem(text: string): Promise<boolean>;

  /**
   * Method createSubtask
   *
   * @description
   * Creates a subtask of the open task, toasts `Subtask <key> created`, then reads the detail
   * again; a refusal on a limit shows its message under the list and in the toast.
   *
   * @param {string} name - Name of the subtask, not blank.
   * @returns {Promise<boolean>} Whether it was created.
   */
  createSubtask(name: string): Promise<boolean>;
  // #endregion
}

/**
 * Function createTaskDetailSectionsStore
 *
 * @description
 * Builds the store of the detail's own section writes.
 *
 * @returns {Type<TaskDetailSectionsStoreInstance>} Injectable store constructor.
 */
function createTaskDetailSectionsStore(): Type<TaskDetailSectionsStoreInstance> {
  const initialState: TaskDetailSectionsState = {
    people: [],
    checklistPending: {},
    depth: null,
    refusedLimit: null,
    restoredDraft: null,
    restoredChanged: false,
    creating: false,
  };
  return signalStore(
    withState(initialState),
    withProps(() => ({
      _api: inject(TaskSectionsApi),
      _workspace: inject(WORKSPACE_CONTEXT),
      _storage: ((): Storage | null => {
        try {
          return inject(DOCUMENT).defaultView?.localStorage ?? null;
        } catch {
          return null;
        }
      })(),
      _detail: inject(TaskDetailStore),
      _toasts: inject(CwToastService),
    })),
    withComputed((store) => ({
      peopleById: computed(
        (): ReadonlyMap<string, Person> =>
          new Map(store.people().map((person: Person): [string, Person] => [person.id, person])),
      ),
      checklist: computed((): readonly TaskChecklistItem[] => {
        const pending: Readonly<Record<string, boolean>> = store.checklistPending();
        return (store._detail.task()?.checklistItems ?? []).map(
          (item: TaskChecklistItem): TaskChecklistItem =>
            item.id in pending ? { ...item, done: pending[item.id] } : item,
        );
      }),
      subtaskLimit: computed((): SubtaskLimit | null => {
        const depth: number | null = store.depth();
        if (store.refusedLimit()) return store.refusedLimit();
        if (depth !== null && depth > SUBTASK_DEPTH) return 'depth';
        return store._detail.subtasks().length >= SUBTASK_LIMIT ? 'count' : null;
      }),
    })),
    withMethods((store) => {
      const failed: () => void = (): void => {
        store._toasts.error($localize`:@@task.detail.failed:Could not save the change`, {
          description: $localize`:@@task.detail.failed-text:The server did not answer. Try again in a moment.`,
        });
      };
      let draft: {
        readonly key: string;
        readonly markdown: string;
        readonly base: string;
      } | null = null;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let subtaskAttempt: {
        readonly parentKey: string;
        readonly name: string;
        readonly idempotencyKey: string;
      } | null = null;
      const sentDescriptions: Map<string, { readonly markdown: string }> = new Map<
        string,
        { readonly markdown: string }
      >();
      const draftKey: (key: string) => string = (key: string): string =>
        `${DESCRIPTION_DRAFT_PREFIX}.${store._workspace.organization().id}.${store._workspace.user().id}.${key}`;
      const readDraft: (key: string) => StoredDescriptionDraft | null = (
        key: string,
      ): StoredDescriptionDraft | null => {
        try {
          const value: string | null = store._storage?.getItem(draftKey(key)) ?? null;
          const stored: Partial<StoredDescriptionDraft> | null =
            value === null ? null : (JSON.parse(value) as Partial<StoredDescriptionDraft>);
          return typeof stored?.markdown === 'string' && typeof stored.base === 'string'
            ? { markdown: stored.markdown, base: stored.base }
            : null;
        } catch {
          return null;
        }
      };
      const writeDraft: (key: string, stored: StoredDescriptionDraft | null) => void = (
        key: string,
        stored: StoredDescriptionDraft | null,
      ): void => {
        try {
          if (stored === null) store._storage?.removeItem(draftKey(key));
          else store._storage?.setItem(draftKey(key), JSON.stringify(stored));
        } catch {
          return;
        }
      };
      const flush: () => void = (): void => {
        if (timer !== null) clearTimeout(timer);
        timer = null;
        const pending: typeof draft = draft;
        draft = null;
        if (pending === null) return;
        const key: string = pending.key;
        const markdown: string = pending.markdown;
        const confirmed: TaskDetailTask | null = store._detail.confirmedTask();
        const base: string =
          sentDescriptions.get(key)?.markdown ??
          (confirmed?.key === key ? (confirmed.description ?? '') : pending.base);
        if (markdown.trim() === base.trim()) return;
        const patch: TaskDetailPatch =
          markdown.trim() === ''
            ? { description: null }
            : { description: markdown, descriptionMentions: mentionSpans(markdown) };
        const sent: { readonly markdown: string } = { markdown };
        sentDescriptions.set(key, sent);
        writeDraft(key, { markdown, base: pending.base });
        void store._detail
          .update(patch, { key, draftKept: true })
          .then((saved: boolean): void => {
            if (!saved) {
              const latest: boolean = sentDescriptions.get(key) === sent && draft === null;
              if (latest && store._detail.taskKey() === key) {
                patchState(store, { restoredDraft: markdown });
              }
              return;
            }
            if (readDraft(key)?.markdown === markdown) writeDraft(key, null);
            if (store._detail.taskKey() === key && store.restoredDraft() === markdown) {
              patchState(store, { restoredDraft: null });
            }
          })
          .finally((): void => {
            if (sentDescriptions.get(key) === sent) sentDescriptions.delete(key);
          });
      };
      return {
        editDescription(markdown: string): void {
          const confirmed: TaskDetailTask | null = store._detail.confirmedTask();
          const key: string | null = store._detail.taskKey();
          if (key === null) return;
          if (draft !== null && draft.key !== key) flush();
          if (store.restoredDraft() !== null) {
            patchState(store, { restoredDraft: null, restoredChanged: false });
          }
          draft = {
            key,
            markdown,
            base: draft?.base ?? (confirmed?.key === key ? (confirmed.description ?? '') : ''),
          };
          if (timer !== null) clearTimeout(timer);
          timer = setTimeout(flush, DESCRIPTION_SAVE_MS);
        },

        flushDescription(): void {
          flush();
        },

        discardDraft(): void {
          const key: string | null = store._detail.taskKey();
          if (key === null) return;
          if (draft?.key === key) {
            if (timer !== null) clearTimeout(timer);
            timer = null;
            draft = null;
          }
          writeDraft(key, null);
          patchState(store, { restoredDraft: null, restoredChanged: false });
        },

        keepDraft(): void {
          const key: string | null = store._detail.taskKey();
          const markdown: string | null = store.restoredDraft();
          const confirmed: TaskDetailTask | null = store._detail.confirmedTask();
          if (key === null || markdown === null || confirmed?.key !== key) return;
          patchState(store, { restoredChanged: false });
          if (timer !== null) clearTimeout(timer);
          timer = null;
          draft = { key, markdown, base: confirmed.description ?? '' };
          flush();
        },

        _restoreDraft(key: string | null): void {
          patchState(store, { restoredDraft: null, restoredChanged: false });
          const confirmed: TaskDetailTask | null = store._detail.confirmedTask();
          if (key === null || confirmed?.key !== key) return;
          const stored: StoredDescriptionDraft | null = readDraft(key);
          if (stored === null) return;
          const current: string = confirmed.description ?? '';
          if (stored.markdown.trim() === current.trim()) {
            writeDraft(key, null);
            return;
          }
          const changed: boolean = stored.base.trim() !== current.trim();
          patchState(store, { restoredDraft: stored.markdown, restoredChanged: changed });
          if (changed) return;
          draft = { key, markdown: stored.markdown, base: stored.base };
          if (timer !== null) clearTimeout(timer);
          timer = setTimeout(flush, DESCRIPTION_SAVE_MS);
        },

        async toggleItem(item: TaskChecklistItem): Promise<void> {
          const key: string | null = store._detail.taskKey();
          if (key === null) return;
          const done: boolean = !item.done;
          patchState(store, { checklistPending: { ...store.checklistPending(), [item.id]: done } });
          const settle: () => void = (): void => {
            if (store.checklistPending()[item.id] !== done) return;
            patchState(store, {
              checklistPending: Object.fromEntries(
                Object.entries(store.checklistPending()).filter(
                  ([id]: [string, boolean]): boolean => id !== item.id,
                ),
              ),
            });
          };
          try {
            await store._detail.write(
              key,
              async (): Promise<void> => {
                const task: TaskDetailTask = await store._api.setChecklistItem(key, item.id, done);
                store._detail.accept(task);
              },
              UNVERSIONED_WRITE,
            );
            settle();
          } catch {
            settle();
            failed();
          }
        },

        async addItem(text: string): Promise<boolean> {
          const key: string | null = store._detail.taskKey();
          if (key === null || text.trim() === '') return false;
          try {
            await store._detail.write(
              key,
              async (): Promise<void> => {
                const task: TaskDetailTask = await store._api.addChecklistItem(key, text.trim());
                store._detail.accept(task);
              },
              UNVERSIONED_WRITE,
            );
            return true;
          } catch {
            failed();
            return false;
          }
        },

        async createSubtask(name: string): Promise<boolean> {
          const parent: TaskDetailTask | null = store._detail.confirmedTask();
          if (!parent || name.trim() === '' || store.creating()) return false;
          const trimmed: string = name.trim();
          if (subtaskAttempt?.parentKey !== parent.key || subtaskAttempt.name !== trimmed) {
            subtaskAttempt = {
              parentKey: parent.key,
              name: trimmed,
              idempotencyKey: crypto.randomUUID(),
            };
          }
          const sent: { readonly idempotencyKey: string } = subtaskAttempt;
          patchState(store, { creating: true });
          try {
            const created: { readonly key: string } = await store._api.createSubtask(
              parent.key,
              trimmed,
              sent.idempotencyKey,
            );
            if (subtaskAttempt === sent) subtaskAttempt = null;
            patchState(store, { creating: false });
            store._toasts.success(
              $localize`:@@task.subtasks.created:Subtask ${created.key}:key: created`,
              {
                description: $localize`:@@task.subtasks.created-text:In ${parent.key}:key: · ${parent.name}:name:`,
              },
            );
            void store._detail.reload();
            return true;
          } catch (error: unknown) {
            const limit: SubtaskLimit | null = hasProblemCode(error, 'task.subtask-depth-exceeded')
              ? 'depth'
              : hasProblemCode(error, 'task.subtask-limit-reached')
                ? 'count'
                : null;
            patchState(store, { creating: false, refusedLimit: limit });
            if (limit === null) {
              store._toasts.error(
                $localize`:@@task.subtasks.create-failed:Could not create the subtask`,
                {
                  description: $localize`:@@task.detail.failed-text:The server did not answer. Try again in a moment.`,
                },
              );
            }
            return false;
          }
        },

        async _readPeople(): Promise<void> {
          try {
            patchState(store, { people: await store._api.people() });
          } catch {
            patchState(store, { people: [] });
          }
        },

        async _readDepth(parentKey: string | null, moved: boolean): Promise<void> {
          patchState(store, {
            depth: parentKey === null ? 0 : null,
            ...(moved ? { refusedLimit: null } : {}),
          });
          if (parentKey === null) return;
          const stillParent: () => boolean = (): boolean =>
            (store._detail.confirmedTask()?.parentKey ?? null) === parentKey;
          try {
            const grandparent: string | null = await store._api.parentOf(parentKey);
            if (stillParent()) patchState(store, { depth: grandparent === null ? 1 : 2 });
          } catch {
            if (stillParent()) patchState(store, { depth: null });
          }
        },
      };
    }),
    withMethods((store) => {
      let readParent: string | null | undefined;
      let seenCount: number | undefined;
      return {
        _followTask: signalMethod<string | null>((key: string | null): void => {
          store._restoreDraft(key);
        }),
        _followParent: signalMethod<string | null>((parentKey: string | null): void => {
          if (parentKey === readParent) return;
          const moved: boolean = readParent !== undefined;
          readParent = parentKey;
          void store._readDepth(parentKey, moved);
        }),
        _followCount: signalMethod<number>((count: number): void => {
          const changed: boolean = seenCount !== undefined && seenCount !== count;
          seenCount = count;
          if (changed && store.refusedLimit() === 'count')
            patchState(store, { refusedLimit: null });
        }),
      };
    }),
    withHooks({
      onInit(store): void {
        void store._readPeople();
        store._followTask(
          computed((): string | null => store._detail.confirmedTask()?.key ?? null),
        );
        store._followParent(
          computed((): string | null => store._detail.confirmedTask()?.parentKey ?? null),
        );
        store._followCount(computed((): number => store._detail.subtasks().length));
      },
      onDestroy(store): void {
        store.flushDescription();
      },
    }),
  );
}

/**
 * Constant TaskDetailSectionsStore
 *
 * @description
 * The detail tabs' own writes, provided by `cw-task-detail-tabs` so it dies with the open task:
 * the description saved after `DESCRIPTION_SAVE_MS` of quiet through `TaskDetailStore.update`,
 * the checklist ticks shown at once then confirmed (rolled back with the failure toast), checklist
 * additions, subtask creation with its depth and size limits (the depth reads the parent's
 * parent, again whenever the task moves under another parent; a refusal names the limit until
 * then or until the subtask count changes; a creation sent again after a failure reuses its
 * `Idempotency-Key`), and the organization's member directory that names
 * reviewers, authors, actors and assignees (a failed read leaves the initials of unknown people
 * out rather than blocking the tabs). The checklist writes go through `TaskDetailStore.write`
 * after the task's other writes and hand the task they answer to `TaskDetailStore.accept` before
 * the next one is sent; a creation reads the detail again.
 *
 * @type {Type<TaskDetailSectionsStoreInstance>}
 */
export const TaskDetailSectionsStore: Type<TaskDetailSectionsStoreInstance> =
  createTaskDetailSectionsStore();
