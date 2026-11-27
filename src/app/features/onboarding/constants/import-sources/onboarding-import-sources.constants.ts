/**
 * Type OnboardingImportSource
 *
 * @description
 * A source tool of the assistant's `Import` step (`App.dc.html` lines 4274-4279): `trello`, `jira`,
 * `csv` (a CSV file) or `later`.
 *
 * @type {'trello' | 'jira' | 'csv' | 'later'}
 */
export type OnboardingImportSource = 'trello' | 'jira' | 'csv' | 'later';

/**
 * Interface OnboardingImportChoice
 *
 * @description
 * One source card of the `Import` step.
 */
export interface OnboardingImportChoice {
  // #region Properties
  /**
   * Property value
   *
   * @description
   * The source.
   *
   * @type {OnboardingImportSource}
   * @readonly
   */
  readonly value: OnboardingImportSource;

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
   * Name of the source.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property available
   *
   * @description
   * Whether the card can be chosen. Only `later` is: no public operation imports anything yet
   * (gap B18, the contract defers import), so the three tools show disabled.
   *
   * @type {boolean}
   * @readonly
   */
  readonly available: boolean;
  // #endregion
}

/**
 * Constant ONBOARDING_IMPORT_DEFAULT
 *
 * @description
 * The source chosen by default and, until an import operation exists (gap B18), the only one.
 *
 * @type {OnboardingImportSource}
 */
export const ONBOARDING_IMPORT_DEFAULT: OnboardingImportSource = 'later';

/**
 * Function onboardingImportSources
 *
 * @description
 * The four source cards in the mockup's order. Built on each call so the copy follows the runtime
 * locale.
 *
 * @returns {readonly OnboardingImportChoice[]} The source cards.
 */
export function onboardingImportSources(): readonly OnboardingImportChoice[] {
  return [
    {
      value: 'trello',
      icon: 'phosphorKanbanBold',
      label: $localize`:@@onboarding.wizard.import.trello:Trello`,
      available: false,
    },
    {
      value: 'jira',
      icon: 'phosphorBugBold',
      label: $localize`:@@onboarding.wizard.import.jira:Jira`,
      available: false,
    },
    {
      value: 'csv',
      icon: 'phosphorFileCsvBold',
      label: $localize`:@@onboarding.wizard.import.csv:CSV file`,
      available: false,
    },
    {
      value: 'later',
      icon: 'phosphorClockBold',
      label: $localize`:@@onboarding.wizard.import.later:Later`,
      available: true,
    },
  ];
}
