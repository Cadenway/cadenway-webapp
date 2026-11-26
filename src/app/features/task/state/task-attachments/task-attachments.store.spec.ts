import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CwToastService } from '@cadenway/ui/components/toast';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { TaskSectionsApi } from '../../data-access/services/task-sections-api/task-sections-api.service';
import type { TaskAttachment } from '../../models/task-detail-sections/task-detail-sections.interface';
import { TaskDetailStore } from '../task-detail/task-detail.store';
import { TaskAttachmentsStore, type TaskAttachmentsStoreInstance } from './task-attachments.store';

/**
 * Function attachment
 *
 * @description
 * A file attached to CAD-482 by Camille Martin.
 *
 * @param {string} id - Its id.
 * @param {string} name - Its name.
 * @returns {TaskAttachment} The attachment.
 */
function attachment(id: string, name: string): TaskAttachment {
  return {
    id,
    name,
    contentType: 'application/pdf',
    size: 2048,
    authorId: 'u1',
    uploadedAt: '2026-11-06T09:00:00Z',
    version: 1,
  };
}

/**
 * Function file
 *
 * @description
 * A file of a given size.
 *
 * @param {string} name - Its name.
 * @param {number} size - Its size in bytes.
 * @returns {File} The file.
 */
function file(name: string, size: number = 10): File {
  const made: File = new File(['x'], name, { type: 'application/pdf' });
  Object.defineProperty(made, 'size', { value: size });
  return made;
}

describe('TaskAttachmentsStore', () => {
  let api: Record<string, Mock>;
  let toasts: { success: Mock; error: Mock };
  let store: TaskAttachmentsStoreInstance;

  beforeEach(() => {
    api = {
      listAttachments: vi.fn(() => Promise.resolve([attachment('a1', 'brief.pdf')])),
      upload: vi.fn((_key: string, chosen: File) => Promise.resolve(attachment('a2', chosen.name))),
      deleteAttachment: vi.fn(() => Promise.resolve()),
      downloadUrl: vi.fn(() => Promise.resolve('https://storage.test/a1')),
    };
    toasts = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        TaskAttachmentsStore,
        { provide: TaskDetailStore, useValue: { taskKey: signal('CAD-482') } },
        { provide: TaskSectionsApi, useValue: api },
        { provide: CwToastService, useValue: toasts },
      ],
    });
    store = TestBed.inject(TaskAttachmentsStore);
  });

  it('reads the attachments, and tells an empty list from a failed read', async () => {
    await vi.waitFor(() => {
      expect(store.items()).toHaveLength(1);
    });

    api['listAttachments'].mockResolvedValueOnce([]);
    await store.load();
    expect(store.items()).toEqual([]);
    expect(store.failed()).toBe(false);

    api['listAttachments'].mockRejectedValueOnce(new Error('offline'));
    await store.load();
    expect(store.failed()).toBe(true);
  });

  it('refuses a file over 25 MB and skips a name already attached', async () => {
    await vi.waitFor(() => {
      expect(store.items()).toHaveLength(1);
    });

    await store.add([file('video.mp4', 30 * 1024 * 1024), file('brief.pdf')]);

    expect(toasts.error).toHaveBeenCalledWith('File too large', {
      description: 'video.mp4 exceeds 25 MB, the per-file limit.',
    });
    expect(api['upload']).not.toHaveBeenCalled();
    expect(toasts.success).toHaveBeenCalledWith('File added', {
      description: 'Already attached to the task',
    });
  });

  it('refuses an empty file client-side, from the section and from the composer', async () => {
    await vi.waitFor(() => {
      expect(store.items()).toHaveLength(1);
    });

    await store.add([file('empty.txt', 0)]);
    await expect(store.attach(file('blank.txt', 0))).resolves.toBeNull();

    expect(toasts.error).toHaveBeenCalledWith('Empty file', {
      description: 'empty.txt is empty, there is nothing to attach.',
    });
    expect(toasts.error).toHaveBeenCalledWith('Empty file', {
      description: 'blank.txt is empty, there is nothing to attach.',
    });
    expect(api['upload']).not.toHaveBeenCalled();
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it('uploads new files and lists them first', async () => {
    await vi.waitFor(() => {
      expect(store.items()).toHaveLength(1);
    });

    await store.add([file('export.csv')]);

    expect(api['upload']).toHaveBeenCalledExactlyOnceWith('CAD-482', expect.any(File));
    expect(store.items().map((item: TaskAttachment) => item.name)).toEqual([
      'export.csv',
      'brief.pdf',
    ]);
    expect(store.uploads()).toEqual([]);
    expect(toasts.success).toHaveBeenCalledWith('File added', { description: 'export.csv' });
  });

  it('toasts a file that could not be sent', async () => {
    api['upload'].mockRejectedValueOnce(new Error('offline'));

    await store.add([file('export.csv')]);

    expect(toasts.error).toHaveBeenCalledWith('Could not attach export.csv', expect.any(Object));
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it('removes an attachment once the gateway confirms, and keeps it when refused', async () => {
    await vi.waitFor(() => {
      expect(store.items()).toHaveLength(1);
    });
    api['deleteAttachment'].mockRejectedValueOnce(new Error('refused'));

    await expect(store.remove(store.items()[0])).resolves.toBe(false);
    expect(store.items()).toHaveLength(1);

    await expect(store.remove(store.items()[0])).resolves.toBe(true);
    expect(store.items()).toEqual([]);
    expect(toasts.success).toHaveBeenCalledWith('Attachment removed', { description: 'brief.pdf' });
  });

  it('reuses an attachment of the same name for the composer', async () => {
    await vi.waitFor(() => {
      expect(store.items()).toHaveLength(1);
    });

    await expect(store.attach(file('brief.pdf'))).resolves.toMatchObject({ id: 'a1' });
    expect(api['upload']).not.toHaveBeenCalled();
  });
});
