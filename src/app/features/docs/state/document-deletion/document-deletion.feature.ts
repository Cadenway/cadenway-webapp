import { DestroyRef, inject } from '@angular/core';
import { CwToastService } from '@cadenway/ui/components/toast';
import {
  type EmptyFeatureResult,
  patchState,
  type SignalStoreFeature,
  signalStoreFeature,
  withMethods,
  withState,
} from '@ngrx/signals';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { DocumentsApi } from '../../data-access/services/documents-api/documents-api.service';
import type {
  DocumentDeleteOutcome,
  DocumentSummary,
} from '../../models/document/document.interface';
import {
  isContextChange,
  isForbidden,
  isGone,
  isUncertain,
  isVersionMismatch,
  OrganizationChangedError,
} from '../../utils/write-outcome/write-outcome.util';

/**
 * Interface DocumentDeletionState
 *
 * @description
 * The deletion under way.
 */
interface DocumentDeletionState {
  // #region Properties
  /**
   * Property deletingId
   *
   * @description
   * The document whose deletion waits for the gateway, or null.
   *
   * @type {string | null}
   */
  deletingId: string | null;
  // #endregion
}

/**
 * Interface DocumentDeletionMethods
 *
 * @description
 * What the feature adds to its store.
 */
interface DocumentDeletionMethods {
  // #region Methods
  /**
   * Method deleteDocument
   *
   * @description
   * Deletes a document from the version shown and says how it ended with a toast.
   *
   * @param {DocumentSummary} document - The document as shown.
   * @returns {Promise<DocumentDeleteOutcome>} How the deletion ended.
   */
  deleteDocument(document: DocumentSummary): Promise<DocumentDeleteOutcome>;
  // #endregion
}

/**
 * Type Literal
 *
 * @description
 * The members of an interface as an object type, which a feature result requires.
 *
 * @type {{ [K in keyof T]: T[K] }}
 */
type Literal<T> = { [K in keyof T]: T[K] };

/**
 * Function withDocumentDeletion
 *
 * @description
 * The deletion of a document, shared by the catalog and the document page: `deleteDocument`
 * deletes from the version shown and says how it ended with a toast. The mockup's `Undo` (gap
 * G-C1) is left out since nothing restores a document; the pages confirm first instead.
 *
 * A deletion belongs to the organization shown when it starts: once the workspace shows another,
 * or the page went away, it ends `cancelled` without a toast. A document already gone (`404`)
 * counts as deleted. A stale version (`412`) keeps it (`conflict`). A lost answer or a server
 * error reads the document again: gone is `deleted`, still there is `failed`, and a read that
 * fails too is `unknown`.
 *
 * @returns {SignalStoreFeature} The feature.
 */
export function withDocumentDeletion(): SignalStoreFeature<
  EmptyFeatureResult,
  {
    state: Literal<DocumentDeletionState>;
    props: object;
    methods: Literal<DocumentDeletionMethods>;
  }
> {
  return signalStoreFeature(
    withState<DocumentDeletionState>({ deletingId: null }),
    withMethods(
      (
        store,
        api: DocumentsApi = inject(DocumentsApi),
        workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT),
        toasts: CwToastService = inject(CwToastService),
        destroyRef: DestroyRef = inject(DestroyRef),
      ) => {
        const stillWanted: (organizationId: string) => boolean = (
          organizationId: string,
        ): boolean => !destroyRef.destroyed && workspace.organization().id === organizationId;
        const ensureOrganization: (organizationId: string) => void = (
          organizationId: string,
        ): void => {
          if (!stillWanted(organizationId)) throw new OrganizationChangedError();
        };
        const verify: (
          document: DocumentSummary,
          organizationId: string,
        ) => Promise<DocumentDeleteOutcome> = async (
          document: DocumentSummary,
          organizationId: string,
        ): Promise<DocumentDeleteOutcome> => {
          try {
            ensureOrganization(organizationId);
            await api.get(document.id);
            return 'failed';
          } catch (error: unknown) {
            if (isContextChange(error)) return 'cancelled';
            return isGone(error) ? 'deleted' : 'unknown';
          }
        };
        const attempt: (
          document: DocumentSummary,
          organizationId: string,
        ) => Promise<DocumentDeleteOutcome | 'forbidden'> = async (
          document: DocumentSummary,
          organizationId: string,
        ): Promise<DocumentDeleteOutcome | 'forbidden'> => {
          try {
            ensureOrganization(organizationId);
            await api.remove(document.id, document.version);
            return 'deleted';
          } catch (error: unknown) {
            if (isContextChange(error)) return 'cancelled';
            if (isGone(error)) return 'deleted';
            if (isVersionMismatch(error)) return 'conflict';
            if (isUncertain(error)) return verify(document, organizationId);
            return isForbidden(error) ? 'forbidden' : 'failed';
          }
        };
        return {
          async deleteDocument(document: DocumentSummary): Promise<DocumentDeleteOutcome> {
            if (store.deletingId() !== null) return 'cancelled';
            const organizationId: string = workspace.organization().id;
            patchState(store, { deletingId: document.id });
            try {
              const outcome: DocumentDeleteOutcome | 'forbidden' = await attempt(
                document,
                organizationId,
              );
              if (!stillWanted(organizationId)) return 'cancelled';
              switch (outcome) {
                case 'forbidden':
                  toasts.error(
                    $localize`:@@docs.toast.delete-failed:The document could not be deleted`,
                    {
                      description: $localize`:@@docs.toast.forbidden-text:You can no longer edit the documents of this space.`,
                    },
                  );
                  return 'failed';
                case 'deleted':
                  toasts.success($localize`:@@docs.toast.deleted:Document deleted`, {
                    description: document.title,
                  });
                  break;
                case 'conflict':
                  toasts.error($localize`:@@docs.toast.changed:The document changed meanwhile`, {
                    description: $localize`:@@docs.toast.delete-conflict-text:It was kept. Read it again before deleting it.`,
                  });
                  break;
                case 'failed':
                  toasts.error(
                    $localize`:@@docs.toast.delete-failed:The document could not be deleted`,
                    {
                      description: $localize`:@@docs.toast.delete-failed-text:It is still there. Try again in a moment.`,
                    },
                  );
                  break;
                case 'unknown':
                  toasts.warning(
                    $localize`:@@docs.toast.delete-unknown:The document may not have been deleted`,
                    {
                      description: $localize`:@@docs.toast.delete-unknown-text:The answer was lost. Check the list before deleting it again.`,
                    },
                  );
                  break;
                case 'cancelled':
                  break;
              }
              return outcome;
            } finally {
              patchState(store, { deletingId: null });
            }
          },
        };
      },
    ),
  );
}
