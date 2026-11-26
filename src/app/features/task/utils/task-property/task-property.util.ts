import { formatDate } from '@angular/common';
import type { Recurrence } from '@cadenway/contracts';
import { formatDuration, parseDuration } from '@cadenway/ui/components/time-tracker';

/**
 * Type BareNumberUnit
 *
 * @description
 * What a bare number means: hours for an estimate, minutes for spent time (`App.dc.html`,
 * `parseEst` and `parseDur`).
 *
 * @type {'hours' | 'minutes'}
 */
export type BareNumberUnit = 'hours' | 'minutes';

/**
 * Constant DEFAULT_DURATIONS
 *
 * @description
 * Suggestions shown before anything is typed, in minutes (`durSuggest` of `App.dc.html`).
 *
 * @type {readonly number[]}
 */
const DEFAULT_DURATIONS: readonly number[] = [15, 30, 60, 90, 120, 240, 480];

/**
 * Constant MAX_SUGGESTED_MINUTES
 *
 * @description
 * Longest duration suggested: a week.
 *
 * @type {number}
 */
const MAX_SUGGESTED_MINUTES: number = 7 * 24 * 60;

/**
 * Function formatMinutes
 *
 * @description
 * Writes minutes the way the design system writes durations (`1 h 30`, `3 h`, `45 min`).
 *
 * @param {number} minutes - Whole minutes.
 * @returns {string} The duration.
 */
export function formatMinutes(minutes: number): string {
  return formatDuration(minutes * 60_000);
}

/**
 * Function parseMinutes
 *
 * @description
 * Reads a typed duration in whole minutes with the design system's `parseDuration`; an empty,
 * unreadable or zero duration is null.
 *
 * @param {string} text - The typed text.
 * @param {BareNumberUnit} bareNumber - Unit of a bare number.
 * @returns {number | null} The minutes, or null.
 */
export function parseMinutes(text: string, bareNumber: BareNumberUnit): number | null {
  const milliseconds: number | null = parseDuration(text, { bareNumber });
  if (milliseconds === null) return null;
  const minutes: number = Math.round(milliseconds / 60_000);
  return minutes > 0 ? minutes : null;
}

/**
 * Function durationSuggestions
 *
 * @description
 * Durations to propose from the beginning of a typed duration (`durSuggest` of `App.dc.html`):
 * the defaults before anything is typed; for a bare number, the hours and the half hour after
 * it and the minutes, in the order of the unit of a bare number; after `2h`, the quarters of
 * that hour; six at most, a week at most.
 *
 * @param {string} text - The typed text.
 * @param {BareNumberUnit} bareNumber - Unit of a bare number.
 * @returns {readonly number[]} The suggestions, in minutes.
 */
export function durationSuggestions(text: string, bareNumber: BareNumberUnit): readonly number[] {
  const compact: string = text.toLowerCase().replace(/,/gu, '.').replace(/\s+/gu, '');
  const out: number[] = [];
  const push: (minutes: number) => void = (minutes: number): void => {
    if (minutes > 0 && minutes <= MAX_SUGGESTED_MINUTES && !out.includes(minutes)) {
      out.push(minutes);
    }
  };
  if (!compact) {
    DEFAULT_DURATIONS.forEach(push);
    return out;
  }
  const bare: RegExpExecArray | null = /^(\d+)$/u.exec(compact);
  if (bare) {
    const value: number = Number(bare[1]);
    const hours: () => void = (): void => {
      if (value <= 99) {
        push(value * 60);
        push(value * 60 + 30);
      }
    };
    const minutes: () => void = (): void => {
      push(value);
      if (value < 10) push(value * 10);
    };
    if (bareNumber === 'hours') {
      hours();
      minutes();
    } else {
      minutes();
      hours();
    }
    return out.slice(0, 6);
  }
  const exact: number | null = parseMinutes(text, bareNumber);
  if (exact !== null) push(exact);
  const hourOnly: RegExpExecArray | null = /^(\d+(?:\.\d+)?)h$/u.exec(compact);
  const hourDigit: RegExpExecArray | null = /^(\d+)h(\d)$/u.exec(compact);
  const minuteStart: RegExpExecArray | null = /^(\d+)(?:m|mi)$/u.exec(compact);
  const clock: RegExpExecArray | null = /^(\d+):$/u.exec(compact);
  if (hourOnly) {
    const base: number = Math.round(Number(hourOnly[1]) * 60);
    [0, 15, 30, 45].forEach((quarter: number) => {
      push(base + quarter);
    });
  } else if (hourDigit) {
    const base: number = Number(hourDigit[1]) * 60;
    const digit: number = Number(hourDigit[2]);
    if (digit <= 5) push(base + digit * 10);
    push(base + digit);
  } else if (minuteStart) {
    push(Number(minuteStart[1]));
  } else if (clock) {
    const base: number = Number(clock[1]) * 60;
    [0, 15, 30, 45].forEach((quarter: number) => {
      push(base + quarter);
    });
  }
  return out.slice(0, 6);
}

/**
 * Function formatSpan
 *
 * @description
 * Writes a long elapsed time rounded to the hour, as the time per status does (`fmtD` of
 * `App.dc.html`): `less than 1 h`, `5 h`, `2 d 3 h`.
 *
 * @param {number} milliseconds - The elapsed time.
 * @returns {string} The duration.
 */
export function formatSpan(milliseconds: number): string {
  const hours: number = Math.round(milliseconds / 3_600_000);
  if (hours < 1) return $localize`:@@task.properties.span-under-hour:less than 1 h`;
  const days: number = Math.floor(hours / 24);
  const rest: number = hours % 24;
  if (days === 0) return $localize`:@@task.properties.span-hours:${rest}:hours: h`;
  return rest
    ? $localize`:@@task.properties.span-days-hours:${days}:days: d ${rest}:hours: h`
    : $localize`:@@task.properties.span-days:${days}:days: d`;
}

/**
 * Function localDay
 *
 * @description
 * The calendar day of a local date (`YYYY-MM-DD`).
 *
 * @param {Date} date - The date.
 * @returns {string} The day.
 */
export function localDay(date: Date): string {
  const month: string = String(date.getMonth() + 1).padStart(2, '0');
  const day: string = String(date.getDate()).padStart(2, '0');
  return `${String(date.getFullYear())}-${month}-${day}`;
}

/**
 * Function dateOf
 *
 * @description
 * The local noon of a calendar day, so adding days never crosses a time change badly.
 *
 * @param {string} iso - The day (`YYYY-MM-DD`, a longer ISO text is cut).
 * @returns {Date} The date.
 */
export function dateOf(iso: string): Date {
  const [year, month, day]: number[] = iso.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

/**
 * Function addDays
 *
 * @description
 * A calendar day some days after another.
 *
 * @param {string} iso - The day.
 * @param {number} days - Days to add, possibly negative.
 * @returns {string} The new day.
 */
export function addDays(iso: string, days: number): string {
  const date: Date = dateOf(iso);
  date.setDate(date.getDate() + days);
  return localDay(date);
}

/**
 * Function dayOffset
 *
 * @description
 * Days from one calendar day to another (negative when it is before).
 *
 * @param {string} iso - The day.
 * @param {string} today - The reference day.
 * @returns {number} The difference in days.
 */
export function dayOffset(iso: string, today: string): number {
  return Math.round((dateOf(iso).getTime() - dateOf(today).getTime()) / 86_400_000);
}

/**
 * Function nextOccurrence
 *
 * @description
 * The due date of the next occurrence of a recurring task (`nextOccur` of `App.dc.html`): the
 * next working day, a week, two weeks or a month later.
 *
 * @param {string} due - The current due date.
 * @param {Recurrence} recurrence - The rule.
 * @returns {string} The next due date (the same day for `none`).
 */
export function nextOccurrence(due: string, recurrence: Recurrence): string {
  switch (recurrence) {
    case 'daily': {
      let next: string = addDays(due, 1);
      while ([0, 6].includes(dateOf(next).getDay())) next = addDays(next, 1);
      return next;
    }
    case 'weekly':
      return addDays(due, 7);
    case 'biweekly':
      return addDays(due, 14);
    case 'monthly': {
      const date: Date = dateOf(due);
      date.setMonth(date.getMonth() + 1);
      return localDay(date);
    }
    default:
      return due;
  }
}

/**
 * Function shortDayLabel
 *
 * @description
 * How a row writes a day (`dueInfo` of `App.dc.html`): `Today`, `Tomorrow`, `Yesterday`, else
 * the short weekday and date, with the year when it is not the current one.
 *
 * @param {string} iso - The day.
 * @param {string} today - Today.
 * @param {string} locale - Locale of the dates.
 * @returns {string} The label.
 */
export function shortDayLabel(iso: string, today: string, locale: string): string {
  const offset: number = dayOffset(iso, today);
  if (offset === 0) return $localize`:@@task.due.today:Today`;
  if (offset === 1) return $localize`:@@task.due.tomorrow:Tomorrow`;
  if (offset === -1) return $localize`:@@task.properties.due-yesterday:Yesterday`;
  const sameYear: boolean = iso.slice(0, 4) === today.slice(0, 4);
  return formatDate(dateOf(iso), sameYear ? 'EEE d MMM' : 'EEE d MMM y', locale);
}

/**
 * Function longDayLabel
 *
 * @description
 * The full date of a day (`Monday 9 November`, the year when it is not the current one),
 * prefixed by `Today, ` for today.
 *
 * @param {string} iso - The day.
 * @param {string} today - Today.
 * @param {string} locale - Locale of the dates.
 * @returns {string} The label.
 */
export function longDayLabel(iso: string, today: string, locale: string): string {
  const sameYear: boolean = iso.slice(0, 4) === today.slice(0, 4);
  const date: string = formatDate(dateOf(iso), sameYear ? 'EEEE d MMMM' : 'EEEE d MMMM y', locale);
  return dayOffset(iso, today) === 0
    ? $localize`:@@task.properties.due-today-long:Today, ${date}:date:`
    : date.charAt(0).toLocaleUpperCase(locale) + date.slice(1);
}
