import { Component, computed, input, type InputSignal, type Signal } from '@angular/core';
import { CwStat, CwStatGroup } from '@cadenway/ui/components/stat';

import type { GoalStats as GoalFigures } from '../../../models/goal/goal.interface';

/**
 * Component GoalStats
 *
 * @description
 * The statistics strip of the goals page (`App.dc.html` lines 1578-1580 and 5170-5175): `Goals`
 * with the quarter, `Average progress` with the expected progress, `On track` with the achieved
 * goals and `At risk or behind`. Four `cw-stat` in a `cw-stat-group`, laid out two by two below
 * 1024 px with inner borders, which the brick does not offer yet (DS3). The labels are medium
 * weight, as the mockup draws them (line 1579), which the brick does not set. Presentational.
 */
@Component({
  selector: 'cw-goal-stats',
  imports: [CwStat, CwStatGroup],
  template: `
    @let figures = stats();
    <cw-stat-group
      class="max-lg:grid-flow-row max-lg:grid-cols-2 max-lg:[&>*:nth-child(2)]:border-e-0 max-lg:[&>*:nth-child(n+3)]:border-t max-lg:[&>*:nth-child(3)]:border-s-0 [&>cw-stat>:first-child]:font-medium"
      [ariaLabel]="groupLabel"
    >
      <cw-stat [label]="countLabel" [value]="figures.count" [comparison]="quarterLabel()" />
      <cw-stat [label]="averageLabel" [value]="averageText()" [comparison]="expectedText()" />
      <cw-stat [label]="onTrackLabel" [value]="figures.onTrack" [comparison]="achievedText()" />
      <cw-stat [label]="atRiskLabel" [value]="figures.atRisk" [comparison]="atRiskHint" />
    </cw-stat-group>
  `,
})
export class GoalStats {
  // #region Properties
  /**
   * Property stats
   *
   * @description
   * The figures.
   *
   * @type {InputSignal<GoalFigures>}
   * @readonly
   */
  public readonly stats: InputSignal<GoalFigures> = input.required<GoalFigures>();

  /**
   * Property quarterLabel
   *
   * @description
   * Name of the quarter shown (`Q4 2026`).
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly quarterLabel: InputSignal<string> = input.required<string>();

  /**
   * Property groupLabel
   *
   * @description
   * Accessible name of the strip.
   *
   * @type {string}
   * @readonly
   */
  protected readonly groupLabel: string = $localize`:@@goals.stats.label:Goals of the quarter`;

  /**
   * Property countLabel
   *
   * @description
   * Label of the goal count.
   *
   * @type {string}
   * @readonly
   */
  protected readonly countLabel: string = $localize`:@@goals.stats.count:Goals`;

  /**
   * Property averageLabel
   *
   * @description
   * Label of the average progress.
   *
   * @type {string}
   * @readonly
   */
  protected readonly averageLabel: string = $localize`:@@goals.stats.average:Average progress`;

  /**
   * Property onTrackLabel
   *
   * @description
   * Label of the goals on track.
   *
   * @type {string}
   * @readonly
   */
  protected readonly onTrackLabel: string = $localize`:@@goals.stats.on-track:On track`;

  /**
   * Property atRiskLabel
   *
   * @description
   * Label of the goals at risk or behind.
   *
   * @type {string}
   * @readonly
   */
  protected readonly atRiskLabel: string = $localize`:@@goals.stats.at-risk:At risk or behind`;

  /**
   * Property atRiskHint
   *
   * @description
   * Hint of the goals at risk or behind.
   *
   * @type {string}
   * @readonly
   */
  protected readonly atRiskHint: string = $localize`:@@goals.stats.at-risk-hint:to review at the team meeting`;

  /**
   * Property averageText
   *
   * @description
   * The average progress with its unit.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly averageText: Signal<string> = computed(
    (): string => $localize`:@@goals.stats.average-value:${this.stats().averagePercent}:percent:%`,
  );

  /**
   * Property expectedText
   *
   * @description
   * Hint of the average progress.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly expectedText: Signal<string> = computed(
    (): string =>
      $localize`:@@goals.stats.expected:expected: ${this.stats().expectedPercent}:percent:%`,
  );

  /**
   * Property achievedText
   *
   * @description
   * Hint of the goals on track.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly achievedText: Signal<string> = computed(
    (): string =>
      $localize`:@@goals.stats.achieved:including achieved: ${this.stats().achieved}:count:`,
  );
  // #endregion
}
