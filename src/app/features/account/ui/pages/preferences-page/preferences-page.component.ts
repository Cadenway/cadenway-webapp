import {
  Component,
  computed,
  inject,
  resource,
  type ResourceRef,
  type Signal,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { CwButton } from '@cadenway/ui/components/button';
import { CwCard } from '@cadenway/ui/components/card';
import { CwSelect, CwSelectOption } from '@cadenway/ui/components/select';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';

import { ThemeService } from '@core/theme';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { ACCOUNT_LANGUAGE_OPTIONS } from '../../../constants/account-languages/account-languages.constants';
import type {
  AccountLanguage,
  AccountLanguageOption,
  AccountLanguageSettings,
} from '../../../data-access/services/language-api/account-language.interface';
import { AccountLanguageSync } from '../../../services/account-language-sync/account-language-sync.service';
import { ThemeCards, type ThemePick } from '../../components/theme-cards/theme-cards.component';

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
 * Component PreferencesPage
 *
 * @description
 * The account settings section `Preferences` (mockup `Compte.dc.html` lines 405-505), in the
 * centred `max-w-3xl` column of the account settings, limited to what the backend stores today:
 *
 * - `Theme`: `ThemeCards` on `core/theme`'s `ThemeService`, applied at once with the circle
 *   transition from the chosen card, and kept per device.
 * - `Language and region`: the `Language` select, a view over the root-scoped
 *   `AccountLanguageSync`, which saves the account's language and applies its locale once
 *   confirmed, even after the page closed. The select shows the pending pick over the confirmed
 *   language. When the outcome of a save could not be confirmed, a neutral note says so, with
 *   `Retry`.
 *
 * The date format, the week start and the `Display and accessibility` card are hidden until the
 * backend stores them (gap B9). While the account loads, the section skeleton shows
 * (`role="status"`, lines 82-121); a failed read throws from the template into the route's error
 * boundary, whose Retry runs the route again. Below 640 px the cards and the select stack.
 */
@Component({
  selector: 'cw-preferences-page',
  imports: [CwButton, CwCard, CwSelect, CwSelectOption, CwSkeleton, NgIcon, ThemeCards],
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
   * Property sync
   *
   * @description
   * The account's language, its saves and their outcome.
   *
   * @type {AccountLanguageSync}
   * @readonly
   */
  protected readonly sync: AccountLanguageSync = inject(AccountLanguageSync);

  /**
   * Property workspace
   *
   * @description
   * The signed-in person, whose account the language belongs to.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  private readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property account
   *
   * @description
   * The language the section starts from, read for the signed-in person through the sync.
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
    }): Promise<AccountLanguageSettings> => this.sync.load(params.userId, abortSignal),
  });

  /**
   * Property loaded
   *
   * @description
   * Whether the section has read the account. Reading it throws once the read failed, so the
   * route's error boundary replaces the page.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly loaded: Signal<boolean> = computed(
    (): boolean => this.account.value() !== undefined,
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
    (): AccountLanguage | null =>
      this.sync.requested() ??
      this.sync.confirmed()?.language ??
      this.account.value()?.language ??
      null,
  );

  /**
   * Property languageOptions
   *
   * @description
   * The options of the select.
   *
   * @type {readonly AccountLanguageOption[]}
   * @readonly
   */
  protected readonly languageOptions: readonly AccountLanguageOption[] = ACCOUNT_LANGUAGE_OPTIONS;

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
   * Saves the picked language through the sync; a value that names no option is ignored.
   *
   * @param {AccountLanguage | null} value - Value of the chosen option.
   */
  protected chooseLanguage(value: AccountLanguage | null): void {
    const option: AccountLanguageOption | undefined = ACCOUNT_LANGUAGE_OPTIONS.find(
      (candidate: AccountLanguageOption): boolean => candidate.value === value,
    );
    if (option) this.sync.choose(option.value);
  }
  // #endregion
}
