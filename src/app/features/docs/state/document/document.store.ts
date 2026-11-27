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
import { REFRESH_INTERVAL_MS } from '../../constants/refresh/refresh.constants';
import { refusalText } from '../../constants/write-copy/write-copy.constants';
import { DocumentsApi } from '../../data-access/services/documents-api/documents-api.service';
import type {
  DocumentConflict,
  DocumentDeleteOutcome,
  DocumentDetail,
  DocumentDraft,
  DocumentSaveOutcome,
} from '../../models/document/document.interface';
import {
  isContextChange,
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
   * Property editing
   *
   * @description
   * Whether the page shows the document in edit mode; no background read applies meanwhile.
   *
   * @type {boolean}
   */
  editing: boolean;

  /**
   * Property conflict
   *
   * @description
   * The other version the last save met, while the merged draft stays in edit mode, or null.
   *
   * @type {DocumentConflict | null}
   */
  conflict: DocumentConflict | null;

  /**
   * Property _draftBase
   *
   * @description
   * The stored document the draft started from: its version is the one the next save names, and
   * its fields are the base of the merge after a conflict. Null outside edit mode.
   *
   * @type {DocumentDetail | null}
   */
  _draftBase: DocumentDetail | null;

  /**
   * Property _savingFor
   *
   * @description
   * The document whose save is under way, or null; a save of a document no longer shown does not
   * count as the page's.
   *
   * @type {string | null}
   */
  _savingFor: string | null;

  /**
   * Property _readAt
   *
   * @description
   * When the last read of the document settled, in milliseconds since the epoch; 0 before.
   *
   * @type {number}
   */
  _readAt: number;
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
   * state (`NotFoundRouteError` for a missing document or an id that is not one). A save, a
   * conflict or a refresh writes the gateway's latest answer into it.
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
   * Property editing
   *
   * @description
   * Whether the document shows in edit mode.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly editing: Signal<boolean>;

  /**
   * Property conflict
   *
   * @description
   * The other version the last save met, or null.
   *
   * @type {Signal<DocumentConflict | null>}
   * @readonly
   */
  readonly conflict: Signal<DocumentConflict | null>;

  /**
   * Property conflictAuthorName
   *
   * @description
   * Name of who saved the other version, or null while unknown.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  readonly conflictAuthorName: Signal<string | null>;

  /**
   * Property saving
   *
   * @description
   * Whether a save of the document shown is under way.
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
   * Follows the document of the route (`:docId`); another document leaves edit mode and forgets
   * the previous one's save and deletion under way.
   *
   * @type {SignalMethod<string>}
   * @readonly
   */
  readonly followDocument: SignalMethod<string>;
  // #endregion

  // #region Methods
  /**
   * Method beginEditing
   *
   * @description
   * Enters edit mode from the stored document, which becomes the draft's base.
   *
   * @returns {DocumentDetail | null} The draft's base, or null when the caller may not edit it.
   */
  beginEditing(): DocumentDetail | null;

  /**
   * Method endEditing
   *
   * @description
   * Leaves edit mode and forgets the draft's base and any conflict.
   */
  endEditing(): void;

  /**
   * Method save
   *
   * @description
   * `Done`: saves the draft from its base's version, the title normalized (empty saves as
   * `Untitled`), and says how it ended with a toast.
   *
   * @param {DocumentDraft} draft - The editor's draft.
   * @returns {Promise<DocumentSaveOutcome>} How the save ended.
   */
  save(draft: DocumentDraft): Promise<DocumentSaveOutcome>;

  /**
   * Method saveSettled
   *
   * @description
   * Waits for the save under way, if any, to settle.
   *
   * @returns {Promise<void>} Resolves once no save is under way.
   */
  saveSettled(): Promise<void>;

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
   * one shown. Nothing is read, or applied, in edit mode or while a save or a deletion is under
   * way, nor within 30 s of the last settled read unless `force` is set.
   *
   * @param {boolean} force - Whether to read even right after another read.
   * @returns {Promise<void>} Settles once read.
   */
  refresh(force?: boolean): Promise<void>;
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
    withState<DocumentState>({
      documentId: null,
      editing: false,
      conflict: null,
      _draftBase: null,
      _savingFor: null,
      _readAt: 0,
    }),
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
        loader: async ({
          params,
          abortSignal,
        }: {
          params: { organizationId: string; documentId: string };
          abortSignal: AbortSignal;
        }): Promise<DocumentDetail> => {
          try {
            return await store._api.open(params.documentId, abortSignal);
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
      const nameOf: (userId: string) => string | null = (userId: string): string | null =>
        store.authors.hasValue() ? (store.authors.value().get(userId) ?? null) : null;
      return {
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
        authorName: (): string | null =>
          store.document.hasValue() ? nameOf(store.document.value().authorUserId) : null,
        conflictAuthorName: (): string | null => {
          const conflict: DocumentConflict | null = store.conflict();
          return conflict === null ? null : nameOf(conflict.authorUserId);
        },
        saving: (): boolean =>
          store._savingFor() !== null && store._savingFor() === store.documentId(),
      };
    }),
    withComputed((store) => ({
      canEdit: (): boolean => store.space()?.callerRole === 'edit',
    })),
    withMethods((store) => {
      // The save under way, which `saveSettled()` waits for.
      let pending: Promise<unknown> | null = null;
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
      const stored: (fresh: DocumentDetail) => void = (fresh: DocumentDetail): void => {
        store.document.set(fresh);
        patchState(store, { _readAt: Date.now() });
      };
      const accept: (saved: DocumentDetail) => DocumentSaveOutcome = (
        saved: DocumentDetail,
      ): DocumentSaveOutcome => {
        stored(saved);
        patchState(store, { _draftBase: saved, conflict: null });
        store._toasts.success($localize`:@@docs.toast.saved:Document saved`, {
          description: saved.title,
        });
        return { kind: 'saved' };
      };
      const toastGone: () => DocumentSaveOutcome = (): DocumentSaveOutcome => {
        store._toasts.error($localize`:@@docs.toast.gone:This document no longer exists`, {
          description: $localize`:@@docs.toast.gone-text:It was deleted meanwhile. Copy your text before leaving.`,
        });
        return { kind: 'gone' };
      };
      // After a stale version or a lost answer, the stored document tells what happened: it
      // holds the draft (saved, by this save or an earlier one whose answer was lost), it is
      // still the version sent (a lost save that was not applied), or someone saved another
      // version. Then each field the draft did not change takes the other version's value; when
      // the draft changed nothing the other version is simply shown.
      const reconcile: (
        base: DocumentDetail,
        draft: DocumentDraft,
        sent: DocumentDraft,
        organization: string,
        uncertain: boolean,
      ) => Promise<DocumentSaveOutcome> = async (
        base: DocumentDetail,
        draft: DocumentDraft,
        sent: DocumentDraft,
        organization: string,
        uncertain: boolean,
      ): Promise<DocumentSaveOutcome> => {
        let fresh: DocumentDetail;
        try {
          ensure(organization, base.id);
          fresh = await store._api.get(base.id);
        } catch (error: unknown) {
          if (isContextChange(error) || !stillWanted(organization, base.id)) {
            return { kind: 'cancelled' };
          }
          if (isGone(error)) return toastGone();
          store._toasts.warning(
            $localize`:@@docs.toast.save-unknown:The document may not have been saved`,
            {
              description: $localize`:@@docs.toast.save-unknown-text:The answer was lost. Your draft is kept: choose Done to send it again.`,
            },
          );
          return { kind: 'unknown' };
        }
        if (!stillWanted(organization, base.id)) return { kind: 'cancelled' };
        if (fresh.title === sent.title && fresh.body === sent.body) return accept(fresh);
        if (uncertain && fresh.version === base.version) {
          store._toasts.error(
            $localize`:@@docs.toast.save-failed:The document could not be saved`,
            {
              description: $localize`:@@docs.toast.save-failed-text:Your draft is kept. Try again in a moment.`,
            },
          );
          return { kind: 'failed' };
        }
        const titleChanged: boolean = sent.title !== base.title;
        const bodyChanged: boolean = sent.body !== base.body;
        stored(fresh);
        if (!titleChanged && !bodyChanged) {
          patchState(store, { _draftBase: fresh, conflict: null });
          store._toasts.info($localize`:@@docs.toast.changed:The document changed meanwhile`, {
            description: $localize`:@@docs.toast.adopted-text:You had changed nothing, so its latest version shows.`,
          });
          return { kind: 'adopted' };
        }
        patchState(store, {
          _draftBase: fresh,
          conflict: { authorUserId: fresh.authorUserId, updatedAt: fresh.updatedAt },
        });
        store._toasts.error($localize`:@@docs.toast.changed:The document changed meanwhile`, {
          description: $localize`:@@docs.toast.save-conflict-text:Your changes are kept over the other version. Check them, then choose Done to replace it.`,
        });
        return {
          kind: 'conflict',
          draft: {
            title: titleChanged ? draft.title : fresh.title,
            body: bodyChanged ? draft.body : fresh.body,
          },
        };
      };
      const send: (
        base: DocumentDetail,
        draft: DocumentDraft,
        organization: string,
      ) => Promise<DocumentSaveOutcome> = async (
        base: DocumentDetail,
        draft: DocumentDraft,
        organization: string,
      ): Promise<DocumentSaveOutcome> => {
        const sent: DocumentDraft = { title: normalizedTitle(draft.title), body: draft.body };
        let saved: DocumentDetail;
        try {
          ensure(organization, base.id);
          saved = await store._api.update(base.id, base.version, sent);
        } catch (error: unknown) {
          if (isContextChange(error) || !stillWanted(organization, base.id)) {
            return { kind: 'cancelled' };
          }
          if (isGone(error)) return toastGone();
          if (isVersionMismatch(error) || isUncertain(error)) {
            return reconcile(base, draft, sent, organization, isUncertain(error));
          }
          store._toasts.error(
            $localize`:@@docs.toast.save-failed:The document could not be saved`,
            {
              description: refusalText(
                error,
                $localize`:@@docs.toast.save-failed-text:Your draft is kept. Try again in a moment.`,
              ),
            },
          );
          return { kind: 'failed' };
        }
        return stillWanted(organization, base.id) ? accept(saved) : { kind: 'cancelled' };
      };
      return {
        followDocument: signalMethod<string>((documentId: string): void => {
          if (documentId === store.documentId()) return;
          patchState(store, {
            documentId,
            editing: false,
            conflict: null,
            deletingId: null,
            _draftBase: null,
            _savingFor: null,
          });
        }),

        beginEditing(): DocumentDetail | null {
          if (!store.document.hasValue() || !store.canEdit()) return null;
          const base: DocumentDetail = store.document.value();
          patchState(store, { editing: true, conflict: null, _draftBase: base });
          return base;
        },

        endEditing(): void {
          patchState(store, { editing: false, conflict: null, _draftBase: null });
        },

        async save(draft: DocumentDraft): Promise<DocumentSaveOutcome> {
          const base: DocumentDetail | null = store._draftBase();
          if (base === null || store.saving() || store.deletingId() !== null) {
            return { kind: 'cancelled' };
          }
          patchState(store, { _savingFor: base.id });
          const run: Promise<DocumentSaveOutcome> = send(base, draft, organizationId());
          pending = run;
          try {
            return await run;
          } finally {
            if (pending === run) pending = null;
            if (store._savingFor() === base.id) patchState(store, { _savingFor: null });
          }
        },

        async saveSettled(): Promise<void> {
          if (pending !== null) await pending.catch((): void => undefined);
        },

        async remove(): Promise<DocumentDeleteOutcome> {
          if (!store.document.hasValue() || store.saving()) return 'cancelled';
          const shown: DocumentDetail = store.document.value();
          return store.deleteDocument(shown, (): boolean => store.documentId() === shown.id);
        },

        async refresh(force: boolean = false): Promise<void> {
          // The document shown, while nothing edits, saves or deletes it.
          const idle: () => DocumentDetail | null = (): DocumentDetail | null =>
            store.document.hasValue() &&
            !store.document.isLoading() &&
            !store.editing() &&
            !store.saving() &&
            store.deletingId() === null
              ? store.document.value()
              : null;
          const shown: DocumentDetail | null = idle();
          if (shown === null) return;
          if (!force && Date.now() - store._readAt() < REFRESH_INTERVAL_MS) return;
          const organization: string = organizationId();
          try {
            const fresh: DocumentDetail = await store._api.get(shown.id, { passive: true });
            const latest: DocumentDetail | null = idle();
            if (
              stillWanted(organization, shown.id) &&
              latest !== null &&
              fresh.version > latest.version
            ) {
              store.document.set(fresh);
            }
          } catch {
            // A background read that fails keeps the document shown.
          } finally {
            if (stillWanted(organization, shown.id)) patchState(store, { _readAt: Date.now() });
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
 * Edit mode (`beginEditing`, `endEditing`) records the stored document the draft starts from;
 * `save()` sends the draft from that version (`If-Match`), so a read landing meanwhile never
 * moves it, and no background read applies in edit mode. A stale version (`412`) and an unknown
 * outcome (no answer, a timeout, a `5xx`) read the document again instead of failing: the draft is
 * `saved` when it is the stored document, `failed` when a lost save was not applied, `adopted`
 * when someone saved another version and the draft changed nothing, and `conflict` otherwise,
 * with a draft merged field by field and `conflict` naming who saved and when; that version is
 * then the base the next save replaces. A deleted document is `gone`. The draft itself stays in
 * the page's form.
 *
 * `remove()` deletes it (`withDocumentDeletion`, no `Undo`: gap G-C1), bound to the document.
 * `refresh()` reads it again in the background (on focus, at most once per 30 s, gap G-C4). Every
 * write belongs to the organization and the document shown when it starts: once either changes or
 * the page goes away, it sends nothing more and ends `cancelled` without a toast, and `saving`
 * only ever describes the document shown.
 *
 * @type {Type<DocumentStoreInstance>}
 */
export const DocumentStore: Type<DocumentStoreInstance> = createDocumentStore();
