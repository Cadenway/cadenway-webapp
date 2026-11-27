import { afterEach, describe, expect, it, vi } from 'vitest';

import { csvDelimiter, csvNumber, saveCsvFile, toCsv, usageFileName } from './usage-csv.util';

/**
 * Constant BOM
 *
 * @description
 * The UTF-8 byte order mark every export starts with.
 *
 * @type {string}
 */
const BOM: string = String.fromCodePoint(0xfeff);

describe('usage CSV', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('separates the cells with a semicolon where the decimal separator is a comma', () => {
    expect(csvDelimiter('fr')).toBe(';');
    expect(csvDelimiter('en')).toBe(',');
  });

  it('writes numbers with the locale decimal separator and no grouping', () => {
    expect(csvNumber(92.4, 'fr', 1)).toBe('92,4');
    expect(csvNumber(1234, 'en', 0)).toBe('1234');
    expect(csvNumber(100, 'en', 1)).toBe('100');
  });

  it('writes a byte order mark, quotes the cells that need it and ends every row with CRLF', () => {
    expect(
      toCsv(
        [
          ['Section', 'Metric'],
          ['Team plan limits', 'Storage; GB'],
          ['Say "hi"', 'two\nlines'],
        ],
        ';',
      ),
    ).toBe(
      `${BOM}Section;Metric\r\nTeam plan limits;"Storage; GB"\r\n"Say ""hi""";"two\nlines"\r\n`,
    );
    expect(toCsv([['92,4', 'a;b']], ',')).toBe(`${BOM}"92,4",a;b\r\n`);
  });

  it('names the file after the organization and the month', () => {
    expect(usageFileName('atelier-nord', new Date(2026, 10, 27))).toBe(
      'atelier-nord-usage-2026-11.csv',
    );
  });

  it('starts the download of the file, or says when the browser refuses it', async () => {
    const click: ReturnType<typeof vi.spyOn> = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    let saved: Blob | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
      saved = blob as Blob;
      return 'blob:usage';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    expect(saveCsvFile(document, 'atelier-nord-usage-2026-11.csv', 'a;b\r\n')).toBe(true);
    expect(click).toHaveBeenCalledOnce();
    expect(await saved?.text()).toBe('a;b\r\n');
    expect(document.querySelector('a[download]')).toBeNull();

    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      throw new Error('Blocked');
    });
    expect(saveCsvFile(document, 'atelier-nord-usage-2026-11.csv', 'a;b\r\n')).toBe(false);
  });
});
