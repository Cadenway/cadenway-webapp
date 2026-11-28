import { Component } from '@angular/core';
import { CwRadioGroup, CwRadioGroupItem } from '@cadenway/ui/components/radio-group';
import { NgIcon } from '@ng-icons/core';

import {
  ONBOARDING_IMPORT_DEFAULT,
  type OnboardingImportChoice,
  type OnboardingImportSource,
  onboardingImportSources,
} from '../../../constants/import-sources/onboarding-import-sources.constants';

/**
 * Component OnboardingImportStep
 *
 * @description
 * The assistant's `Import` screen (`App.dc.html` lines 2697-2701): a radio group named `Source
 * tool` of four cards. No public operation imports anything (gap B18: the contract defers
 * import), so `Trello`, `Jira` and `CSV file` show disabled and `Later` stays checked; the screen
 * keeps its place so the counter stays `of 4`, as in the mockup and the contract's `import` step.
 * It emits nothing. The checked card's icon and name are `text-primary`, as in the mockup.
 */
@Component({
  selector: 'cw-onboarding-import-step',
  imports: [CwRadioGroup, CwRadioGroupItem, NgIcon],
  template: `
    <cw-radio-group
      class="grid grid-cols-2 gap-2 sm:grid-cols-4"
      ariaLabel="Source tool"
      i18n-ariaLabel="@@onboarding.wizard.import.label"
      data-testid="onboarding-imports"
      [value]="selected"
    >
      @for (choice of sources; track choice.value) {
        <cw-radio-group-item
          variant="card"
          [indicator]="false"
          [value]="choice.value"
          [disabled]="!choice.available"
        >
          <span
            class="flex flex-col items-center gap-2 text-sm font-medium"
            [class.text-primary]="choice.value === selected"
          >
            <ng-icon size="1.25rem" [name]="choice.icon" aria-hidden="true" />
            {{ choice.label }}
          </span>
        </cw-radio-group-item>
      }
    </cw-radio-group>
  `,
})
export class OnboardingImportStep {
  // #region Properties
  /**
   * Property sources
   *
   * @description
   * The source cards.
   *
   * @type {readonly OnboardingImportChoice[]}
   * @readonly
   */
  protected readonly sources: readonly OnboardingImportChoice[] = onboardingImportSources();

  /**
   * Property selected
   *
   * @description
   * The source checked: `later`, the only one available.
   *
   * @type {OnboardingImportSource}
   * @readonly
   */
  protected readonly selected: OnboardingImportSource = ONBOARDING_IMPORT_DEFAULT;
  // #endregion
}
