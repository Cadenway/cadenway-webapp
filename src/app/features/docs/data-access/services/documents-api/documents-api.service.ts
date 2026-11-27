import { HttpContext } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import {
  type DocumentDetail as DocumentDetailDto,
  type DocumentPage as DocumentPageDto,
  DocumentsService,
  type MemberPage,
  MembersService,
} from '@cadenway/api-client';
import { firstValueFrom, fromEvent, type Observable, takeUntil } from 'rxjs';

import { PASSIVE_REQUEST } from '@core/api';
import { NotFoundRouteError } from '@shared/route-errors';

import type {
  DocumentDetail,
  DocumentDraft,
  DocumentList,
  DocumentSummary,
} from '../../../models/document/document.interface';
import { toDocumentDetail, toDocumentSummary } from '../../adapters/document/document.adapter';
import { toDocumentRouteError } from '../../adapters/route-error/route-error.adapter';

/**
 * Constant PAGE_SIZE
 *
 * @description
 * Documents or members asked for per page, the contracts' maximum.
 *
 * @type {number}
 */
const PAGE_SIZE: number = 100;

/**
 * Constant MAX_DOCUMENT_PAGES
 *
 * @description
 * Catalog pages read at most for one search: the 500 most recently updated documents.
 *
 * @type {number}
 */
const MAX_DOCUMENT_PAGES: number = 5;

/**
 * Constant MAX_MEMBER_PAGES
 *
 * @description
 * Member pages read at most to name the authors, a bound against a cursor that never ends.
 *
 * @type {number}
 */
const MAX_MEMBER_PAGES: number = 20;

/**
 * Constant DOCUMENT_ID
 *
 * @description
 * The contract's `DocumentUuid`: a UUID version 7.
 *
 * @type {RegExp}
 */
const DOCUMENT_ID: RegExp =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-7[0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

/**
 * Function abortable
 *
 * @description
 * Waits for the first answer of a request, which the signal cancels.
 *
 * @template T
 * @param {Observable<T>} source - The request.
 * @param {AbortSignal | undefined} signal - Cancels a superseded read.
 * @returns {Promise<T>} The answer.
 */
function abortable<T>(source: Observable<T>, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  return firstValueFrom(signal ? source.pipe(takeUntil(fromEvent(signal, 'abort'))) : source);
}

/**
 * Function ifMatch
 *
 * @description
 * The strong entity tag of a document version, which a save or a deletion must name.
 *
 * @param {number} version - The version shown.
 * @returns {Record<string, string>} The `If-Match` header.
 */
function ifMatch(version: number): Record<string, string> {
  return { 'If-Match': `"${String(version)}"` };
}

/**
 * Function readContext
 *
 * @description
 * The request context of a read: a background read (a refresh on focus) is passive, so it waits
 * while the organization context is being verified again.
 *
 * @param {boolean} passive - Whether the read runs in the background.
 * @returns {HttpContext} The context.
 */
function readContext(passive: boolean): HttpContext {
  return new HttpContext().set(PASSIVE_REQUEST, passive);
}

/**
 * Service DocumentsApi
 *
 * @description
 * The documents of the current organization (`openapi/public/documents.yaml`) and the names of
 * their authors (`MembersService.listMembers`), mapped to display models. Its methods reject with
 * the gateway's `HttpErrorResponse`; a save or a deletion sends the version shown as `If-Match`,
 * so a stale one rejects with `412 request.version-mismatch`.
 */
@Service()
export class DocumentsApi {
  // #region Properties
  /**
   * Property documents
   *
   * @description
   * Generated document operations.
   *
   * @type {DocumentsService}
   * @readonly
   */
  private readonly documents: DocumentsService = inject(DocumentsService);

  /**
   * Property members
   *
   * @description
   * Generated member operations, which name the authors.
   *
   * @type {MembersService}
   * @readonly
   */
  private readonly members: MembersService = inject(MembersService);
  // #endregion

  // #region Methods
  /**
   * Method list
   *
   * @description
   * Reads the documents whose title or body contains the query (all of them for an empty one),
   * the most recently updated first, following the cursor for at most 500 documents; `truncated`
   * says the last page read still had a next one.
   *
   * @param {string} query - The search, trimmed by the caller.
   * @param {{ readonly signal?: AbortSignal; readonly passive?: boolean }} options - Cancels a
   *   superseded read; marks a background read as passive.
   * @returns {Promise<DocumentList>} The documents.
   */
  public async list(
    query: string,
    options: { readonly signal?: AbortSignal; readonly passive?: boolean } = {},
  ): Promise<DocumentList> {
    const items: DocumentSummary[] = [];
    let cursor: string | undefined;
    for (let page: number = 0; page < MAX_DOCUMENT_PAGES; page += 1) {
      const answer: DocumentPageDto = await abortable(
        this.documents.listDocuments(
          {
            limit: PAGE_SIZE,
            ...(query === '' ? {} : { q: query }),
            ...(cursor === undefined ? {} : { cursor }),
          },
          { context: readContext(options.passive ?? false) },
        ),
        options.signal,
      );
      items.push(...answer.items.map(toDocumentSummary));
      if (answer.nextCursor === null) return { items, truncated: false };
      cursor = answer.nextCursor;
    }
    return { items, truncated: true };
  }

  /**
   * Method get
   *
   * @description
   * Reads a document with its body. A missing, deleted or invisible one rejects with
   * `404 document.not-found`.
   *
   * @param {string} id - The document.
   * @param {{ readonly signal?: AbortSignal; readonly passive?: boolean }} options - Cancels a
   *   superseded read; marks a background read as passive.
   * @returns {Promise<DocumentDetail>} The document.
   */
  public async get(
    id: string,
    options: { readonly signal?: AbortSignal; readonly passive?: boolean } = {},
  ): Promise<DocumentDetail> {
    const answer: DocumentDetailDto = await abortable(
      this.documents.getDocument(id, { context: readContext(options.passive ?? false) }),
      options.signal,
    );
    return toDocumentDetail(answer);
  }

  /**
   * Method open
   *
   * @description
   * The document page's primary read: reads a document with its body, and rejects with the route
   * boundary's state, `NotFoundRouteError` for a missing, deleted or invisible document and
   * `UnavailableRouteError` for any other answer. An id that is not a document id (the contract's
   * `DocumentUuid`, a UUID version 7) rejects with `NotFoundRouteError` without any request.
   *
   * @param {string} id - The document.
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<DocumentDetail>} The document.
   */
  public async open(id: string, signal?: AbortSignal): Promise<DocumentDetail> {
    if (!DOCUMENT_ID.test(id)) throw new NotFoundRouteError();
    try {
      return await this.get(id, signal ? { signal } : {});
    } catch (error: unknown) {
      throw toDocumentRouteError(error);
    }
  }

  /**
   * Method create
   *
   * @description
   * Creates an empty document in a space the caller can edit. The same idempotency key replays
   * the first creation's answer for 24 hours, so a creation whose answer was lost is sent again
   * with it.
   *
   * @param {string} spaceId - The space.
   * @param {string} title - The title, at least one visible character.
   * @param {string} idempotencyKey - The key of this creation.
   * @returns {Promise<DocumentDetail>} The new document.
   */
  public async create(
    spaceId: string,
    title: string,
    idempotencyKey: string,
  ): Promise<DocumentDetail> {
    const answer: DocumentDetailDto = await firstValueFrom(
      this.documents.createDocument(
        { spaceId, title, body: '' },
        { headers: { 'Idempotency-Key': idempotencyKey } },
      ),
    );
    return toDocumentDetail(answer);
  }

  /**
   * Method update
   *
   * @description
   * Saves the title and the body from the version shown. An equivalent save answers the current
   * document unchanged.
   *
   * @param {string} id - The document.
   * @param {number} version - The version shown.
   * @param {DocumentDraft} draft - The title, already normalized, and the body.
   * @returns {Promise<DocumentDetail>} The stored document.
   */
  public async update(id: string, version: number, draft: DocumentDraft): Promise<DocumentDetail> {
    const answer: DocumentDetailDto = await firstValueFrom(
      this.documents.updateDocument(
        id,
        { title: draft.title, body: draft.body },
        { headers: ifMatch(version) },
      ),
    );
    return toDocumentDetail(answer);
  }

  /**
   * Method remove
   *
   * @description
   * Deletes a document from the version shown, for the whole organization; nothing restores it.
   *
   * @param {string} id - The document.
   * @param {number} version - The version shown.
   * @returns {Promise<void>} Resolves once deleted.
   */
  public async remove(id: string, version: number): Promise<void> {
    await firstValueFrom(this.documents.deleteDocument(id, { headers: ifMatch(version) }));
  }

  /**
   * Method authors
   *
   * @description
   * Reads every member of the organization to name the documents' authors, following the cursor
   * for at most 20 pages.
   *
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<ReadonlyMap<string, string>>} The names by user id.
   */
  public async authors(signal?: AbortSignal): Promise<ReadonlyMap<string, string>> {
    const names: Map<string, string> = new Map<string, string>();
    let cursor: string | undefined;
    for (let page: number = 0; page < MAX_MEMBER_PAGES; page += 1) {
      const answer: MemberPage = await abortable(
        this.members.listMembers(
          cursor === undefined ? { limit: PAGE_SIZE } : { cursor, limit: PAGE_SIZE },
        ),
        signal,
      );
      for (const member of answer.items) names.set(member.userId, member.name);
      if (answer.nextCursor === null) break;
      cursor = answer.nextCursor;
    }
    return names;
  }
  // #endregion
}
