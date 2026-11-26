import { inject, LOCALE_ID, type Signal, type Type } from '@angular/core';
import {
  patchState,
  signalStore,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { CwToastService } from '@cadenway/ui/components/toast';

import { TaskSectionsApi } from '../../data-access/services/task-sections-api/task-sections-api.service';
import type { TaskAttachment } from '../../models/task-detail-sections/task-detail-sections.interface';
import {
  ATTACHMENT_MAX_BYTES,
  fileSize,
} from '../../utils/task-detail-sections/task-detail-sections.util';
import { TaskDetailStore } from '../task-detail/task-detail.store';

/**
 * Interface TaskAttachmentUpload
 *
 * @description
 * A file being attached.
 */
export interface TaskAttachmentUpload {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Local identifier of the upload.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * File name.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property size
   *
   * @description
   * Size in bytes.
   *
   * @type {number}
   * @readonly
   */
  readonly size: number;

  /**
   * Property progress
   *
   * @description
   * Sent percentage.
   *
   * @type {number}
   * @readonly
   */
  readonly progress: number;
  // #endregion
}

/**
 * Interface TaskAttachmentsState
 *
 * @description
 * State of the attachments section.
 */
interface TaskAttachmentsState {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * The ready attachments, the most recent first.
   *
   * @type {readonly TaskAttachment[]}
   * @readonly
   */
  readonly items: readonly TaskAttachment[];

  /**
   * Property loading
   *
   * @description
   * Whether the attachments are being read.
   *
   * @type {boolean}
   * @readonly
   */
  readonly loading: boolean;

  /**
   * Property failed
   *
   * @description
   * Whether the last read failed.
   *
   * @type {boolean}
   * @readonly
   */
  readonly failed: boolean;

  /**
   * Property uploads
   *
   * @description
   * Files being attached.
   *
   * @type {readonly TaskAttachmentUpload[]}
   * @readonly
   */
  readonly uploads: readonly TaskAttachmentUpload[];

  /**
   * Property removing
   *
   * @description
   * The attachment being removed, or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly removing: string | null;
  // #endregion
}

/**
 * Interface TaskAttachmentsStoreInstance
 *
 * @description
 * Public API of `TaskAttachmentsStore`.
 */
export interface TaskAttachmentsStoreInstance {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * The ready attachments, the most recent first.
   *
   * @type {Signal<readonly TaskAttachment[]>}
   * @readonly
   */
  readonly items: Signal<readonly TaskAttachment[]>;

  /**
   * Property loading
   *
   * @description
   * Whether the attachments are being read.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly loading: Signal<boolean>;

  /**
   * Property failed
   *
   * @description
   * Whether the last read failed (inline error with `Retry`).
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly failed: Signal<boolean>;

  /**
   * Property uploads
   *
   * @description
   * Files being attached.
   *
   * @type {Signal<readonly TaskAttachmentUpload[]>}
   * @readonly
   */
  readonly uploads: Signal<readonly TaskAttachmentUpload[]>;

  /**
   * Property removing
   *
   * @description
   * The attachment being removed, or null.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  readonly removing: Signal<string | null>;
  // #endregion

  // #region Methods
  /**
   * Method load
   *
   * @description
   * Reads the attachments of the open task (`Retry`).
   *
   * @returns {Promise<void>} Resolves once read.
   */
  load(): Promise<void>;

  /**
   * Method add
   *
   * @description
   * Attaches files from the section (`Add`, a drop): a file over 25 MB is refused with
   * `File too large`, a name already attached is skipped, the others are uploaded together;
   * then one toast names what was added (`File added`, `<n> files added`, or `Already attached to
   * the task`), and one failure toast names a file that could not be sent.
   *
   * @param {readonly File[]} files - The chosen files.
   * @returns {Promise<void>} Resolves once every upload settled.
   */
  add(files: readonly File[]): Promise<void>;

  /**
   * Method attach
   *
   * @description
   * Attaches one file without a toast (the comment composer's files): an attachment of the same
   * name is reused, a file over 25 MB refused with `File too large`.
   *
   * @param {File} file - The file.
   * @param {(percent: number) => void} progress - Receives the sent percentage.
   * @returns {Promise<TaskAttachment | null>} The attachment, or null when refused or failed.
   */
  attach(file: File, progress: (percent: number) => void): Promise<TaskAttachment | null>;

  /**
   * Method remove
   *
   * @description
   * Removes a confirmed attachment from the task, then toasts `Attachment removed`.
   *
   * @param {TaskAttachment} attachment - The attachment.
   * @returns {Promise<boolean>} Whether it was removed.
   */
  remove(attachment: TaskAttachment): Promise<boolean>;

  /**
   * Method signedUrl
   *
   * @description
   * Signs a short-lived download of an attachment (also the preview's image source).
   *
   * @param {TaskAttachment} attachment - The attachment.
   * @returns {Promise<string | null>} The address, or null when it could not be signed.
   */
  signedUrl(attachment: TaskAttachment): Promise<string | null>;
  // #endregion
}

/**
 * Function createTaskAttachmentsStore
 *
 * @description
 * Builds the attachments store.
 *
 * @returns {Type<TaskAttachmentsStoreInstance>} Injectable store constructor.
 */
function createTaskAttachmentsStore(): Type<TaskAttachmentsStoreInstance> {
  const initialState: TaskAttachmentsState = {
    items: [],
    loading: false,
    failed: false,
    uploads: [],
    removing: null,
  };
  return signalStore(
    withState(initialState),
    withProps(() => ({
      _api: inject(TaskSectionsApi),
      _detail: inject(TaskDetailStore),
      _toasts: inject(CwToastService),
      _locale: inject(LOCALE_ID),
    })),
    withMethods((store) => {
      const tooLarge: (file: File) => void = (file: File): void => {
        store._toasts.error($localize`:@@task.attachments.too-large:File too large`, {
          description: $localize`:@@task.attachments.too-large-text:${file.name}:name: exceeds 25 MB, the per-file limit.`,
        });
      };
      const send: (
        file: File,
        progress?: (percent: number) => void,
      ) => Promise<TaskAttachment> = async (
        file: File,
        progress?: (percent: number) => void,
      ): Promise<TaskAttachment> => {
        const key: string | null = store._detail.taskKey();
        if (key === null) throw new Error('No task is open.');
        const id: string = crypto.randomUUID();
        patchState(store, {
          uploads: [...store.uploads(), { id, name: file.name, size: file.size, progress: 0 }],
        });
        const drop: () => void = (): void => {
          patchState(store, {
            uploads: store.uploads().filter((upload: TaskAttachmentUpload) => upload.id !== id),
          });
        };
        try {
          const attachment: TaskAttachment = await store._api.upload(
            key,
            file,
            (percent: number) => {
              progress?.(percent);
              patchState(store, {
                uploads: store
                  .uploads()
                  .map((upload: TaskAttachmentUpload) =>
                    upload.id === id ? { ...upload, progress: percent } : upload,
                  ),
              });
            },
          );
          drop();
          if (store._detail.taskKey() === key) {
            patchState(store, {
              items: [
                attachment,
                ...store.items().filter((item: TaskAttachment) => item.id !== attachment.id),
              ],
            });
          }
          return attachment;
        } catch (error: unknown) {
          drop();
          throw error;
        }
      };
      const named: (name: string) => TaskAttachment | undefined = (
        name: string,
      ): TaskAttachment | undefined =>
        store.items().find((item: TaskAttachment): boolean => item.name === name);
      return {
        async load(): Promise<void> {
          const key: string | null = store._detail.taskKey();
          if (key === null) return;
          patchState(store, { loading: true, failed: false });
          try {
            const items: readonly TaskAttachment[] = await store._api.listAttachments(key);
            if (store._detail.taskKey() === key) patchState(store, { items, loading: false });
          } catch {
            if (store._detail.taskKey() === key)
              patchState(store, { loading: false, failed: true });
          }
        },

        async add(files: readonly File[]): Promise<void> {
          const big: readonly File[] = files.filter(
            (file: File): boolean => file.size > ATTACHMENT_MAX_BYTES,
          );
          if (big.length > 0) tooLarge(big[0]);
          const accepted: readonly File[] = files.filter(
            (file: File): boolean => file.size <= ATTACHMENT_MAX_BYTES && file.name !== '',
          );
          if (accepted.length === 0) return;
          const fresh: readonly File[] = accepted.filter(
            (file: File, index: number): boolean =>
              !named(file.name) &&
              accepted.findIndex((other: File): boolean => other.name === file.name) === index,
          );
          const results: PromiseSettledResult<TaskAttachment>[] = await Promise.allSettled(
            fresh.map((file: File) => send(file)),
          );
          const added: string[] = [];
          const refused: string[] = [];
          results.forEach((result: PromiseSettledResult<TaskAttachment>, index: number): void => {
            if (result.status === 'fulfilled') added.push(result.value.name);
            else refused.push(fresh[index].name);
          });
          if (refused.length > 0) {
            const failed: string = refused[0];
            store._toasts.error(
              $localize`:@@task.attachments.upload-failed:Could not attach ${failed}:name:`,
              {
                description: $localize`:@@task.detail.failed-text:The server did not answer. Try again in a moment.`,
              },
            );
          }
          if (added.length > 0 || fresh.length === 0) {
            store._toasts.success(
              added.length > 1
                ? $localize`:@@task.attachments.added-many:${added.length}:count: files added`
                : $localize`:@@task.attachments.added-one:File added`,
              {
                description:
                  added.length > 0
                    ? added.join(', ')
                    : $localize`:@@task.attachments.already:Already attached to the task`,
              },
            );
          }
        },

        async attach(
          file: File,
          progress: (percent: number) => void,
        ): Promise<TaskAttachment | null> {
          if (file.size > ATTACHMENT_MAX_BYTES) {
            tooLarge(file);
            return null;
          }
          const existing: TaskAttachment | undefined = named(file.name);
          if (existing) return existing;
          try {
            return await send(file, progress);
          } catch {
            return null;
          }
        },

        async remove(attachment: TaskAttachment): Promise<boolean> {
          const key: string | null = store._detail.taskKey();
          if (key === null || store.removing()) return false;
          patchState(store, { removing: attachment.id });
          try {
            await store._api.deleteAttachment(key, attachment);
            patchState(store, {
              removing: null,
              items: store.items().filter((item: TaskAttachment) => item.id !== attachment.id),
            });
            store._toasts.success($localize`:@@task.attachments.removed:Attachment removed`, {
              description: attachment.name,
            });
            return true;
          } catch {
            patchState(store, { removing: null });
            store._toasts.error(
              $localize`:@@task.attachments.remove-failed:Could not remove the attachment`,
              {
                description: $localize`:@@task.detail.failed-text:The server did not answer. Try again in a moment.`,
              },
            );
            return false;
          }
        },

        async signedUrl(attachment: TaskAttachment): Promise<string | null> {
          const key: string | null = store._detail.taskKey();
          if (key === null) return null;
          try {
            return await store._api.downloadUrl(key, attachment.id);
          } catch {
            store._toasts.error($localize`:@@task.attachments.download-blocked:Download blocked`, {
              description: `${attachment.name} · ${fileSize(attachment.size, store._locale)}`,
            });
            return null;
          }
        },
      };
    }),
    withHooks({
      onInit(store): void {
        void store.load();
      },
    }),
  );
}

/**
 * Constant TaskAttachmentsStore
 *
 * @description
 * The attachments of the open task (`App.dc.html` lines 2169-2191, 4977-5035), provided by
 * `cw-task-detail-tabs`, read when the detail is shown. Uploads go through a signed reservation,
 * the form post to object storage and the completion; the ready attachment joins the list at the
 * top. Removal waits for the confirmation dialog and for the gateway (no optimistic removal: a
 * refused one keeps the file with the failure toast). The section's additions and the comment
 * composer's files share the list and its upload queue.
 *
 * @type {Type<TaskAttachmentsStoreInstance>}
 */
export const TaskAttachmentsStore: Type<TaskAttachmentsStoreInstance> =
  createTaskAttachmentsStore();
