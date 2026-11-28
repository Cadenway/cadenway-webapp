import { inject, Service, type Signal, signal, type WritableSignal } from '@angular/core';
import { CwToastService } from '@cadenway/ui/components/toast';

import { APP_LOCALES, type AppLocale, DEFAULT_LOCALE, LocaleService } from '@core/locale';

import { ACCOUNT_LANGUAGE_OPTIONS } from '../../constants/account-languages/account-languages.constants';
import type {
  AccountLanguage,
  AccountLanguageOption,
  AccountLanguageSettings,
} from '../../data-access/services/language-api/account-language.interface';
import { LanguageApi } from '../../data-access/services/language-api/language-api.service';
import { AccountChangedError } from '../../data-access/services/notification-preferences-api/account-changed.error';
import {
  isUncertainWrite,
  isVersionMismatch,
} from '../../data-access/services/notification-preferences-api/notification-preferences-api.service';
import { CONFIRMATION_DELAYS } from './confirmation-delays.token';

/**
 * Type SaveOutcome
 *
 * @description
 * What saving a language ended with: a write answered `2xx` (`saved`), the gateway refused the
 * first write for certain (`refused`), or no fencing write answered `2xx` (`unanswered`).
 *
 * @type {'saved' | 'refused' | 'unanswered'}
 */
type SaveOutcome = 'saved' | 'refused' | 'unanswered';

/**
 * Function displayLocale
 *
 * @description
 * The locale the application is shown in for an account language: French and English have a
 * catalog, German and Spanish render the English source copy.
 *
 * @param {AccountLanguage} language - The account language.
 * @returns {AppLocale} The locale to show.
 */
export function displayLocale(language: AccountLanguage): AppLocale {
  return APP_LOCALES.find((locale: AppLocale): boolean => locale === language) ?? DEFAULT_LOCALE;
}

/**
 * Service AccountLanguageSync
 *
 * @description
 * Holds the account's language for the browser session (root-scoped, so a save outlives the
 * preferences page that started it), bound to one account as `NotificationPreferencesSync` is:
 * binding another account drops the pending pick and ignores the old binding's answers, and a
 * session held by another account or none (`AccountChangedError`) stops it silently. Each run
 * belongs to the binding it started in and writes for that binding's account only, so a pick made
 * after a new binding starts its own run.
 *
 * - `confirmed` is the language and version last settled by the gateway; `requested` is the
 *   latest pick not yet settled, which the page shows over it.
 * - Picks are saved one at a time, the latest winning, with `If-Match` on the confirmed version.
 *   While the state is certain, a pick equal to the confirmed language sends nothing.
 * - A write without a known outcome (no answer, a timeout, a `5xx`) may still land, so no read
 *   can settle it, whatever it shows. The state turns uncertain and is fenced: the account is
 *   read for its current version and the latest pick is sent again with `If-Match` on it, even
 *   when the read already shows it. A late first write then fails on its stale version. A fencing
 *   write refused with `412` reads and fences again; at most 3 fencing attempts run, after 2, 4
 *   and 8 s when the previous one got no answer. Only a `2xx` on a fencing write settles the
 *   state; otherwise `unconfirmed` turns on and the page shows a neutral note with `retry`.
 *   A first write refused with `412` is fenced the same way.
 * - Once the latest pick is confirmed, the application shows its locale: `LocaleService.use`
 *   remembers it and opens the same page below its segment (`/fr/`, `/en/`) when that locale is
 *   not the one shown, and otherwise `Preference saved` confirms.
 * - Only a first write refused for certain (a `4xx` other than `412`, while the state is
 *   certain) puts the confirmed language back with `Could not save`; when an earlier pick of the
 *   same run was saved, its locale is applied the same way.
 */
@Service()
export class AccountLanguageSync {
  // #region Properties
  /**
   * Property api
   *
   * @description
   * The account language's read and write.
   *
   * @type {LanguageApi}
   * @readonly
   */
  private readonly api: LanguageApi = inject(LanguageApi);

  /**
   * Property locale
   *
   * @description
   * The locale the application is shown in, and its switch.
   *
   * @type {LocaleService}
   * @readonly
   */
  private readonly locale: LocaleService = inject(LocaleService);

  /**
   * Property toasts
   *
   * @description
   * The confirmation and failure toasts.
   *
   * @type {CwToastService}
   * @readonly
   */
  private readonly toasts: CwToastService = inject(CwToastService);

  /**
   * Property delays
   *
   * @description
   * Waits before each fencing attempt that follows an unanswered one, in milliseconds; their
   * count bounds the attempts.
   *
   * @type {readonly number[]}
   * @readonly
   */
  private readonly delays: readonly number[] = inject(CONFIRMATION_DELAYS);

  /**
   * Property confirmedState
   *
   * @description
   * The language and version last settled by the gateway, or null before the first read.
   *
   * @type {WritableSignal<AccountLanguageSettings | null>}
   * @readonly
   */
  private readonly confirmedState: WritableSignal<AccountLanguageSettings | null> =
    signal<AccountLanguageSettings | null>(null);

  /**
   * Property requestedState
   *
   * @description
   * The latest pick not yet settled, or null.
   *
   * @type {WritableSignal<AccountLanguage | null>}
   * @readonly
   */
  private readonly requestedState: WritableSignal<AccountLanguage | null> =
    signal<AccountLanguage | null>(null);

  /**
   * Property unconfirmedState
   *
   * @description
   * Whether the outcome of the latest pick could not be confirmed.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  private readonly unconfirmedState: WritableSignal<boolean> = signal(false);

  /**
   * Property confirmed
   *
   * @description
   * The language and version last settled by the gateway.
   *
   * @type {Signal<AccountLanguageSettings | null>}
   * @readonly
   */
  public readonly confirmed: Signal<AccountLanguageSettings | null> =
    this.confirmedState.asReadonly();

  /**
   * Property requested
   *
   * @description
   * The latest pick not yet settled.
   *
   * @type {Signal<AccountLanguage | null>}
   * @readonly
   */
  public readonly requested: Signal<AccountLanguage | null> = this.requestedState.asReadonly();

  /**
   * Property unconfirmed
   *
   * @description
   * Whether the outcome of the latest pick could not be confirmed; `retry` tries again.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  public readonly unconfirmed: Signal<boolean> = this.unconfirmedState.asReadonly();

  /**
   * Property userId
   *
   * @description
   * The account the state belongs to, or null.
   *
   * @type {string | null}
   */
  private userId: string | null = null;

  /**
   * Property epoch
   *
   * @description
   * Increased by each reset, so the answers of an earlier binding are ignored.
   *
   * @type {number}
   */
  private epoch: number = 0;

  /**
   * Property runningEpoch
   *
   * @description
   * The binding whose save run is in progress, or null; picks of that binding join it, and a run
   * of an earlier binding never blocks the current one.
   *
   * @type {number | null}
   */
  private runningEpoch: number | null = null;

  /**
   * Property uncertain
   *
   * @description
   * Whether a write of the current binding may have landed unseen: until a fencing write answers
   * `2xx`, the confirmed value is not trusted.
   *
   * @type {boolean}
   */
  private uncertain: boolean = false;

  /**
   * Property wake
   *
   * @description
   * Ends the current wait early, when a newer pick or a reset arrives.
   *
   * @type {(() => void) | null}
   */
  private wake: (() => void) | null = null;

  /**
   * Property failureToast
   *
   * @description
   * The failure toast on screen, replaced by the next one.
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
   * Binds the state to an account and returns its language: the state's own while a save is in
   * progress or unsettled, otherwise a fresh read.
   *
   * @param {string} userId - The signed-in account.
   * @param {AbortSignal | undefined} abortSignal - Cancels a superseded read.
   * @returns {Promise<AccountLanguageSettings>} The language to start from.
   * @throws {AccountChangedError} When the binding changed during the read.
   */
  public async load(userId: string, abortSignal?: AbortSignal): Promise<AccountLanguageSettings> {
    this.bind(userId);
    const epoch: number = this.epoch;
    const known: AccountLanguageSettings | null = this.confirmedState();
    if (known !== null && !this.idle()) return known;
    const fresh: AccountLanguageSettings = await this.api.read(userId, abortSignal);
    if (epoch !== this.epoch) throw new AccountChangedError();
    if (this.idle()) this.confirmedState.set(fresh);
    return this.confirmedState() ?? fresh;
  }

  /**
   * Method choose
   *
   * @description
   * Requests a language for the bound account and saves it; ignored before the first read.
   *
   * @param {AccountLanguage} language - The picked language.
   */
  public choose(language: AccountLanguage): void {
    if (this.userId === null || this.confirmedState() === null) return;
    this.requestedState.set(language);
    this.unconfirmedState.set(false);
    this.wake?.();
    void this.run(this.epoch, this.userId);
  }

  /**
   * Method retry
   *
   * @description
   * Fences the latest pick again once its outcome could not be confirmed.
   */
  public retry(): void {
    if (!this.unconfirmedState() || this.userId === null) return;
    this.unconfirmedState.set(false);
    void this.run(this.epoch, this.userId);
  }

  /**
   * Method idle
   *
   * @description
   * Whether the current binding has nothing in progress and nothing unsettled.
   *
   * @returns {boolean} Whether a read may replace the confirmed language.
   */
  private idle(): boolean {
    return this.runningEpoch !== this.epoch && this.requestedState() === null && !this.uncertain;
  }

  /**
   * Method bind
   *
   * @description
   * Binds the state to an account, resetting it for another one.
   *
   * @param {string} userId - The signed-in account.
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
   * Drops the state and ignores the answers still expected.
   */
  private reset(): void {
    this.epoch += 1;
    this.userId = null;
    this.uncertain = false;
    this.confirmedState.set(null);
    this.requestedState.set(null);
    this.unconfirmedState.set(false);
    this.wake?.();
  }

  /**
   * Method current
   *
   * @description
   * Whether a run started in an epoch still belongs to the bound account.
   *
   * @param {number} epoch - The run's epoch.
   * @returns {boolean} Whether its answers still count.
   */
  private current(epoch: number): boolean {
    return epoch === this.epoch && this.userId !== null;
  }

  /**
   * Method run
   *
   * @description
   * Saves the requested language, then each newer pick, one at a time, and applies the result
   * once nothing is left to save. A changed account stops it silently.
   *
   * @param {number} epoch - The binding it runs for.
   * @param {string} userId - That binding's account, the only one it writes for.
   * @returns {Promise<void>} Resolves once the run ends.
   */
  private async run(epoch: number, userId: string): Promise<void> {
    if (this.runningEpoch === epoch) return;
    this.runningEpoch = epoch;
    let savedAny: boolean = false;
    let outcome: SaveOutcome | null = null;
    try {
      while (this.current(epoch)) {
        const target: AccountLanguage | null = this.requestedState();
        const base: AccountLanguageSettings | null = this.confirmedState();
        if (target === null || base === null) break;
        if (!this.uncertain && target === base.language) {
          this.requestedState.set(null);
          break;
        }
        const result: { outcome: SaveOutcome; language: AccountLanguage } = await this.save(
          target,
          epoch,
          userId,
        );
        if (!this.current(epoch)) return;
        if (result.outcome === 'saved') savedAny = true;
        if (this.requestedState() !== result.language) continue;
        if (result.outcome === 'unanswered') {
          this.unconfirmedState.set(true);
          outcome = 'unanswered';
          break;
        }
        this.requestedState.set(null);
        outcome = result.outcome;
        break;
      }
    } catch (error: unknown) {
      if (!(error instanceof AccountChangedError)) throw error;
      if (this.current(epoch)) this.reset();
      return;
    } finally {
      if (this.runningEpoch === epoch) this.runningEpoch = null;
    }
    if (!this.current(epoch) || outcome === 'unanswered') return;
    const language: AccountLanguage | null = this.confirmedState()?.language ?? null;
    if (outcome === 'refused') this.failed();
    if (!savedAny || language === null) return;
    const reloaded: boolean = this.show(language);
    if (!reloaded && outcome === 'saved') this.saved(language);
  }

  /**
   * Method save
   *
   * @description
   * Saves one language. While the state is certain, it is written against the confirmed version;
   * a `2xx` settles it and a `4xx` other than `412` refuses it. A `412`, an unknown outcome, or
   * an uncertain state leads to fencing.
   *
   * @param {AccountLanguage} target - The language to save.
   * @param {number} epoch - The run's binding.
   * @param {string} userId - That binding's account.
   * @returns {Promise<{ outcome: SaveOutcome; language: AccountLanguage }>} The outcome and the
   * language it settled or concerns.
   * @throws {AccountChangedError} When another account or none holds the session.
   */
  private async save(
    target: AccountLanguage,
    epoch: number,
    userId: string,
  ): Promise<{ outcome: SaveOutcome; language: AccountLanguage }> {
    const base: AccountLanguageSettings | null = this.confirmedState();
    let unknown: boolean = false;
    if (!this.uncertain && base !== null) {
      try {
        this.settle(await this.api.write(target, base.version, userId), epoch);
        return { outcome: 'saved', language: target };
      } catch (error: unknown) {
        if (error instanceof AccountChangedError) throw error;
        if (!isUncertainWrite(error) && !isVersionMismatch(error)) {
          return { outcome: 'refused', language: target };
        }
        unknown = isUncertainWrite(error);
        if (unknown && this.current(epoch)) this.uncertain = true;
      }
    }
    return this.fence(target, epoch, userId, unknown);
  }

  /**
   * Method fence
   *
   * @description
   * Reads the account for its current version, then sends the latest pick with `If-Match` on it,
   * so a write still in flight fails on its stale version. Each attempt first waits its delay
   * (2, 4 and 8 s) when the previous read or write got no answer, the first one when the write it
   * fences just got none; a `412` fences again at once. At most as many attempts as delays run.
   *
   * @param {AccountLanguage} target - The language being saved when fencing started.
   * @param {number} epoch - The run's binding.
   * @param {string} userId - That binding's account.
   * @param {boolean} afterUnknown - Whether the write it fences just got no answer.
   * @returns {Promise<{ outcome: SaveOutcome; language: AccountLanguage }>} `saved` with the
   * language a fencing write settled, or `unanswered` with the latest pick.
   * @throws {AccountChangedError} When another account or none holds the session.
   */
  private async fence(
    target: AccountLanguage,
    epoch: number,
    userId: string,
    afterUnknown: boolean,
  ): Promise<{ outcome: SaveOutcome; language: AccountLanguage }> {
    let latest: AccountLanguage = target;
    let wait: boolean = afterUnknown;
    for (const delay of this.delays) {
      if (wait) await this.pause(delay);
      if (!this.current(epoch)) return { outcome: 'unanswered', language: latest };
      latest = this.requestedState() ?? latest;
      wait = true;
      let version: number;
      try {
        version = (await this.api.read(userId)).version;
      } catch (error: unknown) {
        if (error instanceof AccountChangedError) throw error;
        continue;
      }
      if (!this.current(epoch)) return { outcome: 'unanswered', language: latest };
      latest = this.requestedState() ?? latest;
      try {
        this.settle(await this.api.write(latest, version, userId), epoch);
        return { outcome: 'saved', language: latest };
      } catch (error: unknown) {
        if (error instanceof AccountChangedError) throw error;
        if (isVersionMismatch(error)) wait = false;
        else if (isUncertainWrite(error) && this.current(epoch)) this.uncertain = true;
      }
    }
    return { outcome: 'unanswered', language: this.requestedState() ?? latest };
  }

  /**
   * Method settle
   *
   * @description
   * Takes a `2xx` answer as the confirmed language and ends the uncertainty, unless the binding
   * changed.
   *
   * @param {AccountLanguageSettings} answer - The answer.
   * @param {number} epoch - The run's binding.
   */
  private settle(answer: AccountLanguageSettings, epoch: number): void {
    if (!this.current(epoch)) return;
    this.confirmedState.set(answer);
    this.uncertain = false;
  }

  /**
   * Method pause
   *
   * @description
   * Waits, ending early when a newer pick or a reset wakes it.
   *
   * @param {number} delay - The wait, in milliseconds.
   * @returns {Promise<void>} Resolves once the wait ends.
   */
  private pause(delay: number): Promise<void> {
    return new Promise<void>((resolve: () => void): void => {
      const timer: ReturnType<typeof setTimeout> = setTimeout((): void => {
        this.wake = null;
        resolve();
      }, delay);
      this.wake = (): void => {
        clearTimeout(timer);
        this.wake = null;
        resolve();
      };
    });
  }

  /**
   * Method show
   *
   * @description
   * Opens the application in a confirmed language's locale build when it is not the one shown.
   *
   * @param {AccountLanguage} language - The confirmed language.
   * @returns {boolean} Whether the application reloads.
   */
  private show(language: AccountLanguage): boolean {
    const locale: AppLocale = displayLocale(language);
    if (locale === this.locale.current) return false;
    this.locale.use(locale);
    return true;
  }

  /**
   * Method saved
   *
   * @description
   * Confirms a saved language that needs no reload.
   *
   * @param {AccountLanguage} language - The saved language.
   */
  private saved(language: AccountLanguage): void {
    const label: string =
      ACCOUNT_LANGUAGE_OPTIONS.find(
        (option: AccountLanguageOption): boolean => option.value === language,
      )?.label ?? language;
    this.toasts.success($localize`:@@account.preferences.saved:Preference saved`, {
      description: $localize`:@@account.preferences.saved-text:Language: ${label}:language:.`,
    });
  }

  /**
   * Method failed
   *
   * @description
   * Says the latest pick was refused; the confirmed language shows again. Replaces the previous
   * failure toast.
   */
  private failed(): void {
    if (this.failureToast !== null) this.toasts.dismiss(this.failureToast);
    this.failureToast = this.toasts.error(
      $localize`:@@account.preferences.save-failed:Could not save`,
      {
        description: $localize`:@@account.preferences.save-failed-text:The previous language is back. Try again in a moment.`,
      },
    );
  }
  // #endregion
}
