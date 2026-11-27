import { Component, computed, input, type InputSignal, type Signal } from '@angular/core';
import type { StatusKey } from '@cadenway/contracts';
import { CwProgress } from '@cadenway/ui/components/progress';
import { CwStatusIcon } from '@cadenway/ui/components/status-icon';

import { defaultStatusOptions, statusLabel } from '@features/task';

import type { DashboardStatusCount } from '../../../models/team-dashboard/team-dashboard.interface';

/**
 * Interface StatusLine
 *
 * @description
 * One status of the breakdown as it is drawn.
 */
interface StatusLine {
  // #region Properties
  /**
   * Property status
   *
   * @description
   * The status.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;

  /**
   * Property label
   *
   * @description
   * Its default word (gap G-D2: a space's own names do not apply across spaces).
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property count
   *
   * @description
   * Tasks in it.
   *
   * @type {number}
   * @readonly
   */
  readonly count: number;
  // #endregion
}

/**
 * Component StatusBreakdown
 *
 * @description
 * The `By status` card of the dashboard (`App.dc.html` lines 1861-1870): each status the visible
 * tasks have, in workflow order, with its icon and default word, a bar against the largest count
 * (`cw-progress`, named after the status) and the count. Milestones and tasks share the counts, so
 * every status reads with the task icon and word. Statuses without a task are left out,
 * as the contract does. Presentational: inputs only.
 */
@Component({
  selector: 'cw-status-breakdown',
  imports: [CwProgress, CwStatusIcon],
  host: { class: 'block' },
  templateUrl: './status-breakdown.component.html',
})
export class StatusBreakdown {
  // #region Properties
  /**
   * Property counts
   *
   * @description
   * The represented statuses with their counts.
   *
   * @type {InputSignal<readonly DashboardStatusCount[]>}
   * @readonly
   */
  public readonly counts: InputSignal<readonly DashboardStatusCount[]> =
    input.required<readonly DashboardStatusCount[]>();

  /**
   * Property lines
   *
   * @description
   * The statuses with a task, with their words.
   *
   * @type {Signal<readonly StatusLine[]>}
   * @readonly
   */
  protected readonly lines: Signal<readonly StatusLine[]> = computed((): readonly StatusLine[] =>
    this.counts()
      .filter((row: DashboardStatusCount): boolean => row.count > 0)
      .map((row: DashboardStatusCount): StatusLine => ({
        status: row.status,
        label: statusLabel(row.status, defaultStatusOptions(), false),
        count: row.count,
      })),
  );

  /**
   * Property max
   *
   * @description
   * The largest count, the full width of a bar; 1 at least.
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly max: Signal<number> = computed((): number =>
    Math.max(1, ...this.lines().map((line: StatusLine): number => line.count)),
  );
  // #endregion
}
