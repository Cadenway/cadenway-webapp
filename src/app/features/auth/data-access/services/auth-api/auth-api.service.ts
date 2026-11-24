import type { HttpResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import {
  AuthService,
  type FederatedAuthorization,
  type PasswordResetCompleted,
  type PasswordResetLink as PasswordResetLinkDto,
  type SecurityKeyAssertion,
  type SecurityKeyAssertionOptions,
  type SignedIn,
  type SignInChallenge,
  type SignInMethods,
} from '@cadenway/api-client';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { firstValueFrom, type Observable } from 'rxjs';

import type {
  FederatedProvider,
  PasswordResetLink,
  PasswordResetResult,
  SignedInAccount,
  SignInOutcome,
  TwoStepChallenge,
} from '../../../models/session/session.interface';
import { SecurityKeyService } from '../../../services/security-key/security-key.service';
import { withSessionLock } from '../../../services/session-lock/session-lock.service';
import {
  openedSession,
  signInOutcome,
  twoStepChallenge,
} from '../../adapters/session/session.adapter';

/**
 * Function locked
 *
 * @description
 * Runs a request that changes the session cookie under the exclusive cross-tab session lock and
 * waits for its single answer.
 *
 * @template T
 * @param {() => Observable<T>} operation - The generated client call.
 * @returns {Promise<T>} The answer, or a rejection when the lock or the request fails.
 */
function locked<T>(operation: () => Observable<T>): Promise<T> {
  return firstValueFrom(withSessionLock(operation));
}

/**
 * Function providerDestination
 *
 * @description
 * Accepts only the contracted HTTPS authorization URL without credentials before the browser is
 * handed to it.
 *
 * @param {FederatedAuthorization} authorization - The gateway's answer.
 * @returns {string} The normalized destination.
 * @throws {Error} When the destination is not a bounded HTTPS URL without credentials.
 */
function providerDestination({ authorizationUrl }: FederatedAuthorization): string {
  const url: URL = new URL(authorizationUrl);
  if (
    authorizationUrl.length > 8_192 ||
    url.protocol !== 'https:' ||
    url.username !== '' ||
    url.password !== ''
  ) {
    throw new Error('The gateway returned an invalid provider authorization URL.');
  }
  return url.href;
}

/**
 * Service AuthApi
 *
 * @description
 * The auth screens' access to the gateway's auth operations, mapped to display models. Every
 * operation that may set or clear the session cookie (sign-in, its second step, a verified
 * sign-up, the federated continuation, sign-out) runs under the exclusive session lock; reads and
 * code or link requests do not. Rejections carry the client's `HttpErrorResponse`, read with
 * `authProblem`.
 */
@Service()
export class AuthApi {
  // #region Properties
  /**
   * Property auth
   *
   * @description
   * Generated auth operations.
   *
   * @type {AuthService}
   * @readonly
   */
  private readonly auth: AuthService = inject(AuthService);

  /**
   * Property securityKey
   *
   * @description
   * Browser WebAuthn ceremony.
   *
   * @type {SecurityKeyService}
   * @readonly
   */
  private readonly securityKey: SecurityKeyService = inject(SecurityKeyService);
  // #endregion

  // #region Methods
  /**
   * Method discoverSignInMethods
   *
   * @description
   * Lists the method types the gateway offers for an address (`password`, `email-code`, later
   * `saml`...). The address travels in the body.
   *
   * @param {string} email - Address typed by the person.
   * @returns {Promise<readonly string[]>} The method types.
   */
  public async discoverSignInMethods(email: string): Promise<readonly string[]> {
    const { methods }: SignInMethods = await firstValueFrom(
      this.auth.discoverSignInMethods({ email }),
    );
    return methods.map((method: { type: string }): string => method.type);
  }

  /**
   * Method signInWithPassword
   *
   * @description
   * Checks an address and its password.
   *
   * @param {string} email - Account address.
   * @param {string} password - Password, sent once and never kept.
   * @param {boolean} rememberMe - Whether the session cookie lasts 30 days.
   * @returns {Promise<SignInOutcome>} The opened session or the two-step challenge.
   */
  public async signInWithPassword(
    email: string,
    password: string,
    rememberMe: boolean,
  ): Promise<SignInOutcome> {
    return signInOutcome(
      await locked(() =>
        this.auth.signInWithPassword({ email, password, rememberMe }, { observe: 'response' }),
      ),
    );
  }

  /**
   * Method startFederatedSignIn
   *
   * @description
   * Binds a provider flow to this browser and returns where to send it. Opens no session.
   *
   * @param {FederatedProvider | { readonly email: string }} provider - A social provider, or the
   * work address that selects a SAML connection.
   * @param {boolean} rememberMe - Whether the eventual session cookie lasts 30 days.
   * @returns {Promise<string>} The checked HTTPS authorization URL.
   */
  public async startFederatedSignIn(
    provider: FederatedProvider | { readonly email: string },
    rememberMe: boolean,
  ): Promise<string> {
    return providerDestination(
      await firstValueFrom(
        this.auth.startFederatedSignIn(
          typeof provider === 'string'
            ? { provider, rememberMe }
            : { provider: 'saml', email: provider.email, rememberMe },
        ),
      ),
    );
  }

  /**
   * Method finishFederatedSignIn
   *
   * @description
   * Redeems the HttpOnly continuation cookie with an empty body. The gateway clears the cookie on
   * every outcome, so a second call is refused.
   *
   * @returns {Promise<SignInOutcome>} The opened session or the two-step challenge.
   */
  public async finishFederatedSignIn(): Promise<SignInOutcome> {
    return signInOutcome(
      await locked(() => this.auth.finishFederatedSignIn({}, { observe: 'response' })),
    );
  }

  /**
   * Method requestSignInCode
   *
   * @description
   * Sends a 6-digit sign-in code to the address when an account uses it; always accepted.
   *
   * @param {string} email - Account address.
   * @returns {Promise<void>} Resolves once the gateway accepted the request.
   */
  public async requestSignInCode(email: string): Promise<void> {
    await firstValueFrom(this.auth.requestSignInCode({ email }));
  }

  /**
   * Method signInWithCode
   *
   * @description
   * Checks a sign-in code.
   *
   * @param {string} email - Account address.
   * @param {string} code - The 6 digits of the e-mail.
   * @param {boolean} rememberMe - Whether the session cookie lasts 30 days.
   * @returns {Promise<SignInOutcome>} The opened session or the two-step challenge.
   */
  public async signInWithCode(
    email: string,
    code: string,
    rememberMe: boolean,
  ): Promise<SignInOutcome> {
    return signInOutcome(
      await locked(() =>
        this.auth.signInWithCode({ email, code, rememberMe }, { observe: 'response' }),
      ),
    );
  }

  /**
   * Method inspectChallenge
   *
   * @description
   * Reads a pending challenge again from its token, without answering it.
   *
   * @param {string} token - Challenge token kept for the tab.
   * @returns {Promise<TwoStepChallenge>} The challenge; `auth.challenge-expired` rejects.
   */
  public async inspectChallenge(token: string): Promise<TwoStepChallenge> {
    const challenge: SignInChallenge = await firstValueFrom(
      this.auth.inspectSignInChallenge({ token }),
    );
    return twoStepChallenge(challenge);
  }

  /**
   * Method answerWithAuthenticatorApp
   *
   * @description
   * Answers a challenge with the 6 digits of the authenticator app.
   *
   * @param {string} token - Challenge token.
   * @param {string} code - The 6 digits.
   * @param {boolean} trustDevice - Whether to trust this device for 30 days.
   * @returns {Promise<SignedInAccount>} The account of the opened session.
   */
  public async answerWithAuthenticatorApp(
    token: string,
    code: string,
    trustDevice: boolean,
  ): Promise<SignedInAccount> {
    return openedSession(
      await locked(() =>
        this.auth.answerSignInChallengeWithAuthenticatorApp(
          { token, code, trustDevice },
          { observe: 'response' },
        ),
      ),
    );
  }

  /**
   * Method answerWithBackupCode
   *
   * @description
   * Answers a challenge with a single-use backup code (`XXXX-XXXX`).
   *
   * @param {string} token - Challenge token.
   * @param {string} code - The backup code.
   * @param {boolean} trustDevice - Whether to trust this device for 30 days.
   * @returns {Promise<SignedInAccount>} The account of the opened session.
   */
  public async answerWithBackupCode(
    token: string,
    code: string,
    trustDevice: boolean,
  ): Promise<SignedInAccount> {
    return openedSession(
      await locked(() =>
        this.auth.answerSignInChallengeWithBackupCode(
          { token, code, trustDevice },
          { observe: 'response' },
        ),
      ),
    );
  }

  /**
   * Method answerWithSecurityKey
   *
   * @description
   * Asks the gateway for WebAuthn options, runs the browser ceremony, then sends the key's answer.
   * Only the answer runs under the session lock, so a slow ceremony does not hold other tabs.
   *
   * @param {string} token - Challenge token.
   * @param {boolean} trustDevice - Whether to trust this device for 30 days.
   * @returns {Promise<SignedInAccount>} The account of the opened session.
   */
  public async answerWithSecurityKey(
    token: string,
    trustDevice: boolean,
  ): Promise<SignedInAccount> {
    const { options }: SecurityKeyAssertionOptions = await firstValueFrom(
      this.auth.getSignInChallengeSecurityKeyOptions({ token }),
    );
    const credential: SecurityKeyAssertion = (await this.securityKey.assert(
      options as unknown as PublicKeyCredentialRequestOptionsJSON,
    )) as unknown as SecurityKeyAssertion;
    return openedSession(
      await locked(() =>
        this.auth.answerSignInChallengeWithSecurityKey(
          { token, credential, trustDevice },
          { observe: 'response' },
        ),
      ),
    );
  }

  /**
   * Method signUp
   *
   * @description
   * Creates an unverified account and sends a 6-digit code to its address. Opens no session.
   *
   * @param {{ readonly name: string; readonly email: string; readonly password: string }} account -
   * The sign-up form values.
   * @returns {Promise<void>} Resolves once the code is sent; `auth.email-taken` rejects.
   */
  public async signUp(account: {
    readonly name: string;
    readonly email: string;
    readonly password: string;
  }): Promise<void> {
    await firstValueFrom(this.auth.signUp({ ...account, acceptTerms: true }));
  }

  /**
   * Method resendSignUpCode
   *
   * @description
   * Sends a new sign-up code; the previous one stops working.
   *
   * @param {string} email - Address being verified.
   * @returns {Promise<void>} Resolves once accepted.
   */
  public async resendSignUpCode(email: string): Promise<void> {
    await firstValueFrom(this.auth.resendSignUpCode({ email }));
  }

  /**
   * Method verifySignUp
   *
   * @description
   * Checks the sign-up code with the password of the sign-up and opens the first session.
   *
   * @param {string} email - Address being verified.
   * @param {string} code - The 6 digits of the e-mail.
   * @param {string} password - Password typed in the sign-up form.
   * @returns {Promise<SignedInAccount>} The account of the opened session.
   */
  public async verifySignUp(
    email: string,
    code: string,
    password: string,
  ): Promise<SignedInAccount> {
    return openedSession(
      await locked(() =>
        this.auth.verifySignUp({ email, code, password }, { observe: 'response' }),
      ),
    );
  }

  /**
   * Method requestPasswordReset
   *
   * @description
   * Sends a reset link when an account uses the address; always answers the same way.
   *
   * @param {string} email - Account address.
   * @returns {Promise<void>} Resolves once accepted; `auth.reset-throttled` rejects.
   */
  public async requestPasswordReset(email: string): Promise<void> {
    await firstValueFrom(this.auth.requestPasswordReset({ email }));
  }

  /**
   * Method inspectPasswordReset
   *
   * @description
   * Reads the account of a reset link without using it.
   *
   * @param {string} token - Token from the link's fragment, sent in the body only.
   * @returns {Promise<PasswordResetLink>} The account; `auth.reset-link-expired` rejects.
   */
  public async inspectPasswordReset(token: string): Promise<PasswordResetLink> {
    const link: PasswordResetLinkDto = await firstValueFrom(
      this.auth.inspectPasswordResetLink({ token }),
    );
    return { email: link.email, sessionCount: link.sessionCount };
  }

  /**
   * Method confirmPasswordReset
   *
   * @description
   * Sets the new password and uses the link up. Never signs in.
   *
   * @param {string} token - Token from the link's fragment.
   * @param {string} newPassword - The new password.
   * @param {boolean} closeOtherSessions - Whether every open session of the account closes.
   * @returns {Promise<PasswordResetResult>} The confirmation address and the closed sessions.
   */
  public async confirmPasswordReset(
    token: string,
    newPassword: string,
    closeOtherSessions: boolean,
  ): Promise<PasswordResetResult> {
    const result: PasswordResetCompleted = await firstValueFrom(
      this.auth.confirmPasswordReset({ token, newPassword, closeOtherSessions }),
    );
    return { email: result.email, closedSessionCount: result.closedSessionCount };
  }

  /**
   * Method currentAccount
   *
   * @description
   * Reads the account of the session cookie; `401` rejects without a session.
   *
   * @returns {Promise<SignedInAccount>} The signed-in account.
   */
  public async currentAccount(): Promise<SignedInAccount> {
    const user: SignedIn['user'] = await firstValueFrom(
      this.auth.getCurrentUser({ cache: 'no-store' }),
    );
    return { name: user.name, email: user.email };
  }

  /**
   * Method signOut
   *
   * @description
   * Closes the session of this browser; signing out twice is not an error.
   *
   * @returns {Promise<void>} Resolves once the gateway cleared the cookie.
   */
  public async signOut(): Promise<void> {
    await locked((): Observable<HttpResponse<void>> =>
      this.auth.signOut({}, { observe: 'response' }),
    );
  }
  // #endregion
}
