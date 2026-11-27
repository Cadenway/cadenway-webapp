import {
  DestroyRef,
  inject,
  resource,
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

import { hasProblemCode, OrganizationSwitchPendingError } from '@core/api';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
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
   * boundary. A save or a logo change writes the latest organization into it.
   *
   * @type {ResourceRef<OrganizationProfile | undefined>}
   * @readonly
   */
  readonly organization: ResourceRef<OrganizationProfile | undefined>;

  /**
   * Property logo
   *
   * @description
   * The read of the logo image as an object URL, a secondary read keyed by the logo reference;
   * idle without a logo. A failure shows the initials.
   *
   * @type {ResourceRef<string | undefined>}
   * @readonly
   */
  readonly logo: ResourceRef<string | undefined>;

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
   * The object URL of the logo image, or null while there is none to show.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  readonly logoUrl: Signal<string | null>;

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
   * @returns {Promise<OrganizationSaveResult>} How the save ended.
   */
  save(change: OrganizationProfileChange): Promise<OrganizationSaveResult>;

  /**
   * Method uploadLogo
   *
   * @description
   * Checks, reserves, sends and publishes a new logo, then reads the organization again.
   *
   * @param {File} file - The picked file.
   * @returns {Promise<OrganizationLogoOutcome>} How the change ended.
   */
  uploadLogo(file: File): Promise<OrganizationLogoOutcome>;

  /**
   * Method removeLogo
   *
   * @description
   * Removes the logo, then reads the organization again.
   *
   * @returns {Promise<OrganizationLogoOutcome>} How the change ended.
   */
  removeLogo(): Promise<OrganizationLogoOutcome>;
  // #endregion
}

/**
 * Function logoOutcomeOf
 *
 * @description
 * The outcome of a refused logo change.
 *
 * @param {unknown} error - The refusal.
 * @returns {OrganizationLogoOutcome} How it ended.
 */
function logoOutcomeOf(error: unknown): OrganizationLogoOutcome {
  if (
    error instanceof OrganizationSwitchPendingError ||
    hasProblemCode(error, 'organization.context-changed')
  ) {
    return 'context-changed';
  }
  if (hasProblemCode(error, 'request.version-mismatch')) return 'outdated';
  if (hasProblemCode(error, 'media.unsupported-type')) return 'unsupported';
  if (hasProblemCode(error, 'media.file-too-large')) return 'too-large';
  if (hasProblemCode(error, 'media.invalid-image')) return 'invalid-image';
  return 'failed';
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
      // Object URLs of the logo images read, revoked once replaced and with the store.
      const urls: string[] = [];
      const organization: ResourceRef<OrganizationProfile | undefined> = resource({
        params: (): string => workspace.organization().id,
        loader: (): Promise<OrganizationProfile> => api.current(),
      });
      return {
        organization,
        logo: resource({
          params: (): { readonly organizationId: string; readonly logoId: string } | undefined => {
            if (!organization.hasValue()) return undefined;
            const shown: OrganizationProfile = organization.value();
            return shown.logoId === null
              ? undefined
              : { organizationId: shown.id, logoId: shown.logoId };
          },
          loader: async (): Promise<string> => {
            const url: string = URL.createObjectURL(await api.logo());
            for (const previous of urls.splice(0)) URL.revokeObjectURL(previous);
            urls.push(url);
            return url;
          },
        }),
        _revokeLogos: (): void => {
          for (const url of urls.splice(0)) URL.revokeObjectURL(url);
        },
      };
    }),
    withComputed((store) => ({
      current: (): OrganizationProfile | null =>
        store.organization.hasValue() ? store.organization.value() : null,
      logoUrl: (): string | null => {
        const shown: OrganizationProfile | null = store.organization.hasValue()
          ? store.organization.value()
          : null;
        if ((shown?.logoId ?? null) === null) return null;
        return store.logo.hasValue() ? store.logo.value() : null;
      },
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
        // Reads the organization after a logo change, for its logo reference and version; a failed
        // read leaves it to a background reload.
        const refresh: (stillWanted: () => boolean) => Promise<void> = async (
          stillWanted: () => boolean,
        ): Promise<void> => {
          try {
            const latest: OrganizationProfile = await api.current();
            if (stillWanted()) store.organization.set(latest);
          } catch {
            if (stillWanted()) store.organization.reload();
          }
        };
        const idle: () => boolean = (): boolean => !store.saving() && store.logoChange() === null;

        const save: (change: OrganizationProfileChange) => Promise<OrganizationSaveResult> = async (
          change: OrganizationProfileChange,
        ): Promise<OrganizationSaveResult> => {
          const current: OrganizationProfile | null = store.current();
          if (current === null || !idle() || Object.keys(change).length === 0) {
            return { outcome: 'skipped' };
          }
          const stillWanted: () => boolean = wantedFor(current.id);
          patchState(store, { saving: true });
          try {
            const updated: OrganizationProfile = await api.update(change, current.version);
            if (!stillWanted()) return { outcome: 'cancelled' };
            store.organization.set(updated);
            return {
              outcome: 'saved',
              slug: updated.slug,
              slugChanged: updated.slug !== current.slug,
            };
          } catch (error: unknown) {
            if (!stillWanted()) return { outcome: 'cancelled' };
            if (
              error instanceof OrganizationSwitchPendingError ||
              hasProblemCode(error, 'organization.context-changed')
            ) {
              return { outcome: 'context-changed' };
            }
            if (hasProblemCode(error, 'request.version-mismatch')) {
              store.organization.reload();
              return { outcome: 'outdated' };
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
            const saving: Promise<OrganizationSaveResult> = save(change);
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
              await api.sendLogo(upload, file);
              if (!stillWanted()) return 'cancelled';
              await api.publishLogo(upload.uploadId, store.current()?.version ?? current.version);
              if (!stillWanted()) return 'cancelled';
              await refresh(stillWanted);
              return 'updated';
            } catch (error: unknown) {
              if (!stillWanted()) return 'cancelled';
              const outcome: OrganizationLogoOutcome = logoOutcomeOf(error);
              if (outcome === 'outdated') store.organization.reload();
              return outcome;
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
              return 'removed';
            } catch (error: unknown) {
              if (!stillWanted()) return 'cancelled';
              const outcome: OrganizationLogoOutcome = logoOutcomeOf(error);
              if (outcome === 'outdated') store.organization.reload();
              return outcome;
            } finally {
              patchState(store, { logoChange: null });
            }
          },
        };
      },
    ),
    withHooks((store) => ({
      onDestroy(): void {
        store._revokeLogos();
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
 * another organization reads that one's. The logo image is a secondary read keyed by the logo
 * reference, shown through an object URL the store revokes once replaced and when it goes away.
 *
 * A save sends only what changed, from the version read (`If-Match`). A logo change reserves an
 * upload, sends the image to its signed destination and publishes it, or removes the logo, each
 * from the organization's version, then reads the organization again for its new reference and
 * version. One write runs at a time: a save, an upload or a removal started while another runs
 * is skipped. Each is bound to the organization shown when it starts and to the page: once either
 * changes it sends nothing more, drops any late answer and ends `cancelled`. A stale version
 * (`412 request.version-mismatch`) reads the organization again; a changed organization context
 * (`412 organization.context-changed`, or a switch in progress) ends `context-changed`, which the
 * workspace recovery takes over.
 *
 * @type {ReturnType<typeof createOrganizationProfileStore>}
 */
export const OrganizationProfileStore: ReturnType<typeof createOrganizationProfileStore> =
  createOrganizationProfileStore();
