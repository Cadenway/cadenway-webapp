import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { SlotContribution } from '@shared/layout-slot';
import { describe, expect, it } from 'vitest';

import { RuntimeConfigStore } from '@core/config';

import { LegalLinks } from '../../ui/components/legal-links/legal-links.component';
import { ThemeToggle } from '../../ui/components/theme-toggle/theme-toggle.component';
import { withLegalLinks, withThemeToggle } from './auth-layout-slots.provider';

/**
 * Function legalLinks
 *
 * @description
 * Builds the legal links contribution with a given site address.
 *
 * @param {string | undefined} siteUrl - The configured site, or undefined.
 * @returns {SlotContribution} The contribution.
 */
function legalLinks(siteUrl: string | undefined): SlotContribution {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: RuntimeConfigStore,
        useValue: { config: signal({ apiUrl: 'http://api.localhost', siteUrl }) },
      },
    ],
  });
  return TestBed.runInInjectionContext(() => withLegalLinks().useFactory());
}

describe('auth layout slot contributions', () => {
  it('contributes the theme button', () => {
    expect(withThemeToggle().useFactory()).toEqual({
      id: 'auth-theme',
      order: 20,
      component: ThemeToggle,
    });
  });

  it('passes the configured site to the legal links, or null without one', () => {
    expect(legalLinks('https://cadenway.example')).toEqual({
      id: 'auth-legal',
      order: 10,
      component: LegalLinks,
      inputs: { siteUrl: 'https://cadenway.example' },
    });
    TestBed.resetTestingModule();
    expect(legalLinks(undefined).inputs).toEqual({ siteUrl: null });
  });
});
