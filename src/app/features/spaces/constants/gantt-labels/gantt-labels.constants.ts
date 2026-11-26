import type { Provider } from '@angular/core';
import {
  type CwTimelineLabels,
  type CwTimelineScale,
  provideCwTimelineLabels,
} from '@cadenway/ui/components/timeline';

import { daysBetween } from '../../utils/gantt-timeline/gantt-timeline.util';

/**
 * Interface GanttDateFormats
 *
 * @description
 * The date formats of one locale.
 */
interface GanttDateFormats {
  // #region Properties
  /**
   * Property day
   *
   * @description
   * The day of month alone.
   *
   * @type {Intl.DateTimeFormat}
   * @readonly
   */
  readonly day: Intl.DateTimeFormat;

  /**
   * Property long
   *
   * @description
   * The day and the full month (`3 November`).
   *
   * @type {Intl.DateTimeFormat}
   * @readonly
   */
  readonly long: Intl.DateTimeFormat;

  /**
   * Property short
   *
   * @description
   * The day and the short month (`3 Nov`).
   *
   * @type {Intl.DateTimeFormat}
   * @readonly
   */
  readonly short: Intl.DateTimeFormat;

  /**
   * Property title
   *
   * @description
   * The day, short month and year of the period title.
   *
   * @type {Intl.DateTimeFormat}
   * @readonly
   */
  readonly title: Intl.DateTimeFormat;

  /**
   * Property dayFirst
   *
   * @description
   * Whether the locale writes the day before the month, so a period within one month names the
   * month once (`du 3 au 7 novembre`).
   *
   * @type {boolean}
   * @readonly
   */
  readonly dayFirst: boolean;
  // #endregion
}

/**
 * Constant FORMATS
 *
 * @description
 * The date formats of the Gantt's texts, by locale.
 *
 * @type {Map<string, GanttDateFormats>}
 */
const FORMATS: Map<string, GanttDateFormats> = new Map<string, GanttDateFormats>();

/**
 * Function formatsOf
 *
 * @description
 * The date formats of a locale, built once.
 *
 * @param {string} locale - The locale.
 * @returns {GanttDateFormats} The formats.
 */
function formatsOf(locale: string): GanttDateFormats {
  const known: GanttDateFormats | undefined = FORMATS.get(locale);
  if (known) return known;
  const long: Intl.DateTimeFormat = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
  });
  const order: string[] = long
    .formatToParts(new Date(2026, 10, 18))
    .map((part: Intl.DateTimeFormatPart): string => part.type);
  const formats: GanttDateFormats = {
    day: new Intl.DateTimeFormat(locale, { day: 'numeric' }),
    long,
    short: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }),
    title: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }),
    dayFirst: order.indexOf('day') < order.indexOf('month'),
  };
  FORMATS.set(locale, formats);
  return formats;
}

/**
 * Function startOf
 *
 * @description
 * The first day of a period as its text writes it: the day alone when the period stays in one
 * month and the locale writes the day first, else the day and month.
 *
 * @param {Date} start - First day.
 * @param {Date} end - Last day.
 * @param {Intl.DateTimeFormat} format - The day and month format.
 * @param {GanttDateFormats} formats - The locale's formats.
 * @returns {string} The text.
 */
function startOf(
  start: Date,
  end: Date,
  format: Intl.DateTimeFormat,
  formats: GanttDateFormats,
): string {
  const sameMonth: boolean =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  return sameMonth && formats.dayFirst ? formats.day.format(start) : format.format(start);
}

/**
 * Function ganttRangeText
 *
 * @description
 * A period of a task (`App.dc.html` line 6488): `on 3 November`, `from 3 to 7 November`.
 *
 * @param {Date} start - First day.
 * @param {Date} end - Last day.
 * @param {string} locale - The locale.
 * @returns {string} The text, in lower case.
 */
export function ganttRangeText(start: Date, end: Date, locale: string): string {
  const formats: GanttDateFormats = formatsOf(locale);
  const last: string = formats.long.format(end);
  if (daysBetween(start, end) === 0) return $localize`:@@spaces.gantt.range-day:on ${last}:date:`;
  const first: string = startOf(start, end, formats.long, formats);
  return $localize`:@@spaces.gantt.range:from ${first}:start: to ${last}:end:`;
}

/**
 * Function ganttRescheduledText
 *
 * @description
 * The second line of a move's toast (`App.dc.html` line 6500): the period, capitalized, with a
 * full stop (`From 3 to 7 November.`).
 *
 * @param {Date} start - First day.
 * @param {Date} end - Last day.
 * @param {string} locale - The locale.
 * @returns {string} The text.
 */
export function ganttRescheduledText(start: Date, end: Date, locale: string): string {
  const range: string = ganttRangeText(start, end, locale);
  return `${range.charAt(0).toLocaleUpperCase(locale)}${range.slice(1)}.`;
}

/**
 * Function ganttPeriodTitle
 *
 * @description
 * The title of the period shown (`App.dc.html` line 9225): `Nov 23 – Dec 13, 2026`.
 *
 * @param {Date} start - First day.
 * @param {Date} end - Last day.
 * @param {string} locale - The locale.
 * @returns {string} The title.
 */
export function ganttPeriodTitle(start: Date, end: Date, locale: string): string {
  return formatsOf(locale).title.formatRange(start, end);
}

/**
 * Function ganttScaleLabels
 *
 * @description
 * The names of the scales (`App.dc.html` lines 6419-6421).
 *
 * @returns {Readonly<Record<CwTimelineScale, string>>} The names.
 */
export function ganttScaleLabels(): Readonly<Record<CwTimelineScale, string>> {
  return {
    day: $localize`:@@spaces.gantt.scale-day:Day`,
    week: $localize`:@@spaces.gantt.scale-week:Week`,
    month: $localize`:@@spaces.gantt.scale-month:Month`,
  };
}

/**
 * Function moveText
 *
 * @description
 * The tip of a bar being dragged: `Nov 3 → Nov 7 · 5 d`.
 *
 * @param {Date} start - First day.
 * @param {Date} end - Last day.
 * @param {string} locale - The locale.
 * @returns {string} The tip.
 */
function moveText(start: Date, end: Date, locale: string): string {
  const formats: GanttDateFormats = formatsOf(locale);
  const first: string = startOf(start, end, formats.short, formats);
  const last: string = formats.short.format(end);
  const days: number = daysBetween(start, end) + 1;
  return $localize`:@@spaces.gantt.move:${first}:start: → ${last}:end: · ${days}:days: d`;
}

/**
 * Function lateText
 *
 * @description
 * How late a task is, in the bar's accessible name: `1 day late`, `3 days late`.
 *
 * @param {number} count - Days late.
 * @returns {string} The text.
 */
function lateText(count: number): string {
  return count > 1
    ? $localize`:@@spaces.gantt.late-long:${count}:count: days late`
    : $localize`:@@spaces.gantt.late-long-one:${count}:count: day late`;
}

/**
 * Function ganttTimelineLabels
 *
 * @description
 * The English texts of `cw-timeline` in the Gantt, with the mockup's wording where it has one.
 *
 * @returns {Required<CwTimelineLabels>} The texts.
 */
export function ganttTimelineLabels(): Required<CwTimelineLabels> {
  const scales: Readonly<Record<CwTimelineScale, string>> = ganttScaleLabels();
  return {
    range: ganttRangeText,
    move: moveText,
    nameHeader: $localize`:@@spaces.gantt.name-header:Task`,
    undatedLabel: $localize`:@@spaces.gantt.undated:No date`,
    scheduleLabel: $localize`:@@spaces.gantt.schedule:Schedule`,
    week: (week: number): string => $localize`:@@spaces.gantt.week:Week ${week}:week:`,
    weekShort: (week: number): string => $localize`:@@spaces.gantt.week-short:W${week}:week:`,
    late: (count: number): string => $localize`:@@spaces.gantt.late:${count}:count: d late`,
    lateLong: lateText,
    conflict: (predecessor: string): string =>
      $localize`:@@spaces.gantt.conflict:starts before the end of ${predecessor}:task:`,
    conflictAnnounce: (successor: string, predecessor: string): string =>
      $localize`:@@spaces.gantt.conflict-announce:Conflict: ${successor}:successor: starts before the end of ${predecessor}:predecessor:`,
    milestone: (label: string, date: string): string =>
      $localize`:@@spaces.gantt.milestone:Milestone ${label}:name:, ${date}:date:`,
    moved: (name: string, range: string): string =>
      $localize`:@@spaces.gantt.moved:${name}:name:: ${range}:range:`,
    scale: (scale: CwTimelineScale): string => {
      const word: string = scales[scale].toLocaleLowerCase();
      return $localize`:@@spaces.gantt.scale-announce:Scale: ${word}:scale:`;
    },
    zoom: (percent: number): string =>
      $localize`:@@spaces.gantt.zoom-announce:Zoom: ${percent}:percent:%`,
    percent: (value: number): string => $localize`:@@spaces.gantt.percent:${value}:value:%`,
    durationHeader: $localize`:@@spaces.gantt.duration-header:Duration`,
    duration: (days: number): string => $localize`:@@spaces.gantt.duration:${days}:days: d`,
    reveal: (name: string, range: string): string =>
      $localize`:@@spaces.gantt.reveal:Show ${name}:name: (${range}:range:)`,
    fitted: (count: number): string =>
      count > 1
        ? $localize`:@@spaces.gantt.fitted:View fitted to the ${count}:count: dated tasks`
        : $localize`:@@spaces.gantt.fitted-one:View fitted to the dated task`,
    loading: $localize`:@@spaces.gantt.loading:Loading the Gantt chart`,
    empty: $localize`:@@spaces.gantt.empty:No task matches the search or the filters.`,
  };
}

/**
 * Constant GANTT_TIMELINE_LABELS
 *
 * @description
 * The provider of the Gantt's `cw-timeline` texts, for the page's `providers`.
 *
 * @type {Provider}
 */
export const GANTT_TIMELINE_LABELS: Provider = provideCwTimelineLabels(ganttTimelineLabels);
