import { Component, model, type ModelSignal } from '@angular/core';
import { CwRadioGroup, CwRadioGroupItem } from '@cadenway/ui/components/radio-group';
import { NgIcon } from '@ng-icons/core';

import {
  type OnboardingPresetChoice,
  onboardingPresets,
} from '../../../constants/presets/onboarding-presets.constants';
import type { OnboardingPreset } from '../../../models/onboarding/onboarding.type';

/**
 * Component OnboardingPresetStep
 *
 * @description
 * The assistant's `Template` screen (`App.dc.html` lines 2688-2692): a radio group named `Space
 * template` of four cards without a radio dot, each with its icon, name, line and list names. It
 * edits `preset` and sends nothing. The checked card's icon is `text-primary`, as in the mockup;
 * its border and fill use the design system's ink tone where the mockup tints them violet (a
 * token rule of the card radio).
 */
@Component({
  selector: 'cw-onboarding-preset-step',
  imports: [CwRadioGroup, CwRadioGroupItem, NgIcon],
  template: `
    <cw-radio-group
      class="grid grid-cols-1 gap-2 sm:grid-cols-2"
      ariaLabel="Space template"
      i18n-ariaLabel="@@onboarding.wizard.preset.label"
      data-testid="onboarding-presets"
      [value]="preset()"
      (valueChange)="pick($event)"
    >
      @for (choice of presets; track choice.value) {
        <cw-radio-group-item variant="card" [indicator]="false" [value]="choice.value">
          <span class="flex items-start gap-3">
            <ng-icon
              size="1.25rem"
              class="mt-0.5 shrink-0"
              [class.text-primary]="preset() === choice.value"
              [class.text-muted-foreground]="preset() !== choice.value"
              [name]="choice.icon"
              aria-hidden="true"
            />
            <span class="flex min-w-0 flex-col gap-0.5">
              <span class="text-sm font-medium">{{ choice.label }}</span>
              <span class="text-xs text-muted-foreground">{{ choice.text }}</span>
              <span class="mt-1 truncate text-xs text-muted-foreground">{{ choice.lists }}</span>
            </span>
          </span>
        </cw-radio-group-item>
      }
    </cw-radio-group>
  `,
})
export class OnboardingPresetStep {
  // #region Properties
  /**
   * Property preset
   *
   * @description
   * The template chosen.
   *
   * @type {ModelSignal<OnboardingPreset>}
   * @readonly
   */
  public readonly preset: ModelSignal<OnboardingPreset> = model<OnboardingPreset>('dev');

  /**
   * Property presets
   *
   * @description
   * The template cards.
   *
   * @type {readonly OnboardingPresetChoice[]}
   * @readonly
   */
  protected readonly presets: readonly OnboardingPresetChoice[] = onboardingPresets();
  // #endregion

  // #region Methods
  /**
   * Method pick
   *
   * @description
   * Takes the card chosen.
   *
   * @param {string | null} value - The radio group's value.
   */
  protected pick(value: string | null): void {
    const found: OnboardingPresetChoice | undefined = this.presets.find(
      (choice: OnboardingPresetChoice): boolean => choice.value === value,
    );
    if (found) this.preset.set(found.value);
  }
  // #endregion
}
