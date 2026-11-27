import { describe, expect, it } from 'vitest';

import { ONBOARDING_WIZARD_OVERLAY } from '../../constants/overlays/onboarding-overlays.constants';
import { OnboardingStore } from '../../state/onboarding/onboarding.store';
import { GettingStartedHost } from '../../ui/components/getting-started-host/getting-started-host.component';
import { OnboardingWizardHost } from '../../ui/components/onboarding-wizard-host/onboarding-wizard-host.component';
import { provideOnboarding, withGettingStarted, withOnboardingWizard } from './onboarding.provider';

describe('onboarding providers', () => {
  it('provides the shared store', () => {
    expect(provideOnboarding()).toEqual([OnboardingStore]);
  });

  it('contributes the checklist, then the assistant, after the task detail', () => {
    expect(withGettingStarted().useFactory()).toEqual({
      id: 'onboarding.getting-started',
      order: 40,
      component: GettingStartedHost,
    });
    expect(withOnboardingWizard().useFactory()).toEqual({
      id: ONBOARDING_WIZARD_OVERLAY,
      order: 50,
      component: OnboardingWizardHost,
    });
  });
});
