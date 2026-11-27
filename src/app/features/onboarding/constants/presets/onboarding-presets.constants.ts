import type { OnboardingPreset } from '../../models/onboarding/onboarding.type';

/**
 * Interface OnboardingPresetChoice
 *
 * @description
 * One template card of the assistant's `Template` step (`App.dc.html` lines 4268-4273): what it
 * shows and how many lists the gateway creates with it.
 */
export interface OnboardingPresetChoice {
  // #region Properties
  /**
   * Property value
   *
   * @description
   * The template sent to `finishOnboarding`.
   *
   * @type {OnboardingPreset}
   * @readonly
   */
  readonly value: OnboardingPreset;

  /**
   * Property icon
   *
   * @description
   * Phosphor icon of the card.
   *
   * @type {string}
   * @readonly
   */
  readonly icon: string;

  /**
   * Property label
   *
   * @description
   * Name of the template.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property text
   *
   * @description
   * One line on what the template sets up.
   *
   * @type {string}
   * @readonly
   */
  readonly text: string;

  /**
   * Property lists
   *
   * @description
   * Preview of the list names, joined with ` · `. The gateway creates the contract's names (French
   * for every template, contract gap G7); the English source previews them in English.
   *
   * @type {string}
   * @readonly
   */
  readonly lists: string;

  /**
   * Property listCount
   *
   * @description
   * Number of lists the gateway creates (the contract's table in `finishOnboarding`), counted by
   * the creation toast.
   *
   * @type {number}
   * @readonly
   */
  readonly listCount: number;
  // #endregion
}

/**
 * Function onboardingPresets
 *
 * @description
 * The four templates in the mockup's order, `dev` first (the contract's default). Built on each
 * call so the copy follows the runtime locale.
 *
 * @returns {readonly OnboardingPresetChoice[]} The template cards.
 */
export function onboardingPresets(): readonly OnboardingPresetChoice[] {
  return [
    {
      value: 'dev',
      icon: 'phosphorCodeBold',
      label: $localize`:@@onboarding.wizard.preset.dev.label:Software development`,
      text: $localize`:@@onboarding.wizard.preset.dev.text:Backlog, sprint and bugs, with code review.`,
      lists: $localize`:@@onboarding.wizard.preset.dev.lists:Backlog · Sprint 1 · Bugs`,
      listCount: 3,
    },
    {
      value: 'mkt',
      icon: 'phosphorMegaphoneBold',
      label: $localize`:@@onboarding.wizard.preset.mkt.label:Marketing`,
      text: $localize`:@@onboarding.wizard.preset.mkt.text:Editorial calendar and campaigns.`,
      lists: $localize`:@@onboarding.wizard.preset.mkt.lists:Editorial calendar · Campaigns`,
      listCount: 2,
    },
    {
      value: 'agency',
      icon: 'phosphorBriefcaseBold',
      label: $localize`:@@onboarding.wizard.preset.agency.label:Agency and clients`,
      text: $localize`:@@onboarding.wizard.preset.agency.text:One project per client, centralized requests.`,
      lists: $localize`:@@onboarding.wizard.preset.agency.lists:Client projects · Requests`,
      listCount: 2,
    },
    {
      value: 'blank',
      icon: 'phosphorSquareBold',
      label: $localize`:@@onboarding.wizard.preset.blank.label:Start from scratch`,
      text: $localize`:@@onboarding.wizard.preset.blank.text:A single empty list, over to you.`,
      lists: $localize`:@@onboarding.wizard.preset.blank.lists:First list`,
      listCount: 1,
    },
  ];
}
