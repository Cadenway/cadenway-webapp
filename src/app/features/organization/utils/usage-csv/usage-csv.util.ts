/**
 * Type CsvDelimiter
 *
 * @description
 * Cell separator of a CSV file: `;` where the decimal separator is a comma, as spreadsheets of
 * those locales expect (the mockup's French export), `,` elsewhere.
 *
 * @type {';' | ','}
 */
export type CsvDelimiter = ';' | ',';

/**
 * Constant BYTE_ORDER_MARK
 *
 * @description
 * UTF-8 byte order mark that makes spreadsheets read accented letters correctly
 * (`Organisation.dc.html` line 898).
 *
 * @type {string}
 */
const BYTE_ORDER_MARK: string = String.fromCodePoint(0xfeff);

/**
 * Function csvDelimiter
 *
 * @description
 * The cell separator suited to a locale: `;` when its decimal separator is a comma (`fr`), `,`
 * otherwise (`en`).
 *
 * @param {string} locale - BCP 47 locale of the values.
 * @returns {CsvDelimiter} The separator.
 */
export function csvDelimiter(locale: string): CsvDelimiter {
  const decimal: string | undefined = new Intl.NumberFormat(locale)
    .formatToParts(1.5)
    .find((part: Intl.NumberFormatPart) => part.type === 'decimal')?.value;
  return decimal === ',' ? ';' : ',';
}

/**
 * Function csvNumber
 *
 * @description
 * A number as a CSV cell of a locale: its decimal separator, no grouping (so `1234`, never
 * `1,234`, which a `,` separated file would split), at most `fractionDigits` decimals.
 *
 * @param {number} value - The number.
 * @param {string} locale - BCP 47 locale of the values.
 * @param {number} fractionDigits - Maximum number of decimals.
 * @returns {string} The cell text.
 */
export function csvNumber(value: number, locale: string, fractionDigits: number): string {
  return new Intl.NumberFormat(locale, {
    useGrouping: false,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/**
 * Function toCsv
 *
 * @description
 * Writes rows as a CSV file the way the mockup's export does (`Organisation.dc.html` lines
 * 897-898): a UTF-8 byte order mark, cells joined by the delimiter, a cell holding the delimiter,
 * a quote or a line break quoted with its quotes doubled, and every row ended by CRLF.
 *
 * @param {readonly (readonly string[])[]} rows - Rows of cells, the header first.
 * @param {CsvDelimiter} delimiter - Cell separator.
 * @returns {string} The file content.
 */
export function toCsv(rows: readonly (readonly string[])[], delimiter: CsvDelimiter): string {
  const cell: (text: string) => string = (text: string): string =>
    text.includes(delimiter) || /["\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  return (
    BYTE_ORDER_MARK +
    rows.map((row: readonly string[]) => `${row.map(cell).join(delimiter)}\r\n`).join('')
  );
}

/**
 * Function usageFileName
 *
 * @description
 * Name of an organization's usage export for the month of a date, in local time:
 * `atelier-nord-usage-2026-11.csv` (`Organisation.dc.html` line 1950).
 *
 * @param {string} slug - The organization's address.
 * @param {Date} date - A day of the exported month.
 * @returns {string} The file name.
 */
export function usageFileName(slug: string, date: Date): string {
  const month: string = String(date.getMonth() + 1).padStart(2, '0');
  return `${slug}-usage-${String(date.getFullYear())}-${month}.csv`;
}

/**
 * Function saveCsvFile
 *
 * @description
 * Hands a CSV file to the browser's download through a temporary object URL, revoked once the
 * download started.
 *
 * @param {Document} document - Document of the page.
 * @param {string} fileName - Name of the saved file.
 * @param {string} content - File content.
 * @returns {boolean} Whether the download could start (false when the browser refuses it).
 */
export function saveCsvFile(document: Document, fileName: string, content: string): boolean {
  const view: (Window & typeof globalThis) | null = document.defaultView;
  if (!view || typeof view.URL.createObjectURL !== 'function') return false;
  try {
    const url: string = view.URL.createObjectURL(
      new Blob([content], { type: 'text/csv;charset=utf-8' }),
    );
    const link: HTMLAnchorElement = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.append(link);
    link.click();
    link.remove();
    view.URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}
