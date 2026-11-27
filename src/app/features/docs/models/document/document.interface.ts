/**
 * Interface DocumentSummary
 *
 * @description
 * A document of the catalog as the gateway lists it: who last saved it, when, and the version
 * its next write must name (`If-Match`). It carries no body.
 */
export interface DocumentSummary {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Document identifier; the document opens at `/:org/d/:id`.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property spaceId
   *
   * @description
   * The space that owns the document, which names it and decides who may edit it.
   *
   * @type {string}
   * @readonly
   */
  readonly spaceId: string;

  /**
   * Property title
   *
   * @description
   * Display title (`Release notes 3.1`), never empty.
   *
   * @type {string}
   * @readonly
   */
  readonly title: string;

  /**
   * Property authorUserId
   *
   * @description
   * The account that made the last stored edit, or that created the document before any edit.
   *
   * @type {string}
   * @readonly
   */
  readonly authorUserId: string;

  /**
   * Property updatedAt
   *
   * @description
   * Instant of the last stored edit, as an ISO 8601 string.
   *
   * @type {string}
   * @readonly
   */
  readonly updatedAt: string;

  /**
   * Property version
   *
   * @description
   * Version of the stored document, sent back as `If-Match` by a save or a deletion.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;
  // #endregion
}

/**
 * Interface DocumentDetail
 *
 * @description
 * A document with its body, the Markdown source of its blocks.
 */
export interface DocumentDetail extends DocumentSummary {
  // #region Properties
  /**
   * Property body
   *
   * @description
   * Markdown source of the blocks, empty for a document without content.
   *
   * @type {string}
   * @readonly
   */
  readonly body: string;
  // #endregion
}

/**
 * Interface DocumentDraft
 *
 * @description
 * What the editor of a document holds: its title as typed (empty saves as `Untitled`) and its
 * body.
 */
export interface DocumentDraft {
  // #region Properties
  /**
   * Property title
   *
   * @description
   * The title as typed.
   *
   * @type {string}
   */
  title: string;

  /**
   * Property body
   *
   * @description
   * Markdown source of the blocks.
   *
   * @type {string}
   */
  body: string;
  // #endregion
}

/**
 * Interface DocumentRow
 *
 * @description
 * A row of the catalog: the document with the names of its space and of its last author, null
 * while unknown (the space or the member directory is not read, or no longer lists them).
 */
export interface DocumentRow {
  // #region Properties
  /**
   * Property document
   *
   * @description
   * The document.
   *
   * @type {DocumentSummary}
   * @readonly
   */
  readonly document: DocumentSummary;

  /**
   * Property spaceName
   *
   * @description
   * Name of its space, or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly spaceName: string | null;

  /**
   * Property authorName
   *
   * @description
   * Name of its last author, or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly authorName: string | null;

  /**
   * Property canEdit
   *
   * @description
   * Whether the caller may edit and delete it: the caller's role on its space is `edit`.
   *
   * @type {boolean}
   * @readonly
   */
  readonly canEdit: boolean;
  // #endregion
}

/**
 * Type DocumentCreateOutcome
 *
 * @description
 * How `New document` ended: `created` with the new document's id, `unknown` when no answer
 * confirmed it, `failed` when the gateway refused it, `cancelled` when the organization changed
 * or the page went away first.
 *
 * @type {{ readonly kind: 'created'; readonly id: string } | { readonly kind: 'unknown' | 'failed' | 'cancelled' }}
 */
export type DocumentCreateOutcome =
  | { readonly kind: 'created'; readonly id: string }
  | { readonly kind: 'unknown' | 'failed' | 'cancelled' };

/**
 * Type DocumentSaveOutcome
 *
 * @description
 * How a save ended:
 *
 * - `saved`: the draft is the stored document;
 * - `adopted`: someone saved another version first and the draft changed nothing of the version
 *   it started from, so the other version is shown as it is;
 * - `conflict`: someone saved another version first; `draft` merges it with the draft, field by
 *   field (the other version's title or body wherever the draft did not change it), and the next
 *   save replaces the other version;
 * - `failed` (refused or not applied), `unknown` (no answer and no read confirmed it), `gone` (the
 *   document no longer exists) or `cancelled` (the organization or the document changed, or the
 *   page went away).
 *
 * @type {{ readonly kind: 'saved' | 'adopted' | 'failed' | 'unknown' | 'gone' | 'cancelled' } | { readonly kind: 'conflict'; readonly draft: DocumentDraft }}
 */
export type DocumentSaveOutcome =
  | { readonly kind: 'saved' | 'adopted' | 'failed' | 'unknown' | 'gone' | 'cancelled' }
  | { readonly kind: 'conflict'; readonly draft: DocumentDraft };

/**
 * Interface DocumentConflict
 *
 * @description
 * The other version a save met: who saved it and when. The draft stays in edit mode over it until
 * a save replaces it or the edit is cancelled.
 */
export interface DocumentConflict {
  // #region Properties
  /**
   * Property authorUserId
   *
   * @description
   * The account that saved the other version.
   *
   * @type {string}
   * @readonly
   */
  readonly authorUserId: string;

  /**
   * Property updatedAt
   *
   * @description
   * When it was saved, ISO 8601.
   *
   * @type {string}
   * @readonly
   */
  readonly updatedAt: string;
  // #endregion
}

/**
 * Interface DocumentList
 *
 * @description
 * The documents of a search, as far as the catalog reads them.
 */
export interface DocumentList {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * The documents, the most recently saved first.
   *
   * @type {readonly DocumentSummary[]}
   * @readonly
   */
  readonly items: readonly DocumentSummary[];

  /**
   * Property truncated
   *
   * @description
   * Whether more documents match than the catalog reads (500).
   *
   * @type {boolean}
   * @readonly
   */
  readonly truncated: boolean;
  // #endregion
}

/**
 * Type DocumentDeleteOutcome
 *
 * @description
 * How a deletion ended: `deleted` (the document no longer exists), `conflict` (it changed since it
 * was shown, so it was kept), `failed` (refused or not applied), `unknown` (no answer and no read
 * confirmed it) or `cancelled` (the organization changed or the page went away).
 *
 * @type {'deleted' | 'conflict' | 'failed' | 'unknown' | 'cancelled'}
 */
export type DocumentDeleteOutcome = 'deleted' | 'conflict' | 'failed' | 'unknown' | 'cancelled';
