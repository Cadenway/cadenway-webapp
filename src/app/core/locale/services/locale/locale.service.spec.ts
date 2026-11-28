import { DOCUMENT, PlatformLocation } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

import { LocaleService } from './locale.service';

/**
 * Interface Page
 *
 * @description
 * The service under test and what it did to the page.
 */
interface Page {
  // #region Properties
  /**
   * Property service
   *
   * @description
   * The service.
   *
   * @type {LocaleService}
   * @readonly
   */
  readonly service: LocaleService;

  /**
   * Property assign
   *
   * @description
   * The recorded full navigation.
   *
   * @type {Mock}
   * @readonly
   */
  readonly assign: Mock;

  /**
   * Property cookies
   *
   * @description
   * Every text assigned to `document.cookie`, in order.
   *
   * @type {string[]}
   * @readonly
   */
  readonly cookies: string[];
  // #endregion
}

/**
 * Function setUp
 *
 * @description
 * Creates the service for a build in a locale, on `/fr/atelier-nord/inbox?tab=all#top` (or its
 * `/en/` twin) served over a protocol, over a document whose navigation and cookies are recorded.
 *
 * @param {string} locale - Value of `$localize.locale` for this build.
 * @param {string} protocol - The page protocol (`https:`).
 * @returns {Page} The service and what it did.
 */
function setUp(locale: string, protocol: string = 'https:'): Page {
  $localize.locale = locale;
  const assign: Mock = vi.fn();
  const cookies: string[] = [];
  const segment: string = locale === 'fr' ? 'fr' : 'en';
  TestBed.configureTestingModule({
    providers: [
      {
        provide: DOCUMENT,
        useValue: {
          location: { protocol, assign },
          set cookie(text: string) {
            cookies.push(text);
          },
        },
      },
      {
        provide: PlatformLocation,
        useValue: {
          pathname: `/${segment}/atelier-nord/inbox`,
          search: '?tab=all',
          hash: '#top',
          getBaseHrefFromDOM: (): string => `/${segment}/`,
        },
      },
    ],
  });
  return { service: TestBed.inject(LocaleService), assign, cookies };
}

describe('LocaleService', () => {
  afterEach(() => {
    $localize.locale = 'en';
  });

  it('reports the locale of this build and falls back to English for an unknown one', () => {
    expect(setUp('fr').service.current).toBe('fr');
    TestBed.resetTestingModule();
    expect(setUp('en-US').service.current).toBe('en');
  });

  it('opens the same page below the other locale segment, keeping its query and fragment', () => {
    const { service, assign }: Page = setUp('fr');

    service.use('en');

    expect(assign).toHaveBeenCalledWith('/en/atelier-nord/inbox?tab=all#top');
  });

  it('remembers the choice in a secure first-party cookie over HTTPS', () => {
    const { service, cookies }: Page = setUp('en');

    service.use('fr');

    expect(cookies).toEqual(['cw_locale=fr; Path=/; Max-Age=31536000; SameSite=Lax; Secure']);
  });

  it('leaves Secure out over HTTP', () => {
    const { service, cookies }: Page = setUp('en', 'http:');

    service.use('fr');

    expect(cookies).toEqual(['cw_locale=fr; Path=/; Max-Age=31536000; SameSite=Lax']);
  });

  it('remembers the current locale without navigating', () => {
    const { service, assign, cookies }: Page = setUp('fr');

    service.use('fr');

    expect(assign).not.toHaveBeenCalled();
    expect(cookies).toEqual(['cw_locale=fr; Path=/; Max-Age=31536000; SameSite=Lax; Secure']);
  });
});
