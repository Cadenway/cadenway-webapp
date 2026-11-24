import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { provideAppLocale } from './app-locale.provider';

describe('provideAppLocale', () => {
  afterEach(() => {
    $localize.locale = 'fr';
  });

  it('uses the locale of the translated build', () => {
    TestBed.configureTestingModule({ providers: [provideAppLocale()] });

    expect(TestBed.inject(LOCALE_ID)).toBe('fr');
  });

  it('falls back to the English source locale without a translated build', () => {
    $localize.locale = undefined;
    TestBed.configureTestingModule({ providers: [provideAppLocale()] });

    expect(TestBed.inject(LOCALE_ID)).toBe('en');
  });
});
