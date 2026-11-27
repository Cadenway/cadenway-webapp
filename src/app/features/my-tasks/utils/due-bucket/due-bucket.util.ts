import type { StatusKey } from '@cadenway/contracts';

import { isClosedStatus } from '@features/task';

/**
 * Type DueBucket
 *
 * @description
 * Where a task falls against today (`dueInfo` of `App.dc.html`, lines 3650-3664): `closed` for a
 * done or cancelled task, otherwise `late` (due before today), `today`, `week` (1 to 7 days
 * ahead), `later` or `none` (no due date).
 *
 * @type {'late' | 'today' | 'week' | 'later' | 'none' | 'closed'}
 */
export type DueBucket = 'late' | 'today' | 'week' | 'later' | 'none' | 'closed';

/**
 * Constant OPEN_BUCKETS
 *
 * @description
 * The groups of the `To do` tab, in the mockup's order (line 6661).
 *
 * @type {readonly DueBucket[]}
 */
export const OPEN_BUCKETS: readonly DueBucket[] = ['late', 'today', 'week', 'later', 'none'];

/**
 * Constant WEEK_DAYS
 *
 * @description
 * Last day offset of the `week` bucket.
 *
 * @type {number}
 */
const WEEK_DAYS: number = 7;

/**
 * Function dayNumber
 *
 * @description
 * Days since the epoch of a `YYYY-MM-DD` date (or the date part of a timestamp), so two days
 * compare without time zones or daylight saving changes.
 *
 * @param {string} iso - The date.
 * @returns {number} Its day number.
 */
function dayNumber(iso: string): number {
  const [year, month, day]: number[] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

/**
 * Function localDay
 *
 * @description
 * The local calendar day of a moment, as `YYYY-MM-DD`.
 *
 * @param {Date} date - The moment.
 * @returns {string} Its local day.
 */
export function localDay(date: Date): string {
  const month: string = String(date.getMonth() + 1).padStart(2, '0');
  const day: string = String(date.getDate()).padStart(2, '0');
  return `${String(date.getFullYear())}-${month}-${day}`;
}

/**
 * Function dueBucket
 *
 * @description
 * The bucket of a task. A closed task is `closed` whatever its date; an open one is placed by the
 * number of local days between today and its due date.
 *
 * @param {string | null} due - Its due date (`YYYY-MM-DD`), or null.
 * @param {StatusKey} status - Its status.
 * @param {string} today - Today's local day (`YYYY-MM-DD`).
 * @returns {DueBucket} The bucket.
 */
export function dueBucket(due: string | null, status: StatusKey, today: string): DueBucket {
  if (isClosedStatus(status)) return 'closed';
  if (due === null) return 'none';
  const offset: number = dayNumber(due) - dayNumber(today);
  if (offset < 0) return 'late';
  if (offset === 0) return 'today';
  return offset <= WEEK_DAYS ? 'week' : 'later';
}
