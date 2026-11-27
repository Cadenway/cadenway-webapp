import { Component, computed, input, type InputSignal, type Signal } from '@angular/core';
import { CwMeter, type CwMeterFormat } from '@cadenway/ui/components/meter';

import type {
  WorkloadRow,
  WorkloadZone,
} from '../../../models/workload-row/workload-row.interface';

/**
 * Component WorkloadCard
 *
 * @description
 * The `Workload per person` card of the dashboard (`App.dc.html` lines 1851-1860): for each
 * assignee, their initials beside a `cw-meter` named after them, `n / 6` against the threshold
 * (the meter's `max`, so a load above it fills the track), in the zone the store gave: `High load`
 * (balise) from one task under the threshold, `Overloaded` (grenat) above it. The meter writes its
 * note under the track, where the mockup writes it after the name. The caption says what is
 * measured. Without any assignee the card says so. Presentational: inputs only.
 */
@Component({
  selector: 'cw-workload-card',
  imports: [CwMeter],
  host: { class: 'block' },
  templateUrl: './workload-card.component.html',
})
export class WorkloadCard {
  // #region Properties
  /**
   * Property rows
   *
   * @description
   * The assignees and their loads, in the order to show.
   *
   * @type {InputSignal<readonly WorkloadRow[]>}
   * @readonly
   */
  public readonly rows: InputSignal<readonly WorkloadRow[]> =
    input.required<readonly WorkloadRow[]>();

  /**
   * Property threshold
   *
   * @description
   * Open tasks one person can take on (6).
   *
   * @type {InputSignal<number>}
   * @readonly
   */
  public readonly threshold: InputSignal<number> = input.required<number>();

  /**
   * Property format
   *
   * @description
   * The meter's value text, `7 / 6`, also its `aria-valuetext`.
   *
   * @type {CwMeterFormat}
   * @readonly
   */
  protected readonly format: CwMeterFormat = (value: number, max: number): string =>
    `${String(value)} / ${String(max)}`;

  /**
   * Property caption
   *
   * @description
   * What the meters measure: `Open tasks assigned, against a capacity of 6 per sprint.`
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly caption: Signal<string> = computed((): string => {
    const threshold: number = this.threshold();
    return $localize`:@@dashboards.workload.caption:Open tasks assigned, against a capacity of ${threshold}:threshold: per sprint.`;
  });

  /**
   * Property notes
   *
   * @description
   * The note of each zone; none in the normal zone.
   *
   * @type {Readonly<Record<WorkloadZone, string>>}
   * @readonly
   */
  protected readonly notes: Readonly<Record<WorkloadZone, string>> = {
    normal: '',
    high: $localize`:@@dashboards.workload.high:High load`,
    critical: $localize`:@@dashboards.workload.overloaded:Overloaded`,
  };
  // #endregion
}
