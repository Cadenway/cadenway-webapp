import { Component } from '@angular/core';

/**
 * Component OnboardingWizardHost
 *
 * @description
 * Host of the onboarding assistant in the application shell's `overlays` slot (order 50). It
 * renders nothing yet. With step 9's wizard package, the assistant will cover the shell when Auth
 * opened `/<slug>?onboarding=start` after creating the organization, or by itself on Home once a
 * draft past version 1 was saved, and never for a guest.
 */
@Component({
  selector: 'cw-onboarding-wizard-host',
  host: { 'data-testid': 'onboarding-wizard-host' },
  template: '',
})
export class OnboardingWizardHost {}
