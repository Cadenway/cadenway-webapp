/**
 * Interface TimeParts
 *
 * @description
 * A clock time cut into the pieces a message places itself, as the locale writes them: `3`,
 * `00` and ` PM` in English, `15`, `00` and nothing in French.
 */
export interface TimeParts {
  // #region Properties
  /**
   * Property hour
   *
   * @description
   * The hour, on the locale's clock (`3` in English, `15` in French).
   *
   * @type {string}
   * @readonly
   */
  readonly hour: string;

  /**
   * Property minute
   *
   * @description
   * The minutes, two digits (`00`, `19`).
   *
   * @type {string}
   * @readonly
   */
  readonly minute: string;

  /**
   * Property period
   *
   * @description
   * What follows the minutes, its leading space included (` PM` in English), or an empty string on
   * a 24-hour clock.
   *
   * @type {string}
   * @readonly
   */
  readonly period: string;
  // #endregion
}

/**
 * Function timeParts
 *
 * @description
 * Cuts the time of an instant as `Intl.DateTimeFormat(locale, { hour: 'numeric', minute:
 * '2-digit' })` writes it, the application's one time format. A message joins the parts in its own
 * words: the English source writes them back as that format (`3:00 PM`), and a translation may
 * word them otherwise (the French `15 h`, `14 h 19` of the mockup's reminders). Any space before
 * the day period (the narrow no-break space of `formatToParts`) becomes the plain space `format`
 * writes, so the parts join into exactly the formatted text.
 *
 * @param {Date} instant - The instant, read in the browser's time zone.
 * @param {string} locale - The application locale (`LOCALE_ID`).
 * @returns {TimeParts} The parts.
 */
export function timeParts(instant: Date, locale: string): TimeParts {
  const parts: readonly Intl.DateTimeFormatPart[] = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  }).formatToParts(instant);
  const minuteIndex: number = parts.findIndex(
    (part: Intl.DateTimeFormatPart) => part.type === 'minute',
  );
  return {
    hour: parts.find((part: Intl.DateTimeFormatPart) => part.type === 'hour')?.value ?? '',
    minute: parts[minuteIndex]?.value ?? '',
    period: parts
      .slice(minuteIndex + 1)
      .map((part: Intl.DateTimeFormatPart) => part.value)
      .join('')
      .replace(/\s/gu, ' '),
  };
}
