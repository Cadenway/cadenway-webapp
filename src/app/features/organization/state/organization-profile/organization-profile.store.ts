import {
  computed,
  DestroyRef,
  inject,
  linkedSignal,
  resource,
  type ResourceLoaderParams,
  type ResourceRef,
  type Signal,
  type Type,
} from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';

import { hasProblemCode, OrganizationSwitchPendingError, readProblem } from '@core/api';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
  type WorkspaceOrganization,
} from '@features/workspace/ports/workspace-context';

import { OrganizationApi } from '../../data-access/services/organization-api/organization-api.service';
import type {
  OrganizationField,
  OrganizationLogoOutcome,
  OrganizationLogoUpload,
  OrganizationProfile,
  OrganizationProfileChange,
  OrganizationSaveResult,
} from '../../models/organization/organization-profile.interface';

/**
 * Constant LOGO_TYPES
 *
 * @description
 * The media types a logo may have (`OrganizationLogoUploadContentType`).
 *
 * @type {readonly string[]}
 */
const LOGO_TYPES: readonly string[] = ['image/png', 'image/svg+xml'];

/**
 * Constant MAX_LOGO_BYTES
 *
 * @description
 * The largest logo source the contract accepts: 5 MiB.
 *
 * @type {number}
 */
const MAX_LOGO_BYTES: number = 5 * 1024 * 1024;

/**
 * Type LogoChange
 *
 * @description
 * The logo change under way: an upload or a removal, or none.
 *
 * @type {'upload' | 'remove' | null}
 */
type LogoChange = 'upload' | 'remove' | null;

/**
 * Interface OrganizationProfileState
 *
 * @description
 * What the store holds besides the reads.
 */
interface OrganizationProfileState {
  // #region Properties
  /**
   * Property saving
   *
   * @description
   * Whether a save of the form is on its way to the gateway.
   *
   * @type {boolean}
   * @readonly
   */
  readonly saving: boolean;

  /**
   * Property logoChange
   *
   * @description
   * The logo change under way.
   *
   * @type {LogoChange}
   * @readonly
   */
  readonly logoChange: LogoChange;
  // #endregion
}

/**
 * Interface OrganizationProfileStoreInstance
 *
 * @description
 * The current organization of the `Organization profile` section, its logo and their changes.
 */
interface OrganizationProfileStoreInstance {
  // #region Properties
  /**
   * Property organization
   *
   * @description
   * The read of the organization, the page's primary read: a rejection reaches the route's error
   * boundary. A save, a reread or a logo change writes the latest organization into it.
   *
   * @type {ResourceRef<OrganizationProfile | undefined>}
   * @readonly
   */
  readonly organization: ResourceRef<OrganizationProfile | undefined>;

  /**
   * Property logo
   *
   * @description
   * The read of the logo image, a secondary read keyed by `<organization id>:<logo id>`, so a read
   * of the organization that keeps its logo reads no image; idle without a logo.
   *
   * @type {ResourceRef<Blob | undefined>}
   * @readonly
   */
  readonly logo: ResourceRef<Blob | undefined>;

  /**
   * Property current
   *
   * @description
   * The saved organization, or null while it is read or when the read failed.
   *
   * @type {Signal<OrganizationProfile | null>}
   * @readonly
   */
  readonly current: Signal<OrganizationProfile | null>;

  /**
   * Property logoUrl
   *
   * @description
   * The object URL of the logo image, or null while there is none to show. The URL it replaces is
   * revoked once the new one is shown, and as soon as the organization has no logo.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  readonly logoUrl: Signal<string | null>;

  /**
   * Property movedTo
   *
   * @description
   * The organization's address when a read or a save shows one other than the workspace's, which
   * the page then opens; null while they agree.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  readonly movedTo: Signal<string | null>;

  /**
   * Property saving
   *
   * @description
   * Whether a save is on its way.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly saving: Signal<boolean>;

  /**
   * Property logoChange
   *
   * @description
   * The logo change under way.
   *
   * @type {Signal<LogoChange>}
   * @readonly
   */
  readonly logoChange: Signal<LogoChange>;
  // #endregion

  // #region Methods
  /**
   * Method sent
   *
   * @description
   * Waits for the save on its way to settle; resolves at once when none is.
   *
   * @returns {Promise<void>} Settles once nothing is on its way.
   */
  sent(): Promise<void>;

  /**
   * Method save
   *
   * @description
   * Sends a change from the current version.
   *
   * @param {OrganizationProfileChange} change - What changes.
   * @returns {Promise<OrganizationSaveResult>} How the save ended; `outdated` once the latest
   * version is read again.
   */
  save(change: OrganizationProfileChange): Promise<OrganizationSaveResult>;

  /**
   * Method uploadLogo
   *
   * @description
   * Checks, reserves, sends and publishes a new logo, then reads the organization again.
   *
   * @param {File} file - The picked file.
   * @returns {Promise<OrganizationLogoOutcome>} How the change ended, once the organization is read
   * again.
   */
  uploadLogo(file: File): Promise<OrganizationLogoOutcome>;

  /**
   * Method removeLogo
   *
   * @description
   * Removes the logo, then reads the organization again.
   *
   * @returns {Promise<OrganizationLogoOutcome>} How the change ended, once the organization is read
   * again.
   */
  removeLogo(): Promise<OrganizationLogoOutcome>;
  // #endregion
}

/**
 * Function isContextChange
 *
 * @description
 * Whether a refusal comes from a changed organization context, which the workspace recovery
 * handles: `412 organization.context-changed`, or a request held while a switch is in progress.
 *
 * @param {unknown} error - The refusal.
 * @returns {boolean} True for a changed context.
 */
function isContextChange(error: unknown): boolean {
  return (
    error instanceof OrganizationSwitchPendingError ||
    hasProblemCode(error, 'organization.context-changed')
  );
}

/**
 * Function logoOutcomeOf
 *
 * @description
 * The outcome of a refused logo change; `409 media.upload-not-ready`, `upload-expired` and
 * `upload-superseded` are failures.
 *
 * @param {unknown} error - The refusal.
 * @returns {OrganizationLogoOutcome} How it ended.
 */
function logoOutcomeOf(error: unknown): OrganizationLogoOutcome {
  if (isContextChange(error)) return 'context-changed';
  if (hasProblemCode(error, 'request.version-mismatch')) return 'outdated';
  if (hasProblemCode(error, 'media.unsupported-type')) return 'unsupported';
  if (hasProblemCode(error, 'media.file-too-large')) return 'too-large';
  if (hasProblemCode(error, 'media.invalid-image')) return 'invalid-image';
  return 'failed';
}

/**
 * Function isUncertainTransfer
 *
 * @description
 * Whether the transfer to storage ended without an answer (status 0): storage may have received
 * the image, so the contract asks to try publishing the same upload before giving up.
 *
 * @param {unknown} error - The transfer's failure.
 * @returns {boolean} True when the outcome is unknown.
 */
function isUncertainTransfer(error: unknown): boolean {
  return readProblem(error)?.status === 0;
}

/**
 * Function createOrganizationProfileStore
 *
 * @description
 * Creates the organization profile store.
 *
 * @returns {Type<OrganizationProfileStoreInstance>} Injectable store constructor.
 */
function createOrganizationProfileStore(): Type<OrganizationProfileStoreInstance> {
  return signalStore(
    withState<OrganizationProfileState>({ saving: false, logoChange: null }),
    withProps(() => {
      const api: OrganizationApi = inject(OrganizationApi);
      const workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);
      const organization: ResourceRef<OrganizationProfile | undefined> = resource({
        params: (): string => workspace.organization().id,
        loader: (): Promise<OrganizationProfile> => api.current(),
      });
      const logo: ResourceRef<Blob | undefined> = resource<Blob, string | undefined>({
        params: (): string | undefined => {
          if (!organization.hasValue()) return undefined;
          const shown: OrganizationProfile = organization.value();
          return shown.logoId === null ? undefined : `${shown.id}:${shown.logoId}`;
        },
        loader: async ({
          abortSignal,
        }: ResourceLoaderParams<string | undefined>): Promise<Blob> => {
          const image: Blob = await api.logo(abortSignal);
          abortSignal.throwIfAborted();
          return image;
        },
      });
      // The image to show: the logo's, only while the organization shown has a logo.
      const image: Signal<Blob | null> = computed((): Blob | null => {
        if (!organization.hasValue() || organization.value().logoId === null) return null;
        return logo.hasValue() ? logo.value() : null;
      });
      // The object URL shown, revoked once another replaces it and with the store.
      let shownUrl: string | null = null;
      const logoUrl: Signal<string | null> = linkedSignal<Blob | null, string | null>({
        source: image,
        computation: (next: Blob | null): string | null => {
          if (shownUrl !== null) URL.revokeObjectURL(shownUrl);
          shownUrl = next === null ? null : URL.createObjectURL(next);
          return shownUrl;
        },
      });
      return {
        organization,
        logo,
        logoUrl,
        movedTo: computed((): string | null => {
          if (!organization.hasValue()) return null;
          const shown: OrganizationProfile = organization.value();
          const context: WorkspaceOrganization = workspace.organization();
          return shown.id === context.id && shown.slug !== context.slug ? shown.slug : null;
        }),
        _revokeLogo: (): void => {
          if (shownUrl !== null) URL.revokeObjectURL(shownUrl);
          shownUrl = null;
        },
      };
    }),
    withComputed((store) => ({
      current: (): OrganizationProfile | null =>
        store.organization.hasValue() ? store.organization.value() : null,
    })),
    withMethods(
      (
        store,
        api: OrganizationApi = inject(OrganizationApi),
        workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT),
        destroyRef: DestroyRef = inject(DestroyRef),
      ) => {
        // The save on its way, which `sent()` waits for.
        let pending: Promise<unknown> | null = null;
        // Whether a change started for the organization shown is still wanted: the organization is
        // the same and the page is still there.
        const wantedFor: (organizationId: string) => () => boolean =
          (organizationId: string): (() => boolean) =>
          (): boolean =>
            !destroyRef.destroyed && workspace.organization().id === organizationId;
        // Reads the organization again, for a logo change's reference and version or after a
        // stale version. A changed context or a switch in progress is the workspace recovery's: it
        // reads nothing more, so the page keeps what it shows. Another failure leaves it to a
        // background reload.
        const refresh: (stillWanted: () => boolean) => Promise<void> = async (
          stillWanted: () => boolean,
        ): Promise<void> => {
          try {
            const latest: OrganizationProfile = await api.current();
            if (stillWanted()) store.organization.set(latest);
          } catch (error: unknown) {
            if (stillWanted() && !isContextChange(error)) store.organization.reload();
          }
        };
        const idle: () => boolean = (): boolean => !store.saving() && store.logoChange() === null;

        const send: (
          current: OrganizationProfile,
          change: OrganizationProfileChange,
        ) => Promise<OrganizationSaveResult> = async (
          current: OrganizationProfile,
          change: OrganizationProfileChange,
        ): Promise<OrganizationSaveResult> => {
          const stillWanted: () => boolean = wantedFor(current.id);
          patchState(store, { saving: true });
          try {
            const updated: OrganizationProfile = await api.update(change, current.version);
            if (!stillWanted()) return { outcome: 'cancelled' };
            store.organization.set(updated);
            return { outcome: 'saved' };
          } catch (error: unknown) {
            if (!stillWanted()) return { outcome: 'cancelled' };
            if (isContextChange(error)) return { outcome: 'context-changed' };
            if (hasProblemCode(error, 'request.version-mismatch')) {
              await refresh(stillWanted);
              return stillWanted() ? { outcome: 'outdated' } : { outcome: 'cancelled' };
            }
            if (hasProblemCode(error, 'organization.slug-taken')) {
              return { outcome: 'refused', refusals: [{ field: 'slug', reason: 'slug-taken' }] };
            }
            if (hasProblemCode(error, 'organization.slug-reserved')) {
              return { outcome: 'refused', refusals: [{ field: 'slug', reason: 'slug-reserved' }] };
            }
            if (hasProblemCode(error, 'request.invalid')) {
              const fields: readonly OrganizationField[] = api.refusedFields(error);
              if (fields.length > 0) {
                return {
                  outcome: 'refused',
                  refusals: fields.map((field: OrganizationField) => ({
                    field,
                    reason: 'invalid' as const,
                  })),
                };
              }
            }
            return { outcome: 'failed' };
          } finally {
            patchState(store, { saving: false });
          }
        };

        // Ends a refused logo change: a stale version reads the organization again first.
        const refusedLogo: (
          error: unknown,
          stillWanted: () => boolean,
        ) => Promise<OrganizationLogoOutcome> = async (
          error: unknown,
          stillWanted: () => boolean,
        ): Promise<OrganizationLogoOutcome> => {
          if (!stillWanted()) return 'cancelled';
          const outcome: OrganizationLogoOutcome = logoOutcomeOf(error);
          if (outcome === 'outdated') await refresh(stillWanted);
          return stillWanted() ? outcome : 'cancelled';
        };

        return {
          sent(): Promise<void> {
            return pending === null
              ? Promise.resolve()
              : pending.then(
                  (): void => undefined,
                  (): void => undefined,
                );
          },

          save(change: OrganizationProfileChange): Promise<OrganizationSaveResult> {
            const current: OrganizationProfile | null = store.current();
            if (current === null || !idle() || Object.keys(change).length === 0) {
              return Promise.resolve({ outcome: 'skipped' });
            }
            const saving: Promise<OrganizationSaveResult> = send(current, change);
            pending = saving;
            void saving.finally((): void => {
              if (pending === saving) pending = null;
            });
            return saving;
          },

          async uploadLogo(file: File): Promise<OrganizationLogoOutcome> {
            const current: OrganizationProfile | null = store.current();
            if (current === null || !idle()) return 'skipped';
            if (!LOGO_TYPES.includes(file.type)) return 'unsupported';
            if (file.size === 0) return 'unreadable';
            if (file.size > MAX_LOGO_BYTES) return 'too-large';
            // The change belongs to the organization shown when it starts: once it switches or the
            // page goes away, nothing more is sent and nothing is shown.
            const stillWanted: () => boolean = wantedFor(current.id);
            patchState(store, { logoChange: 'upload' });
            try {
              const upload: OrganizationLogoUpload = await api.reserveLogo(file);
              if (!stillWanted()) return 'cancelled';
              try {
                await api.sendLogo(upload, file);
              } catch (error: unknown) {
                // Storage may have the image: publishing the same upload once tells, and its
                // refusal (`409 media.upload-not-ready` among others) ends the change.
                if (!isUncertainTransfer(error)) throw error;
              }
              if (!stillWanted()) return 'cancelled';
              await api.publishLogo(upload.uploadId, store.current()?.version ?? current.version);
              if (!stillWanted()) return 'cancelled';
              await refresh(stillWanted);
              return stillWanted() ? 'updated' : 'cancelled';
            } catch (error: unknown) {
              return await refusedLogo(error, stillWanted);
            } finally {
              patchState(store, { logoChange: null });
            }
          },

          async removeLogo(): Promise<OrganizationLogoOutcome> {
            const current: OrganizationProfile | null = store.current();
            if (current === null || !idle()) return 'skipped';
            if (current.logoId === null) return 'skipped';
            const stillWanted: () => boolean = wantedFor(current.id);
            patchState(store, { logoChange: 'remove' });
            try {
              await api.removeLogo(current.version);
              if (!stillWanted()) return 'cancelled';
              await refresh(stillWanted);
              return stillWanted() ? 'removed' : 'cancelled';
            } catch (error: unknown) {
              return await refusedLogo(error, stillWanted);
            } finally {
              patchState(store, { logoChange: null });
            }
          },
        };
      },
    ),
    withHooks((store) => ({
      onDestroy(): void {
        store._revokeLogo();
      },
    })),
  );
}

/**
 * Constant OrganizationProfileStore
 *
 * @description
 * The current organization for the `Organization profile` section, provided by its page. The read
 * is the page's primary read, keyed by the workspace organization, so a page the router reuses for
 * another organization reads that one's. The logo image is a secondary read keyed by
 * `<organization id>:<logo id>`, so a save that keeps the logo reads no image again; its request
 * is aborted when the key changes, and an aborted read shows nothing. The image shows through an
 * object URL revoked once replaced, as soon as the organization has no logo, and with the store.
 *
 * A save sends only what changed, from the version read (`If-Match`). A logo change reserves an
 * upload, sends the image to its signed destination and publishes it (a transfer that ended
 * without an answer publishes the same upload once before failing), or removes the logo, each
 * from the organization's version, then reads the organization again for its new reference and
 * version. One write runs at a time: a save, an upload or a removal started while another runs is
 * skipped, and a skipped save leaves `sent()` waiting for the one on its way. Each is bound to the
 * organization shown when it starts and to the page: once either changes it sends nothing more,
 * drops any late answer and ends `cancelled`. A stale version (`412 request.version-mismatch`)
 * reads the organization again before ending `outdated`; a changed organization context (`412
 * organization.context-changed`, or a switch in progress) ends `context-changed` and reads
 * nothing, leaving it to the workspace recovery.
 *
 * @type {ReturnType<typeof createOrganizationProfileStore>}
 */
export const OrganizationProfileStore: ReturnType<typeof createOrganizationProfileStore> =
  createOrganizationProfileStore();
