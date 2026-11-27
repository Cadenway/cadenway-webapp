import {
  Component,
  type ElementRef,
  input,
  type InputSignal,
  output,
  type OutputEmitterRef,
  type Signal,
  viewChildren,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NgIcon } from '@ng-icons/core';
import { CwRadioGroup, CwRadioGroupItem } from '@cadenway/ui/components/radio-group';

import type { ResolvedTheme, ThemePreference } from '@core/theme';

/**
 * Interface ThemeCardOption
 *
 * @description
 * One card of the theme choice.
 */
interface ThemeCardOption {
  // #region Properties
  /**
   * Property preference
   *
   * @description
   * The preference the card selects.
   *
   * @type {ThemePreference}
   * @readonly
   */
  readonly preference: ThemePreference;

  /**
   * Property label
   *
   * @description
   * Name of the card, also the radio's accessible name.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property icon
   *
   * @description
   * Phosphor icon before the name.
   *
   * @type {string}
   * @readonly
   */
  readonly icon: string;
  // #endregion
}

/**
 * Interface ThemePick
 *
 * @description
 * A theme chosen on a card, with the point the theme transition spreads from.
 */
export interface ThemePick {
  // #region Properties
  /**
   * Property preference
   *
   * @description
   * The chosen preference.
   *
   * @type {ThemePreference}
   * @readonly
   */
  readonly preference: ThemePreference;

  /**
   * Property origin
   *
   * @description
   * Centre of the chosen card in viewport pixels, or undefined when it could not be measured.
   *
   * @type {{ readonly x: number; readonly y: number } | undefined}
   * @readonly
   */
  readonly origin: { readonly x: number; readonly y: number } | undefined;
  // #endregion
}

/**
 * Constant THEME_CARDS
 *
 * @description
 * The cards in the mockup's order (`Compte.dc.html` lines 1665-1667), the order the template
 * writes them in: their radios carry static values.
 *
 * @type {readonly ThemeCardOption[]}
 */
const THEME_CARDS: readonly ThemeCardOption[] = [
  {
    preference: 'light',
    label: $localize`:@@account.preferences.theme-light:Light`,
    icon: 'phosphorSunBold',
  },
  {
    preference: 'dark',
    label: $localize`:@@account.preferences.theme-dark:Dark`,
    icon: 'phosphorMoonBold',
  },
  {
    preference: 'system',
    label: $localize`:@@account.preferences.theme-system:System`,
    icon: 'phosphorMonitorBold',
  },
];

/**
 * Component ThemeCards
 *
 * @description
 * The theme choice of the account preferences (mockup `Compte.dc.html` lines 412-430): a
 * `cw-radio-group` of three cards, `Light`, `Dark` and `System`, each a label holding a mini
 * preview of the application drawn in its theme (`System` in the theme shown now, as in the
 * mockup), its radio, icon and name. One column below 640 px, three from `sm`. The arrows move
 * the choice as in any radio group. Presentational: `preference` is the checked card, and
 * `picked` emits each new choice with the centre of its card, where the theme transition starts.
 */
@Component({
  selector: 'cw-theme-cards',
  imports: [CwRadioGroup, CwRadioGroupItem, NgIcon, NgTemplateOutlet],
  templateUrl: './theme-cards.component.html',
})
export class ThemeCards {
  // #region Properties
  /**
   * Property preference
   *
   * @description
   * The checked preference.
   *
   * @type {InputSignal<ThemePreference>}
   * @readonly
   */
  public readonly preference: InputSignal<ThemePreference> = input.required<ThemePreference>();

  /**
   * Property shown
   *
   * @description
   * The theme the application shows now, drawn by the `System` preview.
   *
   * @type {InputSignal<ResolvedTheme>}
   * @readonly
   */
  public readonly shown: InputSignal<ResolvedTheme> = input.required<ResolvedTheme>();

  /**
   * Property labelledBy
   *
   * @description
   * Id of the heading that names the group.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly labelledBy: InputSignal<string> = input.required<string>();

  /**
   * Property picked
   *
   * @description
   * Emits a newly chosen preference with the centre of its card.
   *
   * @type {OutputEmitterRef<ThemePick>}
   * @readonly
   */
  public readonly picked: OutputEmitterRef<ThemePick> = output<ThemePick>();

  /**
   * Property cards
   *
   * @description
   * The cards, in order.
   *
   * @type {readonly ThemeCardOption[]}
   * @readonly
   */
  protected readonly cards: readonly ThemeCardOption[] = THEME_CARDS;

  /**
   * Property cardElements
   *
   * @description
   * The rendered cards, in the order of `cards`, measured for the transition origin.
   *
   * @type {Signal<readonly ElementRef<HTMLElement>[]>}
   * @readonly
   */
  private readonly cardElements: Signal<readonly ElementRef<HTMLElement>[]> =
    viewChildren<ElementRef<HTMLElement>>('cardBox');
  // #endregion

  // #region Methods
  /**
   * Method choose
   *
   * @description
   * Emits the chosen card's preference; a value that names no card is ignored.
   *
   * @param {string | null} value - Value of the chosen radio.
   */
  protected choose(value: string | null): void {
    const index: number = THEME_CARDS.findIndex(
      (card: ThemeCardOption): boolean => card.preference === value,
    );
    const card: ThemeCardOption | undefined = THEME_CARDS.at(index);
    if (index < 0 || !card) return;
    const box: DOMRect | undefined = this.cardElements()
      .at(index)
      ?.nativeElement.getBoundingClientRect();
    this.picked.emit({
      preference: card.preference,
      origin: box
        ? { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) }
        : undefined,
    });
  }
  // #endregion
}
