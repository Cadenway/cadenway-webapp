/**
 * Type ReminderPresetKey
 *
 * @description
 * The reminder moments the header offers (`REM_PRESETS` of `App.dc.html`): in one hour, this
 * afternoon, tomorrow morning, next week and the day before the due date.
 *
 * @type {'hour' | 'afternoon' | 'tomorrow' | 'week' | 'due'}
 */
export type ReminderPresetKey = 'hour' | 'afternoon' | 'tomorrow' | 'week' | 'due';

/**
 * Interface ReminderPreset
 *
 * @description
 * A reminder moment and the instant it stands for.
 */
export interface ReminderPreset {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Which moment.
   *
   * @type {ReminderPresetKey}
   * @readonly
   */
  readonly key: ReminderPresetKey;

  /**
   * Property at
   *
   * @description
   * The instant, in the caller's time zone.
   *
   * @type {Date}
   * @readonly
   */
  readonly at: Date;
  // #endregion
}

/**
 * Constant REMINDER_HOURS
 *
 * @description
 * Hours of the custom reminder picker (`App.dc.html`, `remHours`).
 *
 * @type {readonly number[]}
 */
export const REMINDER_HOURS: readonly number[] = [9, 11, 14, 16, 18, 20];

/**
 * Constant REMINDER_DAYS
 *
 * @description
 * Days the custom reminder picker offers, from today.
 *
 * @type {number}
 */
export const REMINDER_DAYS: number = 14;

/**
 * Constant MINUTE_MS
 *
 * @description
 * A minute, in milliseconds.
 *
 * @type {number}
 */
const MINUTE_MS: number = 60_000;

/**
 * Constant HOUR_MS
 *
 * @description
 * An hour, in milliseconds.
 *
 * @type {number}
 */
const HOUR_MS: number = 60 * MINUTE_MS;

/**
 * Function at
 *
 * @description
 * A local instant on the day of `day`, a number of days later, at a whole hour.
 *
 * @param {Date} day - The reference day.
 * @param {number} days - Days to add.
 * @param {number} hour - Hour, 0 to 23.
 * @returns {Date} The instant.
 */
export function at(day: Date, days: number, hour: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + days, hour, 0, 0, 0);
}

/**
 * Function reminderPresets
 *
 * @description
 * The moments offered now, each in the future: in one hour (an hour from now, rounded up to the
 * minute, so `In 1 hour` is never less than one), this
 * afternoon at 15 h (only before then), tomorrow at 9 h, the Monday of next week at 9 h (a week
 * from Sunday, as in the mockup where Sunday 8 offers Monday 16), and the day before
 * the due date at 9 h (only with a due date whose day before is still ahead).
 *
 * @param {Date} now - The current instant.
 * @param {string | null} due - The task's due date (`YYYY-MM-DD`), or null.
 * @returns {readonly ReminderPreset[]} The moments, in the mockup's order.
 */
export function reminderPresets(now: Date, due: string | null): readonly ReminderPreset[] {
  const inAnHour: Date = new Date(Math.ceil((now.getTime() + HOUR_MS) / MINUTE_MS) * MINUTE_MS);
  const presets: ReminderPreset[] = [{ key: 'hour', at: inAnHour }];
  const afternoon: Date = at(now, 0, 15);
  if (afternoon > now) presets.push({ key: 'afternoon', at: afternoon });
  presets.push({ key: 'tomorrow', at: at(now, 1, 9) });
  const nextMonday: number = (8 - now.getDay()) % 7 || 7;
  presets.push({ key: 'week', at: at(now, nextMonday === 1 ? 8 : nextMonday, 9) });
  const match: RegExpExecArray | null = due ? /^(\d{4})-(\d{2})-(\d{2})$/u.exec(due) : null;
  if (match) {
    const eve: Date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) - 1, 9);
    if (eve > now) presets.push({ key: 'due', at: eve });
  }
  return presets;
}

/**
 * Function reminderDays
 *
 * @description
 * The days of the custom picker: today and the 13 next days, at midnight.
 *
 * @param {Date} now - The current instant.
 * @returns {readonly Date[]} The days.
 */
export function reminderDays(now: Date): readonly Date[] {
  return Array.from({ length: REMINDER_DAYS }, (_: unknown, index: number): Date =>
    at(now, index, 0),
  );
}

/**
 * Function daysFrom
 *
 * @description
 * Whole calendar days from the day of `now` to the day of `day`.
 *
 * @param {Date} now - The current instant.
 * @param {Date} day - Another instant.
 * @returns {number} The days, negative before today.
 */
export function daysFrom(now: Date, day: Date): number {
  return Math.round((at(day, 0, 12).getTime() - at(now, 0, 12).getTime()) / 86_400_000);
}

/**
 * Function reminderTimeLabel
 *
 * @description
 * How the time of a reminder reads, in the single format of the mockup's reminder popover
 * (`REM_PRESETS` of `App.dc.html`): `11:00` or `14:19` in English, `11 h` or `14 h 19` in the
 * French catalog. Every time of the popover (presets, hour picker, custom moment) goes through
 * it, so a time with minutes never switches to another format.
 *
 * @param {number} hour - Hour, 0 to 23.
 * @param {number} minute - Minute, 0 to 59.
 * @returns {string} The label.
 */
export function reminderTimeLabel(hour: number, minute: number): string {
  if (minute === 0) return $localize`:@@task.detail.reminder.hour:${hour}:hour::00`;
  const minutes: string = String(minute).padStart(2, '0');
  return $localize`:@@task.detail.reminder.hour-minute:${hour}:hour::${minutes}:minute:`;
}
