import { describe, expect, it } from 'vitest';

import { isAppLocale, localeAddress, localeCookie } from './locale-address.utils';

describe('isAppLocale', () => {
  it('accepts the built locales only', () => {
    expect(isAppLocale('en')).toBe(true);
    expect(isAppLocale('fr')).toBe(true);
    expect(isAppLocale('de')).toBe(false);
    expect(isAppLocale('en-US')).toBe(false);
    expect(isAppLocale(undefined)).toBe(false);
  });
});

describe('localeAddress', () => {
  it('moves the path below the other locale segment, query and fragment kept', () => {
    expect(
      localeAddress(
        { pathname: '/fr/atelier-nord/home', search: '?x=1', hash: '#y' },
        '/fr/',
        'en',
      ),
    ).toBe('/en/atelier-nord/home?x=1#y');
    expect(
      localeAddress({ pathname: '/en/atelier-nord/t/CAD-482', search: '', hash: '' }, '/en/', 'fr'),
    ).toBe('/fr/atelier-nord/t/CAD-482');
  });

  it('opens the root of the other locale from the root of the current one', () => {
    expect(localeAddress({ pathname: '/en/', search: '', hash: '' }, '/en/', 'fr')).toBe('/fr/');
    expect(localeAddress({ pathname: '/en', search: '?a', hash: '' }, '/en/', 'fr')).toBe('/fr/?a');
  });

  it('keeps the whole path when it is not below the base', () => {
    expect(localeAddress({ pathname: '/atelier-nord/home', search: '', hash: '' }, '/', 'fr')).toBe(
      '/fr/atelier-nord/home',
    );
  });
});

describe('localeCookie', () => {
  it('remembers the locale for the whole site for a year', () => {
    expect(localeCookie('fr', true)).toBe(
      'cw_locale=fr; Path=/; Max-Age=31536000; SameSite=Lax; Secure',
    );
    expect(localeCookie('en', false)).toBe('cw_locale=en; Path=/; Max-Age=31536000; SameSite=Lax');
  });
});
