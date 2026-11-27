import { Service } from '@angular/core';
import {
  browserSupportsWebAuthn,
  type PublicKeyCredentialCreationOptionsJSON,
  type RegistrationResponseJSON,
  startRegistration,
} from '@simplewebauthn/browser';

/**
 * Function isPromptDismissed
 *
 * @description
 * Whether a WebAuthn ceremony failed because the person closed the browser's prompt, let it time
 * out, or the ceremony was replaced (`NotAllowedError`, `AbortError`, or the library's
 * `ERROR_CEREMONY_ABORTED`), as opposed to a failure worth reporting.
 *
 * @param {unknown} error - What the ceremony rejected with.
 * @returns {boolean} Whether to end silently.
 */
export function isPromptDismissed(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { name, code }: { name?: unknown; code?: unknown } = error as {
    name?: unknown;
    code?: unknown;
  };
  return name === 'NotAllowedError' || name === 'AbortError' || code === 'ERROR_CEREMONY_ABORTED';
}

/**
 * Service SecurityKeyRegistration
 *
 * @description
 * The browser side of registering a security key or the device's biometrics: whether this browser
 * can run WebAuthn at all, and the creation ceremony (`navigator.credentials.create` through
 * `@simplewebauthn/browser`) for the options the gateway gave. It reaches no API and keeps
 * nothing.
 */
@Service()
export class SecurityKeyRegistration {
  // #region Methods
  /**
   * Method supported
   *
   * @description
   * Whether this browser exposes WebAuthn; the section hides security keys otherwise.
   *
   * @returns {boolean} Whether keys can be registered here.
   */
  public supported(): boolean {
    try {
      return browserSupportsWebAuthn();
    } catch {
      return false;
    }
  }

  /**
   * Method create
   *
   * @description
   * Asks the browser to create a credential for the options; rejects when the person closes the
   * prompt (see `isPromptDismissed`) or the authenticator refuses.
   *
   * @param {PublicKeyCredentialCreationOptionsJSON} options - The gateway's creation options.
   * @returns {Promise<RegistrationResponseJSON>} The browser's answer, as JSON.
   */
  public create(
    options: PublicKeyCredentialCreationOptionsJSON,
  ): Promise<RegistrationResponseJSON> {
    return startRegistration({ optionsJSON: options });
  }
  // #endregion
}
