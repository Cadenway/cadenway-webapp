import {
  Component,
  computed,
  input,
  type InputSignal,
  model,
  type ModelSignal,
  type Signal,
} from '@angular/core';
import { CwToggleGroup, CwToggleGroupItem } from '@cadenway/ui/components/toggle-group';
import { NgIcon } from '@ng-icons/core';

import { lookIconLabels } from '../../../constants/view-labels/view-labels.constants';
import type { LookColor, LookIcon } from '../../../models/look/look.type';
import { LOOK_ICON_KEYS, lookIconName } from '../../../utils/look/look.util';

/**
 * Constant DEFAULT_ICON
 *
 * @description
 * Value of the « Initiale » or « Par défaut » choice in the icon group.
 *
 * @type {string}
 */
const DEFAULT_ICON: string = 'default';

/**
 * Interface LookColorChoice
 *
 * @description
 * A color of the « Couleur » group with its name and swatch.
 */
interface LookColorChoice {
  // #region Properties
  /**
   * Property value
   *
   * @description
   * The color key.
   *
   * @type {LookColor}
   * @readonly
   */
  readonly value: LookColor;

  /**
   * Property label
   *
   * @description
   * Its name (« Améthyste »).
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property swatch
   *
   * @description
   * Background class of its swatch, a literal class of the tokens.
   *
   * @type {string}
   * @readonly
   */
  readonly swatch: string;
  // #endregion
}

/**
 * Function lookColorChoices
 *
 * @description
 * The thirteen colors of `LOOK_COLORS`, in the mockup's order.
 *
 * @returns {readonly LookColorChoice[]} The choices.
 */
function lookColorChoices(): readonly LookColorChoice[] {
  return [
    { value: 'gris', label: $localize`:@@spaces.look.gris:Gray`, swatch: 'bg-ink-muted' },
    {
      value: 'violet',
      label: $localize`:@@spaces.look.violet:Amethyst`,
      swatch: 'bg-amethyste',
    },
    { value: 'indigo', label: $localize`:@@spaces.look.indigo:Indigo`, swatch: 'bg-indigo' },
    { value: 'azur', label: $localize`:@@spaces.look.azur:Azure`, swatch: 'bg-azur' },
    { value: 'lagon', label: $localize`:@@spaces.look.lagon:Lagoon`, swatch: 'bg-lagon' },
    { value: 'vert', label: $localize`:@@spaces.look.vert:Jade`, swatch: 'bg-jade' },
    { value: 'olive', label: $localize`:@@spaces.look.olive:Olive`, swatch: 'bg-olive' },
    { value: 'jaune', label: $localize`:@@spaces.look.jaune:Beacon`, swatch: 'bg-balise' },
    {
      value: 'orange',
      label: $localize`:@@spaces.look.orange:Carnelian`,
      swatch: 'bg-cornaline',
    },
    { value: 'rouge', label: $localize`:@@spaces.look.rouge:Garnet`, swatch: 'bg-grenat' },
    { value: 'rose', label: $localize`:@@spaces.look.rose:Pink`, swatch: 'bg-rose' },
    { value: 'fuchsia', label: $localize`:@@spaces.look.fuchsia:Fuchsia`, swatch: 'bg-fuchsia' },
    { value: 'ardoise', label: $localize`:@@spaces.look.ardoise:Slate`, swatch: 'bg-ardoise' },
  ];
}

/**
 * Component LookPicker
 *
 * @description
 * The « Icône » and « Couleur » groups of the space and list dialogs (`lookPicker` in
 * `App.dc.html`): a single choice among the default (the space's initial, or the list's default
 * icon) and the seventeen icons, then among the thirteen colors, each named for assistive
 * technologies. Presentational: `icon` and `color` are two-way models.
 */
@Component({
  selector: 'cw-look-picker',
  imports: [CwToggleGroup, CwToggleGroupItem, NgIcon],
  host: { class: 'flex flex-col gap-4' },
  template: `
    <div class="flex flex-col gap-2">
      <span class="text-sm leading-none font-medium" i18n="@@spaces.look.icon">Icon</span>
      <cw-toggle-group
        type="single"
        size="sm"
        class="grid grid-cols-9 gap-1"
        ariaLabel="Icon"
        i18n-ariaLabel="@@spaces.look.icon"
        data-testid="look-icons"
        [value]="iconValue()"
        (valueChange)="pickIcon($event)"
      >
        <button
          cwToggleGroupItem
          [value]="defaultValue"
          [attr.aria-label]="defaultLabel()"
          [attr.title]="defaultLabel()"
        >
          @if (initial(); as letter) {
            <span class="text-xs font-semibold" aria-hidden="true">{{ letter }}</span>
          } @else {
            <ng-icon name="phosphorListBulletsBold" aria-hidden="true" />
          }
        </button>
        @for (choice of icons; track choice.value) {
          <button
            cwToggleGroupItem
            [value]="choice.value"
            [attr.aria-label]="choice.label"
            [attr.title]="choice.label"
          >
            <ng-icon [name]="choice.name" aria-hidden="true" />
          </button>
        }
      </cw-toggle-group>
    </div>
    <div class="flex flex-col gap-2">
      <span class="text-sm leading-none font-medium" i18n="@@spaces.look.color">Color</span>
      <cw-toggle-group
        type="single"
        size="sm"
        class="flex flex-wrap gap-2"
        ariaLabel="Color"
        i18n-ariaLabel="@@spaces.look.color"
        data-testid="look-colors"
        [value]="color()"
        (valueChange)="pickColor($event)"
      >
        @for (choice of colors; track choice.value) {
          <button
            cwToggleGroupItem
            class="rounded-full"
            [value]="choice.value"
            [attr.aria-label]="choice.label"
            [attr.title]="choice.label"
          >
            <span
              class="flex size-6 items-center justify-center rounded-full text-background"
              [class]="choice.swatch"
              aria-hidden="true"
            >
              @if (color() === choice.value) {
                <ng-icon name="phosphorCheckBold" class="size-3.5" />
              }
            </span>
          </button>
        }
      </cw-toggle-group>
    </div>
  `,
})
export class LookPicker {
  // #region Properties
  /**
   * Property icon
   *
   * @description
   * The icon chosen, or null for the default.
   *
   * @type {ModelSignal<LookIcon>}
   * @readonly
   */
  public readonly icon: ModelSignal<LookIcon> = model<LookIcon>(null);

  /**
   * Property color
   *
   * @description
   * The color chosen.
   *
   * @type {ModelSignal<LookColor>}
   * @readonly
   */
  public readonly color: ModelSignal<LookColor> = model<LookColor>('gris');

  /**
   * Property initial
   *
   * @description
   * The letter the default choice shows (a space's initial), or null for the list icon.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly initial: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property defaultLabel
   *
   * @description
   * Name of the default choice (« Initiale », « Par défaut »).
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly defaultLabel: InputSignal<string> = input.required<string>();

  /**
   * Property defaultValue
   *
   * @description
   * Value of the default choice in the icon group.
   *
   * @type {string}
   * @readonly
   */
  protected readonly defaultValue: string = DEFAULT_ICON;

  /**
   * Property icons
   *
   * @description
   * The seventeen icons with their Bold glyph and name.
   *
   * @type {readonly { value: string; name: string; label: string }[]}
   * @readonly
   */
  protected readonly icons: readonly { value: string; name: string; label: string }[] =
    LOOK_ICON_KEYS.map((key: Exclude<LookIcon, null>) => ({
      value: key,
      name: lookIconName(key),
      label: lookIconLabels()[key],
    }));

  /**
   * Property colors
   *
   * @description
   * The thirteen colors.
   *
   * @type {readonly LookColorChoice[]}
   * @readonly
   */
  protected readonly colors: readonly LookColorChoice[] = lookColorChoices();

  /**
   * Property iconValue
   *
   * @description
   * The icon group's value.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly iconValue: Signal<string> = computed(
    (): string => this.icon() ?? DEFAULT_ICON,
  );
  // #endregion

  // #region Methods
  /**
   * Method pickIcon
   *
   * @description
   * Takes the icon chosen; clearing the single choice keeps the default.
   *
   * @param {string | null | readonly string[]} value - The group's value.
   */
  protected pickIcon(value: string | null | readonly string[]): void {
    const key: string | undefined = typeof value === 'string' ? value : undefined;
    this.icon.set(
      key !== undefined && (LOOK_ICON_KEYS as readonly string[]).includes(key)
        ? (key as Exclude<LookIcon, null>)
        : null,
    );
  }

  /**
   * Method pickColor
   *
   * @description
   * Takes the color chosen; clearing the single choice keeps the current color.
   *
   * @param {string | null | readonly string[]} value - The group's value.
   */
  protected pickColor(value: string | null | readonly string[]): void {
    const found: LookColorChoice | undefined = this.colors.find(
      (choice: LookColorChoice): boolean => choice.value === value,
    );
    if (found) this.color.set(found.value);
  }
  // #endregion
}
