import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { DatePipe } from '@angular/common';
import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { clearTranslations } from '@angular/localize';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { readCatalog, loadLocale } from './locale-loader.utils';

/**
 * Constant FRENCH_CATALOG
 *
 * @description
 * The maintained French catalog, as the server delivers it.
 *
 * @type {{ readonly translations: Readonly<Record<string, string>> }}
 */
const FRENCH_CATALOG: { readonly translations: Readonly<Record<string, string>> } = JSON.parse(
  readFileSync(resolve(process.cwd(), 'src/locale/messages.fr.json'), 'utf8'),
) as { readonly translations: Readonly<Record<string, string>> };

/**
 * Constant FRENCH_PROFILE
 *
 * @description
 * The French text of `account.user-menu.profile`, read from the catalog so the spec holds no French.
 *
 * @type {string}
 */
const FRENCH_PROFILE: string = FRENCH_CATALOG.translations['account.user-menu.profile'] ?? '';

/**
 * Constant FRENCH_DAY
 *
 * @description
 * Monday, 9 November 2026 as the `fr` locale writes `EEEE d MMMM`, computed by `Intl`.
 *
 * @type {string}
 */
const FRENCH_DAY: string = new Intl.DateTimeFormat('fr', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
}).format(new Date(2026, 10, 9));

/**
 * Component LocalizedSample
 *
 * @description
 * Renders a real catalog message through template i18n and a date through `LOCALE_ID`.
 */
@Component({
  selector: 'cw-localized-sample',
  imports: [DatePipe],
  template: `<p i18n="@@account.user-menu.profile">My profile</p>
    <time>{{ day | date: 'EEEE d MMMM' }}</time>`,
})
class LocalizedSample {
  // #region Properties
  /**
   * Property day
   *
   * @description
   * A fixed Monday, 9 November 2026.
   *
   * @type {Date}
   * @readonly
   */
  protected readonly day: Date = new Date(2026, 10, 9);
  // #endregion
}

/**
 * Function profileLabel
 *
 * @description
 * Reads a real catalog message the way a module-level constant does.
 *
 * @returns {string} The message in the installed locale.
 */
function profileLabel(): string {
  return $localize`:@@account.user-menu.profile:My profile`;
}

describe('loadLocale', () => {
  let fetchCatalog: Mock<() => Promise<Response>>;

  beforeEach(() => {
    fetchCatalog = vi.fn((): Promise<Response> =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: (): Promise<unknown> => Promise.resolve(FRENCH_CATALOG),
      } as Response),
    );
    vi.stubGlobal('fetch', fetchCatalog);
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    clearTranslations();
    $localize.locale = 'en';
    window.localStorage.clear();
    window.history.replaceState(null, '', '/');
    document.documentElement.lang = 'en';
  });

  it('starts in English by default and loads nothing', async () => {
    window.history.replaceState(null, '', '/atelier-nord');

    await expect(loadLocale(window)).resolves.toBe('en');

    expect(fetchCatalog).not.toHaveBeenCalled();
    expect($localize.locale).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(profileLabel()).toBe('My profile');
  });

  it('loads French from ?lang=fr, remembers it and renders the French copy', async () => {
    window.history.replaceState(null, '', '/atelier-nord?lang=fr');

    await expect(loadLocale(window)).resolves.toBe('fr');

    expect(fetchCatalog).toHaveBeenCalledWith(new URL('messages.fr.json', document.baseURI));
    expect(window.localStorage.getItem('cadenway-locale')).toBe('fr');
    expect($localize.locale).toBe('fr');
    expect(document.documentElement.lang).toBe('fr');
    expect(FRENCH_PROFILE).not.toBe('My profile');
    expect(profileLabel()).toBe(FRENCH_PROFILE);

    const fixture: ComponentFixture<LocalizedSample> = TestBed.createComponent(LocalizedSample);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('p')?.textContent).toBe(FRENCH_PROFILE);
    expect(host.querySelector('time')?.textContent).toBe(FRENCH_DAY);
  });

  it('keeps the remembered French choice when the address has no parameter', async () => {
    window.localStorage.setItem('cadenway-locale', 'fr');

    await expect(loadLocale(window)).resolves.toBe('fr');

    expect(profileLabel()).toBe(FRENCH_PROFILE);
  });

  it('returns to English with ?lang=en and remembers it', async () => {
    window.localStorage.setItem('cadenway-locale', 'fr');
    window.history.replaceState(null, '', '/atelier-nord?lang=en');

    await expect(loadLocale(window)).resolves.toBe('en');

    expect(fetchCatalog).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('cadenway-locale')).toBe('en');
    expect(profileLabel()).toBe('My profile');
  });

  it('ignores an unsupported parameter', async () => {
    window.history.replaceState(null, '', '/?lang=de');

    await expect(loadLocale(window)).resolves.toBe('en');

    expect(window.localStorage.getItem('cadenway-locale')).toBeNull();
  });

  it('applies the parameter when the device storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    window.history.replaceState(null, '', '/?lang=fr');

    await expect(loadLocale(window)).resolves.toBe('fr');
  });

  it('starts in English and logs the failure when the French catalog cannot be fetched', async () => {
    fetchCatalog.mockResolvedValue({ ok: false, status: 503 } as Response);
    const log: Mock = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    window.history.replaceState(null, '', '/?lang=fr');

    await expect(loadLocale(window)).resolves.toBe('en');

    expect(log).toHaveBeenCalledOnce();
    expect(document.documentElement.lang).toBe('en');
    expect(profileLabel()).toBe('My profile');
  });
});

describe('readCatalog', () => {
  it('accepts a French catalog of string translations', () => {
    expect(readCatalog({ locale: 'fr', translations: { 'a.one': 'Un' } })).toEqual({
      'a.one': 'Un',
    });
  });

  it('rejects another locale, a missing table or a non-string translation', () => {
    expect(() => readCatalog({ locale: 'en', translations: {} })).toThrow(TypeError);
    expect(() => readCatalog({ locale: 'fr' })).toThrow(TypeError);
    expect(() => readCatalog({ locale: 'fr', translations: { 'a.one': 1 } })).toThrow(TypeError);
    expect(() => readCatalog(null)).toThrow(TypeError);
  });
});
