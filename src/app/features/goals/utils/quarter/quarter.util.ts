import type { Quarter } from '../../models/goal/goal.interface';

/**
 * Function todayIso
 *
 * @description
 * The caller's day in the browser's time zone, `YYYY-MM-DD`: the `today` the goals operations
 * need to compute the expected progress, which task-service cannot know.
 *
 * @param {Date} now - Current instant.
 * @returns {string} The local date.
 */
export function todayIso(now: Date): string {
  const month: string = String(now.getMonth() + 1).padStart(2, '0');
  const day: string = String(now.getDate()).padStart(2, '0');
  return `${String(now.getFullYear())}-${month}-${day}`;
}

/**
 * Function quarterOf
 *
 * @description
 * The calendar quarter of a day in the browser's time zone; the goals page shows the current one,
 * since the mockup offers no other.
 *
 * @param {Date} now - Current instant.
 * @returns {Quarter} Its quarter.
 */
export function quarterOf(now: Date): Quarter {
  const year: number = now.getFullYear();
  const number: 1 | 2 | 3 | 4 = (Math.floor(now.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
  const last: Date = new Date(year, number * 3, 0);
  return { key: `${String(year)}-Q${String(number)}`, year, number, end: todayIso(last) };
}

/**
 * Function toLocalDate
 *
 * @description
 * A plain `YYYY-MM-DD` date at local midnight, so formatting never shifts it by a time zone.
 *
 * @param {string} iso - Plain date.
 * @returns {Date} The local date.
 */
export function toLocalDate(iso: string): Date {
  const [year, month, day]: number[] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}
