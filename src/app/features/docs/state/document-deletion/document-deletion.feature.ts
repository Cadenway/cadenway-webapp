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

import { DELETION_CHECK_DELAYS_MS } from '../../constants/deletion-checks/deletion-checks.token';
import { refusalText } from '../../constants/write-copy/write-copy.constants';
import { DocumentsApi } from '../../data-access/services/documents-api/documents-api.service';
import type {
  DocumentDeleteOutcome,
  DocumentSummary,
} from '../../models/document/document.interface';
import {
  isContextChange,
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
   * @param {() => boolean} isCurrent - Whether the page still shows that document; once it does
   *   not, the deletion reads nothing more, shows no toast and ends `cancelled`.
   * @returns {Promise<DocumentDeleteOutcome>} How the deletion ended.
   */
  deleteDocument(
    document: DocumentSummary,
    isCurrent?: () => boolean,
  ): Promise<DocumentDeleteOutcome>;
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
 * Type Attempt
 *
 * @description
 * How the request ended: an outcome, or a refusal with its failure for the toast.
 *
 * @type {DocumentDeleteOutcome | { readonly refused: unknown }}
 */
type Attempt = DocumentDeleteOutcome | { readonly refused: unknown };

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
 * Function withDocumentDeletion
 *
 * @description
 * The deletion of a document, shared by the catalog and the document page: `deleteDocument`
 * deletes from the version shown and says how it ended with a toast. The mockup's `Undo` (gap
 * G-C1) is left out since nothing restores a document; the pages confirm first instead.
 *
 * A deletion belongs to the organization shown when it starts and, through `isCurrent`, to the
 * document shown: once either changes or the page went away, it reads nothing more and ends
 * `cancelled` without a toast. A document already gone (`404 document.not-found`) counts as
 * deleted. A stale version (`412`) keeps it (`conflict`). A lost answer or a server error keeps the
 * deletion pending and reads the document after 2, 4 and 8 s (`DELETION_CHECK_DELAYS_MS`): a read
 * that finds it gone ends `deleted`; one that still finds it proves nothing, since the original
 * request may still run, so after the last read it ends `unknown` with the neutral
 * `The deletion could not be confirmed`, never `failed`.
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
        checkDelays: readonly number[] = inject(DELETION_CHECK_DELAYS_MS),
      ) => {
        // A read that still finds the document proves nothing while the original request may
        // still run: only a read that finds it gone settles the deletion, and once the last
        // delayed read is done it stays unconfirmed, never failed.
        const verify: (document: DocumentSummary, ensure: () => void) => Promise<Attempt> = async (
          document: DocumentSummary,
          ensure: () => void,
        ): Promise<Attempt> => {
          for (const wait of checkDelays) {
            await delay(wait);
            try {
              ensure();
              await api.get(document.id);
            } catch (error: unknown) {
              if (isContextChange(error)) return 'cancelled';
              if (isGone(error)) return 'deleted';
            }
          }
          return 'unknown';
        };
        const attempt: (document: DocumentSummary, ensure: () => void) => Promise<Attempt> = async (
          document: DocumentSummary,
          ensure: () => void,
        ): Promise<Attempt> => {
          try {
            ensure();
            await api.remove(document.id, document.version);
            return 'deleted';
          } catch (error: unknown) {
            if (isContextChange(error)) return 'cancelled';
            if (isGone(error)) return 'deleted';
            if (isVersionMismatch(error)) return 'conflict';
            if (isUncertain(error)) return verify(document, ensure);
            return { refused: error };
          }
        };
        return {
          async deleteDocument(
            document: DocumentSummary,
            isCurrent: () => boolean = (): boolean => true,
          ): Promise<DocumentDeleteOutcome> {
            if (store.deletingId() !== null) return 'cancelled';
            const organizationId: string = workspace.organization().id;
            const stillWanted: () => boolean = (): boolean =>
              !destroyRef.destroyed &&
              workspace.organization().id === organizationId &&
              isCurrent();
            const ensure: () => void = (): void => {
              if (!stillWanted()) throw new OrganizationChangedError();
            };
            patchState(store, { deletingId: document.id });
            try {
              const outcome: Attempt = await attempt(document, ensure);
              if (!stillWanted()) return 'cancelled';
              if (typeof outcome === 'object') {
                toasts.error(
                  $localize`:@@docs.toast.delete-failed:The document could not be deleted`,
                  {
                    description: refusalText(
                      outcome.refused,
                      $localize`:@@docs.toast.delete-failed-text:It is still there. Try again in a moment.`,
                    ),
                  },
                );
                return 'failed';
              }
              switch (outcome) {
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
                    $localize`:@@docs.toast.delete-unknown:The deletion could not be confirmed`,
                    {
                      description: $localize`:@@docs.toast.delete-unknown-text:The answer was lost and the document may still disappear. Check the list in a moment before deleting it again.`,
                    },
                  );
                  break;
                case 'cancelled':
                  break;
              }
              return outcome;
            } finally {
              if (store.deletingId() === document.id) patchState(store, { deletingId: null });
            }
          },
        };
      },
    ),
  );
}
