import type {
  SprintReport,
  SprintVelocity,
} from '../../models/sprint-report/sprint-report.interface';
import { toLocalDate } from '../calendar-date/calendar-date.util';

/**
 * Interface SprintDay
 *
 * @description
 * Where the caller's day stands in a sprint (`day 6 of 15`).
 */
export interface SprintDay {
  // #region Properties
  /**
   * Property day
   *
   * @description
   * One-based day of the sprint, held between 1 and `days`.
   *
   * @type {number}
   * @readonly
   */
  readonly day: number;

  /**
   * Property days
   *
   * @description
   * Days of the sprint, its first and last included.
   *
   * @type {number}
   * @readonly
   */
  readonly days: number;
  // #endregion
}

/**
 * Interface VelocityBar
 *
 * @description
 * One sprint of the velocity chart: the earlier sprints, then the current one.
 */
export interface VelocityBar {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Category of the chart, unique in the chart (`S13`).
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;

  /**
   * Property name
   *
   * @description
   * Sprint name (`Sprint 13`).
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property committed
   *
   * @description
   * Points committed, or null when unknown.
   *
   * @type {number | null}
   * @readonly
   */
  readonly committed: number | null;

  /**
   * Property delivered
   *
   * @description
   * Points delivered, or null when unknown.
   *
   * @type {number | null}
   * @readonly
   */
  readonly delivered: number | null;

  /**
   * Property current
   *
   * @description
   * Whether the bar is the sprint of the report, still in progress.
   *
   * @type {boolean}
   * @readonly
   */
  readonly current: boolean;
  // #endregion
}

/**
 * Constant DAY_MS
 *
 * @description
 * Milliseconds of a day.
 *
 * @type {number}
 */
const DAY_MS: number = 86_400_000;

/**
 * Constant ON_TRACK_POINTS
 *
 * @description
 * Points left at the end below which the sprint is held (`projEnd <= 0.5` in `App.dc.html`).
 *
 * @type {number}
 */
const ON_TRACK_POINTS: number = 0.5;

/**
 * Function daysBetween
 *
 * @description
 * Whole days from one plain date to another, negative when the second comes first.
 *
 * @param {string} from - First date, `YYYY-MM-DD`.
 * @param {string} to - Second date, `YYYY-MM-DD`.
 * @returns {number} The days.
 */
function daysBetween(from: string, to: string): number {
  return Math.round((toLocalDate(to).getTime() - toLocalDate(from).getTime()) / DAY_MS);
}

/**
 * Function sprintDayOf
 *
 * @description
 * The caller's day in a sprint, as the mockup counts it: held to the first day before the sprint
 * and to the last one after it.
 *
 * @param {string} today - The caller's date.
 * @param {string} start - First day of the sprint.
 * @param {string} end - Last day of the sprint.
 * @returns {SprintDay} The day and the length of the sprint.
 */
export function sprintDayOf(today: string, start: string, end: string): SprintDay {
  const days: number = Math.max(1, daysBetween(start, end) + 1);
  return { day: Math.max(1, Math.min(days, daysBetween(start, today) + 1)), days };
}

/**
 * Function projectedEnd
 *
 * @description
 * Points left at the sprint's end: the gateway's forecast, or, once the sprint is over, what
 * remains (the mockup's projection on its last day); null when neither is known.
 *
 * @param {SprintReport} report - The report.
 * @param {string} today - The caller's date.
 * @returns {number | null} The points, or null.
 */
export function projectedEnd(report: SprintReport, today: string): number | null {
  if (report.projected !== null) return report.projected;
  if (today >= report.endDate && report.remaining !== null) return report.remaining.points;
  return null;
}

/**
 * Function isOnTrack
 *
 * @description
 * Whether the points left at the end are few enough to call the sprint held.
 *
 * @param {number} points - Points left at the end.
 * @returns {boolean} Whether the sprint is held.
 */
export function isOnTrack(points: number): boolean {
  return points <= ON_TRACK_POINTS;
}

/**
 * Function deliveredShare
 *
 * @description
 * The delivered share of the sprint's current scope, in whole percent (`D / P` of the mockup,
 * where the scope is the delivered and the remaining points); null when either part is unknown.
 *
 * @param {SprintReport} report - The report.
 * @returns {number | null} The percentage, or null.
 */
export function deliveredShare(report: SprintReport): number | null {
  if (report.delivered === null || report.remaining === null) return null;
  const scope: number = report.delivered.points + report.remaining.points;
  return Math.round((report.delivered.points / Math.max(1, scope)) * 100);
}

/**
 * Function scopeTaskCount
 *
 * @description
 * Tasks of the sprint's current scope, delivered and remaining; null when either part is unknown.
 *
 * @param {SprintReport} report - The report.
 * @returns {number | null} The count, or null.
 */
export function scopeTaskCount(report: SprintReport): number | null {
  if (report.delivered === null || report.remaining === null) return null;
  return report.delivered.taskCount + report.remaining.taskCount;
}

/**
 * Function averageVelocity
 *
 * @description
 * The points the earlier sprints delivered on average, rounded; the sprints without history are
 * left out, and null is returned without any.
 *
 * @param {readonly SprintVelocity[]} velocity - The earlier sprints.
 * @returns {number | null} The average, or null.
 */
export function averageVelocity(velocity: readonly SprintVelocity[]): number | null {
  const delivered: number[] = velocity
    .map((sprint: SprintVelocity): number | null => sprint.delivered)
    .filter((points: number | null): points is number => points !== null);
  if (delivered.length === 0) return null;
  return Math.round(
    delivered.reduce((sum: number, points: number) => sum + points, 0) / delivered.length,
  );
}

/**
 * Function shortSprintName
 *
 * @description
 * The chart's short name of a sprint (`Sprint 13` → `S13`, `name.replace('Sprint ', 'S')` in
 * `App.dc.html`); another name stays whole.
 *
 * @param {string} name - Sprint name.
 * @returns {string} The short name.
 */
export function shortSprintName(name: string): string {
  return name.replace(/^Sprint\s+/u, 'S');
}

/**
 * Function velocityBars
 *
 * @description
 * The bars of the velocity chart: the earlier sprints, oldest first, then the sprint of the report
 * with its commitment and what it delivered so far. Each bar's key is its short name, made unique
 * with its full name, then a rank, so two sprints never share a category.
 *
 * @param {SprintReport} report - The report.
 * @returns {readonly VelocityBar[]} The bars.
 */
export function velocityBars(report: SprintReport): readonly VelocityBar[] {
  const sprints: Omit<VelocityBar, 'key'>[] = [
    ...report.velocity.map((sprint: SprintVelocity): Omit<VelocityBar, 'key'> => ({
      name: sprint.name,
      committed: sprint.committed,
      delivered: sprint.delivered,
      current: false,
    })),
    {
      name: report.name,
      committed: report.committed,
      delivered: report.delivered?.points ?? null,
      current: true,
    },
  ];
  const used: Set<string> = new Set<string>();
  return sprints.map((sprint: Omit<VelocityBar, 'key'>, index: number): VelocityBar => {
    let key: string = shortSprintName(sprint.name);
    if (used.has(key)) key = sprint.name;
    if (used.has(key)) key = `${sprint.name} (${String(index + 1)})`;
    used.add(key);
    return { key, ...sprint };
  });
}
