import { formatDate } from '@angular/common';

import { timeParts, type TimeParts } from '@core/locale';

import type { InboxReminder } from '../../models/inbox-reminder/inbox-reminder.interface';

/**
 * Constant MINUTE_MS
 *
 * @description
 * One minute, in milliseconds.
 *
 * @type {number}
 */
const MINUTE_MS: number = 60_000;

/**
 * Constant MORNING_HOUR
 *
 * @description
 * Local hour of `tomorrow morning`, as the mockup's `Mon, Nov 9, 9:00`.
 *
 * @type {number}
 */
const MORNING_HOUR: number = 9;

/**
 * Function startOfDay
 *
 * @description
 * Local midnight of a moment's day.
 *
 * @param {Date} moment - Any moment.
 * @returns {number} Midnight of its day, in milliseconds since the epoch.
 */
function startOfDay(moment: Date): number {
  return new Date(moment.getFullYear(), moment.getMonth(), moment.getDate()).getTime();
}

/**
 * Function daysBetween
 *
 * @description
 * Calendar days from one local day to another, daylight saving changes included.
 *
 * @param {Date} from - Start moment.
 * @param {Date} to - End moment.
 * @returns {number} Whole days, negative when `to` is before `from`.
 */
function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to) - startOfDay(from)) / (24 * 60 * MINUTE_MS));
}

/**
 * Function capitalize
 *
 * @description
 * Uppercases the first character, since some locales write abbreviated weekdays in lowercase.
 *
 * @param {string} text - Formatted date.
 * @returns {string} The text with an uppercase first character.
 */
function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

/**
 * Function relativeTime
 *
 * @description
 * When a notification arrived, as the mockup writes it: `12 min` and `1 h` the same day (at
 * least one minute), `yesterday` the day before, the abbreviated weekday (`Mon`) within a week,
 * then the day and month (`2 Nov`).
 *
 * @param {string} instant - ISO 8601 instant.
 * @param {Date} now - The current moment.
 * @param {string} locale - Application locale (`LOCALE_ID`).
 * @returns {string} The relative time.
 */
export function relativeTime(instant: string, now: Date, locale: string): string {
  const moment: Date = new Date(instant);
  const minutes: number = Math.max(1, Math.floor((now.getTime() - moment.getTime()) / MINUTE_MS));
  const days: number = daysBetween(moment, now);
  if (days <= 0) {
    return minutes < 60
      ? $localize`:@@inbox.time.minutes:${minutes}:count: min`
      : $localize`:@@inbox.time.hours:${Math.floor(minutes / 60)}:count: h`;
  }
  if (days === 1) return $localize`:@@inbox.time.yesterday:yesterday`;
  return formatDate(moment, days < 7 ? 'EEE' : 'd MMM', locale);
}

/**
 * Function reminderTime
 *
 * @description
 * When a reminder is due, as the mockup writes it, the time in the application's time format for
 * the locale (`timeParts`): `Today, 9:00 AM`, `Tomorrow, 3:00 PM`, else `Mon 16 Nov, 9:00 AM` in
 * English, `9 h` and `15 h 30` in the French catalog.
 *
 * @param {string} instant - ISO 8601 instant.
 * @param {Date} now - The current moment.
 * @param {string} locale - Application locale (`LOCALE_ID`).
 * @returns {string} The due time.
 */
export function reminderTime(instant: string, now: Date, locale: string): string {
  const moment: Date = new Date(instant);
  const { hour, minute, period }: TimeParts = timeParts(moment, locale);
  const time: string =
    moment.getMinutes() === 0
      ? $localize`:@@inbox.time.at-hour:${hour}:hour::00${period}:period:`
      : $localize`:@@inbox.time.at-time:${hour}:hour::${minute}:minutes:${period}:period:`;
  const days: number = daysBetween(now, moment);
  if (days === 0) return $localize`:@@inbox.time.today:Today, ${time}:time:`;
  if (days === 1) return $localize`:@@inbox.time.tomorrow:Tomorrow, ${time}:time:`;
  return $localize`:@@inbox.time.on-day:${capitalize(formatDate(moment, 'EEE d MMM', locale))}:day:, ${time}:time:`;
}

/**
 * Function tomorrowMorning
 *
 * @description
 * The instant `tomorrow morning` stands for: 9:00 tomorrow, local time.
 *
 * @param {Date} now - The current moment.
 * @returns {string} The instant, as ISO 8601.
 */
export function tomorrowMorning(now: Date): string {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, MORNING_HOUR).toISOString();
}

/**
 * Function overdueCount
 *
 * @description
 * How many of the listed pending reminders are due at `now`, as the rows mark them `late`.
 *
 * @param {readonly InboxReminder[]} reminders - Pending reminders.
 * @param {Date} now - The current moment.
 * @returns {number} The due reminders.
 */
export function overdueCount(reminders: readonly InboxReminder[], now: Date): number {
  return reminders.filter(
    (reminder: InboxReminder) => Date.parse(reminder.remindAt) <= now.getTime(),
  ).length;
}
