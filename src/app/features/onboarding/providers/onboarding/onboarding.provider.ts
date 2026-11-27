import type { Provider } from '@angular/core';
import type { SlotContribution, SlotFeature } from '@shared/layout-slot';

import { ONBOARDING_WIZARD_OVERLAY } from '../../constants/overlays/onboarding-overlays.constants';
import { OnboardingStore } from '../../state/onboarding/onboarding.store';
import { GettingStartedHost } from '../../ui/components/getting-started-host/getting-started-host.component';
import { OnboardingWizardHost } from '../../ui/components/onboarding-wizard-host/onboarding-wizard-host.component';

/**
 * Function provideOnboarding
 *
 * @description
 * Provides the one `OnboardingStore` the assistant and the getting-started checklist share. Give
 * it to the `/:org` route, whose injector provides `WORKSPACE_CONTEXT`.
 *
 * @returns {Provider[]} The store.
 */
export function provideOnboarding(): Provider[] {
  return [OnboardingStore];
}

/**
 * Function withOnboardingWizard
 *
 * @description
 * Contributes the onboarding assistant's host to the application shell's `overlays` slot, after
 * the task detail. Bind it in the application shell only, below a route given
 * `provideOnboarding()`; the settings shells do not show the assistant.
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withOnboardingWizard(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: ONBOARDING_WIZARD_OVERLAY,
      order: 50,
      component: OnboardingWizardHost,
    }),
  };
}

/**
 * Function withGettingStarted
 *
 * @description
 * Contributes the `Getting started` checklist's host to the application shell's `overlays` slot,
 * after the task detail and before the assistant. Bind it in the application shell only, below a
 * route given `provideOnboarding()`.
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withGettingStarted(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'onboarding.getting-started',
      order: 40,
      component: GettingStartedHost,
    }),
  };
}
