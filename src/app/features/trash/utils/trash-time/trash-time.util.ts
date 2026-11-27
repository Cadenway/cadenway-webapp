/**
 * Constant DAY_MS
 *
 * @description
 * One day, in milliseconds.
 *
 * @type {number}
 */
const DAY_MS: number = 86_400_000;

/**
 * Constant WARNING_DAYS
 *
 * @description
 * Days left at or below which the row shows its countdown in grenat (`App.dc.html` line 8399).
 *
 * @type {number}
 */
export const WARNING_DAYS: number = 5;

/**
 * Function startOfDay
 *
 * @description
 * Local midnight of an instant.
 *
 * @param {number} time - Instant, in milliseconds since the epoch.
 * @returns {number} Local midnight of that day, in milliseconds since the epoch.
 */
function startOfDay(time: number): number {
  const date: Date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Function daysSince
 *
 * @description
 * Calendar days between a deletion and now, in local time: 0 the same day, 1 the day before
 * (`Deleted today`, `Deleted yesterday`, `Deleted 3 days ago`). A deletion stamped in the future
 * by a clock skew reads as today.
 *
 * @param {string} instant - When the task was deleted, as ISO 8601.
 * @param {number} now - Current instant, in milliseconds since the epoch.
 * @returns {number} Whole days, at least 0.
 */
export function daysSince(instant: string, now: number): number {
  const days: number = Math.round((startOfDay(now) - startOfDay(Date.parse(instant))) / DAY_MS);
  return Math.max(0, days);
}

/**
 * Function daysLeft
 *
 * @description
 * Days before an entry is erased for good: the time left rounded up to whole days, so an entry
 * erased within the next 24 hours shows `1 d`, and one already due shows `0 d`.
 *
 * @param {string} purgeAt - When the entry is erased, as ISO 8601.
 * @param {number} now - Current instant, in milliseconds since the epoch.
 * @returns {number} Whole days, at least 0.
 */
export function daysLeft(purgeAt: string, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(purgeAt) - now) / DAY_MS));
}
