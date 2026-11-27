import {
  Component,
  computed,
  DestroyRef,
  inject,
  resource,
  type ResourceRef,
  type Signal,
  signal,
  type WritableSignal,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { CwCard } from '@cadenway/ui/components/card';
import { CwSelect, CwSelectOption } from '@cadenway/ui/components/select';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { CwToastService } from '@cadenway/ui/components/toast';

import { APP_LOCALES, type AppLocale, DEFAULT_LOCALE, LocaleService } from '@core/locale';
import { ThemeService } from '@core/theme';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { AccountChangedError } from '../../../data-access/services/notification-preferences-api/account-changed.error';
import {
  isUncertainWrite,
  isVersionMismatch,
} from '../../../data-access/services/notification-preferences-api/notification-preferences-api.service';
import type {
  AccountLanguage,
  AccountLanguageSettings,
} from '../../../data-access/services/language-api/account-language.interface';
import { LanguageApi } from '../../../data-access/services/language-api/language-api.service';
import { ThemeCards, type ThemePick } from '../../components/theme-cards/theme-cards.component';

/**
 * Interface LanguageOption
 *
 * @description
 * An option of the `Language` select.
 */
interface LanguageOption {
  // #region Properties
  /**
   * Property value
   *
   * @description
   * The account language it saves.
   *
   * @type {AccountLanguage}
   * @readonly
   */
  readonly value: AccountLanguage;

  /**
   * Property label
   *
   * @description
   * Name of the language, in that language.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property flag
   *
   * @description
   * Flag icon before the name.
   *
   * @type {string}
   * @readonly
   */
  readonly flag: string;
  // #endregion
}

/**
 * Constant LANGUAGE_OPTIONS
 *
 * @description
 * The languages in the mockup's order, with its flags (`Compte.dc.html` lines 1434 and 1660).
 *
 * @type {readonly LanguageOption[]}
 */
const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { value: 'fr', label: $localize`:@@account.preferences.language-fr:Français`, flag: 'flagFr' },
  { value: 'en', label: $localize`:@@account.preferences.language-en:English`, flag: 'flagGb' },
  { value: 'de', label: $localize`:@@account.preferences.language-de:Deutsch`, flag: 'flagDe' },
  { value: 'es', label: $localize`:@@account.preferences.language-es:Español`, flag: 'flagEs' },
];

/**
 * Constant SKELETON_CARDS
 *
 * @description
 * Widths of the skeleton's cards and the shape of each row's control (`SK_SECTIONS.prefs` of
 * `Compte.dc.html`, lines 881-910: four rows, then three).
 *
 * @type {readonly { title: string; rows: readonly { width: string; control: string }[] }[]}
 */
const SKELETON_CARDS: readonly {
  title: string;
  rows: readonly { width: string; control: string }[];
}[] = [
  {
    title: 'w-4/5',
    rows: [
      { width: 'w-2/5', control: 'h-9 w-56 rounded-lg' },
      { width: 'w-2/3', control: 'h-5 w-9 rounded-full' },
      { width: 'w-3/5', control: 'h-8 w-24 rounded-lg' },
      { width: 'w-1/3', control: 'h-9 w-56 rounded-lg' },
    ],
  },
  {
    title: 'w-3/4',
    rows: [
      { width: 'w-1/3', control: 'h-5 w-9 rounded-full' },
      { width: 'w-4/5', control: 'h-8 w-24 rounded-lg' },
      { width: 'w-3/4', control: 'h-9 w-56 rounded-lg' },
    ],
  },
];

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
function displayLocale(language: AccountLanguage): AppLocale {
  return APP_LOCALES.find((locale: AppLocale): boolean => locale === language) ?? DEFAULT_LOCALE;
}

/**
 * Component PreferencesPage
 *
 * @description
 * The account settings section `Preferences` (mockup `Compte.dc.html` lines 405-505), in the
 * centred `max-w-3xl` column of the account settings, limited to what the backend stores today:
 *
 * - `Theme`: `ThemeCards` on `core/theme`'s `ThemeService`, applied at once with the circle
 *   transition from the chosen card, and kept per device.
 * - `Language and region`: the `Language` select, read from and saved on the account
 *   (`LanguageApi`, `updateCurrentUser` with `If-Match`). The pick shows at once and saves; once
 *   saved, the application reloads in its locale through `LocaleService.use` (`?lang=`) when that
 *   locale is not the one shown, and otherwise confirms with a toast. A `412` or a write without a
 *   known outcome reads the account again: it counts as saved when the account holds the pick,
 *   and is otherwise resent once against the version read. A refusal, or a resend that fails
 *   again, puts the previous language back with an error toast; a session that another account
 *   or none holds stops silently. Picks made during a save are sent after it, the latest winning.
 *
 * The date format, the week start and the `Display and accessibility` card are hidden until the
 * backend stores them (gap B9). While the account loads, the section skeleton shows
 * (`role="status"`, lines 82-121); a failed read throws from the template into the route's error
 * boundary, whose Retry runs the route again. Below 640 px the cards and the select stack.
 */
@Component({
  selector: 'cw-preferences-page',
  imports: [CwCard, CwSelect, CwSelectOption, CwSkeleton, NgIcon, ThemeCards],
  templateUrl: './preferences-page.component.html',
})
export class PreferencesPage {
  // #region Properties
  /**
   * Property theme
   *
   * @description
   * The device's theme.
   *
   * @type {ThemeService}
   * @readonly
   */
  protected readonly theme: ThemeService = inject(ThemeService);

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
   * Property languages
   *
   * @description
   * The account language's read and writes.
   *
   * @type {LanguageApi}
   * @readonly
   */
  private readonly languages: LanguageApi = inject(LanguageApi);

  /**
   * Property workspace
   *
   * @description
   * The signed-in person, whose account is read and saved.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  private readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

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
   * Property account
   *
   * @description
   * The confirmed language of the account and its version, read for the signed-in person and
   * replaced by each saved answer.
   *
   * @type {ResourceRef<AccountLanguageSettings | undefined>}
   * @readonly
   */
  private readonly account: ResourceRef<AccountLanguageSettings | undefined> = resource({
    params: (): { userId: string } => ({ userId: this.workspace.user().id }),
    loader: ({
      params,
      abortSignal,
    }: {
      params: { userId: string };
      abortSignal: AbortSignal;
    }): Promise<AccountLanguageSettings> => this.languages.read(params.userId, abortSignal),
  });

  /**
   * Property requested
   *
   * @description
   * The language picked and not yet confirmed, or null.
   *
   * @type {WritableSignal<AccountLanguage | null>}
   * @readonly
   */
  private readonly requested: WritableSignal<AccountLanguage | null> = signal(null);

  /**
   * Property settings
   *
   * @description
   * The confirmed language, or null while it loads. Reading it throws once the read failed, so
   * the route's error boundary replaces the page.
   *
   * @type {Signal<AccountLanguageSettings | null>}
   * @readonly
   */
  protected readonly settings: Signal<AccountLanguageSettings | null> = computed(
    (): AccountLanguageSettings | null => this.account.value() ?? null,
  );

  /**
   * Property language
   *
   * @description
   * The language the select shows: the pending pick, else the confirmed one.
   *
   * @type {Signal<AccountLanguage | null>}
   * @readonly
   */
  protected readonly language: Signal<AccountLanguage | null> = computed(
    (): AccountLanguage | null => this.requested() ?? this.settings()?.language ?? null,
  );

  /**
   * Property languageOptions
   *
   * @description
   * The options of the select.
   *
   * @type {readonly LanguageOption[]}
   * @readonly
   */
  protected readonly languageOptions: readonly LanguageOption[] = LANGUAGE_OPTIONS;

  /**
   * Property skeletonCards
   *
   * @description
   * Widths of the skeleton's cards.
   *
   * @type {readonly { title: string; rows: readonly { width: string; control: string }[] }[]}
   * @readonly
   */
  protected readonly skeletonCards: readonly {
    title: string;
    rows: readonly { width: string; control: string }[];
  }[] = SKELETON_CARDS;

  /**
   * Property saving
   *
   * @description
   * Whether a save is in progress; picks made meanwhile are sent after it.
   *
   * @type {boolean}
   */
  private saving: boolean = false;

  /**
   * Property destroyed
   *
   * @description
   * Whether the page has closed: a save that settles afterwards no longer reloads the application
   * or shows a toast.
   *
   * @type {boolean}
   */
  private destroyed: boolean = false;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Notes when the page closes.
   *
   * @constructor
   */
  public constructor() {
    inject(DestroyRef).onDestroy((): void => {
      this.destroyed = true;
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method chooseTheme
   *
   * @description
   * Applies the chosen theme on this device, spreading from its card.
   *
   * @param {ThemePick} pick - The chosen theme and its card's centre.
   */
  protected chooseTheme(pick: ThemePick): void {
    this.theme.set(pick.preference, pick.origin);
  }

  /**
   * Method chooseLanguage
   *
   * @description
   * Shows the picked language at once and saves it; a value that names no option is ignored.
   *
   * @param {AccountLanguage | null} value - Value of the chosen option.
   */
  protected chooseLanguage(value: AccountLanguage | null): void {
    const option: LanguageOption | undefined = LANGUAGE_OPTIONS.find(
      (candidate: LanguageOption): boolean => candidate.value === value,
    );
    if (!option || this.settings() === null) return;
    this.requested.set(option.value);
    void this.flush(this.workspace.user().id);
  }

  /**
   * Method flush
   *
   * @description
   * Saves the requested language, then any language picked during the save, one write at a time.
   * Once the latest pick is confirmed, applies it.
   *
   * @param {string} userId - The signed-in account.
   * @returns {Promise<void>} Resolves once nothing is left to save.
   */
  private async flush(userId: string): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    let saved: AccountLanguage | null = null;
    try {
      for (;;) {
        const target: AccountLanguage | null = this.requested();
        const confirmed: AccountLanguageSettings | undefined = this.account.value();
        if (target === null || confirmed === undefined) break;
        if (target === confirmed.language) {
          this.requested.set(null);
          break;
        }
        let ok: boolean;
        try {
          ok = await this.send(target, confirmed, userId);
        } catch (error: unknown) {
          if (!(error instanceof AccountChangedError)) throw error;
          this.requested.set(null);
          return;
        }
        if (this.requested() !== target) continue;
        this.requested.set(null);
        if (ok) saved = target;
        else this.failed();
        break;
      }
    } finally {
      this.saving = false;
    }
    if (saved !== null) this.apply(saved);
  }

  /**
   * Method send
   *
   * @description
   * Saves one language against the confirmed version. A `412` or a write without a known outcome
   * reads the account again: the pick counts as saved when the account holds it, and is otherwise
   * resent once against the version read. The confirmed language follows every answer.
   *
   * @param {AccountLanguage} target - The language to save.
   * @param {AccountLanguageSettings} confirmed - The confirmed language and version.
   * @param {string} userId - The signed-in account.
   * @returns {Promise<boolean>} Whether the account now holds the language.
   * @throws {AccountChangedError} When another account or none holds the session.
   */
  private async send(
    target: AccountLanguage,
    confirmed: AccountLanguageSettings,
    userId: string,
  ): Promise<boolean> {
    try {
      this.account.set(await this.languages.write(target, confirmed.version, userId));
      return true;
    } catch (error: unknown) {
      if (error instanceof AccountChangedError) throw error;
      if (!isVersionMismatch(error) && !isUncertainWrite(error)) return false;
    }
    let fresh: AccountLanguageSettings;
    try {
      fresh = await this.languages.read(userId);
    } catch (error: unknown) {
      if (error instanceof AccountChangedError) throw error;
      return false;
    }
    this.account.set(fresh);
    if (fresh.language === target) return true;
    try {
      this.account.set(await this.languages.write(target, fresh.version, userId));
      return true;
    } catch (error: unknown) {
      if (error instanceof AccountChangedError) throw error;
      return false;
    }
  }

  /**
   * Method apply
   *
   * @description
   * Shows the application in a saved language: reloads it in that language's locale when it is
   * not the one shown, else confirms the save with a toast. Nothing happens once the page closed.
   *
   * @param {AccountLanguage} language - The saved language.
   */
  private apply(language: AccountLanguage): void {
    if (this.destroyed) return;
    const locale: AppLocale = displayLocale(language);
    if (locale !== this.locale.current) {
      this.locale.use(locale);
      return;
    }
    const label: string =
      LANGUAGE_OPTIONS.find((option: LanguageOption): boolean => option.value === language)
        ?.label ?? language;
    this.toasts.success($localize`:@@account.preferences.saved:Preference saved`, {
      description: $localize`:@@account.preferences.saved-text:Language: ${label}:language:.`,
    });
  }

  /**
   * Method failed
   *
   * @description
   * Says the language could not be saved; the select already shows the confirmed one again.
   */
  private failed(): void {
    if (this.destroyed) return;
    this.toasts.error($localize`:@@account.preferences.save-failed:Could not save`, {
      description: $localize`:@@account.preferences.save-failed-text:The previous language is back. Try again in a moment.`,
    });
  }
  // #endregion
}
