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
 * Type AttemptOutcome
 *
 * @description
 * What one save of a language ended with: the account holds it, it holds another one (both read
 * or answered by the gateway), or nothing tells.
 *
 * @type {'saved' | 'refused' | 'unknown'}
 */
type AttemptOutcome = 'saved' | 'refused' | 'unknown';

/**
 * Type ConfirmationOutcome
 *
 * @description
 * What the delayed reads of an unknown save ended with: a read answered (`saved` or `refused`),
 * a newer pick replaced the language (`superseded`), or no read answered (`unanswered`).
 *
 * @type {'saved' | 'refused' | 'superseded' | 'unanswered'}
 */
type ConfirmationOutcome = 'saved' | 'refused' | 'superseded' | 'unanswered';

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
 * binding another account drops the pending pick and ignores late answers, and a session held by
 * another account or none (`AccountChangedError`) stops it silently.
 *
 * - `confirmed` is the language and version last answered by the gateway; `requested` is the
 *   latest pick not yet confirmed, which the page shows over it.
 * - Picks are saved one at a time, the latest winning. While the account's language is known, a
 *   pick equal to it sends nothing; while it is uncertain, the account is read first, and the
 *   pick is sent when that read fails, whatever the cached value.
 * - A `412` or a write without a known outcome reads the account: it counts as saved when the
 *   account holds the pick, and is otherwise resent once against the version read. When the
 *   resend's outcome is unknown too, or the read fails, the state stays uncertain and the
 *   account is read again after 2, 4 and 8 s. If none answers, `unconfirmed` turns on: the page
 *   shows a neutral note with `retry`, and nothing is taken as confirmed.
 * - Once the latest pick is confirmed, the application shows its locale: `LocaleService.use`
 *   reloads it when that locale is not the one shown, and otherwise `Preference saved` confirms.
 * - A refusal known for certain puts the confirmed language back with `Could not save`; when an
 *   earlier pick of the same run was saved, its locale is applied the same way.
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
   * Waits before each confirming read, in milliseconds.
   *
   * @type {readonly number[]}
   * @readonly
   */
  private readonly delays: readonly number[] = inject(CONFIRMATION_DELAYS);

  /**
   * Property confirmedState
   *
   * @description
   * The language and version last answered by the gateway, or null before the first read.
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
   * The latest pick not yet confirmed, or null.
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
   * The language and version last answered by the gateway.
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
   * The latest pick not yet confirmed.
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
   * Property running
   *
   * @description
   * Whether a save run is in progress; picks made meanwhile join it.
   *
   * @type {boolean}
   */
  private running: boolean = false;

  /**
   * Property uncertain
   *
   * @description
   * Whether the account's real language is unknown: a write may have landed unseen, so the
   * confirmed value is not trusted until a read answers.
   *
   * @type {boolean}
   */
  private uncertain: boolean = false;

  /**
   * Property wake
   *
   * @description
   * Ends the current confirmation wait early, when a newer pick or a reset arrives.
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
    if (known !== null && (this.running || this.requestedState() !== null)) return known;
    const fresh: AccountLanguageSettings = await this.api.read(userId, abortSignal);
    if (epoch !== this.epoch) throw new AccountChangedError();
    if (!this.running && this.requestedState() === null) {
      this.confirmedState.set(fresh);
      this.uncertain = false;
    }
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
    void this.run(this.epoch);
  }

  /**
   * Method retry
   *
   * @description
   * Tries again to confirm the latest pick once its outcome could not be confirmed.
   */
  public retry(): void {
    if (!this.unconfirmedState()) return;
    this.unconfirmedState.set(false);
    void this.run(this.epoch);
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
   * @param {number} epoch - The epoch it runs in.
   * @returns {Promise<void>} Resolves once the run ends.
   */
  private async run(epoch: number): Promise<void> {
    if (this.running) return;
    this.running = true;
    let savedAny: boolean = false;
    let outcome: 'saved' | 'refused' | 'unconfirmed' | null = null;
    try {
      while (this.current(epoch)) {
        const target: AccountLanguage | null = this.requestedState();
        const base: AccountLanguageSettings | null = this.confirmedState();
        if (target === null || base === null) break;
        if (!this.uncertain && target === base.language) {
          this.requestedState.set(null);
          break;
        }
        let result: AttemptOutcome | ConfirmationOutcome = await this.attempt(target, epoch);
        if (!this.current(epoch)) return;
        if (result === 'unknown') result = await this.confirm(target, epoch);
        if (!this.current(epoch)) return;
        if (result === 'saved') savedAny = true;
        if (this.requestedState() !== target || result === 'superseded') continue;
        if (result === 'unanswered') {
          this.unconfirmedState.set(true);
          outcome = 'unconfirmed';
          break;
        }
        this.requestedState.set(null);
        outcome = result;
        break;
      }
    } catch (error: unknown) {
      if (!(error instanceof AccountChangedError)) throw error;
      if (this.current(epoch)) this.reset();
      return;
    } finally {
      this.running = false;
    }
    if (!this.current(epoch) || outcome === 'unconfirmed') return;
    const language: AccountLanguage | null = this.confirmedState()?.language ?? null;
    if (outcome === 'refused') this.failed();
    if (!savedAny || language === null) return;
    const reloaded: boolean = this.show(language);
    if (!reloaded && outcome === 'saved') this.saved(language);
  }

  /**
   * Method attempt
   *
   * @description
   * Saves one language. While the state is uncertain, the account is read first and the
   * language counts as saved when it already holds it; when that read fails, the language is
   * sent against the cached version anyway. A `412` or an unknown outcome reads the account and
   * resends once against it.
   *
   * @param {AccountLanguage} target - The language to save.
   * @param {number} epoch - The run's epoch.
   * @returns {Promise<AttemptOutcome>} What the account holds afterwards, as far as is known.
   * @throws {AccountChangedError} When another account or none holds the session.
   */
  private async attempt(target: AccountLanguage, epoch: number): Promise<AttemptOutcome> {
    if (this.uncertain) {
      const fresh: AccountLanguageSettings | null = await this.reread(epoch);
      if (fresh?.language === target) return 'saved';
    }
    const base: AccountLanguageSettings | null = this.confirmedState();
    if (base === null || !this.current(epoch)) return 'unknown';
    let first: unknown;
    try {
      this.record(await this.api.write(target, base.version, this.bound()), epoch);
      return 'saved';
    } catch (error: unknown) {
      if (error instanceof AccountChangedError) throw error;
      first = error;
    }
    const unknown: boolean = isUncertainWrite(first);
    if (!unknown && !isVersionMismatch(first)) return this.uncertain ? 'unknown' : 'refused';
    if (unknown) this.uncertain = true;
    const fresh: AccountLanguageSettings | null = await this.reread(epoch);
    if (fresh === null) return 'unknown';
    if (fresh.language === target) return 'saved';
    try {
      this.record(await this.api.write(target, fresh.version, this.bound()), epoch);
      return 'saved';
    } catch (error: unknown) {
      if (error instanceof AccountChangedError) throw error;
      if (unknown || isUncertainWrite(error)) {
        this.uncertain = true;
        return 'unknown';
      }
      return 'refused';
    }
  }

  /**
   * Method confirm
   *
   * @description
   * Reads the account after 2, 4 and 8 s until a read answers, a newer pick replaces the
   * language or the binding changes.
   *
   * @param {AccountLanguage} target - The language whose save is unknown.
   * @param {number} epoch - The run's epoch.
   * @returns {Promise<ConfirmationOutcome>} What the reads found.
   * @throws {AccountChangedError} When another account or none holds the session.
   */
  private async confirm(target: AccountLanguage, epoch: number): Promise<ConfirmationOutcome> {
    for (const delay of this.delays) {
      await this.pause(delay);
      if (!this.current(epoch) || this.requestedState() !== target) return 'superseded';
      const fresh: AccountLanguageSettings | null = await this.reread(epoch);
      if (fresh !== null) return fresh.language === target ? 'saved' : 'refused';
    }
    return 'unanswered';
  }

  /**
   * Method reread
   *
   * @description
   * Reads the account; an answer becomes the confirmed language and settles the uncertainty.
   *
   * @param {number} epoch - The run's epoch.
   * @returns {Promise<AccountLanguageSettings | null>} The answer, or null when the read failed.
   * @throws {AccountChangedError} When another account or none holds the session.
   */
  private async reread(epoch: number): Promise<AccountLanguageSettings | null> {
    try {
      const fresh: AccountLanguageSettings = await this.api.read(this.bound());
      if (!this.current(epoch)) return null;
      this.record(fresh, epoch);
      return fresh;
    } catch (error: unknown) {
      if (error instanceof AccountChangedError) throw error;
      return null;
    }
  }

  /**
   * Method record
   *
   * @description
   * Takes a gateway answer as the confirmed language, unless the binding changed.
   *
   * @param {AccountLanguageSettings} answer - The answer.
   * @param {number} epoch - The run's epoch.
   */
  private record(answer: AccountLanguageSettings, epoch: number): void {
    if (!this.current(epoch)) return;
    this.confirmedState.set(answer);
    this.uncertain = false;
  }

  /**
   * Method bound
   *
   * @description
   * The bound account.
   *
   * @returns {string} Its id.
   * @throws {AccountChangedError} When no account is bound any more.
   */
  private bound(): string {
    if (this.userId === null) throw new AccountChangedError();
    return this.userId;
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
   * Reloads the application in a confirmed language's locale when it is not the one shown.
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
   * Says the latest pick was not saved; the confirmed language shows again. Replaces the previous
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
