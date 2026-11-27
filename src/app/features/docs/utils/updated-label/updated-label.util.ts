/**
 * Type UpdatedCase
 *
 * @description
 * Where a moment is written: `start` at the start of a cell (`Today, 9:40 AM`), `inline` inside a
 * sentence (`Modified today, 9:40 AM by Inès`).
 *
 * @type {'start' | 'inline'}
 */
export type UpdatedCase = 'start' | 'inline';

/**
 * Function dayIndex
 *
 * @description
 * The local calendar day of an instant, as a count of days, so two instants compare by day.
 *
 * @param {Date} date - The instant.
 * @returns {number} The day.
 */
function dayIndex(date: Date): number {
  return Math.round(
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 86_400_000,
  );
}

/**
 * Function updatedLabel
 *
 * @description
 * When a document was last saved, in the mockup's words (`App.dc.html` lines 3834-3839): today
 * and yesterday with the time (`Today, 9:40 AM`, `Yesterday, 5:20 PM`), then the date (`Nov 4`),
 * with the year once it is another year (`Nov 4, 2025`). Times and dates follow the locale.
 *
 * @param {string} iso - The instant, ISO 8601.
 * @param {string} locale - The application locale.
 * @param {UpdatedCase} position - Where it is written.
 * @param {Date} now - The current instant.
 * @returns {string} The label, or the raw value when it is not a date.
 */
export function updatedLabel(
  iso: string,
  locale: string,
  position: UpdatedCase,
  now: Date = new Date(),
): string {
  const date: Date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const time: string = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
  const days: number = dayIndex(now) - dayIndex(date);
  if (days === 0) {
    return position === 'start'
      ? $localize`:@@docs.date.today:Today, ${time}:time:`
      : $localize`:@@docs.date.today-inline:today, ${time}:time:`;
  }
  if (days === 1) {
    return position === 'start'
      ? $localize`:@@docs.date.yesterday:Yesterday, ${time}:time:`
      : $localize`:@@docs.date.yesterday-inline:yesterday, ${time}:time:`;
  }
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  }).format(date);
}
