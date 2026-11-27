import { Component, computed, input, type InputSignal, type Signal } from '@angular/core';
import { CwProgress, type CwProgressVariant } from '@cadenway/ui/components/progress';

import type { GoalHealth } from '../../../models/goal/goal.interface';

/**
 * Interface HealthLook
 *
 * @description
 * How a health reads: its word, the classes of its pill and dot, and the bar's variant.
 */
interface HealthLook {
  // #region Properties
  /**
   * Property label
   *
   * @description
   * The health's word.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property pill
   *
   * @description
   * Literal classes of the pill.
   *
   * @type {string}
   * @readonly
   */
  readonly pill: string;

  /**
   * Property dot
   *
   * @description
   * Literal class of the pill's dot.
   *
   * @type {string}
   * @readonly
   */
  readonly dot: string;

  /**
   * Property bar
   *
   * @description
   * Variant of the progress bar; `cw-progress` has no amber fill, so an at-risk goal keeps the
   * default one.
   *
   * @type {CwProgressVariant}
   * @readonly
   */
  readonly bar: CwProgressVariant;
  // #endregion
}

/**
 * Component GoalProgress
 *
 * @description
 * The health pill, the progress bar and the percentage of a goal row (`App.dc.html` lines
 * 1597-1601). The bar is `cw-progress` (`Progress`); a vertical tick over it marks the expected
 * progress, since the brick has no marker (gap G-G5, DS2), and the group's title explains it. The
 * bar takes its own full-width line below 640 px and 12 rem from there. A health a later contract adds
 * shows no pill. Presentational.
 */
@Component({
  selector: 'cw-goal-progress',
  imports: [CwProgress],
  host: { class: 'contents' },
  template: `
    @if (look(); as health) {
      <span
        class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
        [class]="health.pill"
        data-testid="goal-health"
      >
        <span class="size-1.5 rounded-full" [class]="health.dot" aria-hidden="true"></span>
        {{ health.label }}
      </span>
    }
    <div
      class="flex w-full items-center gap-2 max-sm:order-1 max-sm:px-3 max-sm:pb-1 sm:w-48"
      title="Vertical line: expected progress at this date"
      i18n-title="@@goals.goal.expected-title"
    >
      <div class="relative min-w-0 flex-1">
        <cw-progress
          [value]="percent()"
          [variant]="look()?.bar ?? 'default'"
          [ariaLabel]="progressLabel"
          [valueText]="percentText()"
        />
        <span
          class="absolute -top-1 h-3.5 w-px bg-foreground/50"
          [style.left.%]="expected()"
          aria-hidden="true"
        ></span>
      </div>
      <span
        class="w-10 shrink-0 text-right text-sm font-medium tabular-nums"
        data-testid="goal-percent"
        >{{ percentText() }}</span
      >
    </div>
  `,
})
export class GoalProgress {
  // #region Properties
  /**
   * Property health
   *
   * @description
   * The goal's health, or null for one a later contract adds.
   *
   * @type {InputSignal<GoalHealth | null>}
   * @readonly
   */
  public readonly health: InputSignal<GoalHealth | null> = input<GoalHealth | null>(null);

  /**
   * Property percent
   *
   * @description
   * Rounded progress of the goal.
   *
   * @type {InputSignal<number>}
   * @readonly
   */
  public readonly percent: InputSignal<number> = input.required<number>();

  /**
   * Property expected
   *
   * @description
   * Rounded share of the quarter elapsed, where the tick stands.
   *
   * @type {InputSignal<number>}
   * @readonly
   */
  public readonly expected: InputSignal<number> = input.required<number>();

  /**
   * Property progressLabel
   *
   * @description
   * Accessible name of the bar.
   *
   * @type {string}
   * @readonly
   */
  protected readonly progressLabel: string = $localize`:@@goals.goal.progress:Progress`;

  /**
   * Property percentText
   *
   * @description
   * The percentage beside the bar.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly percentText: Signal<string> = computed(
    (): string => $localize`:@@goals.goal.percent:${this.percent()}:percent:%`,
  );

  /**
   * Property look
   *
   * @description
   * How the health reads, or null without a known health.
   *
   * @type {Signal<HealthLook | null>}
   * @readonly
   */
  protected readonly look: Signal<HealthLook | null> = computed((): HealthLook | null => {
    switch (this.health()) {
      case 'achieved':
        return {
          label: $localize`:@@goals.health.achieved:Achieved`,
          pill: 'bg-jade/10 text-jade-text',
          dot: 'bg-jade',
          bar: 'success',
        };
      case 'on-track':
        return {
          label: $localize`:@@goals.health.on-track:On track`,
          pill: 'bg-jade/10 text-jade-text',
          dot: 'bg-jade',
          bar: 'success',
        };
      case 'at-risk':
        return {
          label: $localize`:@@goals.health.at-risk:At risk`,
          pill: 'bg-balise/10 text-balise-text',
          dot: 'bg-balise',
          bar: 'default',
        };
      case 'behind':
        return {
          label: $localize`:@@goals.health.behind:Behind`,
          pill: 'bg-grenat/10 text-grenat-text',
          dot: 'bg-grenat',
          bar: 'destructive',
        };
      default:
        return null;
    }
  });
  // #endregion
}
