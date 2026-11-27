import type { TimeZoneOption } from './profile.interface';

/**
 * Function offsetLabel
 *
 * @description
 * The UTC offset of a time zone at an instant, as the mockup writes it (`UTC+1`, `UTC−5`,
 * `UTC+5:30`, `UTC`), with a minus sign rather than a hyphen.
 *
 * @param {string} timeZone - IANA time zone name.
 * @param {Date} at - The instant.
 * @returns {string} The offset, or an empty text when the browser does not know the zone.
 */
export function offsetLabel(timeZone: string, at: Date): string {
  try {
    const part: string =
      new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
        .formatToParts(at)
        .find((candidate: Intl.DateTimeFormatPart) => candidate.type === 'timeZoneName')?.value ??
      '';
    return part
      .replace(/^GMT(?:[+-]0)?$/u, 'UTC')
      .replace(/^GMT/u, 'UTC')
      .replace('-', '−');
  } catch {
    return '';
  }
}

/**
 * Function timeZoneLabel
 *
 * @description
 * The label of a time zone option: its name, then its current offset (`Europe/Paris (UTC+1)`).
 *
 * @param {string} timeZone - IANA time zone name.
 * @param {Date} at - The instant the offset is read at.
 * @returns {string} The label; the name alone when the browser does not know the zone.
 */
export function timeZoneLabel(timeZone: string, at: Date): string {
  const offset: string = offsetLabel(timeZone, at);
  return offset === '' || offset === timeZone ? timeZone : `${timeZone} (${offset})`;
}

/**
 * Function timeZoneOptions
 *
 * @description
 * The options of `Time zone`: every IANA zone the browser knows, sorted by name, plus `UTC`, which
 * some browsers leave out of the list, and the saved zone when the browser does not list it, so the
 * saved value always shows.
 *
 * @param {string | null} saved - The saved zone, if any.
 * @param {Date} at - The instant the offsets are read at.
 * @returns {readonly TimeZoneOption[]} The options.
 */
export function timeZoneOptions(saved: string | null, at: Date): readonly TimeZoneOption[] {
  const zones: string[] = [...Intl.supportedValuesOf('timeZone')];
  for (const extra of ['UTC', saved]) {
    if (extra !== null && extra !== '' && !zones.includes(extra)) zones.push(extra);
  }
  return zones
    .sort((a: string, b: string) => a.localeCompare(b, 'en'))
    .map((value: string): TimeZoneOption => ({ value, label: timeZoneLabel(value, at) }));
}
