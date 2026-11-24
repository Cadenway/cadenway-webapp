import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Interface CatalogUnit
 *
 * @description
 * One translation unit of an XLIFF 1.2 catalog: its id and the inner XML of its target, if any.
 */
interface CatalogUnit {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * The `@@` id of the message.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property target
   *
   * @description
   * Inner XML of the `<target>` element, or `null` when the unit has none.
   *
   * @type {string | null}
   * @readonly
   */
  readonly target: string | null;
  // #endregion
}

/**
 * Function readUnits
 *
 * @description
 * Lists the translation units of an XLIFF 1.2 document in document order.
 *
 * @param {string} xliff - The catalog contents.
 * @returns {readonly CatalogUnit[]} The units with their target.
 */
function readUnits(xliff: string): readonly CatalogUnit[] {
  return [...xliff.matchAll(/<trans-unit\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/trans-unit>/g)].map(
    ([, id, body]: RegExpExecArray): CatalogUnit => ({
      id,
      target: /<target(?:\s[^>]*)?>([\s\S]*?)<\/target>/.exec(body)?.[1] ?? null,
    }),
  );
}

/**
 * Function findCatalogProblems
 *
 * @description
 * Compares the French catalog with the source catalog: every source message needs a French unit
 * with a non-empty target, and the French catalog keeps no unit for a removed message. Angular
 * only warns about a unit without a target and silently renders an empty one.
 *
 * @param {string} source - The extracted source catalog (`messages.xlf`).
 * @param {string} french - The French catalog (`messages.fr.xlf`).
 * @returns {readonly string[]} One readable problem per faulty message id.
 */
function findCatalogProblems(source: string, french: string): readonly string[] {
  const translations: ReadonlyMap<string, string | null> = new Map(
    readUnits(french).map((unit: CatalogUnit): [string, string | null] => [unit.id, unit.target]),
  );
  const sourceIds: ReadonlySet<string> = new Set(
    readUnits(source).map((unit: CatalogUnit): string => unit.id),
  );
  const problems: string[] = [];
  for (const id of sourceIds) {
    const target: string | null | undefined = translations.get(id);
    if (target === undefined) problems.push(`${id}: no French unit`);
    else if (target === null) problems.push(`${id}: no French target`);
    else if (target.trim() === '') problems.push(`${id}: empty French target`);
  }
  for (const id of translations.keys()) {
    if (!sourceIds.has(id)) problems.push(`${id}: French unit without a source message`);
  }
  return problems;
}

/**
 * Function catalog
 *
 * @description
 * Wraps units in an XLIFF 1.2 document, as the extractor writes them.
 *
 * @param {string} units - The `<trans-unit>` elements.
 * @returns {string} The catalog contents.
 */
function catalog(units: string): string {
  return `<xliff version="1.2"><file source-language="en"><body>${units}</body></file></xliff>`;
}

describe('French message catalog', () => {
  it('translates every source message with a non-empty target and keeps no orphan unit', () => {
    const source: string = readFileSync(resolve(process.cwd(), 'src/locale/messages.xlf'), 'utf8');
    const french: string = readFileSync(
      resolve(process.cwd(), 'src/locale/messages.fr.xlf'),
      'utf8',
    );

    expect(findCatalogProblems(source, french)).toEqual([]);
  });

  it('reports missing, target-less, empty and orphan French units', () => {
    const source: string = catalog(
      '<trans-unit id="a.one"><source>One</source></trans-unit>' +
        '<trans-unit id="a.two"><source>Two</source></trans-unit>' +
        '<trans-unit id="a.three"><source>Three</source></trans-unit>' +
        '<trans-unit id="a.four"><source>Four <x id="INTERPOLATION"/></source></trans-unit>',
    );
    const french: string = catalog(
      '<trans-unit id="a.two"><source>Two</source></trans-unit>' +
        '<trans-unit id="a.three"><source>Three</source><target> </target></trans-unit>' +
        '<trans-unit id="a.four"><source>Four</source><target><x id="INTERPOLATION"/></target></trans-unit>' +
        '<trans-unit id="a.gone"><source>Gone</source><target>Parti</target></trans-unit>',
    );

    expect(findCatalogProblems(source, french)).toEqual([
      'a.one: no French unit',
      'a.two: no French target',
      'a.three: empty French target',
      'a.gone: French unit without a source message',
    ]);
  });
});
