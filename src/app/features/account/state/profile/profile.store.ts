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

import { hasProblemCode, readProblem } from '@core/api';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { AccountChangedError } from '../../data-access/services/notification-preferences-api/account-changed.error';
import { ProfileApi } from '../../data-access/services/profile-api/profile-api.service';
import type {
  AccountProfile,
  AvatarOutcome,
  AvatarUpload,
  DeletionResult,
  EmailChangeCode,
  EmailConfirmOutcome,
  EmailRequestResult,
  MyOrganization,
  ProfileChange,
  ProfileField,
  ProfileSaveResult,
} from '../../models/profile/profile.interface';
import { ReauthenticationCancelledError } from '../../reauthentication/reauthentication-cancelled.error';
import { ReauthenticationService } from '../../reauthentication/reauthentication.service';

/**
 * Constant AVATAR_TYPES
 *
 * @description
 * The media types a photo may have (`AvatarUploadContentType`).
 *
 * @type {readonly string[]}
 */
const AVATAR_TYPES: readonly string[] = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * Constant MAX_AVATAR_BYTES
 *
 * @description
 * The largest photo source the contract accepts: 5 MiB.
 *
 * @type {number}
 */
const MAX_AVATAR_BYTES: number = 5 * 1024 * 1024;

/**
 * Constant RECHECK_DELAYS
 *
 * @description
 * When a write whose answer was lost is checked, in milliseconds after the previous check: at
 * once, then 2, 4 and 8 s later, since the write may still land after the first reread.
 *
 * @type {readonly number[]}
 */
const RECHECK_DELAYS: readonly number[] = [0, 2000, 4000, 8000];

/**
 * Type Settlement
 *
 * @description
 * What the rereads after a lost answer showed: `held` once the account holds the change;
 * `not-held` when it was read but never held it; `unread` when it could not be read at all;
 * `cancelled` when the account or the page changed meanwhile.
 *
 * @type {'held' | 'not-held' | 'unread' | 'cancelled'}
 */
type Settlement = 'held' | 'not-held' | 'unread' | 'cancelled';

/**
 * Function pause
 *
 * @description
 * Waits before the next check.
 *
 * @param {number} milliseconds - The wait.
 * @returns {Promise<void>} Resolves once it elapsed.
 */
function pause(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve: () => void) => {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * Type AvatarChange
 *
 * @description
 * The photo change under way: an upload or a removal, or none.
 *
 * @type {'upload' | 'remove' | null}
 */
type AvatarChange = 'upload' | 'remove' | null;

/**
 * Interface ProfileState
 *
 * @description
 * What the store holds besides the reads.
 */
interface ProfileState {
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
   * Property avatarChange
   *
   * @description
   * The photo change under way.
   *
   * @type {AvatarChange}
   * @readonly
   */
  readonly avatarChange: AvatarChange;

  /**
   * Property refreshFailedFor
   *
   * @description
   * The account whose reread after a write failed, so what the page shows may lag behind the
   * gateway; null once a read or a write confirmed it.
   *
   * @type {string | null}
   * @readonly
   */
  readonly refreshFailedFor: string | null;

  /**
   * Property refreshing
   *
   * @description
   * Whether `retryRefresh()` is reading the account again.
   *
   * @type {boolean}
   * @readonly
   */
  readonly refreshing: boolean;

  /**
   * Property emailPending
   *
   * @description
   * Whether a request or a confirmation of the e-mail change is on its way.
   *
   * @type {boolean}
   * @readonly
   */
  readonly emailPending: boolean;

  /**
   * Property deleting
   *
   * @description
   * Whether the deletion is on its way, the reauthentication included.
   *
   * @type {boolean}
   * @readonly
   */
  readonly deleting: boolean;

  /**
   * Property deleted
   *
   * @description
   * Whether the deletion is scheduled: the session is gone and the page leaves for the signed-out
   * screen.
   *
   * @type {boolean}
   * @readonly
   */
  readonly deleted: boolean;
  // #endregion
}

/**
 * Interface ProfileStoreInstance
 *
 * @description
 * The signed-in account of the `Profile` section, its photo and their changes.
 */
interface ProfileStoreInstance {
  // #region Properties
  /**
   * Property profile
   *
   * @description
   * The read of the account, the page's primary read: a rejection reaches the route's error
   * boundary. A save, a reread, a photo change or a confirmed address writes the latest account
   * into it.
   *
   * @type {ResourceRef<AccountProfile | undefined>}
   * @readonly
   */
  readonly profile: ResourceRef<AccountProfile | undefined>;

  /**
   * Property avatar
   *
   * @description
   * The read of the photo image, a secondary read keyed by `<account id>:<avatar id>`; idle
   * without a photo.
   *
   * @type {ResourceRef<Blob | undefined>}
   * @readonly
   */
  readonly avatar: ResourceRef<Blob | undefined>;

  /**
   * Property current
   *
   * @description
   * The saved account, or null while it is read or when the read failed.
   *
   * @type {Signal<AccountProfile | null>}
   * @readonly
   */
  readonly current: Signal<AccountProfile | null>;

  /**
   * Property avatarUrl
   *
   * @description
   * The object URL of the photo image, or null while there is none to show. The URL it replaces is
   * revoked once the new one is shown, as soon as the account has no photo, and with the store.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  readonly avatarUrl: Signal<string | null>;

  /**
   * Property avatarFailed
   *
   * @description
   * Whether the image of the account's photo could not be read; `retryAvatar()` reads it again.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly avatarFailed: Signal<boolean>;

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
   * Property avatarChange
   *
   * @description
   * The photo change under way.
   *
   * @type {Signal<AvatarChange>}
   * @readonly
   */
  readonly avatarChange: Signal<AvatarChange>;

  /**
   * Property refreshFailed
   *
   * @description
   * Whether the reread after a write failed for the account shown.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly refreshFailed: Signal<boolean>;

  /**
   * Property refreshing
   *
   * @description
   * Whether `retryRefresh()` runs.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly refreshing: Signal<boolean>;

  /**
   * Property emailPending
   *
   * @description
   * Whether a request or a confirmation of the e-mail change is on its way.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly emailPending: Signal<boolean>;

  /**
   * Property deleting
   *
   * @description
   * Whether the deletion is on its way.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly deleting: Signal<boolean>;

  /**
   * Property deleted
   *
   * @description
   * Whether the deletion is scheduled.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly deleted: Signal<boolean>;
  // #endregion

  // #region Methods
  /**
   * Method sent
   *
   * @description
   * Waits for the save or the photo change on its way to settle; resolves at once when none is.
   *
   * @returns {Promise<void>} Settles once nothing is on its way.
   */
  sent(): Promise<void>;

  /**
   * Method retryAvatar
   *
   * @description
   * Reads the image of the photo again after a failed read.
   */
  retryAvatar(): void;

  /**
   * Method save
   *
   * @description
   * Sends a change from the current version.
   *
   * @param {ProfileChange} change - What changes.
   * @returns {Promise<ProfileSaveResult>} How the save ended.
   */
  save(change: ProfileChange): Promise<ProfileSaveResult>;

  /**
   * Method uploadAvatar
   *
   * @description
   * Checks, reserves, sends and publishes a new photo, then reads the account again.
   *
   * @param {File} file - The picked file.
   * @returns {Promise<AvatarOutcome>} How the change ended.
   */
  uploadAvatar(file: File): Promise<AvatarOutcome>;

  /**
   * Method removeAvatar
   *
   * @description
   * Removes the photo, then reads the account again.
   *
   * @returns {Promise<AvatarOutcome>} How the change ended.
   */
  removeAvatar(): Promise<AvatarOutcome>;

  /**
   * Method retryRefresh
   *
   * @description
   * Reads the account again after a failed reread.
   *
   * @returns {Promise<boolean>} True once the account is read and shown.
   */
  retryRefresh(): Promise<boolean>;

  /**
   * Method requestEmailChange
   *
   * @description
   * Asks for a code at a new address, through the reauthentication; asking again for the same
   * address resends the code.
   *
   * @param {string} email - The new address, trimmed.
   * @returns {Promise<EmailRequestResult>} How the request ended.
   */
  requestEmailChange(email: string): Promise<EmailRequestResult>;

  /**
   * Method confirmEmailChange
   *
   * @description
   * Confirms the new address with its code.
   *
   * @param {string} code - The 6 digits.
   * @param {string} email - The new address the code was sent to.
   * @returns {Promise<EmailConfirmOutcome>} How the confirmation ended.
   */
  confirmEmailChange(code: string, email: string): Promise<EmailConfirmOutcome>;

  /**
   * Method organizations
   *
   * @description
   * Reads the person's organizations, which the account deletion names.
   *
   * @returns {Promise<readonly MyOrganization[] | null>} The organizations, or null when the read
   * failed or the account or the page changed meanwhile.
   */
  organizations(): Promise<readonly MyOrganization[] | null>;

  /**
   * Method scheduleDeletion
   *
   * @description
   * Schedules the deletion of the account, through the reauthentication.
   *
   * @returns {Promise<DeletionResult>} How it ended.
   */
  scheduleDeletion(): Promise<DeletionResult>;
  // #endregion
}

/**
 * Function avatarOutcomeOf
 *
 * @description
 * The outcome of a refused photo change; `409 media.upload-not-ready`, `upload-expired` and
 * `upload-superseded` are failures.
 *
 * @param {unknown} error - The refusal.
 * @returns {AvatarOutcome} How it ended.
 */
function avatarOutcomeOf(error: unknown): AvatarOutcome {
  if (error instanceof AccountChangedError) return 'cancelled';
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
 * Whether the transfer to storage ended without telling its outcome (no answer, a timeout `408` or
 * a server failure `5xx`): storage may have received the image, so the contract asks to try
 * publishing the same upload before giving up.
 *
 * @param {unknown} error - The transfer's failure.
 * @returns {boolean} True when the outcome is unknown.
 */
function isUncertainTransfer(error: unknown): boolean {
  const status: number | undefined = readProblem(error)?.status;
  return status === 0 || status === 408 || (status !== undefined && status >= 500);
}

/**
 * Function isUnknownOutcome
 *
 * @description
 * Whether a write ended without telling whether the gateway applied it: no HTTP answer (status 0,
 * or an error that is not one, the account check excepted), a timeout (`408`) or a server failure
 * (`5xx`).
 *
 * @param {unknown} error - The failure.
 * @returns {boolean} True when the change may have been applied.
 */
function isUnknownOutcome(error: unknown): boolean {
  if (error instanceof AccountChangedError || error instanceof ReauthenticationCancelledError) {
    return false;
  }
  const status: number | undefined = readProblem(error)?.status;
  return status === undefined || status === 0 || status === 408 || status >= 500;
}

/**
 * Function holds
 *
 * @description
 * Whether a saved account already holds every member of a change.
 *
 * @param {AccountProfile} profile - The saved account.
 * @param {ProfileChange} change - The change.
 * @returns {boolean} True when nothing of the change is missing.
 */
function holds(profile: AccountProfile, change: ProfileChange): boolean {
  return (Object.keys(change) as (keyof ProfileChange)[]).every(
    (field: keyof ProfileChange): boolean => profile[field] === change[field],
  );
}

/**
 * Function createProfileStore
 *
 * @description
 * Creates the profile store.
 *
 * @returns {Type<ProfileStoreInstance>} Injectable store constructor.
 */
function createProfileStore(): Type<ProfileStoreInstance> {
  return signalStore(
    withState<ProfileState>({
      saving: false,
      avatarChange: null,
      refreshFailedFor: null,
      refreshing: false,
      emailPending: false,
      deleting: false,
      deleted: false,
    }),
    withProps(() => {
      const api: ProfileApi = inject(ProfileApi);
      const workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);
      const profile: ResourceRef<AccountProfile | undefined> = resource<AccountProfile, string>({
        params: (): string => workspace.user().id,
        loader: ({ params, abortSignal }: ResourceLoaderParams<string>): Promise<AccountProfile> =>
          api.current(params, abortSignal),
      });
      const avatar: ResourceRef<Blob | undefined> = resource<Blob, string | undefined>({
        params: (): string | undefined => {
          if (!profile.hasValue()) return undefined;
          const shown: AccountProfile = profile.value();
          return shown.avatarId === null ? undefined : `${shown.id}:${shown.avatarId}`;
        },
        loader: async ({
          params,
          abortSignal,
        }: ResourceLoaderParams<string | undefined>): Promise<Blob> => {
          // The key is `<account id>:<avatar id>`; neither holds a colon.
          const image: Blob = await api.avatar(params.slice(0, params.indexOf(':')), abortSignal);
          abortSignal.throwIfAborted();
          return image;
        },
      });
      // The image to show: the photo's, only while the account shown has a photo.
      const image: Signal<Blob | null> = computed((): Blob | null => {
        if (!profile.hasValue() || profile.value().avatarId === null) return null;
        return avatar.hasValue() ? avatar.value() : null;
      });
      // The object URL shown, revoked once another replaces it and with the store.
      let shownUrl: string | null = null;
      const avatarUrl: Signal<string | null> = linkedSignal<Blob | null, string | null>({
        source: image,
        computation: (next: Blob | null): string | null => {
          if (shownUrl !== null) URL.revokeObjectURL(shownUrl);
          shownUrl = next === null ? null : URL.createObjectURL(next);
          return shownUrl;
        },
      });
      return {
        profile,
        avatar,
        avatarUrl,
        _revokeAvatar: (): void => {
          if (shownUrl !== null) URL.revokeObjectURL(shownUrl);
          shownUrl = null;
        },
      };
    }),
    withComputed((store, workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT)) => ({
      current: (): AccountProfile | null =>
        store.profile.hasValue() ? store.profile.value() : null,
      refreshFailed: (): boolean => store.refreshFailedFor() === workspace.user().id,
      avatarFailed: (): boolean =>
        store.profile.hasValue() &&
        store.profile.value().avatarId !== null &&
        store.avatar.status() === 'error',
    })),
    withMethods(
      (
        store,
        api: ProfileApi = inject(ProfileApi),
        workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT),
        reauthentication: ReauthenticationService = inject(ReauthenticationService),
        destroyRef: DestroyRef = inject(DestroyRef),
      ) => {
        // The save on its way, which `sent()` waits for.
        let pending: Promise<unknown> | null = null;
        // Whether a change started for the account shown is still wanted: the workspace shows the
        // same account and the page is still there.
        const wantedFor: (userId: string) => () => boolean =
          (userId: string): (() => boolean) =>
          (): boolean =>
            !destroyRef.destroyed && workspace.user().id === userId;
        // Shows an account the gateway confirmed, which ends a failed reread.
        const confirm: (profile: AccountProfile) => void = (profile: AccountProfile): void => {
          store.profile.set(profile);
          patchState(store, { refreshFailedFor: null });
        };
        // Reads the account again after a write. A failure never reloads the primary read (its
        // error would replace the page and the draft): the last confirmed account stays, and the
        // page shows that it could not be refreshed.
        const refresh: (
          userId: string,
          stillWanted: () => boolean,
        ) => Promise<AccountProfile | null> = async (
          userId: string,
          stillWanted: () => boolean,
        ): Promise<AccountProfile | null> => {
          try {
            const latest: AccountProfile = await api.current(userId);
            if (!stillWanted()) return null;
            confirm(latest);
            return latest;
          } catch {
            if (stillWanted()) patchState(store, { refreshFailedFor: userId });
            return null;
          }
        };
        // Checks a write whose answer was lost: reads the account at once, then 2, 4 and 8 s later,
        // until it holds the change. Each read shows the account it brings; when none could be
        // read, the page shows that it could not be refreshed.
        const settle: (
          userId: string,
          stillWanted: () => boolean,
          held: (profile: AccountProfile) => boolean,
        ) => Promise<Settlement> = async (
          userId: string,
          stillWanted: () => boolean,
          held: (profile: AccountProfile) => boolean,
        ): Promise<Settlement> => {
          let read: boolean = false;
          for (const delay of RECHECK_DELAYS) {
            if (delay > 0) await pause(delay);
            if (!stillWanted()) return 'cancelled';
            try {
              const latest: AccountProfile = await api.current(userId);
              if (!stillWanted()) return 'cancelled';
              confirm(latest);
              read = true;
              if (held(latest)) return 'held';
            } catch {
              if (!stillWanted()) return 'cancelled';
            }
          }
          if (!read) patchState(store, { refreshFailedFor: userId });
          return read ? 'not-held' : 'unread';
        };
        // Keeps a write on its way for `sent()`.
        const track: <T>(write: Promise<T>) => Promise<T> = <T>(write: Promise<T>): Promise<T> => {
          pending = write;
          void write.finally((): void => {
            if (pending === write) pending = null;
          });
          return write;
        };
        const idle: () => boolean = (): boolean =>
          !store.saving() && store.avatarChange() === null && !store.deleting();

        const send: (
          current: AccountProfile,
          change: ProfileChange,
        ) => Promise<ProfileSaveResult> = async (
          current: AccountProfile,
          change: ProfileChange,
        ): Promise<ProfileSaveResult> => {
          const stillWanted: () => boolean = wantedFor(current.id);
          patchState(store, { saving: true });
          try {
            const updated: AccountProfile = await api.update(change, current.version, current.id);
            if (!stillWanted()) return { outcome: 'cancelled' };
            confirm(updated);
            return { outcome: 'saved' };
          } catch (error: unknown) {
            if (!stillWanted() || error instanceof AccountChangedError) {
              return { outcome: 'cancelled' };
            }
            if (hasProblemCode(error, 'request.version-mismatch')) {
              const latest: AccountProfile | null = await refresh(current.id, stillWanted);
              if (!stillWanted()) return { outcome: 'cancelled' };
              return latest === null ? { outcome: 'unreconciled' } : { outcome: 'outdated' };
            }
            if (hasProblemCode(error, 'request.invalid')) {
              const fields: readonly ProfileField[] = api.refusedFields(error);
              if (fields.length > 0) {
                return {
                  outcome: 'refused',
                  refusals: fields.map((field: ProfileField) => ({ field })),
                };
              }
            }
            if (isUnknownOutcome(error)) {
              const settled: Settlement = await settle(
                current.id,
                stillWanted,
                (latest: AccountProfile): boolean => holds(latest, change),
              );
              if (settled === 'held') return { outcome: 'saved' };
              if (settled === 'not-held') return { outcome: 'unconfirmed' };
              return settled === 'unread' ? { outcome: 'unreconciled' } : { outcome: 'cancelled' };
            }
            return { outcome: 'failed' };
          } finally {
            patchState(store, { saving: false });
          }
        };

        // Ends a refused photo change: a stale version reads the account again first.
        const refusedAvatar: (
          error: unknown,
          userId: string,
          stillWanted: () => boolean,
        ) => Promise<AvatarOutcome> = async (
          error: unknown,
          userId: string,
          stillWanted: () => boolean,
        ): Promise<AvatarOutcome> => {
          if (!stillWanted()) return 'cancelled';
          const outcome: AvatarOutcome = avatarOutcomeOf(error);
          if (outcome !== 'outdated') return outcome;
          const latest: AccountProfile | null = await refresh(userId, stillWanted);
          if (!stillWanted()) return 'cancelled';
          return latest === null ? 'unreconciled' : 'outdated';
        };
        // Ends a publication or a removal whose answer was lost: done only once the account shows
        // the reference this write sets (`expected`), so a photo change made elsewhere meanwhile
        // never confirms it. A publication sets the reserved upload's id, which the contract
        // reuses for the published asset (`ProfileMediaId`); a removal sets none.
        const lostAvatar: (
          outcome: 'updated' | 'removed',
          expected: string | null,
          userId: string,
          stillWanted: () => boolean,
        ) => Promise<AvatarOutcome> = async (
          outcome: 'updated' | 'removed',
          expected: string | null,
          userId: string,
          stillWanted: () => boolean,
        ): Promise<AvatarOutcome> => {
          const settled: Settlement = await settle(
            userId,
            stillWanted,
            (latest: AccountProfile): boolean => latest.avatarId === expected,
          );
          if (settled === 'held') return outcome;
          if (settled === 'not-held') return 'unconfirmed';
          return settled === 'unread' ? 'unreconciled' : 'cancelled';
        };
        // Ends an applied photo change once the account is read again.
        const appliedAvatar: (
          outcome: 'updated' | 'removed',
          userId: string,
          stillWanted: () => boolean,
        ) => Promise<AvatarOutcome> = async (
          outcome: 'updated' | 'removed',
          userId: string,
          stillWanted: () => boolean,
        ): Promise<AvatarOutcome> => {
          const latest: AccountProfile | null = await refresh(userId, stillWanted);
          if (!stillWanted()) return 'cancelled';
          return latest === null ? 'unreconciled' : outcome;
        };

        // Reserves, sends and publishes a photo, then reads the account again.
        const upload: (current: AccountProfile, file: File) => Promise<AvatarOutcome> = async (
          current: AccountProfile,
          file: File,
        ): Promise<AvatarOutcome> => {
          const stillWanted: () => boolean = wantedFor(current.id);
          patchState(store, { avatarChange: 'upload' });
          try {
            const reserved: AvatarUpload = await api.reserveAvatar(file, current.id);
            if (!stillWanted()) return 'cancelled';
            try {
              await api.sendAvatar(reserved, file);
            } catch (error: unknown) {
              // Storage may have the image: publishing the same upload once tells, and its
              // refusal (`409 media.upload-not-ready` among others) ends the change.
              if (!isUncertainTransfer(error)) throw error;
            }
            if (!stillWanted()) return 'cancelled';
            try {
              await api.publishAvatar(
                reserved.uploadId,
                store.current()?.version ?? current.version,
                current.id,
              );
            } catch (error: unknown) {
              if (!stillWanted() || !isUnknownOutcome(error)) throw error;
              return await lostAvatar('updated', reserved.uploadId, current.id, stillWanted);
            }
            if (!stillWanted()) return 'cancelled';
            return await appliedAvatar('updated', current.id, stillWanted);
          } catch (error: unknown) {
            return await refusedAvatar(error, current.id, stillWanted);
          } finally {
            patchState(store, { avatarChange: null });
          }
        };
        // Removes the photo, then reads the account again.
        const remove: (current: AccountProfile) => Promise<AvatarOutcome> = async (
          current: AccountProfile,
        ): Promise<AvatarOutcome> => {
          const stillWanted: () => boolean = wantedFor(current.id);
          patchState(store, { avatarChange: 'remove' });
          try {
            await api.removeAvatar(current.version, current.id);
            if (!stillWanted()) return 'cancelled';
            return await appliedAvatar('removed', current.id, stillWanted);
          } catch (error: unknown) {
            if (stillWanted() && isUnknownOutcome(error)) {
              return await lostAvatar('removed', null, current.id, stillWanted);
            }
            return await refusedAvatar(error, current.id, stillWanted);
          } finally {
            patchState(store, { avatarChange: null });
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

          retryAvatar(): void {
            if (store.avatarFailed()) store.avatar.reload();
          },

          save(change: ProfileChange): Promise<ProfileSaveResult> {
            const current: AccountProfile | null = store.current();
            if (current === null || !idle() || Object.keys(change).length === 0) {
              return Promise.resolve({ outcome: 'skipped' });
            }
            return track(send(current, change));
          },

          uploadAvatar(file: File): Promise<AvatarOutcome> {
            const current: AccountProfile | null = store.current();
            if (current === null || !idle()) return Promise.resolve('skipped');
            if (!AVATAR_TYPES.includes(file.type)) return Promise.resolve('unsupported');
            if (file.size === 0) return Promise.resolve('unreadable');
            if (file.size > MAX_AVATAR_BYTES) return Promise.resolve('too-large');
            return track(upload(current, file));
          },

          removeAvatar(): Promise<AvatarOutcome> {
            const current: AccountProfile | null = store.current();
            if (current === null || !idle() || current.avatarId === null) {
              return Promise.resolve('skipped');
            }
            return track(remove(current));
          },

          async retryRefresh(): Promise<boolean> {
            const current: AccountProfile | null = store.current();
            if (current === null || store.refreshing()) return false;
            const stillWanted: () => boolean = wantedFor(current.id);
            patchState(store, { refreshing: true });
            try {
              return (await refresh(current.id, stillWanted)) !== null;
            } finally {
              patchState(store, { refreshing: false });
            }
          },

          async requestEmailChange(email: string): Promise<EmailRequestResult> {
            const current: AccountProfile | null = store.current();
            if (current === null || store.emailPending()) return { outcome: 'cancelled' };
            const stillWanted: () => boolean = wantedFor(current.id);
            patchState(store, { emailPending: true });
            try {
              const code: EmailChangeCode = await reauthentication.run(() => {
                if (!stillWanted()) throw new AccountChangedError();
                return api.requestEmailChange(email, current.id);
              });
              return stillWanted() ? { outcome: 'sent', code } : { outcome: 'cancelled' };
            } catch (error: unknown) {
              if (
                !stillWanted() ||
                error instanceof AccountChangedError ||
                error instanceof ReauthenticationCancelledError
              ) {
                return { outcome: 'cancelled' };
              }
              const refusal: 'invalid' | 'unchanged' | 'taken' | 'throttled' | null =
                hasProblemCode(error, 'auth.email-unchanged')
                  ? 'unchanged'
                  : hasProblemCode(error, 'auth.email-taken')
                    ? 'taken'
                    : hasProblemCode(error, 'auth.code-throttled')
                      ? 'throttled'
                      : hasProblemCode(error, 'request.invalid')
                        ? 'invalid'
                        : null;
              if (refusal === null) return { outcome: 'failed' };
              return {
                outcome: 'refused',
                reason: refusal,
                resendAvailableAt: api.resendAvailableAt(error),
              };
            } finally {
              patchState(store, { emailPending: false });
            }
          },

          async confirmEmailChange(code: string, email: string): Promise<EmailConfirmOutcome> {
            const current: AccountProfile | null = store.current();
            if (current === null || store.emailPending()) return 'cancelled';
            const stillWanted: () => boolean = wantedFor(current.id);
            patchState(store, { emailPending: true });
            try {
              const updated: AccountProfile = await api.confirmEmailChange(code, current.id);
              if (!stillWanted()) return 'cancelled';
              confirm(updated);
              return 'confirmed';
            } catch (error: unknown) {
              if (!stillWanted() || error instanceof AccountChangedError) return 'cancelled';
              if (
                hasProblemCode(error, 'auth.code-invalid') ||
                hasProblemCode(error, 'auth.code-expired') ||
                hasProblemCode(error, 'request.invalid')
              ) {
                return 'wrong-code';
              }
              if (hasProblemCode(error, 'auth.email-taken')) return 'taken';
              if (isUnknownOutcome(error)) {
                // The address may have changed, or still change: the account read again tells.
                const settled: Settlement = await settle(
                  current.id,
                  stillWanted,
                  (latest: AccountProfile): boolean =>
                    latest.email.toLowerCase() === email.toLowerCase(),
                );
                if (settled === 'held') return 'confirmed';
                return settled === 'cancelled' ? 'cancelled' : 'unconfirmed';
              }
              return 'failed';
            } finally {
              patchState(store, { emailPending: false });
            }
          },

          async organizations(): Promise<readonly MyOrganization[] | null> {
            const current: AccountProfile | null = store.current();
            if (current === null) return null;
            const stillWanted: () => boolean = wantedFor(current.id);
            try {
              const organizations: readonly MyOrganization[] = await api.myOrganizations(
                current.id,
              );
              return stillWanted() ? organizations : null;
            } catch {
              return null;
            }
          },

          async scheduleDeletion(): Promise<DeletionResult> {
            const current: AccountProfile | null = store.current();
            if (current === null || !idle()) return { outcome: 'cancelled' };
            const stillWanted: () => boolean = wantedFor(current.id);
            patchState(store, { deleting: true });
            try {
              await reauthentication.run(() => {
                if (!stillWanted()) throw new AccountChangedError();
                return api.scheduleDeletion(current.id);
              });
              if (!stillWanted()) return { outcome: 'cancelled' };
              patchState(store, { deleted: true });
              return { outcome: 'scheduled' };
            } catch (error: unknown) {
              if (
                !stillWanted() ||
                error instanceof AccountChangedError ||
                error instanceof ReauthenticationCancelledError
              ) {
                return { outcome: 'cancelled' };
              }
              if (hasProblemCode(error, 'account.organization-owner')) {
                return {
                  outcome: 'owner',
                  organizationIds: api.ownedOrganizationIds(error),
                };
              }
              // A deletion whose answer was lost may still commit after any reread, and a session
              // that no longer reads the account proves nothing either (`401 auth.session-expired`
              // covers a revoked and an ended session alike): only the gateway's answer decides.
              if (isUnknownOutcome(error)) return { outcome: 'unconfirmed' };
              return { outcome: 'failed' };
            } finally {
              patchState(store, { deleting: false });
            }
          },
        };
      },
    ),
    withHooks((store) => ({
      onDestroy(): void {
        store._revokeAvatar();
      },
    })),
  );
}

/**
 * Constant ProfileStore
 *
 * @description
 * The signed-in account for the `Profile` section, provided by its page. The read is the page's
 * primary read, keyed by the workspace's account; the photo image is a secondary read keyed by
 * `<account id>:<avatar id>`, so a save that keeps the photo reads no image again; its request is
 * aborted when the key changes. The image shows through an object URL revoked once replaced, as
 * soon as the account has no photo, and with the store.
 *
 * A save sends only what changed, from the version read (`If-Match`). A photo change reserves an
 * upload, sends the image to its signed destination and publishes it (a transfer that ended
 * without telling its outcome, no answer, a `408` or a `5xx`, publishes the same upload once
 * before failing), or removes the photo, each from the account's version, then reads the account
 * again for its new reference and version. A failed read of the image sets `avatarFailed`, and
 * `retryAvatar()` reads it again. One write runs at a time: a save, a photo change or the deletion
 * started while another runs is skipped, and `sent()` waits for the save or the photo change on
 * its way. Every write is bound to the account shown when it starts and to the page: once either
 * changes it sends nothing more, drops any late answer and ends `cancelled`; the data access also
 * checks, before sending, that the session still belongs to that account. A stale version
 * (`412 request.version-mismatch`) reads the account again before ending `outdated`.
 *
 * A write whose answer was lost (no answer, a `408` or a `5xx`: a save, the photo's publication or
 * removal, the address confirmation) may still land after a first reread, so the account is read
 * at once, then 2, 4 and 8 s later: the write is done once the account holds it (`saved`,
 * `updated`, `removed`, `confirmed`), and `unconfirmed` when it never does. When no reread
 * succeeds the write ends `unreconciled`: the last confirmed account stays and `refreshFailed`
 * holds until a read or a write confirms it; `retryRefresh()` reads it again. A reread never
 * reaches the error boundary.
 *
 * The e-mail change request and the deletion run through `ReauthenticationService`; a closed
 * reauthentication ends `cancelled`. Only the gateway's answer decides a deletion: one whose
 * answer was lost ends `unconfirmed`, without reading the account again, since it may still commit
 * after any reread and a session that no longer reads the account (`401 auth.session-expired`)
 * may have ended for another reason. A photo publication or removal whose answer was lost is
 * done only once the account shows the reference it sets: the reserved upload's id, or none.
 *
 * @type {ReturnType<typeof createProfileStore>}
 */
export const ProfileStore: ReturnType<typeof createProfileStore> = createProfileStore();
