import type { AuthProblem, SignInChallenge } from './auth.interface';

/**
 * Type SignInOutcome
 *
 * @description
 * An accepted first factor either opens a session or requires an authenticator code.
 *
 * @type {{ kind: 'signed-in' } | { kind: 'challenge'; challenge: SignInChallenge }}
 */
export type SignInOutcome =
  { kind: 'signed-in' } | { kind: 'challenge'; challenge: SignInChallenge };

/**
 * Type FederatedSignInRequest
 *
 * @description
 * The selected provider, persistence preference and address used to select a SAML connection.
 *
 * @type {{ provider: 'google' | 'github' | 'microsoft' | 'gitlab'; rememberMe: boolean } | { provider: 'saml'; email: string; rememberMe: boolean }}
 */
export type FederatedSignInRequest =
  | { provider: 'google' | 'github' | 'microsoft' | 'gitlab'; rememberMe: boolean }
  | { provider: 'saml'; email: string; rememberMe: boolean };

/**
 * Type AuthResult
 *
 * @description
 * A gateway outcome with either authenticated data or a displayable failure.
 *
 * @template T
 * @type {{ ok: true; value: T } | { ok: false; problem: AuthProblem }}
 */
export type AuthResult<T> = { ok: true; value: T } | { ok: false; problem: AuthProblem };
