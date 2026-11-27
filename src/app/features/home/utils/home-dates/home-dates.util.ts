/**
 * Function localDay
 *
 * @description
 * The local calendar day of a moment, as `YYYY-MM-DD`: the `today` `getHome` counts the late
 * tasks, the tasks due that day and the current sprints against, which task-service cannot know.
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
 * Function toLocalDate
 *
 * @description
 * A plain `YYYY-MM-DD` date at local midnight, so formatting never shifts it by a time zone.
 *
 * @param {string} iso - Plain date.
 * @returns {Date} The local date.
 */
function toLocalDate(iso: string): Date {
  const [year, month, day]: number[] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Function formatDayMonth
 *
 * @description
 * A day and short month in a locale (`Nov 17` in English).
 *
 * @param {string} iso - Plain date.
 * @param {string} locale - Application locale.
 * @returns {string} The formatted date.
 */
function formatDayMonth(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(
    toLocalDate(iso),
  );
}

/**
 * Function formatSprintRange
 *
 * @description
 * The range of a sprint as the mockup writes it on the home screen's sprint card (`App.dc.html`
 * line 1718): the month written once within one month, where the locale puts it
 * (`Nov 3 – 17` in English), both months across two (`Oct 27 – Nov 9`), the dash with a space on
 * each side. Spaces formats its sprint headers the same way, but its utility is private to it.
 *
 * @param {string} start - First day (`YYYY-MM-DD`).
 * @param {string} end - Last day (`YYYY-MM-DD`).
 * @param {string} locale - Application locale.
 * @returns {string} The range.
 */
export function formatSprintRange(start: string, end: string, locale: string): string {
  const first: Date = toLocalDate(start);
  const last: Date = toLocalDate(end);
  const sameMonth: boolean =
    first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear();
  if (!sameMonth) return `${formatDayMonth(start, locale)} – ${formatDayMonth(end, locale)}`;
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' })
    .formatRange(first, last)
    .replace(/\s*[–-]\s*/u, ' – ');
}
