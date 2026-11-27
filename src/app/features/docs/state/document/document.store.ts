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

import { normalizedTitle } from '../../constants/document-titles/document-titles.constants';
import { DocumentsApi } from '../../data-access/services/documents-api/documents-api.service';
import type {
  DocumentDeleteOutcome,
  DocumentDetail,
  DocumentDraft,
  DocumentSaveOutcome,
} from '../../models/document/document.interface';
import {
  isContextChange,
  isForbidden,
  isGone,
  isUncertain,
  isVersionMismatch,
  OrganizationChangedError,
} from '../../utils/write-outcome/write-outcome.util';
import { withDocumentDeletion } from '../document-deletion/document-deletion.feature';

/**
 * Interface DocumentState
 *
 * @description
 * What the document page holds besides its reads.
 */
interface DocumentState {
  // #region Properties
  /**
   * Property documentId
   *
   * @description
   * The document of the route, or null before the page gives it.
   *
   * @type {string | null}
   */
  documentId: string | null;

  /**
   * Property saving
   *
   * @description
   * Whether a save waits for the gateway, or for the read that settles its outcome.
   *
   * @type {boolean}
   */
  saving: boolean;
  // #endregion
}

/**
 * Interface DocumentStoreInstance
 *
 * @description
 * What the document page reads and calls.
 */
interface DocumentStoreInstance {
  // #region Properties
  /**
   * Property document
   *
   * @description
   * The read of the document, the page's primary read: it rejects with the route boundary's
   * state (`NotFoundRouteError` for a missing document). A save, a conflict or a refresh writes
   * the gateway's latest answer into it.
   *
   * @type {ResourceRef<DocumentDetail | undefined>}
   * @readonly
   */
  readonly document: ResourceRef<DocumentDetail | undefined>;

  /**
   * Property current
   *
   * @description
   * The stored document, undefined while read; reading it throws the read's failure, for the
   * route's error boundary.
   *
   * @type {Signal<DocumentDetail | undefined>}
   * @readonly
   */
  readonly current: Signal<DocumentDetail | undefined>;

  /**
   * Property space
   *
   * @description
   * The document's space in the space directory, or null while unknown.
   *
   * @type {Signal<SpaceDirectoryEntry | null>}
   * @readonly
   */
  readonly space: Signal<SpaceDirectoryEntry | null>;

  /**
   * Property canEdit
   *
   * @description
   * Whether the caller may edit and delete the document: its role on the space is `edit` (gap
   * G-C2). The gateway still answers `403` to a write it no longer allows.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly canEdit: Signal<boolean>;

  /**
   * Property authorName
   *
   * @description
   * Name of the last author, or null while the member directory is read, failed or no longer
   * lists them.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  readonly authorName: Signal<string | null>;

  /**
   * Property saving
   *
   * @description
   * Whether a save is under way.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly saving: Signal<boolean>;

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
   * Property followDocument
   *
   * @description
   * Follows the document of the route (`:docId`).
   *
   * @type {SignalMethod<string>}
   * @readonly
   */
  readonly followDocument: SignalMethod<string>;
  // #endregion

  // #region Methods
  /**
   * Method save
   *
   * @description
   * `Done`: saves the draft from the version shown, the title normalized (empty saves as
   * `Untitled`), and says how it ended with a toast.
   *
   * @param {DocumentDraft} draft - The editor's draft.
   * @returns {Promise<DocumentSaveOutcome>} How the save ended.
   */
  save(draft: DocumentDraft): Promise<DocumentSaveOutcome>;

  /**
   * Method remove
   *
   * @description
   * Deletes the document from the version shown.
   *
   * @returns {Promise<DocumentDeleteOutcome>} How the deletion ended.
   */
  remove(): Promise<DocumentDeleteOutcome>;

  /**
   * Method refresh
   *
   * @description
   * Reads the document again in the background and shows a newer version; a failure keeps the
   * one shown. Nothing is read while a save or a deletion is under way.
   *
   * @returns {Promise<void>} Settles once read.
   */
  refresh(): Promise<void>;
  // #endregion
}

/**
 * Function createDocumentStore
 *
 * @description
 * Creates the document store.
 *
 * @returns {Type<DocumentStoreInstance>} Injectable store constructor.
 */
function createDocumentStore(): Type<DocumentStoreInstance> {
  return signalStore(
    withState<DocumentState>({ documentId: null, saving: false }),
    withDocumentDeletion(),
    withProps(() => ({
      _api: inject(DocumentsApi),
      _workspace: inject<WorkspaceContextPort>(WORKSPACE_CONTEXT),
      _spaces: inject<SpaceDirectoryPort | null>(SPACE_DIRECTORY, { optional: true }),
      _toasts: inject(CwToastService),
      _destroyRef: inject(DestroyRef),
    })),
    withProps((store) => ({
      document: resource({
        params: (): { organizationId: string; documentId: string } | undefined => {
          const documentId: string | null = store.documentId();
          return documentId === null
            ? undefined
            : { organizationId: store._workspace.organization().id, documentId };
        },
        loader: ({
          params,
          abortSignal,
        }: {
          params: { organizationId: string; documentId: string };
          abortSignal: AbortSignal;
        }): Promise<DocumentDetail> => store._api.open(params.documentId, abortSignal),
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
    withComputed((store) => ({
      current: (): DocumentDetail | undefined => store.document.value(),
      space: (): SpaceDirectoryEntry | null => {
        const shown: DocumentDetail | undefined = store.document.hasValue()
          ? store.document.value()
          : undefined;
        if (shown === undefined) return null;
        return (
          store._spaces
            ?.spaces()
            .find((space: SpaceDirectoryEntry): boolean => space.id === shown.spaceId) ?? null
        );
      },
      authorName: (): string | null => {
        if (!store.document.hasValue() || !store.authors.hasValue()) return null;
        return store.authors.value().get(store.document.value().authorUserId) ?? null;
      },
    })),
    withComputed((store) => ({
      canEdit: (): boolean => store.space()?.callerRole === 'edit',
    })),
    withMethods((store) => {
      const organizationId: () => string = (): string => store._workspace.organization().id;
      const stillWanted: (organization: string, documentId: string) => boolean = (
        organization: string,
        documentId: string,
      ): boolean =>
        !store._destroyRef.destroyed &&
        organizationId() === organization &&
        store.documentId() === documentId;
      const ensure: (organization: string, documentId: string) => void = (
        organization: string,
        documentId: string,
      ): void => {
        if (!stillWanted(organization, documentId)) throw new OrganizationChangedError();
      };
      const toastSaved: (saved: DocumentDetail) => void = (saved: DocumentDetail): void => {
        store._toasts.success($localize`:@@docs.toast.saved:Document saved`, {
          description: saved.title,
        });
      };
      const toastGone: () => void = (): void => {
        store._toasts.error($localize`:@@docs.toast.gone:This document no longer exists`, {
          description: $localize`:@@docs.toast.gone-text:It was deleted meanwhile. Copy your text before leaving.`,
        });
      };
      // After a stale version or a lost answer, the stored document tells what happened: it
      // holds the draft (saved, by this save or an earlier one whose answer was lost), it is
      // still the version sent (a lost save that was not applied), or someone saved another
      // version (a conflict: the draft is kept over it, and the next save replaces it).
      const reconcile: (
        base: DocumentDetail,
        sent: DocumentDraft,
        organization: string,
        uncertain: boolean,
      ) => Promise<DocumentSaveOutcome> = async (
        base: DocumentDetail,
        sent: DocumentDraft,
        organization: string,
        uncertain: boolean,
      ): Promise<DocumentSaveOutcome> => {
        let fresh: DocumentDetail;
        try {
          ensure(organization, base.id);
          fresh = await store._api.get(base.id);
        } catch (error: unknown) {
          if (isContextChange(error) || !stillWanted(organization, base.id)) return 'cancelled';
          if (isGone(error)) {
            toastGone();
            return 'gone';
          }
          store._toasts.warning(
            $localize`:@@docs.toast.save-unknown:The document may not have been saved`,
            {
              description: $localize`:@@docs.toast.save-unknown-text:The answer was lost. Your draft is kept: choose Done to send it again.`,
            },
          );
          return 'unknown';
        }
        if (!stillWanted(organization, base.id)) return 'cancelled';
        if (fresh.title === sent.title && fresh.body === sent.body) {
          store.document.set(fresh);
          toastSaved(fresh);
          return 'saved';
        }
        if (uncertain && fresh.version === base.version) {
          store._toasts.error(
            $localize`:@@docs.toast.save-failed:The document could not be saved`,
            {
              description: $localize`:@@docs.toast.save-failed-text:Your draft is kept. Try again in a moment.`,
            },
          );
          return 'failed';
        }
        store.document.set(fresh);
        store._toasts.error($localize`:@@docs.toast.changed:The document changed meanwhile`, {
          description: $localize`:@@docs.toast.save-conflict-text:Your draft is kept. Choose Done to replace the other version, or Cancel to read it.`,
        });
        return 'conflict';
      };
      return {
        followDocument: signalMethod<string>((documentId: string): void => {
          patchState(store, { documentId });
        }),

        async save(draft: DocumentDraft): Promise<DocumentSaveOutcome> {
          if (!store.document.hasValue() || store.saving() || store.deletingId() !== null) {
            return 'cancelled';
          }
          const base: DocumentDetail = store.document.value();
          const organization: string = organizationId();
          const sent: DocumentDraft = { title: normalizedTitle(draft.title), body: draft.body };
          patchState(store, { saving: true });
          try {
            let saved: DocumentDetail;
            try {
              ensure(organization, base.id);
              saved = await store._api.update(base.id, base.version, sent);
            } catch (error: unknown) {
              if (isContextChange(error) || !stillWanted(organization, base.id)) {
                return 'cancelled';
              }
              if (isGone(error)) {
                toastGone();
                return 'gone';
              }
              if (isVersionMismatch(error) || isUncertain(error)) {
                return await reconcile(base, sent, organization, isUncertain(error));
              }
              store._toasts.error(
                $localize`:@@docs.toast.save-failed:The document could not be saved`,
                {
                  description: isForbidden(error)
                    ? $localize`:@@docs.toast.forbidden-text:You can no longer edit the documents of this space.`
                    : $localize`:@@docs.toast.save-failed-text:Your draft is kept. Try again in a moment.`,
                },
              );
              return 'failed';
            }
            if (!stillWanted(organization, base.id)) return 'cancelled';
            store.document.set(saved);
            toastSaved(saved);
            return 'saved';
          } finally {
            patchState(store, { saving: false });
          }
        },

        async remove(): Promise<DocumentDeleteOutcome> {
          if (!store.document.hasValue() || store.saving()) return 'cancelled';
          return store.deleteDocument(store.document.value());
        },

        async refresh(): Promise<void> {
          if (!store.document.hasValue() || store.document.isLoading()) return;
          if (store.saving() || store.deletingId() !== null) return;
          const shown: DocumentDetail = store.document.value();
          const organization: string = organizationId();
          try {
            const fresh: DocumentDetail = await store._api.get(shown.id, { passive: true });
            if (
              stillWanted(organization, shown.id) &&
              !store.saving() &&
              store.deletingId() === null &&
              store.document.hasValue() &&
              fresh.version > store.document.value().version
            ) {
              store.document.set(fresh);
            }
          } catch {
            // A background read that fails keeps the document shown.
          }
        },
      };
    }),
  );
}

/**
 * Constant DocumentStore
 *
 * @description
 * A document at its shareable address, provided by `DocumentPage`. Its read is the page's
 * primary read, keyed by the organization and the route's document. The caller's rights come
 * from the space directory (gap G-C2), the last author's name from the member directory (a
 * secondary read).
 *
 * `save()` sends the draft from the version shown (`If-Match`) and replaces the read with the
 * stored document. A stale version (`412`) and an unknown outcome (no answer, a timeout, a `5xx`)
 * read the document again instead of failing: the draft is `saved` when it is the stored
 * document, `failed` when a lost save was not applied, and `conflict` when someone saved another
 * version, which then becomes the version the next save replaces. A deleted document is `gone`.
 * The draft itself stays in the page's form, so every outcome but `saved` keeps it.
 *
 * `remove()` deletes it (`withDocumentDeletion`, no `Undo`: gap G-C1). `refresh()` reads it again
 * in the background (on focus while nothing is edited, gap G-C4). Every write belongs to the
 * organization and the document shown when it starts: once either changes or the page goes away,
 * it sends nothing more and ends `cancelled` without a toast.
 *
 * @type {Type<DocumentStoreInstance>}
 */
export const DocumentStore: Type<DocumentStoreInstance> = createDocumentStore();
