import {
  type HttpEvent,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  AttachmentsService,
  MembersService,
  TaskActivityService,
  TasksService,
} from '@cadenway/api-client';
import { type Observable, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { TaskAttachment } from '../../../models/task-detail-sections/task-detail-sections.interface';
import { TaskSectionsApi } from './task-sections-api.service';

/**
 * Constant READY
 *
 * @description
 * `maquette-sso.png`, once its upload completed.
 *
 * @type {object}
 */
const READY: object = {
  id: 'a1',
  taskKey: 'CAD-482',
  fileName: 'maquette-sso.png',
  contentType: 'image/png',
  sizeBytes: 2048,
  authorUserId: 'u1',
  uploadedAt: '2026-11-06T09:00:00Z',
  version: 1,
};

describe('TaskSectionsApi', () => {
  let tasks: Record<string, Mock>;
  let attachments: Record<string, Mock>;
  let api: TaskSectionsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    tasks = { listTaskParticipants: vi.fn(), createTaskComment: vi.fn() };
    attachments = {
      startTaskAttachmentUpload: vi.fn(() =>
        of({
          id: 'a1',
          method: 'POST',
          url: 'https://storage.test/upload',
          fields: { key: 'k', ticket: 't' },
          expiresAt: '2026-11-06T09:05:00Z',
        }),
      ),
      completeTaskAttachmentUpload: vi.fn(() => of(READY)),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TasksService, useValue: tasks },
        { provide: AttachmentsService, useValue: attachments },
        { provide: TaskActivityService, useValue: {} },
        { provide: MembersService, useValue: {} },
      ],
    });
    api = TestBed.inject(TaskSectionsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('reads the participants to the last page and lets a refusal fail the read', async () => {
    tasks['listTaskParticipants']
      .mockReturnValueOnce(of({ items: [{ userId: 'u1', memberId: 'm1' }], nextCursor: 'c2' }))
      .mockReturnValueOnce(of({ items: [{ userId: 'u2', memberId: 'm2' }], nextCursor: null }));

    await expect(api.participants('CAD-482')).resolves.toEqual(['u1', 'u2']);

    tasks['listTaskParticipants'].mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 403 })),
    );
    await expect(api.participants('CAD-482')).rejects.toBeInstanceOf(HttpErrorResponse);
  });

  it('posts a comment with its spans under an idempotency key', async () => {
    tasks['createTaskComment'].mockReturnValue(
      of({
        id: 'c1',
        taskKey: 'CAD-482',
        actor: { type: 'user', id: 'u1' },
        body: 'Hi @[Hugo](u2)',
        createdAt: '2026-11-06T09:00:00Z',
        editedAt: null,
        version: 1,
        mentions: [],
        replyToCommentId: null,
      }),
    );

    await api.comment(
      'CAD-482',
      { body: 'Hi @[Hugo](u2)', mentions: [{ userId: 'u2', start: 3, end: 14 }], replyTo: null },
      'key-1',
    );

    expect(tasks['createTaskComment']).toHaveBeenCalledWith(
      'CAD-482',
      { body: 'Hi @[Hugo](u2)', mentions: [{ userId: 'u2', start: 3, end: 14 }] },
      { headers: { 'Idempotency-Key': 'key-1' } },
    );
  });

  it('reserves, posts the signed form with the file last, then completes', async () => {
    const file: File = new File(['png'], 'maquette-sso.png', { type: 'image/png' });

    const done: Promise<TaskAttachment> = api.upload('CAD-482', file);
    const sent: TestRequest = await vi.waitFor(() => http.expectOne('https://storage.test/upload'));
    const body: FormData = sent.request.body as FormData;
    expect(Array.from(body.keys())).toEqual(['key', 'ticket', 'file']);
    expect(sent.request.reportUploadProgress).toBe(false);
    expect(sent.request.reportProgress).toBe(false);
    sent.flush('');

    await expect(done).resolves.toMatchObject({ id: 'a1', name: 'maquette-sso.png', size: 2048 });
    expect(attachments['completeTaskAttachmentUpload']).toHaveBeenCalledWith('CAD-482', 'a1');
  });

  it('still tries the completion after a transfer without an answer', async () => {
    const file: File = new File(['png'], 'maquette-sso.png', { type: 'image/png' });

    const done: Promise<TaskAttachment> = api.upload('CAD-482', file);
    const sent: TestRequest = await vi.waitFor(() => http.expectOne('https://storage.test/upload'));
    sent.error(new ProgressEvent('error'), { status: 0 });

    await expect(done).resolves.toMatchObject({ id: 'a1' });
  });
});

describe('TaskSectionsApi upload refused before sending', () => {
  it('fails without completing a reservation whose transfer never left', async () => {
    const complete: Mock = vi.fn(() => of(READY));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(
          withInterceptors([
            (): Observable<HttpEvent<unknown>> =>
              throwError(() => new HttpErrorResponse({ error: new Error('NG02824') })),
          ]),
        ),
        { provide: TasksService, useValue: {} },
        {
          provide: AttachmentsService,
          useValue: {
            startTaskAttachmentUpload: vi.fn(() =>
              of({
                id: 'a1',
                method: 'POST',
                url: 'https://storage.test/upload',
                fields: { key: 'k' },
                expiresAt: '2026-11-06T09:05:00Z',
              }),
            ),
            completeTaskAttachmentUpload: complete,
          },
        },
        { provide: TaskActivityService, useValue: {} },
        { provide: MembersService, useValue: {} },
      ],
    });
    const file: File = new File(['png'], 'maquette-sso.png', { type: 'image/png' });

    await expect(TestBed.inject(TaskSectionsApi).upload('CAD-482', file)).rejects.toMatchObject({
      status: 0,
    });
    expect(complete).not.toHaveBeenCalled();
  });
});
