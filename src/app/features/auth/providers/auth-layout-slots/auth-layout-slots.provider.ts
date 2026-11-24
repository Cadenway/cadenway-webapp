import { inject } from '@angular/core';
import type { SlotContribution, SlotFeature } from '@shared/layout-slot';

import { RuntimeConfigStore } from '@core/config';

import { LegalLinks } from '../../ui/components/legal-links/legal-links.component';
import { ThemeToggle } from '../../ui/components/theme-toggle/theme-toggle.component';

/**
 * Function withThemeToggle
 *
 * @description
 * Contributes the theme button to the header actions of the sign-in frame.
 *
 * @returns {SlotFeature<SlotContribution>} The contribution factory.
 */
export function withThemeToggle(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({ id: 'auth-theme', order: 20, component: ThemeToggle }),
  };
}

/**
 * Function withLegalLinks
 *
 * @description
 * Contributes the Privacy, Terms of use and Help links to the footer of the sign-in frame. They
 * point to the public site at the runtime `siteUrl` and render nothing when it is not configured.
 *
 * @returns {SlotFeature<SlotContribution>} The contribution factory.
 */
export function withLegalLinks(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'auth-legal',
      order: 10,
      component: LegalLinks,
      inputs: { siteUrl: inject(RuntimeConfigStore).config().siteUrl ?? null },
    }),
  };
}
