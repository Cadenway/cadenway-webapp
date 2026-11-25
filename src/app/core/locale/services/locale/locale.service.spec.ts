import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

import { LocaleService } from './locale.service';

/**
 * Function setUp
 *
 * @description
 * Creates the service for a load in a locale, over a document whose navigation is recorded.
 *
 * @param {string} locale - Value of `$localize.locale` for this load.
 * @returns {{ service: LocaleService; assign: Mock }} The service and the recorded navigation.
 */
function setUp(locale: string): { service: LocaleService; assign: Mock } {
  $localize.locale = locale;
  const assign: Mock = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: DOCUMENT,
        useValue: {
          location: { href: 'https://app.cadenway.test/atelier-nord/inbox?tab=all#top', assign },
        },
      },
    ],
  });
  return { service: TestBed.inject(LocaleService), assign };
}

describe('LocaleService', () => {
  afterEach(() => {
    $localize.locale = 'en';
  });

  it('reports the locale of this load and falls back to English for an unknown one', () => {
    expect(setUp('fr').service.current).toBe('fr');
    TestBed.resetTestingModule();
    expect(setUp('en-US').service.current).toBe('en');
  });

  it('reloads the current page with ?lang= to switch, keeping its parameters', () => {
    const { service, assign }: { service: LocaleService; assign: Mock } = setUp('en');

    service.use('fr');

    expect(assign).toHaveBeenCalledWith(
      'https://app.cadenway.test/atelier-nord/inbox?tab=all&lang=fr#top',
    );
  });

  it('does nothing for the current locale', () => {
    const { service, assign }: { service: LocaleService; assign: Mock } = setUp('fr');

    service.use('fr');

    expect(assign).not.toHaveBeenCalled();
  });
});
