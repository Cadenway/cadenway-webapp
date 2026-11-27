import {
  computed,
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
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';

import {
  isUncertainWrite,
  NotificationPreferencesApi,
} from '../../data-access/services/notification-preferences-api/notification-preferences-api.service';
import type {
  NotificationPreferenceChange,
  NotificationPreferences,
} from '../../models/notification-preferences/notification-preferences.interface';

/**
 * Type PendingChanges
 *
 * @description
 * The changes shown but not confirmed yet, keyed by the setting they change (`mention.email`,
 * `digest`, `doNotDisturb`): the last change of a setting replaces the previous one.
 *
 * @type {Readonly<Record<string, NotificationPreferenceChange>>}
 */
type PendingChanges = Readonly<Record<string, NotificationPreferenceChange>>;

/**
 * Interface NotificationPreferencesState
 *
 * @description
 * The changes waiting for the gateway's answer.
 */
interface NotificationPreferencesState {
  // #region Properties
  /**
   * Property _pending
   *
   * @description
   * The changes shown over the confirmed preferences until their write ends.
   *
   * @type {PendingChanges}
   * @readonly
   */
  readonly _pending: PendingChanges;
  // #endregion
}

/**
 * Interface NotificationPreferencesStoreInstance
 *
 * @description
 * The account's notification preferences, read once and changed one setting at a time.
 */
export interface NotificationPreferencesStoreInstance {
  // #region Properties
  /**
   * Property saved
   *
   * @description
   * The primary read, then the preferences each write confirms: loading shows the section
   * skeleton, and its error (`value()` throws) reaches the route's error boundary.
   *
   * @type {ResourceRef<NotificationPreferences | undefined>}
   * @readonly
   */
  readonly saved: ResourceRef<NotificationPreferences | undefined>;

  /**
   * Property preferences
   *
   * @description
   * The preferences shown: the confirmed ones with the pending changes over them, or null
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
   * Shows a setting at once and saves it: writes are sent one after the other, each from the
   * version the previous one recorded, and still sent once the page is gone. A refused write
   * puts the confirmed value back and raises an error toast, unless the setting was changed again
   * since; a write without a known outcome is checked against the preferences read again.
   *
   * @param {NotificationPreferenceChange} change - The changed setting.
   */
  change(change: NotificationPreferenceChange): void;
  // #endregion
}

/**
 * Function settingOf
 *
 * @description
 * The setting a change touches.
 *
 * @param {NotificationPreferenceChange} change - The change.
 * @returns {string} Its key.
 */
function settingOf(change: NotificationPreferenceChange): string {
  return change.kind === 'channel' ? `${change.event}.${change.channel}` : change.kind;
}

/**
 * Function applied
 *
 * @description
 * The preferences with one change made, as a new value.
 *
 * @param {NotificationPreferences} preferences - The preferences.
 * @param {NotificationPreferenceChange} change - The change.
 * @returns {NotificationPreferences} The changed preferences.
 */
export function applied(
  preferences: NotificationPreferences,
  change: NotificationPreferenceChange,
): NotificationPreferences {
  switch (change.kind) {
    case 'channel':
      return {
        ...preferences,
        channels: {
          ...preferences.channels,
          [change.event]: {
            ...preferences.channels[change.event],
            [change.channel]: change.enabled,
          },
        },
      };
    case 'digest':
      return { ...preferences, digest: change.digest };
    case 'doNotDisturb':
      return { ...preferences, doNotDisturb: change.enabled };
  }
}

/**
 * Function holds
 *
 * @description
 * Whether the preferences already have the value a change sets.
 *
 * @param {NotificationPreferences} preferences - The preferences.
 * @param {NotificationPreferenceChange} change - The change.
 * @returns {boolean} Whether there is nothing to send.
 */
function holds(
  preferences: NotificationPreferences,
  change: NotificationPreferenceChange,
): boolean {
  switch (change.kind) {
    case 'channel':
      return preferences.channels[change.event][change.channel] === change.enabled;
    case 'digest':
      return preferences.digest === change.digest;
    case 'doNotDisturb':
      return preferences.doNotDisturb === change.enabled;
  }
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
    withState<NotificationPreferencesState>({ _pending: {} }),
    withProps(() => {
      const api: NotificationPreferencesApi = inject(NotificationPreferencesApi);
      return {
        _api: api,
        _toasts: inject(CwToastService),
        _destroyRef: inject(DestroyRef),
        saved: resource({
          loader: ({
            abortSignal,
          }: {
            abortSignal: AbortSignal;
          }): Promise<NotificationPreferences> => api.read(abortSignal),
        }),
      };
    }),
    withComputed((store) => ({
      preferences: computed((): NotificationPreferences | null =>
        store.saved.hasValue()
          ? Object.values(store._pending()).reduce(applied, store.saved.value())
          : null,
      ),
    })),
    withMethods((store) => {
      // Writes run one after the other, so each one is sent from the version the previous one
      // recorded and two writes never race on the same version. The queue keeps draining once
      // the page and its resource are gone, from the values below, which outlive the resource.
      let queue: Promise<void> = Promise.resolve();
      // The newest preferences the gateway confirmed, or null until the first change.
      let confirmed: NotificationPreferences | null = null;
      // Whether a write ended without a known outcome and the preferences could not be read
      // again since: the next write reads them first.
      let uncertain: boolean = false;
      // The failure toast still shown, replaced by the next failure rather than stacked.
      let failureToast: string | null = null;
      const baseline: () => NotificationPreferences | null = (): NotificationPreferences | null =>
        confirmed ?? (store.saved.hasValue() ? store.saved.value() : null);
      const record: (next: NotificationPreferences) => void = (
        next: NotificationPreferences,
      ): void => {
        confirmed = next;
        if (!store._destroyRef.destroyed) store.saved.set(next);
      };
      // Reads the recorded preferences again; says whether it could.
      const refresh: () => Promise<boolean> = async (): Promise<boolean> => {
        try {
          record(await store._api.read());
          uncertain = false;
          return true;
        } catch {
          uncertain = true;
          return false;
        }
      };
      // Ends a write of a setting: drops its pending change when it is still the one that was
      // sent (a newer change keeps showing and is sent next); says whether it was dropped.
      const settle: (setting: string, sent: NotificationPreferenceChange) => boolean = (
        setting: string,
        sent: NotificationPreferenceChange,
      ): boolean => {
        const pending: PendingChanges = store._pending();
        if (pending[setting] !== sent) return false;
        patchState(store, {
          _pending: Object.fromEntries(
            Object.entries(pending).filter(
              ([key]: [string, NotificationPreferenceChange]): boolean => key !== setting,
            ),
          ),
        });
        return true;
      };
      // Shows the confirmed value of a setting again and says the change was not saved.
      const fail: (setting: string, sent: NotificationPreferenceChange) => void = (
        setting: string,
        sent: NotificationPreferenceChange,
      ): void => {
        if (!settle(setting, sent)) return;
        if (failureToast !== null) store._toasts.dismiss(failureToast);
        failureToast = store._toasts.error(
          $localize`:@@account.notifications.save-failed:Could not save`,
          {
            description: $localize`:@@account.notifications.save-failed-text:The previous setting is back. Try again in a moment.`,
          },
        );
      };
      const save: (setting: string) => Promise<void> = async (setting: string): Promise<void> => {
        const pending: PendingChanges = store._pending();
        if (!(setting in pending)) return;
        const sent: NotificationPreferenceChange = pending[setting];
        if (uncertain && !(await refresh())) {
          fail(setting, sent);
          return;
        }
        const base: NotificationPreferences | null = baseline();
        if (base === null) return;
        if (holds(base, sent)) {
          settle(setting, sent);
          return;
        }
        try {
          record(await store._api.change(sent, base.version));
          settle(setting, sent);
        } catch (error: unknown) {
          // A write without a known outcome may have been recorded: the newest preferences
          // decide whether it was, and are what the next changes are compared with.
          if (isUncertainWrite(error) && (await refresh())) {
            const fresh: NotificationPreferences | null = baseline();
            if (fresh !== null && holds(fresh, sent)) {
              settle(setting, sent);
              return;
            }
          }
          fail(setting, sent);
        }
      };
      return {
        change(change: NotificationPreferenceChange): void {
          if (!store.saved.hasValue()) return;
          const setting: string = settingOf(change);
          patchState(store, { _pending: { ...store._pending(), [setting]: change } });
          queue = queue.then((): Promise<void> => save(setting));
        },
      };
    }),
  );
}

/**
 * Constant NotificationPreferencesStore
 *
 * @description
 * Page-scoped on `NotificationsPage` (mockup `Compte.dc.html` lines 1646-1662): the account's
 * notification preferences (`getNotificationPreferences`, the primary read). Each change shows at
 * once, with no Save, and is saved by a write queued behind the previous ones; a later change of
 * the same setting replaces a pending one, and a setting back to its confirmed value sends
 * nothing. A refused write restores the confirmed value of its setting (unless it was changed
 * again since) and shows one error toast. A write without a known outcome (no answer, a timeout,
 * a `5xx`) reads the preferences again: when they hold the change, it was saved; otherwise it is
 * restored as a refusal, and the next changes are compared with what was read (when that read
 * fails too, the next write reads first). The queue outlives the page: the writes still queued
 * when it closes are sent, from the last confirmed preferences.
 *
 * @type {Type<NotificationPreferencesStoreInstance>}
 */
export const NotificationPreferencesStore: Type<NotificationPreferencesStoreInstance> =
  createNotificationPreferencesStore();
