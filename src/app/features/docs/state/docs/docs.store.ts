import {
  DestroyRef,
  inject,
  resource,
  type ResourceRef,
  type Signal,
  type Type,
} from '@angular/core';
import { CwToastService } from '@cadenway/ui/components/toast';
import {
  patchState,
  type SignalMethod,
  signalMethod,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';

import {
  SPACE_DIRECTORY,
  type SpaceDirectoryEntry,
  type SpaceDirectoryPort,
} from '@features/spaces/ports/space-directory';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { untitledTitle } from '../../constants/document-titles/document-titles.constants';
import { REFRESH_INTERVAL_MS } from '../../constants/refresh/refresh.constants';
import { refusalText } from '../../constants/write-copy/write-copy.constants';
import { DocumentsApi } from '../../data-access/services/documents-api/documents-api.service';
import type {
  DocumentCreateOutcome,
  DocumentDeleteOutcome,
  DocumentDetail,
  DocumentList,
  DocumentRow,
  DocumentSummary,
} from '../../models/document/document.interface';
import {
  isContextChange,
  isGone,
  isRequestInProgress,
  isUncertain,
  OrganizationChangedError,
} from '../../utils/write-outcome/write-outcome.util';
import { withDocumentDeletion } from '../document-deletion/document-deletion.feature';

/**
 * Constant QUERY_MAX_LENGTH
 *
 * @description
 * Longest search the contract accepts (`listDocuments`, `q`).
 *
 * @type {number}
 */
const QUERY_MAX_LENGTH: number = 200;

/**
 * Constant CREATE_ATTEMPTS
 *
 * @description
 * Sends of one `New document` at most, the first one included.
 *
 * @type {number}
 */
const CREATE_ATTEMPTS: number = 4;

/**
 * Constant IN_PROGRESS_DELAY_MS
 *
 * @description
 * Wait, in milliseconds, before sending a creation again that the gateway still runs
 * (`409 idempotency.request-in-progress`).
 *
 * @type {number}
 */
export const IN_PROGRESS_DELAY_MS: number = 1_000;

/**
 * Interface CreationKey
 *
 * @description
 * The idempotency key of the creation under way, kept until an answer settles it, so a creation
 * whose answer was lost is sent again with it and replays the first one instead of creating a
 * second document.
 */
interface CreationKey {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * The organization of the creation.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property spaceId
   *
   * @description
   * The space of the creation.
   *
   * @type {string}
   * @readonly
   */
  readonly spaceId: string;

  /**
   * Property key
   *
   * @description
   * The `Idempotency-Key`.
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;
  // #endregion
}

/**
 * Interface ShownDocuments
 *
 * @description
 * The last documents read for an organization, kept to show while another search is read, so the
 * table does not flash its skeleton at each search.
 */
interface ShownDocuments {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * The organization of the read.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property list
   *
   * @description
   * The documents read.
   *
   * @type {DocumentList}
   * @readonly
   */
  readonly list: DocumentList;
  // #endregion
}

/**
 * Interface DocsState
 *
 * @description
 * What the catalog holds besides its reads.
 */
interface DocsState {
  // #region Properties
  /**
   * Property query
   *
   * @description
   * The search applied to the catalog, trimmed; empty for every document.
   *
   * @type {string}
   */
  query: string;

  /**
   * Property creating
   *
   * @description
   * Whether `New document` waits for the gateway.
   *
   * @type {boolean}
   */
  creating: boolean;

  /**
   * Property _removed
   *
   * @description
   * Documents deleted from this page, hidden from every read that may still list them.
   *
   * @type {readonly string[]}
   */
  _removed: readonly string[];

  /**
   * Property _creation
   *
   * @description
   * The key of a creation no answer settled yet, or null.
   *
   * @type {CreationKey | null}
   */
  _creation: CreationKey | null;

  /**
   * Property _lastRead
   *
   * @description
   * The last documents read, shown while another search is read, or null.
   *
   * @type {ShownDocuments | null}
   */
  _lastRead: ShownDocuments | null;

  /**
   * Property _readAt
   *
   * @description
   * When the last read of the catalog settled, in milliseconds since the epoch; 0 before.
   *
   * @type {number}
   */
  _readAt: number;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * The catalog before any read: every document, nothing under way.
 *
 * @type {DocsState}
 */
const initialState: DocsState = {
  query: '',
  creating: false,
  _removed: [],
  _creation: null,
  _lastRead: null,
  _readAt: 0,
};

/**
 * Function delay
 *
 * @description
 * Waits a number of milliseconds.
 *
 * @param {number} ms - The wait.
 * @returns {Promise<void>} Resolves after it.
 */
function delay(ms: number): Promise<void> {
  return new Promise<void>((resolve: () => void): void => {
    setTimeout(resolve, ms);
  });
}

/**
 * Interface DocsStoreInstance
 *
 * @description
 * What the catalog page reads and calls.
 */
interface DocsStoreInstance {
  // #region Properties
  /**
   * Property documents
   *
   * @description
   * The read of the catalog for the organization and the search, the page's primary read.
   *
   * @type {ResourceRef<DocumentList | undefined>}
   * @readonly
   */
  readonly documents: ResourceRef<DocumentList | undefined>;

  /**
   * Property rows
   *
   * @description
   * The rows to show, undefined during the organization's first read; reading it throws the
   * read's failure, for the route's error boundary.
   *
   * @type {Signal<readonly DocumentRow[] | undefined>}
   * @readonly
   */
  readonly rows: Signal<readonly DocumentRow[] | undefined>;

  /**
   * Property truncated
   *
   * @description
   * Whether more documents match the search than the catalog shows (500).
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly truncated: Signal<boolean>;

  /**
   * Property searching
   *
   * @description
   * Whether another search is read while the last rows stay shown.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly searching: Signal<boolean>;

  /**
   * Property targetSpace
   *
   * @description
   * The space `New document` creates in, or null when the caller may edit none.
   *
   * @type {Signal<SpaceDirectoryEntry | null>}
   * @readonly
   */
  readonly targetSpace: Signal<SpaceDirectoryEntry | null>;

  /**
   * Property query
   *
   * @description
   * The search applied.
   *
   * @type {Signal<string>}
   * @readonly
   */
  readonly query: Signal<string>;

  /**
   * Property creating
   *
   * @description
   * Whether `New document` waits for the gateway.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly creating: Signal<boolean>;

  /**
   * Property deletingId
   *
   * @description
   * The document whose deletion waits for the gateway, or null.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  readonly deletingId: Signal<string | null>;

  /**
   * Property followQuery
   *
   * @description
   * Applies a search, or follows a signal of it (the page's `?q=`); trimmed and cut at the
   * contract's 200 characters.
   *
   * @type {SignalMethod<string | undefined>}
   * @readonly
   */
  readonly followQuery: SignalMethod<string | undefined>;
  // #endregion

  // #region Methods
  /**
   * Method refresh
   *
   * @description
   * Reads the catalog again in the background, unless a read settled less than 30 s ago and
   * `force` is not set; a failure keeps the rows shown.
   *
   * @param {boolean} force - Whether to read even right after another read.
   * @returns {Promise<void>} Settles once read.
   */
  refresh(force?: boolean): Promise<void>;

  /**
   * Method create
   *
   * @description
   * `New document`: creates an `Untitled` document in `targetSpace`.
   *
   * @returns {Promise<DocumentCreateOutcome>} How the creation ended.
   */
  create(): Promise<DocumentCreateOutcome>;

  /**
   * Method remove
   *
   * @description
   * Deletes a row's document, then hides the row.
   *
   * @param {DocumentRow} row - The row.
   * @returns {Promise<DocumentDeleteOutcome>} How the deletion ended.
   */
  remove(row: DocumentRow): Promise<DocumentDeleteOutcome>;
  // #endregion
}

/**
 * Function createDocsStore
 *
 * @description
 * Creates the catalog store.
 *
 * @returns {Type<DocsStoreInstance>} Injectable store constructor.
 */
function createDocsStore(): Type<DocsStoreInstance> {
  return signalStore(
    withState<DocsState>(initialState),
    withDocumentDeletion(),
    withProps(() => ({
      _api: inject(DocumentsApi),
      _workspace: inject<WorkspaceContextPort>(WORKSPACE_CONTEXT),
      _spaces: inject<SpaceDirectoryPort | null>(SPACE_DIRECTORY, { optional: true }),
      _toasts: inject(CwToastService),
      _destroyRef: inject(DestroyRef),
    })),
    withProps((store) => ({
      documents: resource({
        params: (): { organizationId: string; query: string } => ({
          organizationId: store._workspace.organization().id,
          query: store.query(),
        }),
        loader: async ({
          params,
          abortSignal,
        }: {
          params: { organizationId: string; query: string };
          abortSignal: AbortSignal;
        }): Promise<DocumentList> => {
          try {
            const list: DocumentList = await store._api.list(params.query, {
              signal: abortSignal,
            });
            patchState(store, { _lastRead: { organizationId: params.organizationId, list } });
            return list;
          } finally {
            patchState(store, { _readAt: Date.now() });
          }
        },
      }),
      authors: resource({
        params: (): string => store._workspace.organization().id,
        loader: ({
          abortSignal,
        }: {
          abortSignal: AbortSignal;
        }): Promise<ReadonlyMap<string, string>> => store._api.authors(abortSignal),
      }),
    })),
    withComputed((store) => {
      const spaces: () => readonly SpaceDirectoryEntry[] = (): readonly SpaceDirectoryEntry[] =>
        store._spaces?.spaces() ?? [];
      // While another search is read, the last documents of the same organization stay shown.
      const shown: () => DocumentList | undefined = (): DocumentList | undefined => {
        if (store.documents.status() === 'error' || store.documents.hasValue()) {
          return store.documents.value();
        }
        const last: ShownDocuments | null = store._lastRead();
        return last?.organizationId === store._workspace.organization().id ? last.list : undefined;
      };
      return {
        rows: (): readonly DocumentRow[] | undefined => {
          const list: DocumentList | undefined = shown();
          if (list === undefined) return undefined;
          const removed: ReadonlySet<string> = new Set(store._removed());
          const byId: ReadonlyMap<string, SpaceDirectoryEntry> = new Map(
            spaces().map((space: SpaceDirectoryEntry): [string, SpaceDirectoryEntry] => [
              space.id,
              space,
            ]),
          );
          const names: ReadonlyMap<string, string> | null = store.authors.hasValue()
            ? store.authors.value()
            : null;
          return list.items
            .filter((document: DocumentSummary): boolean => !removed.has(document.id))
            .map((document: DocumentSummary): DocumentRow => ({
              document,
              spaceName: byId.get(document.spaceId)?.name ?? null,
              authorName: names?.get(document.authorUserId) ?? null,
              canEdit: byId.get(document.spaceId)?.callerRole === 'edit',
            }));
        },
        truncated: (): boolean =>
          store.documents.status() !== 'error' && (shown()?.truncated ?? false),
        searching: (): boolean =>
          store.documents.isLoading() &&
          store.documents.status() !== 'error' &&
          shown() !== undefined,
        targetSpace: (): SpaceDirectoryEntry | null =>
          spaces().find((space: SpaceDirectoryEntry): boolean => space.callerRole === 'edit') ??
          null,
      };
    }),
    withMethods((store) => {
      const organizationId: () => string = (): string => store._workspace.organization().id;
      const stillWanted: (organization: string) => boolean = (organization: string): boolean =>
        !store._destroyRef.destroyed && organizationId() === organization;
      const ensureOrganization: (organization: string) => void = (organization: string): void => {
        if (!stillWanted(organization)) throw new OrganizationChangedError();
      };
      // A lost answer is sent once more with the same key, which replays the first creation; a
      // creation the gateway still runs is sent again after a pause; a replayed creation whose
      // document was deleted since (`404 document.not-found`) is sent once with a new key.
      const send: (first: CreationKey, title: string) => Promise<DocumentDetail> = async (
        first: CreationKey,
        title: string,
      ): Promise<DocumentDetail> => {
        let creation: CreationKey = first;
        let resentLost: boolean = false;
        let renewed: boolean = false;
        let failure: unknown = null;
        for (let attempt: number = 0; attempt < CREATE_ATTEMPTS; attempt += 1) {
          try {
            ensureOrganization(creation.organizationId);
            return await store._api.create(creation.spaceId, title, creation.key);
          } catch (error: unknown) {
            failure = error;
            if (isContextChange(error)) throw error;
            if (isRequestInProgress(error)) {
              await delay(IN_PROGRESS_DELAY_MS);
            } else if (isUncertain(error) && !resentLost) {
              resentLost = true;
            } else if (isGone(error) && !renewed) {
              renewed = true;
              creation = { ...creation, key: crypto.randomUUID() };
              patchState(store, { _creation: creation });
            } else {
              throw error;
            }
          }
        }
        throw failure;
      };
      const refresh: (force?: boolean) => Promise<void> = async (
        force: boolean = false,
      ): Promise<void> => {
        if (!store.documents.hasValue() || store.documents.isLoading()) return;
        if (!force && Date.now() - store._readAt() < REFRESH_INTERVAL_MS) return;
        const organization: string = organizationId();
        const query: string = store.query();
        try {
          const list: DocumentList = await store._api.list(query, { passive: true });
          if (
            stillWanted(organization) &&
            store.query() === query &&
            store.documents.hasValue() &&
            !store.documents.isLoading()
          ) {
            patchState(store, { _lastRead: { organizationId: organization, list } });
            store.documents.set(list);
          }
        } catch {
          // A background read that fails keeps the rows shown.
        } finally {
          if (stillWanted(organization)) patchState(store, { _readAt: Date.now() });
        }
      };
      return {
        followQuery: signalMethod<string | undefined>((query: string | undefined): void => {
          patchState(store, {
            query: Array.from((query ?? '').trim())
              .slice(0, QUERY_MAX_LENGTH)
              .join('')
              .trim(),
          });
        }),

        refresh,

        async create(): Promise<DocumentCreateOutcome> {
          const space: SpaceDirectoryEntry | null = store.targetSpace();
          if (store.creating() || space === null) return { kind: 'cancelled' };
          const organization: string = organizationId();
          const kept: CreationKey | null = store._creation();
          const creation: CreationKey =
            kept?.organizationId === organization && kept.spaceId === space.id
              ? kept
              : { organizationId: organization, spaceId: space.id, key: crypto.randomUUID() };
          patchState(store, { creating: true, _creation: creation });
          try {
            const created: DocumentDetail = await send(creation, untitledTitle());
            patchState(store, { _creation: null });
            return stillWanted(organization)
              ? { kind: 'created', id: created.id }
              : { kind: 'cancelled' };
          } catch (error: unknown) {
            if (isContextChange(error) || !stillWanted(organization)) return { kind: 'cancelled' };
            if (isUncertain(error) || isRequestInProgress(error)) {
              store._toasts.warning(
                $localize`:@@docs.toast.create-unknown:The document may not have been created`,
                {
                  description: $localize`:@@docs.toast.create-unknown-text:The answer was lost. Check the list before creating it again.`,
                },
              );
              void refresh(true);
              return { kind: 'unknown' };
            }
            patchState(store, { _creation: null });
            store._toasts.error(
              $localize`:@@docs.toast.create-failed:The document could not be created`,
              {
                description: refusalText(
                  error,
                  $localize`:@@docs.toast.create-failed-text:Try again in a moment.`,
                ),
              },
            );
            return { kind: 'failed' };
          } finally {
            patchState(store, { creating: false });
          }
        },

        async remove(row: DocumentRow): Promise<DocumentDeleteOutcome> {
          const outcome: DocumentDeleteOutcome = await store.deleteDocument(row.document);
          if (outcome === 'deleted') {
            patchState(store, { _removed: [...store._removed(), row.document.id] });
          } else if (outcome === 'conflict' || outcome === 'unknown') {
            void refresh(true);
          }
          return outcome;
        },
      };
    }),
  );
}

/**
 * Constant DocsStore
 *
 * @description
 * The documents catalog of the current organization, provided by `DocsPage`.
 *
 * - `documents` is the page's primary read, keyed by the organization and the search
 *   (`followQuery`, from `?q=`): its failure reaches the route's error boundary through `rows`.
 *   It reads at most 500 documents (`truncated` says more match). While another search is read,
 *   `rows` keeps the last documents of the organization and `searching` holds. `refresh()` reads
 *   them again in the background (on focus, at most once per 30 s, gap G-C4, since no realtime
 *   notice reaches documents) and keeps the shown rows when it fails.
 * - Each row names its space and its rights from Spaces' `SPACE_DIRECTORY` (gap G-C2: the caller
 *   may edit and delete a document when its role on the space is `edit`) and its last author from
 *   the member directory (`authors`, a secondary read whose failure leaves the names unknown).
 * - `create()` makes an `Untitled` document in the first space the caller may edit (gap G-C3).
 *   It keeps its idempotency key until an answer settles it: a lost answer or a server error is
 *   sent once more with the same key, which replays the first creation; a creation still running
 *   (`409 idempotency.request-in-progress`) is sent again after `IN_PROGRESS_DELAY_MS`; a replay
 *   whose document was deleted since (`404 document.not-found`) is sent once with a new key. A
 *   creation still unknown after that ends `unknown` with a warning and a refresh.
 * - `remove()` deletes a row (`withDocumentDeletion`) and hides it once deleted.
 *
 * Every write belongs to the organization shown when it starts: once the workspace shows another
 * one or the page went away, it sends nothing more and ends `cancelled` without a toast.
 *
 * @type {Type<DocsStoreInstance>}
 */
export const DocsStore: Type<DocsStoreInstance> = createDocsStore();
