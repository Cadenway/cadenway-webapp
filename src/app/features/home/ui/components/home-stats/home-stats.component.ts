import { Component, computed, input, type InputSignal, type Signal } from '@angular/core';
import { CwStat, CwStatGroup } from '@cadenway/ui/components/stat';

import type { HomeStats as HomeStatsModel } from '../../../models/home-read/home-read.interface';
import { takesSingular } from '../../../utils/plural/plural.util';

/**
 * Interface HomeStatsHints
 *
 * @description
 * The hint under each counter, in the count's plural form.
 */
interface HomeStatsHints {
  // #region Properties
  /**
   * Property assigned
   *
   * @description
   * Hint of `Assigned to me`.
   *
   * @type {string}
   * @readonly
   */
  readonly assigned: string;

  /**
   * Property dueToday
   *
   * @description
   * Hint of `Today`.
   *
   * @type {string}
   * @readonly
   */
  readonly dueToday: string;

  /**
   * Property done
   *
   * @description
   * Hint of `Done`.
   *
   * @type {string}
   * @readonly
   */
  readonly done: string;
  // #endregion
}

/**
 * Type HomeStatsCopyKey
 *
 * @description
 * The texts of the counters strip.
 *
 * @type {'assigned' | 'assignedOne' | 'assignedOther' | 'late' | 'lateHint' | 'dueToday' | 'dueTodayOne' | 'dueTodayOther' | 'done' | 'doneOne' | 'doneOther'}
 */
type HomeStatsCopyKey =
  | 'assigned'
  | 'assignedOne'
  | 'assignedOther'
  | 'late'
  | 'lateHint'
  | 'dueToday'
  | 'dueTodayOne'
  | 'dueTodayOther'
  | 'done'
  | 'doneOne'
  | 'doneOther';

/**
 * Constant HOME_STATS_COPY
 *
 * @description
 * The labels and hints of the counters (`App.dc.html` lines 6653-6656). The mockup's `Done` hint
 * says "since the start of the sprint", which the contract does not count (gap G-H1): `stats.done`
 * counts every done task assigned to the caller, so the hint says so.
 *
 * @type {Readonly<Record<HomeStatsCopyKey, string>>}
 */
const HOME_STATS_COPY: Readonly<Record<HomeStatsCopyKey, string>> = {
  assigned: $localize`:@@home.stats.assigned:Assigned to me`,
  assignedOne: $localize`:@@home.stats.assigned-hint.one:open task`,
  assignedOther: $localize`:@@home.stats.assigned-hint.other:open tasks`,
  late: $localize`:@@home.stats.late:Late`,
  lateHint: $localize`:@@home.stats.late-hint:to reschedule`,
  dueToday: $localize`:@@home.stats.due-today:Today`,
  dueTodayOne: $localize`:@@home.stats.due-today-hint.one:due today`,
  dueTodayOther: $localize`:@@home.stats.due-today-hint.other:due today`,
  done: $localize`:@@home.stats.done:Done`,
  doneOne: $localize`:@@home.stats.done-hint.one:task completed in total`,
  doneOther: $localize`:@@home.stats.done-hint.other:tasks completed in total`,
};

/**
 * Component HomeStats
 *
 * @description
 * The counters strip of the home screen (`App.dc.html` lines 1690-1698): `Assigned to me`, `Late`
 * (grenat above 0), `Today` and `Done`, each with its value and a hint in the plural form of its
 * count (`Intl.PluralRules` of the running locale). Four `cw-stat` in one `cw-stat-group`: four
 * columns from 1024 px, a 2×2 grid with inner borders below (the group's one-row layout is
 * overridden here, brick gap DS3). Presentational: one input.
 */
@Component({
  selector: 'cw-home-stats',
  imports: [CwStat, CwStatGroup],
  host: { class: 'block' },
  template: `
    @let shown = stats();
    <cw-stat-group class="grid-flow-row! grid-cols-2 lg:grid-cols-4" data-testid="home-stats">
      <cw-stat [label]="copy.assigned" [value]="shown.assigned" [comparison]="hints().assigned" />
      <cw-stat
        class="max-lg:border-e-0"
        [class.text-grenat-text]="shown.late > 0"
        [label]="copy.late"
        [value]="shown.late"
        [comparison]="copy.lateHint"
        data-testid="home-stats-late"
      />
      <cw-stat
        class="max-lg:border-t max-lg:border-border"
        [label]="copy.dueToday"
        [value]="shown.dueToday"
        [comparison]="hints().dueToday"
      />
      <cw-stat
        class="max-lg:border-t max-lg:border-border"
        [label]="copy.done"
        [value]="shown.done"
        [comparison]="hints().done"
      />
    </cw-stat-group>
  `,
})
export class HomeStats {
  // #region Properties
  /**
   * Property stats
   *
   * @description
   * The four counters.
   *
   * @type {InputSignal<HomeStatsModel>}
   * @readonly
   */
  public readonly stats: InputSignal<HomeStatsModel> = input.required<HomeStatsModel>();

  /**
   * Property copy
   *
   * @description
   * The labels and hints.
   *
   * @type {Readonly<Record<HomeStatsCopyKey, string>>}
   * @readonly
   */
  protected readonly copy: Readonly<Record<HomeStatsCopyKey, string>> = HOME_STATS_COPY;

  /**
   * Property hints
   *
   * @description
   * The hints whose wording follows the count.
   *
   * @type {Signal<HomeStatsHints>}
   * @readonly
   */
  protected readonly hints: Signal<HomeStatsHints> = computed((): HomeStatsHints => {
    const stats: HomeStatsModel = this.stats();
    return {
      assigned: takesSingular(stats.assigned)
        ? HOME_STATS_COPY.assignedOne
        : HOME_STATS_COPY.assignedOther,
      dueToday: takesSingular(stats.dueToday)
        ? HOME_STATS_COPY.dueTodayOne
        : HOME_STATS_COPY.dueTodayOther,
      done: takesSingular(stats.done) ? HOME_STATS_COPY.doneOne : HOME_STATS_COPY.doneOther,
    };
  });
  // #endregion
}
