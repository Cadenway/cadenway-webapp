/**
 * Function todayIso
 *
 * @description
 * The caller's date in the browser's time zone, `YYYY-MM-DD`: the `today` the gateway needs to
 * count late tasks, which task-service cannot know.
 *
 * @param {Date} now - Current instant.
 * @returns {string} The local date.
 */
export function todayIso(now: Date = new Date()): string {
  const month: string = String(now.getMonth() + 1).padStart(2, '0');
  const day: string = String(now.getDate()).padStart(2, '0');
  return `${String(now.getFullYear())}-${month}-${day}`;
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

/**
 * Function formatDayMonth
 *
 * @description
 * A day and short month in the application locale (« 17 nov. »).
 *
 * @param {string} iso - Plain date.
 * @param {string} locale - Application locale.
 * @returns {string} The formatted date.
 */
export function formatDayMonth(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(
    toLocalDate(iso),
  );
}

/**
 * Function formatSprintRange
 *
 * @description
 * The range of a sprint as the mockup writes it (`sprintRange`): « 3 – 17 nov. » within one
 * month, « 27 oct. – 9 nov. » across two.
 *
 * @param {string} start - First day.
 * @param {string} end - Last day.
 * @param {string} locale - Application locale.
 * @returns {string} The range.
 */
export function formatSprintRange(start: string, end: string, locale: string): string {
  const first: Date = toLocalDate(start);
  const last: Date = toLocalDate(end);
  const sameMonth: boolean =
    first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear();
  const from: string = sameMonth
    ? new Intl.DateTimeFormat(locale, { day: 'numeric' }).format(first)
    : formatDayMonth(start, locale);
  return `${from} – ${formatDayMonth(end, locale)}`;
}

/**
 * Function isWithin
 *
 * @description
 * Whether a plain date falls within an inclusive range of plain dates.
 *
 * @param {string} day - Date to check.
 * @param {string} start - First day.
 * @param {string} end - Last day.
 * @returns {boolean} Whether it is within.
 */
export function isWithin(day: string, start: string, end: string): boolean {
  return day >= start && day <= end;
}
