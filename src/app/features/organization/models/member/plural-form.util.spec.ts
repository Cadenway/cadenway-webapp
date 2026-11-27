import { afterEach, describe, expect, it } from 'vitest';

import { takesSingular } from './plural-form.util';

/**
 * Constant LOCALE
 *
 * @description
 * The locale installed before the tests, restored after each one.
 *
 * @type {string | undefined}
 */
const LOCALE: string | undefined = $localize.locale;

describe('takesSingular', () => {
  afterEach(() => {
    $localize.locale = LOCALE;
  });

  it('reads 0 as plural in English and 1 as singular', () => {
    $localize.locale = 'en';

    expect([0, 1, 2].map(takesSingular)).toEqual([false, true, false]);
  });

  it('reads 0 and 1 as singular in French, as the mockup does', () => {
    $localize.locale = 'fr';

    expect([0, 1, 2].map(takesSingular)).toEqual([true, true, false]);
  });
});
