import type { HttpResponse } from '@angular/common/http';
import type { SignedIn, SignInChallenge } from '@cadenway/api-client';

import type {
  SignedInAccount,
  SignInOutcome,
  TwoStepChallenge,
  TwoStepMethod,
} from '../../../models/session/session.interface';

/**
 * Constant TWO_STEP_METHODS
 *
 * @description
 * Methods the two-step screen supports, in tab order. A method the contract adds later is ignored.
 *
 * @type {readonly TwoStepMethod[]}
 */
const TWO_STEP_METHODS: readonly TwoStepMethod[] = [
  'authenticator-app',
  'security-key',
  'backup-code',
];

/**
 * Function signedInAccount
 *
 * @description
 * Keeps the name and the address of the account a session was opened for.
 *
 * @param {SignedIn} signedIn - The `200` body of a sign-in.
 * @returns {SignedInAccount} The account shown and remembered on this device.
 */
export function signedInAccount(signedIn: SignedIn): SignedInAccount {
  return { name: signedIn.user.name, email: signedIn.user.email };
}

/**
 * Function twoStepChallenge
 *
 * @description
 * Maps a challenge to what the two-step screen shows, without its token.
 *
 * @param {SignInChallenge} challenge - The `202` body of a sign-in, or an inspected challenge.
 * @returns {TwoStepChallenge} The display model.
 */
export function twoStepChallenge(challenge: SignInChallenge): TwoStepChallenge {
  return {
    email: challenge.email,
    name: challenge.name,
    methods: TWO_STEP_METHODS.filter((method: TwoStepMethod): boolean =>
      challenge.methods.includes(method),
    ),
    securityKeys: challenge.securityKeys.map((key: { name: string }): string => key.name),
    backupCodesRemaining: challenge.backupCodesRemaining,
  };
}

/**
 * Function signInOutcome
 *
 * @description
 * Reads a first-factor answer by its status, as the contract requires: only a `200` with a
 * session is signed in, and a `202` with a token is a two-step challenge.
 *
 * @param {HttpResponse<SignedIn | SignInChallenge>} response - The full gateway response.
 * @returns {SignInOutcome} The opened session or the challenge.
 * @throws {Error} When the answer is neither.
 */
export function signInOutcome(response: HttpResponse<SignedIn | SignInChallenge>): SignInOutcome {
  const body: SignedIn | SignInChallenge | null = response.body;
  if (response.status === 200 && body !== null && 'session' in body) {
    return { kind: 'signed-in', account: signedInAccount(body) };
  }
  if (response.status === 202 && body !== null && 'token' in body && body.token !== '') {
    return { kind: 'challenge', token: body.token, challenge: twoStepChallenge(body) };
  }
  throw new Error('The gateway returned an unsupported sign-in response.');
}

/**
 * Function openedSession
 *
 * @description
 * Accepts only a `200` with a session, the one answer that opens a session after a challenge or
 * an address verification.
 *
 * @param {HttpResponse<SignedIn>} response - The full gateway response.
 * @returns {SignedInAccount} The account of the opened session.
 * @throws {Error} When no session was opened.
 */
export function openedSession(response: HttpResponse<SignedIn>): SignedInAccount {
  if (response.status !== 200 || response.body === null || !('session' in response.body)) {
    throw new Error('The gateway did not open a session.');
  }
  return signedInAccount(response.body);
}
