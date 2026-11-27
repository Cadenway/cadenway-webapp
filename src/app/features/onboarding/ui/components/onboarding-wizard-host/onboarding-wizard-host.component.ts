import { Component } from '@angular/core';

/**
 * Component OnboardingWizardHost
 *
 * @description
 * Host of the onboarding assistant in the application shell's `overlays` slot (order 50). The
 * assistant covers the shell when Auth opened `/<slug>?onboarding=start` after creating the
 * organization, or by itself on Home once a draft past version 1 was saved, and never for a guest.
 * It renders nothing yet: the assistant screens come with the wizard package of step 9.
 */
@Component({
  selector: 'cw-onboarding-wizard-host',
  host: { 'data-testid': 'onboarding-wizard-host' },
  template: '',
})
export class OnboardingWizardHost {}
