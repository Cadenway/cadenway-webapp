import {
  computed,
  inject,
  resource,
  type ResourceRef,
  type Signal,
  type Type,
} from '@angular/core';
import { signalStore, withComputed, withMethods, withProps } from '@ngrx/signals';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import type {
  NotificationPreferenceChange,
  NotificationPreferences,
} from '../../models/notification-preferences/notification-preferences.interface';
import {
  NotificationPreferencesSync,
  withPending,
} from '../../services/notification-preferences-sync/notification-preferences-sync.service';

/**
 * Interface NotificationPreferencesStoreInstance
 *
 * @description
 * The notifications page's view of the account's preferences.
 */
export interface NotificationPreferencesStoreInstance {
  // #region Properties
  /**
   * Property saved
   *
   * @description
   * The page's primary read: loading shows the section skeleton, and its error (`value()`
   * throws) reaches the route's error boundary.
   *
   * @type {ResourceRef<NotificationPreferences | undefined>}
   * @readonly
   */
  readonly saved: ResourceRef<NotificationPreferences | undefined>;

  /**
   * Property preferences
   *
   * @description
   * The preferences shown: the newest confirmed ones with the pending changes over them, or null
   * before the read answers.
   *
   * @type {Signal<NotificationPreferences | null>}
   * @readonly
   */
  readonly preferences: Signal<NotificationPreferences | null>;
  // #endregion

  // #region Methods
  /**
   * Method change
   *
   * @description
   * Shows a setting at once and saves it through `NotificationPreferencesSync`, which keeps
   * saving once the page is gone.
   *
   * @param {NotificationPreferenceChange} change - The changed setting.
   */
  change(change: NotificationPreferenceChange): void;
  // #endregion
}

/**
 * Function createNotificationPreferencesStore
 *
 * @description
 * Creates the notification preferences store.
 *
 * @returns {Type<NotificationPreferencesStoreInstance>} Injectable store constructor.
 */
function createNotificationPreferencesStore(): Type<NotificationPreferencesStoreInstance> {
  return signalStore(
    withProps(() => {
      const sync: NotificationPreferencesSync = inject(NotificationPreferencesSync);
      const workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);
      return {
        _sync: sync,
        saved: resource({
          params: (): { userId: string } => ({ userId: workspace.user().id }),
          loader: ({
            params,
            abortSignal,
          }: {
            params: { userId: string };
            abortSignal: AbortSignal;
          }): Promise<NotificationPreferences> => sync.load(params.userId, abortSignal),
        }),
      };
    }),
    withComputed((store) => ({
      preferences: computed((): NotificationPreferences | null =>
        store.saved.hasValue()
          ? withPending(store._sync.confirmed() ?? store.saved.value(), store._sync.pending())
          : null,
      ),
    })),
    withMethods((store) => ({
      change(change: NotificationPreferenceChange): void {
        if (store.saved.hasValue()) store._sync.change(change);
      },
    })),
  );
}

/**
 * Constant NotificationPreferencesStore
 *
 * @description
 * Page-scoped on `NotificationsPage` (mockup `Compte.dc.html` lines 1646-1662): a thin view over
 * the session-scoped `NotificationPreferencesSync`, bound to the signed-in person of
 * `WORKSPACE_CONTEXT`. Its primary read (`saved`) starts from the sync's preferences, so a
 * reopened page shows the choices still pending; the preferences shown follow the sync's
 * confirmed preferences and pending changes, and `change` hands each change to the sync, which
 * saves them in order, outlives the page and restores a refused one with a toast.
 *
 * @type {Type<NotificationPreferencesStoreInstance>}
 */
export const NotificationPreferencesStore: Type<NotificationPreferencesStoreInstance> =
  createNotificationPreferencesStore();
