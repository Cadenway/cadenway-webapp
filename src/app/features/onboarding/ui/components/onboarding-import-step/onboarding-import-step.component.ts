import { NgTemplateOutlet } from '@angular/common';
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
 * It emits nothing. The checked card's icon and name are `text-primary`, as in the mockup. The
 * cards are written out rather than repeated with `@for`, since the radio group reads every item's
 * value before a repeated item has its inputs and `Later` is the fourth card (NG0950, see
 * `OnboardingPresetStep`).
 */
@Component({
  selector: 'cw-onboarding-import-step',
  imports: [CwRadioGroup, CwRadioGroupItem, NgIcon, NgTemplateOutlet],
  template: `
    <cw-radio-group
      class="grid grid-cols-2 gap-2 sm:grid-cols-4"
      ariaLabel="Source tool"
      i18n-ariaLabel="@@onboarding.wizard.import.label"
      data-testid="onboarding-imports"
      [value]="selected"
    >
      <cw-radio-group-item
        variant="card"
        [indicator]="false"
        [value]="sources[0].value"
        [disabled]="!sources[0].available"
      >
        <ng-container *ngTemplateOutlet="card; context: { $implicit: sources[0] }" />
      </cw-radio-group-item>
      <cw-radio-group-item
        variant="card"
        [indicator]="false"
        [value]="sources[1].value"
        [disabled]="!sources[1].available"
      >
        <ng-container *ngTemplateOutlet="card; context: { $implicit: sources[1] }" />
      </cw-radio-group-item>
      <cw-radio-group-item
        variant="card"
        [indicator]="false"
        [value]="sources[2].value"
        [disabled]="!sources[2].available"
      >
        <ng-container *ngTemplateOutlet="card; context: { $implicit: sources[2] }" />
      </cw-radio-group-item>
      <cw-radio-group-item
        variant="card"
        [indicator]="false"
        [value]="sources[3].value"
        [disabled]="!sources[3].available"
      >
        <ng-container *ngTemplateOutlet="card; context: { $implicit: sources[3] }" />
      </cw-radio-group-item>
    </cw-radio-group>

    <ng-template #card let-choice>
      <span
        class="flex flex-col items-center gap-2 text-sm font-medium"
        [class.text-primary]="choice.value === selected"
      >
        <ng-icon class="size-5" [name]="choice.icon" aria-hidden="true" />
        {{ choice.label }}
      </span>
    </ng-template>
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
