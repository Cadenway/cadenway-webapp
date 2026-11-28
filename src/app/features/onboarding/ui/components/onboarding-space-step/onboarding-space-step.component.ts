import { _IdGenerator } from '@angular/cdk/a11y';
import {
  Component,
  computed,
  inject,
  input,
  type InputSignal,
  model,
  type ModelSignal,
  type Signal,
} from '@angular/core';
import { type FieldTree, form, FormField, maxLength } from '@angular/forms/signals';
import { CwInput } from '@cadenway/ui/components/input';
import { CwToggleGroup, CwToggleGroupItem } from '@cadenway/ui/components/toggle-group';
import { NgIcon } from '@ng-icons/core';

import {
  type LookColor,
  type LookColorChoice,
  lookColorChoices,
} from '@features/spaces/utils/space-look';

/**
 * Constant SPACE_NAME_MAX_LENGTH
 *
 * @description
 * Longest space name the contract accepts (`SpaceName`, 1 to 80 characters).
 *
 * @type {number}
 */
const SPACE_NAME_MAX_LENGTH: number = 80;

/**
 * Component OnboardingSpaceStep
 *
 * @description
 * The assistant's `Space` screen (`App.dc.html` lines 2684-2687): the space name, `aria-invalid`
 * while blank (the assistant then cannot continue), and the color among Spaces' swatches without
 * `gris` (line 5254), as a single-choice toggle group like Spaces' look picker. The key prefix is
 * not shown: the assistant derives it from the name. The name field is the 36 px (`lg`) input. Each
 * swatch is the mockup's 32 px ring (`p-0.5`, `ring-primary/60` once checked) rather than the toggle
 * item's grey 40 x 28 pill: the toggle group keeps the radio semantics and the keyboard, and the
 * important modifiers replace the item's size, radius, padding and selected background, which its
 * own classes would otherwise win (a swatch item is a design-system need). It edits `name` and
 * `color` and sends nothing.
 */
@Component({
  selector: 'cw-onboarding-space-step',
  imports: [CwInput, CwToggleGroup, CwToggleGroupItem, FormField, NgIcon],
  host: { class: 'flex flex-col gap-6' },
  template: `
    <div class="flex flex-col gap-2">
      <label
        class="text-sm leading-none font-medium"
        i18n="@@onboarding.wizard.space.name"
        [attr.for]="fieldId"
        >Space name</label
      >
      <input
        cwInput
        size="lg"
        type="text"
        autocomplete="off"
        [id]="fieldId"
        [placeholder]="placeholder()"
        [formField]="nameField"
        [attr.aria-invalid]="blank() ? 'true' : null"
        data-testid="onboarding-space-name"
      />
    </div>
    <div class="flex flex-col gap-2">
      <span class="text-sm leading-none font-medium" i18n="@@onboarding.wizard.space.color"
        >Color</span
      >
      <cw-toggle-group
        type="single"
        size="sm"
        class="flex flex-wrap gap-2"
        ariaLabel="Color"
        i18n-ariaLabel="@@onboarding.wizard.space.color"
        data-testid="onboarding-space-colors"
        [value]="color()"
        (valueChange)="pick($event)"
      >
        @for (choice of colors; track choice.value) {
          <button
            cwToggleGroupItem
            class="size-8! min-w-8! rounded-full! p-0.5! ring-2 ring-transparent transition-shadow hover:bg-transparent! aria-checked:ring-primary/60 data-[state=on]:bg-transparent!"
            [value]="choice.value"
            [attr.aria-label]="choice.label"
            [attr.title]="choice.label"
          >
            <span
              class="flex size-7 items-center justify-center rounded-full text-background"
              [class]="choice.swatch"
              aria-hidden="true"
            >
              @if (color() === choice.value) {
                <ng-icon name="phosphorCheckBold" size="0.875rem" />
              }
            </span>
          </button>
        }
      </cw-toggle-group>
    </div>
  `,
})
export class OnboardingSpaceStep {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * The space name as typed.
   *
   * @type {ModelSignal<string>}
   * @readonly
   */
  public readonly name: ModelSignal<string> = model<string>('');

  /**
   * Property color
   *
   * @description
   * The space color; a color without a swatch (`gris`) shows no selection.
   *
   * @type {ModelSignal<LookColor>}
   * @readonly
   */
  public readonly color: ModelSignal<LookColor> = model<LookColor>('violet');

  /**
   * Property placeholder
   *
   * @description
   * Placeholder of the name field: the default name.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly placeholder: InputSignal<string> = input<string>('');

  /**
   * Property fieldId
   *
   * @description
   * Id of the name field, for its label.
   *
   * @type {string}
   * @readonly
   */
  protected readonly fieldId: string = inject(_IdGenerator).getId('cw-onboarding-space-name-');

  /**
   * Property nameField
   *
   * @description
   * Signal Forms field over the `name` model.
   *
   * @type {FieldTree<string>}
   * @readonly
   */
  protected readonly nameField: FieldTree<string> = form(this.name, (path) => {
    maxLength(path, SPACE_NAME_MAX_LENGTH);
  });

  /**
   * Property blank
   *
   * @description
   * Whether the name is blank.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly blank: Signal<boolean> = computed((): boolean => this.name().trim() === '');

  /**
   * Property colors
   *
   * @description
   * Spaces' swatches without `gris`, in the mockup's order.
   *
   * @type {readonly LookColorChoice[]}
   * @readonly
   */
  protected readonly colors: readonly LookColorChoice[] = lookColorChoices().filter(
    (choice: LookColorChoice): boolean => choice.value !== 'gris',
  );
  // #endregion

  // #region Methods
  /**
   * Method pick
   *
   * @description
   * Takes the swatch chosen; a click on the selected swatch, which clears a toggle group, keeps
   * the color.
   *
   * @param {string | null | readonly string[]} value - The toggle group's value.
   */
  protected pick(value: string | null | readonly string[]): void {
    const found: LookColorChoice | undefined = this.colors.find(
      (choice: LookColorChoice): boolean => choice.value === value,
    );
    if (found) this.color.set(found.value);
  }
  // #endregion
}
