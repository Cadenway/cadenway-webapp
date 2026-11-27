import { inject, Service, type Signal, signal, type WritableSignal } from '@angular/core';
import { CwToastService } from '@cadenway/ui/components/toast';

import { AccountChangedError } from '../../data-access/services/notification-preferences-api/account-changed.error';
import {
  isUncertainWrite,
  isVersionMismatch,
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
export type PendingChanges = Readonly<Record<string, NotificationPreferenceChange>>;

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
 * Function withPending
 *
 * @description
 * The preferences with the pending changes over them.
 *
 * @param {NotificationPreferences} preferences - The confirmed preferences.
 * @param {PendingChanges} pending - The pending changes.
 * @returns {NotificationPreferences} The preferences shown.
 */
export function withPending(
  preferences: NotificationPreferences,
  pending: PendingChanges,
): NotificationPreferences {
  return Object.values(pending).reduce(applied, preferences);
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
 * Service NotificationPreferencesSync
 *
 * @description
 * The signed-in account's notification preferences for the whole browser session, shared by every
 * instance of the notifications page: the newest confirmed preferences, the changes not confirmed
 * yet and the queue that saves them, so leaving the page loses nothing and a reopened page shows
 * the pending choices.
 *
 * - It is bound to one account (`load(userId)`); another account resets it: unsent changes are
 *   dropped and late answers of the previous account are ignored (an epoch counts the bindings).
 *   Every request checks the session's account under the session lock
 *   (`NotificationPreferencesApi`); when it changed (sign-out or another sign-in), the service
 *   stops the same way, so nothing is sent to another account and no `412` is retried there.
 * - Changes are saved in the order they were made, one write at a time, each a merge patch of one
 *   setting against the newest confirmed version. A later change of a setting replaces a pending
 *   one; a setting back to its confirmed value sends nothing.
 * - A `412 request.version-mismatch` adopts the preferences read again as the confirmed ones and
 *   sends the setting once more against them, unless they already hold it.
 * - A write without a known outcome (no answer, a timeout, a `5xx`) reads the preferences again:
 *   when they hold the change it counts as saved; otherwise the write itself is sent once more
 *   against the version read, since the first one may still land after that read, and a `412` on
 *   it means the preferences moved meanwhile, which a last read settles.
 * - A change is restored only once its write is refused (or its retry still fails): its setting
 *   shows the confirmed value again, unless it was changed again since, and the
 *   `Could not save` toast replaces the previous one. When the outcome stays unknown, the next
 *   write reads the preferences first.
 */
@Service()
export class NotificationPreferencesSync {
  // #region Properties
  /**
   * Property api
   *
   * @description
   * The preferences requests.
   *
   * @type {NotificationPreferencesApi}
   * @readonly
   */
  private readonly api: NotificationPreferencesApi = inject(NotificationPreferencesApi);

  /**
   * Property toasts
   *
   * @description
   * The application's toasts, which outlive the page.
   *
   * @type {CwToastService}
   * @readonly
   */
  private readonly toasts: CwToastService = inject(CwToastService);

  /**
   * Property confirmedState
   *
   * @description
   * The newest preferences the gateway confirmed for the bound account, or null.
   *
   * @type {WritableSignal<NotificationPreferences | null>}
   * @readonly
   */
  private readonly confirmedState: WritableSignal<NotificationPreferences | null> =
    signal<NotificationPreferences | null>(null);

  /**
   * Property pendingState
   *
   * @description
   * The changes of the bound account not confirmed yet.
   *
   * @type {WritableSignal<PendingChanges>}
   * @readonly
   */
  private readonly pendingState: WritableSignal<PendingChanges> = signal<PendingChanges>({});

  /**
   * Property confirmed
   *
   * @description
   * The newest preferences the gateway confirmed for the bound account, or null before the first
   * read.
   *
   * @type {Signal<NotificationPreferences | null>}
   * @readonly
   */
  public readonly confirmed: Signal<NotificationPreferences | null> =
    this.confirmedState.asReadonly();

  /**
   * Property pending
   *
   * @description
   * The changes shown over the confirmed preferences until their write ends.
   *
   * @type {Signal<PendingChanges>}
   * @readonly
   */
  public readonly pending: Signal<PendingChanges> = this.pendingState.asReadonly();

  /**
   * Property userId
   *
   * @description
   * The bound account, or null before a page binds one or once the session changed.
   *
   * @type {string | null}
   */
  private userId: string | null = null;

  /**
   * Property epoch
   *
   * @description
   * Number of the current binding: work started under an older one is dropped.
   *
   * @type {number}
   */
  private epoch: number = 0;

  /**
   * Property queue
   *
   * @description
   * The writes, chained so that one runs at a time, in the order of the changes.
   *
   * @type {Promise<void>}
   */
  private queue: Promise<void> = Promise.resolve();

  /**
   * Property queued
   *
   * @description
   * Number of writes queued or running.
   *
   * @type {number}
   */
  private queued: number = 0;

  /**
   * Property uncertain
   *
   * @description
   * Whether a write ended with an unknown outcome that no read settled: the next write reads the
   * preferences first.
   *
   * @type {boolean}
   */
  private uncertain: boolean = false;

  /**
   * Property failureToast
   *
   * @description
   * The failure toast still shown, replaced by the next failure rather than stacked.
   *
   * @type {string | null}
   */
  private failureToast: string | null = null;
  // #endregion

  // #region Methods
  /**
   * Method load
   *
   * @description
   * Binds the account and returns the preferences a page starts from: the confirmed ones while
   * writes are pending or running, so a reopened page continues from them; otherwise the
   * preferences read again. A read for an account no longer bound rejects with
   * `AccountChangedError`.
   *
   * @param {string} userId - The signed-in account.
   * @param {AbortSignal | undefined} abortSignal - Cancels a superseded read.
   * @returns {Promise<NotificationPreferences>} The preferences to start from.
   */
  public async load(userId: string, abortSignal?: AbortSignal): Promise<NotificationPreferences> {
    this.bind(userId);
    const epoch: number = this.epoch;
    const known: NotificationPreferences | null = this.confirmedState();
    if (known !== null && (this.queued > 0 || Object.keys(this.pendingState()).length > 0)) {
      return known;
    }
    const fresh: NotificationPreferences = await this.api.read(userId, abortSignal);
    if (epoch !== this.epoch) throw new AccountChangedError();
    this.record(fresh);
    return this.confirmedState() ?? fresh;
  }

  /**
   * Method change
   *
   * @description
   * Shows a setting at once and queues its write; nothing happens before a page loaded the
   * preferences of a bound account.
   *
   * @param {NotificationPreferenceChange} change - The changed setting.
   */
  public change(change: NotificationPreferenceChange): void {
    if (this.userId === null || this.confirmedState() === null) return;
    const setting: string = settingOf(change);
    const epoch: number = this.epoch;
    this.pendingState.update((pending: PendingChanges): PendingChanges => ({
      ...pending,
      [setting]: change,
    }));
    this.queued += 1;
    this.queue = this.queue
      .then((): Promise<void> => this.save(setting, epoch))
      .catch((): void => undefined)
      .then((): void => {
        this.queued -= 1;
      });
  }

  /**
   * Method bind
   *
   * @description
   * Binds an account: another one than the bound account resets the state.
   *
   * @param {string} userId - The account.
   */
  private bind(userId: string): void {
    if (this.userId === userId) return;
    this.reset();
    this.userId = userId;
  }

  /**
   * Method reset
   *
   * @description
   * Forgets the bound account: its unsent changes are dropped, and the work already started
   * under its binding ends without effect.
   */
  private reset(): void {
    this.epoch += 1;
    this.userId = null;
    this.uncertain = false;
    this.confirmedState.set(null);
    this.pendingState.set({});
  }

  /**
   * Method current
   *
   * @description
   * Whether work started under a binding is still the current one.
   *
   * @param {number} epoch - The binding it started under.
   * @returns {boolean} Whether it still counts.
   */
  private current(epoch: number): boolean {
    return epoch === this.epoch && this.userId !== null;
  }

  /**
   * Method record
   *
   * @description
   * Keeps preferences the gateway answered, unless the newest ones known are newer.
   *
   * @param {NotificationPreferences} next - The answered preferences.
   */
  private record(next: NotificationPreferences): void {
    const known: NotificationPreferences | null = this.confirmedState();
    if (known === null || next.version >= known.version) this.confirmedState.set(next);
  }

  /**
   * Method settle
   *
   * @description
   * Ends a write of a setting: drops its pending change when it is still the one that was sent
   * (a newer change keeps showing and is sent next).
   *
   * @param {string} setting - The setting.
   * @param {NotificationPreferenceChange} sent - The change the write sent.
   * @returns {boolean} Whether the pending change was dropped.
   */
  private settle(setting: string, sent: NotificationPreferenceChange): boolean {
    const pending: PendingChanges = this.pendingState();
    if (pending[setting] !== sent) return false;
    this.pendingState.set(
      Object.fromEntries(
        Object.entries(pending).filter(
          ([key]: [string, NotificationPreferenceChange]): boolean => key !== setting,
        ),
      ),
    );
    return true;
  }

  /**
   * Method fail
   *
   * @description
   * Shows the confirmed value of a setting again and says the change was not saved, unless it
   * was changed again since.
   *
   * @param {string} setting - The setting.
   * @param {NotificationPreferenceChange} sent - The change that was not saved.
   */
  private fail(setting: string, sent: NotificationPreferenceChange): void {
    if (!this.settle(setting, sent)) return;
    if (this.failureToast !== null) this.toasts.dismiss(this.failureToast);
    this.failureToast = this.toasts.error(
      $localize`:@@account.notifications.save-failed:Could not save`,
      {
        description: $localize`:@@account.notifications.save-failed-text:The previous setting is back. Try again in a moment.`,
      },
    );
  }

  /**
   * Method reread
   *
   * @description
   * Reads the preferences again and adopts them; null when the read failed (the next write reads
   * first) or the binding ended (the account changed: the service stops).
   *
   * @param {number} epoch - The binding the read is made under.
   * @returns {Promise<NotificationPreferences | null>} The preferences read, or null.
   */
  private async reread(epoch: number): Promise<NotificationPreferences | null> {
    const userId: string | null = this.userId;
    if (userId === null) return null;
    try {
      const fresh: NotificationPreferences = await this.api.read(userId);
      if (!this.current(epoch)) return null;
      this.record(fresh);
      this.uncertain = false;
      return fresh;
    } catch (error: unknown) {
      if (!this.current(epoch)) return null;
      if (error instanceof AccountChangedError) this.reset();
      else this.uncertain = true;
      return null;
    }
  }

  /**
   * Method save
   *
   * @description
   * Saves the pending change of a setting, when there is still one to send.
   *
   * @param {string} setting - The setting.
   * @param {number} epoch - The binding the change was made under.
   * @returns {Promise<void>} Resolves once the write ended.
   */
  private async save(setting: string, epoch: number): Promise<void> {
    if (!this.current(epoch) || !(setting in this.pendingState())) return;
    const sent: NotificationPreferenceChange = this.pendingState()[setting];
    if (this.uncertain) {
      const fresh: NotificationPreferences | null = await this.reread(epoch);
      if (!this.current(epoch)) return;
      if (fresh === null) {
        this.fail(setting, sent);
        return;
      }
    }
    const base: NotificationPreferences | null = this.confirmedState();
    if (base === null) return;
    if (holds(base, sent)) {
      this.settle(setting, sent);
      return;
    }
    await this.deliver(setting, sent, base.version, epoch);
  }

  /**
   * Method deliver
   *
   * @description
   * Sends a change and settles its outcome: a `412` or an unknown outcome reads the preferences
   * again, which may show it saved; otherwise it is sent once more against the version read.
   *
   * @param {string} setting - The setting.
   * @param {NotificationPreferenceChange} sent - The change.
   * @param {number} version - Version it is sent against.
   * @param {number} epoch - The binding it is sent under.
   * @returns {Promise<void>} Resolves once its outcome is settled.
   */
  private async deliver(
    setting: string,
    sent: NotificationPreferenceChange,
    version: number,
    epoch: number,
  ): Promise<void> {
    let at: number = version;
    for (let attempt: number = 0; attempt < 2; attempt += 1) {
      const userId: string | null = this.userId;
      if (userId === null) return;
      try {
        const next: NotificationPreferences = await this.api.write(sent, at, userId);
        if (!this.current(epoch)) return;
        this.record(next);
        this.settle(setting, sent);
        return;
      } catch (error: unknown) {
        if (!this.current(epoch)) return;
        if (error instanceof AccountChangedError) {
          this.reset();
          return;
        }
        const unknown: boolean = isUncertainWrite(error);
        if (!unknown && !isVersionMismatch(error)) break;
        const fresh: NotificationPreferences | null = await this.reread(epoch);
        if (!this.current(epoch)) return;
        if (fresh === null) break;
        if (holds(fresh, sent)) {
          this.settle(setting, sent);
          return;
        }
        // The write may still land after this read: it stays unknown until the retry ends.
        if (unknown) this.uncertain = attempt > 0;
        at = fresh.version;
      }
    }
    this.fail(setting, sent);
  }
  // #endregion
}
