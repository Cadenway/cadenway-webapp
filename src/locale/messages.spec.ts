import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ɵparseTranslation as parseTranslation } from '@angular/localize';

/**
 * Interface Catalog
 *
 * @description
 * A message catalog in Angular's JSON translation format.
 */
interface Catalog {
  // #region Properties
  /**
   * Property locale
   *
   * @description
   * Locale of the messages: `en` for the extracted source, `fr` for the translation.
   *
   * @type {string}
   * @readonly
   */
  readonly locale: string;

  /**
   * Property translations
   *
   * @description
   * Message text by `@@` id, placeholders written `{$NAME}` and ICU expressions inline.
   *
   * @type {Readonly<Record<string, string>>}
   * @readonly
   */
  readonly translations: Readonly<Record<string, string>>;
  // #endregion
}

/**
 * Function readCatalog
 *
 * @description
 * Reads a catalog of `src/locale/`.
 *
 * @param {string} name - File name inside `src/locale/`.
 * @returns {Catalog} The parsed catalog.
 */
function readCatalog(name: string): Catalog {
  return JSON.parse(readFileSync(resolve(process.cwd(), 'src/locale', name), 'utf8')) as Catalog;
}

/**
 * Function placeholders
 *
 * @description
 * Lists the names a message must keep in every translation: its `{$NAME}` placeholders and the
 * variables and interpolations of its ICU expressions.
 *
 * @param {string} text - Message text in the JSON format.
 * @returns {string} The sorted names, comma-separated.
 */
function placeholders(text: string): string {
  const icu: readonly string[] = [...text.matchAll(/\{([A-Z][A-Z0-9_]*)[,}]/g)].map(
    ([, name]: RegExpExecArray): string => name,
  );
  return [...new Set([...parseTranslation(text).placeholderNames, ...icu])].sort().join(',');
}

/**
 * Function findCatalogProblems
 *
 * @description
 * Compares the French catalog with the extracted source catalog: every source message needs a
 * non-empty French text with the same placeholders, and the French catalog keeps no text for a
 * removed message. At runtime a missing translation silently falls back to English.
 *
 * @param {Catalog} source - The extracted source catalog (`messages.json`).
 * @param {Catalog} french - The French catalog (`messages.fr.json`).
 * @returns {readonly string[]} One readable problem per faulty message id.
 */
function findCatalogProblems(source: Catalog, french: Catalog): readonly string[] {
  const problems: string[] = french.locale === 'fr' ? [] : ['catalog: locale is not fr'];
  for (const [id, text] of Object.entries(source.translations)) {
    const target: string | undefined = Object.hasOwn(french.translations, id)
      ? french.translations[id]
      : undefined;
    if (target === undefined) problems.push(`${id}: no French text`);
    else if (target.trim() === '') problems.push(`${id}: empty French text`);
    else if (placeholders(target) !== placeholders(text)) {
      problems.push(`${id}: placeholders differ from the source`);
    }
  }
  for (const id of Object.keys(french.translations)) {
    if (!Object.hasOwn(source.translations, id)) {
      problems.push(`${id}: French text without a source message`);
    }
  }
  return problems;
}

describe('French message catalog', () => {
  it('translates every source message with the same placeholders and keeps no orphan text', () => {
    expect(
      findCatalogProblems(readCatalog('messages.json'), readCatalog('messages.fr.json')),
    ).toEqual([]);
  });

  it('reports missing, empty, mismatched and orphan French texts', () => {
    const source: Catalog = {
      locale: 'en',
      translations: {
        'a.one': 'One',
        'a.two': 'Two',
        'a.three': 'Three {$name}',
        'a.four': '{VAR_PLURAL, plural, =1 {one} other {{INTERPOLATION} items}}',
      },
    };
    const french: Catalog = {
      locale: 'fr',
      translations: {
        'a.two': ' ',
        'a.three': 'Trois',
        'a.four': '{VAR_PLURAL, plural, =1 {un} other {plusieurs}}',
        'a.gone': 'Parti',
      },
    };

    expect(findCatalogProblems(source, french)).toEqual([
      'a.one: no French text',
      'a.two: empty French text',
      'a.three: placeholders differ from the source',
      'a.four: placeholders differ from the source',
      'a.gone: French text without a source message',
    ]);
  });
});
