import { HttpContext, HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  type DocumentDetail as DocumentDetailDto,
  type DocumentPage as DocumentPageDto,
  DocumentsService,
  MembersService,
} from '@cadenway/api-client';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { PASSIVE_REQUEST } from '@core/api';
import { NotFoundRouteError, UnavailableRouteError } from '@shared/route-errors';

import type { DocumentDetail, DocumentSummary } from '../../../models/document/document.interface';
import { DocumentsApi } from './documents-api.service';

/**
 * Function dto
 *
 * @description
 * A document of Atelier Nord's Product space, as the gateway answers it.
 *
 * @param {string} id - Its id.
 * @param {string} title - Its title.
 * @returns {DocumentDetailDto} The document.
 */
function dto(id: string, title: string): DocumentDetailDto {
  return {
    id,
    spaceId: 's1',
    title,
    authorUserId: 'u2',
    createdAt: '2026-11-02T08:00:00Z',
    updatedAt: '2026-11-26T17:20:00Z',
    version: 3,
    body: '# Highlights',
  };
}

/**
 * Function problem
 *
 * @description
 * A gateway refusal with a problem code.
 *
 * @param {number} status - The status.
 * @param {string} code - The problem code.
 * @returns {HttpErrorResponse} The refusal.
 */
function problem(status: number, code: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { status, code, title: 'Refused' } });
}

describe('DocumentsApi', () => {
  let documents: {
    listDocuments: Mock;
    getDocument: Mock;
    createDocument: Mock;
    updateDocument: Mock;
    deleteDocument: Mock;
  };
  let members: { listMembers: Mock };

  beforeEach(() => {
    documents = {
      listDocuments: vi.fn(),
      getDocument: vi.fn(),
      createDocument: vi.fn(),
      updateDocument: vi.fn(),
      deleteDocument: vi.fn(),
    };
    members = { listMembers: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: DocumentsService, useValue: documents },
        { provide: MembersService, useValue: members },
      ],
    });
  });

  it('searches the catalog and follows the cursor, a background read being passive', async () => {
    const pages: DocumentPageDto[] = [
      { items: [dto('d1', 'Release notes 3.1')], nextCursor: 'c2' },
      { items: [dto('d2', 'API integration guide')], nextCursor: null },
    ];
    documents.listDocuments.mockImplementation(() => of(pages.shift()));

    const found: readonly DocumentSummary[] = await TestBed.inject(DocumentsApi).list('notes', {
      passive: true,
    });

    expect(found).toEqual([
      {
        id: 'd1',
        spaceId: 's1',
        title: 'Release notes 3.1',
        authorUserId: 'u2',
        updatedAt: '2026-11-26T17:20:00Z',
        version: 3,
      },
      expect.objectContaining({ id: 'd2' }),
    ]);
    const calls: [unknown, { context: HttpContext }][] = documents.listDocuments.mock.calls as [
      unknown,
      { context: HttpContext },
    ][];
    expect(calls.map(([params]: [unknown, unknown]): unknown => params)).toEqual([
      { limit: 100, q: 'notes' },
      { limit: 100, q: 'notes', cursor: 'c2' },
    ]);
    expect(calls[0]?.[1].context.get(PASSIVE_REQUEST)).toBe(true);
  });

  it('stops after 500 documents and sends no query for an empty search', async () => {
    documents.listDocuments.mockImplementation(() =>
      of({ items: [dto('d1', 'Release notes 3.1')], nextCursor: 'more' }),
    );

    await TestBed.inject(DocumentsApi).list('');

    expect(documents.listDocuments).toHaveBeenCalledTimes(5);
    expect(documents.listDocuments.mock.calls[0]?.[0]).toEqual({ limit: 100 });
  });

  it('creates with its idempotency key, and saves and deletes from the version shown', async () => {
    documents.createDocument.mockReturnValue(of(dto('d9', 'Untitled')));
    documents.updateDocument.mockReturnValue(of({ ...dto('d1', 'Notes'), version: 4 }));
    documents.deleteDocument.mockReturnValue(of(undefined));
    const api: DocumentsApi = TestBed.inject(DocumentsApi);

    const created: DocumentDetail = await api.create('s1', 'Untitled', 'k1');
    const saved: DocumentDetail = await api.update('d1', 3, { title: 'Notes', body: '- A' });
    await api.remove('d1', 4);

    expect(created.id).toBe('d9');
    expect(documents.createDocument).toHaveBeenCalledWith(
      { spaceId: 's1', title: 'Untitled', body: '' },
      { headers: { 'Idempotency-Key': 'k1' } },
    );
    expect(saved.version).toBe(4);
    expect(documents.updateDocument).toHaveBeenCalledWith(
      'd1',
      { title: 'Notes', body: '- A' },
      { headers: { 'If-Match': '"3"' } },
    );
    expect(documents.deleteDocument).toHaveBeenCalledWith('d1', {
      headers: { 'If-Match': '"4"' },
    });
  });

  it('opens a missing document as not found and any other failure as unavailable', async () => {
    const api: DocumentsApi = TestBed.inject(DocumentsApi);
    documents.getDocument.mockReturnValueOnce(throwError(() => problem(404, 'document.not-found')));
    documents.getDocument.mockReturnValueOnce(throwError(() => problem(503, 'upstream.timeout')));

    await expect(api.open('d1')).rejects.toBeInstanceOf(NotFoundRouteError);
    await expect(api.open('d1')).rejects.toBeInstanceOf(UnavailableRouteError);
  });

  it('names the authors from every page of the member directory', async () => {
    const pages: object[] = [
      { items: [{ userId: 'u1', name: 'Camille Martin' }], nextCursor: 'm2', total: 2 },
      { items: [{ userId: 'u2', name: 'Inès Roux' }], nextCursor: null, total: 2 },
    ];
    members.listMembers.mockImplementation(() => of(pages.shift()));

    const names: ReadonlyMap<string, string> = await TestBed.inject(DocumentsApi).authors();

    expect([...names]).toEqual([
      ['u1', 'Camille Martin'],
      ['u2', 'Inès Roux'],
    ]);
    expect(members.listMembers.mock.calls).toEqual([
      [{ limit: 100 }],
      [{ cursor: 'm2', limit: 100 }],
    ]);
  });
});
