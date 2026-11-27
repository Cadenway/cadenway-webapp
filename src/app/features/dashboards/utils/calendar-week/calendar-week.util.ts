/**
 * Constant DAY_MS
 *
 * @description
 * Milliseconds in a calendar day, counted in UTC so daylight saving never shifts a date.
 *
 * @type {number}
 */
const DAY_MS: number = 86_400_000;

/**
 * Function todayIso
 *
 * @description
 * The caller's local date as an ISO calendar date (`2026-11-08`), the `today` the dashboard is
 * computed for.
 *
 * @param {Date} now - The current instant; now by default.
 * @returns {string} The date, `YYYY-MM-DD`.
 */
export function todayIso(now: Date = new Date()): string {
  const month: string = String(now.getMonth() + 1).padStart(2, '0');
  const day: string = String(now.getDate()).padStart(2, '0');
  return `${String(now.getFullYear())}-${month}-${day}`;
}

/**
 * Function callerTimeZone
 *
 * @description
 * The browser's IANA time zone (`Europe/Paris`), which the gateway needs to cut the weeks.
 *
 * @returns {string} The time zone.
 */
export function callerTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Function toLocalDate
 *
 * @description
 * An ISO calendar date as a local `Date` at midnight, to format it in the caller's locale without
 * the UTC shift `new Date('2026-11-08')` would apply.
 *
 * @param {string} iso - The date, `YYYY-MM-DD`.
 * @returns {Date} That day at local midnight.
 */
export function toLocalDate(iso: string): Date {
  const [year, month, day]: number[] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Function isoWeekOf
 *
 * @description
 * The ISO 8601 week number of a calendar date: weeks start on Monday and week 1 holds the year's
 * first Thursday (`2026-11-02` is in week 45, the mockup's `S45`).
 *
 * @param {string} iso - The date, `YYYY-MM-DD`.
 * @returns {number} The week number, 1 to 53.
 */
export function isoWeekOf(iso: string): number {
  const [year, month, day]: number[] = iso.split('-').map(Number);
  const date: Date = new Date(Date.UTC(year, month - 1, day));
  const weekday: number = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const yearStart: number = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.ceil(((date.getTime() - yearStart) / DAY_MS + 1) / 7);
}
