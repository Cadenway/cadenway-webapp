import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { loadTranslations, type ɵParsedTranslation } from '@angular/localize';
import { Xliff1TranslationParser } from '@angular/localize/tools';

/**
 * Function loadFrenchTranslations
 *
 * @description
 * Loads the maintained French catalog through Angular's own parser before the spec modules
 * evaluate their messages. The unit-test builder does not inline translations, so specs run the
 * French copy users see, from the same catalog as the served build.
 *
 * @returns {void} French messages and formatting data are installed for this worker.
 *
 * @throws {Error} The French catalog is malformed or has translation errors.
 */
function loadFrenchTranslations(): void {
  const path: string = resolve(process.cwd(), 'src/locale/messages.fr.xlf');
  const contents: string = readFileSync(path, 'utf8');
  const parser: Xliff1TranslationParser = new Xliff1TranslationParser();
  const analysis: ReturnType<Xliff1TranslationParser['analyze']> = parser.analyze(path, contents);
  if (!analysis.canParse) {
    throw new Error(analysis.diagnostics.formatDiagnostics('Cannot parse the French catalog.'));
  }
  const bundle: ReturnType<Xliff1TranslationParser['parse']> = parser.parse(
    path,
    contents,
    analysis.hint,
  );
  if (bundle.diagnostics.hasErrors || bundle.locale !== 'fr') {
    throw new Error(bundle.diagnostics.formatDiagnostics('Invalid French catalog.'));
  }
  loadTranslations(
    Object.fromEntries(
      Object.entries(bundle.translations).map(
        ([id, translation]: [string, ɵParsedTranslation]): [string, string] => [
          id,
          translation.text,
        ],
      ),
    ),
  );
  registerLocaleData(localeFr);
  $localize.locale = 'fr';
}

loadFrenchTranslations();
