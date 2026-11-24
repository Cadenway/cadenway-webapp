import { Service } from '@angular/core';
import {
  type AuthenticationResponseJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  startAuthentication,
} from '@simplewebauthn/browser';

/**
 * Service SecurityKeyService
 *
 * @description
 * Runs the browser's WebAuthn assertion ceremony ("Touchez votre clé ou validez avec la
 * biométrie…") for options the gateway issued, and returns the answer serialized as JSON. It never
 * talks to the network: the auth data-access service fetches the options and sends the answer.
 * The promise rejects when the person cancels, the browser has no WebAuthn, or no key matches.
 */
@Service()
export class SecurityKeyService {
  // #region Methods
  /**
   * Method assert
   *
   * @description
   * Asks the browser for an assertion of one of the account's keys.
   *
   * @param {PublicKeyCredentialRequestOptionsJSON} options - Options from the gateway, as JSON.
   * @returns {Promise<AuthenticationResponseJSON>} The key's answer, as JSON.
   */
  public assert(
    options: PublicKeyCredentialRequestOptionsJSON,
  ): Promise<AuthenticationResponseJSON> {
    return startAuthentication({ optionsJSON: options });
  }
  // #endregion
}
