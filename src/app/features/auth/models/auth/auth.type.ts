import type { AuthProblem, SignInChallenge } from './auth.interface';

/**
 * Type SignInOutcome
 *
 * @description
 * A successful password check either opens a session or requires an authenticator code.
 *
 * @type {{ kind: 'signed-in' } | { kind: 'challenge'; challenge: SignInChallenge }}
 */
export type SignInOutcome =
  { kind: 'signed-in' } | { kind: 'challenge'; challenge: SignInChallenge };

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
