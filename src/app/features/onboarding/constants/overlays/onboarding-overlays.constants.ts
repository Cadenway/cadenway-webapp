/**
 * Constant ONBOARDING_WIZARD_OVERLAY
 *
 * @description
 * The id of the onboarding assistant: its `overlays` contribution id and the `ShellOverlay` id
 * `OnboardingWizardHost` holds while the assistant covers the shell. The getting-started checklist
 * stays hidden while it is open, and the other shell overlays (palette, shortcuts) cannot open
 * over it.
 *
 * @type {string}
 */
export const ONBOARDING_WIZARD_OVERLAY: string = 'onboarding.wizard';

/**
 * Constant ONBOARDING_INVITE_DIALOG_OVERLAY
 *
 * @description
 * The `ShellOverlay` id of the getting-started checklist's invite dialog, so no other shell
 * overlay opens over it.
 *
 * @type {string}
 */
export const ONBOARDING_INVITE_DIALOG_OVERLAY: string = 'onboarding.invite-dialog';
