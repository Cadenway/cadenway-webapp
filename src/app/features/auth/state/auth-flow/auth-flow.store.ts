import { inject, type Signal, type Type } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';

import { authProblem } from '../../utils/auth-problem/auth-problem.util';
import { AuthApi } from '../../data-access/services/auth-api/auth-api.service';
import { OrganizationApi } from '../../data-access/services/organization-api/organization-api.service';
import type { AuthProblem } from '../../models/auth-problem/auth-problem.interface';
import type {
  FederatedProvider,
  PasswordResetLink,
  PasswordResetResult,
  SignedInAccount,
  SignInOutcome,
  TwoStepChallenge,
} from '../../models/session/session.interface';
import { AuthStorageService } from '../../services/auth-storage/auth-storage.service';
import { RememberedAccountsService } from '../../services/remembered-accounts/remembered-accounts.service';
import { safeReturnUrl } from '../../utils/return-url/return-url.util';

/**
 * Type SessionResult
 *
 * @description
 * Outcome of a step that may open a session: the path to open, a two-step challenge to answer
 * (`/login/two-step`), or a refusal the screen shows.
 *
 * @type {{ readonly kind: 'signed-in'; readonly destination: string } | { readonly kind: 'challenge' } | { readonly kind: 'failed'; readonly problem: AuthProblem }}
 */
export type SessionResult =
  | { readonly kind: 'signed-in'; readonly destination: string }
  | { readonly kind: 'challenge' }
  | { readonly kind: 'failed'; readonly problem: AuthProblem };

/**
 * Type StepResult
 *
 * @description
 * Outcome of a step that opens no session, with its value.
 *
 * @template T
 * @type {{ readonly ok: true; readonly value: T } | { readonly ok: false; readonly problem: AuthProblem }}
 */
export type StepResult<T = void> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly problem: AuthProblem };

/**
 * Type SsoResult
 *
 * @description
 * Outcome of the work-address check: the provider destination, no SSO for the domain, or a refusal.
 *
 * @type {{ readonly kind: 'redirect'; readonly url: string } | { readonly kind: 'no-sso' } | { readonly kind: 'failed'; readonly problem: AuthProblem }}
 */
export type SsoResult =
  | { readonly kind: 'redirect'; readonly url: string }
  | { readonly kind: 'no-sso' }
  | { readonly kind: 'failed'; readonly problem: AuthProblem };

/**
 * Type ChallengeAnswer
 *
 * @description
 * How the person answers the two-step challenge.
 *
 * @type {{ readonly method: 'authenticator-app' | 'backup-code'; readonly code: string } | { readonly method: 'security-key' }}
 */
export type ChallengeAnswer =
  | { readonly method: 'authenticator-app' | 'backup-code'; readonly code: string }
  | { readonly method: 'security-key' };

/**
 * Interface AuthFlowState
 *
 * @description
 * What the auth screens share while the person moves between them.
 */
interface AuthFlowState {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * Address typed last, reused by the code, SSO and password screens.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property prefilled
   *
   * @description
   * Whether the address comes from a remembered account chosen on the signed-out screen.
   *
   * @type {boolean}
   * @readonly
   */
  readonly prefilled: boolean;

  /**
   * Property rememberMe
   *
   * @description
   * "Rester connecté pendant 30 jours", ticked by default as in `Main.dc.html`.
   *
   * @type {boolean}
   * @readonly
   */
  readonly rememberMe: boolean;

  /**
   * Property account
   *
   * @description
   * Account of the confirmed session, set by the session guard.
   *
   * @type {SignedInAccount | null}
   * @readonly
   */
  readonly account: SignedInAccount | null;

  /**
   * Property challenge
   *
   * @description
   * Pending two-step challenge, without its token.
   *
   * @type {TwoStepChallenge | null}
   * @readonly
   */
  readonly challenge: TwoStepChallenge | null;

  /**
   * Property federatedStarting
   *
   * @description
   * Whether a provider redirect is being prepared.
   *
   * @type {boolean}
   * @readonly
   */
  readonly federatedStarting: boolean;

  /**
   * Property _challengeToken
   *
   * @description
   * Token of the pending challenge, sent only in answer bodies.
   *
   * @type {string | null}
   * @readonly
   */
  readonly _challengeToken: string | null;

  /**
   * Property _signUp
   *
   * @description
   * Address and password of the pending sign-up, in memory only: the verification sends the
   * password again so a code never verifies a sign-up someone else replaced.
   *
   * @type {{ readonly email: string; readonly password: string } | null}
   * @readonly
   */
  readonly _signUp: { readonly email: string; readonly password: string } | null;
  // #endregion
}

/**
 * Interface AuthFlowStoreInstance
 *
 * @description
 * Public API of the flow store the auth pages read and call.
 */
interface AuthFlowStoreInstance {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * Address typed last.
   *
   * @type {Signal<string>}
   * @readonly
   */
  readonly email: Signal<string>;

  /**
   * Property prefilled
   *
   * @description
   * Whether the address comes from a remembered account.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly prefilled: Signal<boolean>;

  /**
   * Property rememberMe
   *
   * @description
   * Session duration preference.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly rememberMe: Signal<boolean>;

  /**
   * Property account
   *
   * @description
   * Account of the confirmed session.
   *
   * @type {Signal<SignedInAccount | null>}
   * @readonly
   */
  readonly account: Signal<SignedInAccount | null>;

  /**
   * Property challenge
   *
   * @description
   * Pending two-step challenge.
   *
   * @type {Signal<TwoStepChallenge | null>}
   * @readonly
   */
  readonly challenge: Signal<TwoStepChallenge | null>;

  /**
   * Property federatedStarting
   *
   * @description
   * Whether a provider redirect is being prepared.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly federatedStarting: Signal<boolean>;

  /**
   * Property signUpEmail
   *
   * @description
   * Address of the pending sign-up, or null.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  readonly signUpEmail: Signal<string | null>;
  // #endregion

  // #region Methods
  /**
   * Method setEmail
   *
   * @description
   * Records the address typed on a screen; a typed address is no longer a prefilled one.
   *
   * @param {string} email - The address.
   */
  setEmail(email: string): void;

  /**
   * Method prefill
   *
   * @description
   * Prefills the sign-in address with a remembered account.
   *
   * @param {string} email - The remembered address.
   */
  prefill(email: string): void;

  /**
   * Method setRememberMe
   *
   * @description
   * Records the session duration preference.
   *
   * @param {boolean} rememberMe - Whether the session lasts 30 days.
   */
  setRememberMe(rememberMe: boolean): void;

  /**
   * Method setAccount
   *
   * @description
   * Records the account of the session the guard confirmed.
   *
   * @param {SignedInAccount} account - The account.
   */
  setAccount(account: SignedInAccount): void;

  /**
   * Method setReturnUrl
   *
   * @description
   * Records a `?next=` path to open after sign-in, kept for the tab; an unsafe value is dropped.
   *
   * @param {unknown} next - The query parameter value.
   */
  setReturnUrl(next: unknown): void;

  /**
   * Method signInWithPassword
   *
   * @description
   * Checks the address and the password.
   *
   * @param {string} email - Account address.
   * @param {string} password - Password, never kept.
   * @returns {Promise<SessionResult>} The destination, a challenge or the refusal.
   */
  signInWithPassword(email: string, password: string): Promise<SessionResult>;

  /**
   * Method startFederatedSignIn
   *
   * @description
   * Prepares one provider redirect at a time.
   *
   * @param {FederatedProvider} provider - Social provider.
   * @returns {Promise<StepResult<string> | null>} The destination, a refusal, or null while
   * another redirect is being prepared.
   */
  startFederatedSignIn(provider: FederatedProvider): Promise<StepResult<string> | null>;

  /**
   * Method startSso
   *
   * @description
   * Checks that the work address has a SAML connection (`discoverSignInMethods`), then prepares
   * its redirect.
   *
   * @param {string} email - Work address.
   * @returns {Promise<SsoResult>} The destination, no SSO for the domain, or a refusal.
   */
  startSso(email: string): Promise<SsoResult>;

  /**
   * Method finishFederatedSignIn
   *
   * @description
   * Redeems the continuation cookie once per store: a second call returns the first call's result
   * without sending another request.
   *
   * @returns {Promise<SessionResult>} The destination, a challenge or the refusal.
   */
  finishFederatedSignIn(): Promise<SessionResult>;

  /**
   * Method requestSignInCode
   *
   * @description
   * Sends a sign-in code to the address and records it.
   *
   * @param {string} email - Account address.
   * @returns {Promise<StepResult>} Whether the request was accepted.
   */
  requestSignInCode(email: string): Promise<StepResult>;

  /**
   * Method signInWithCode
   *
   * @description
   * Checks a sign-in code for the recorded address.
   *
   * @param {string} code - The 6 digits.
   * @returns {Promise<SessionResult>} The destination, a challenge or the refusal.
   */
  signInWithCode(code: string): Promise<SessionResult>;

  /**
   * Method loadChallenge
   *
   * @description
   * Makes the pending challenge available, reading it again from the tab's token after a reload.
   *
   * @returns {Promise<boolean>} Whether a usable challenge is pending.
   */
  loadChallenge(): Promise<boolean>;

  /**
   * Method answerChallenge
   *
   * @description
   * Answers the pending challenge. An expired challenge is dropped.
   *
   * @param {ChallengeAnswer} answer - The method and its code.
   * @param {boolean} trustDevice - Whether to trust this device for 30 days.
   * @returns {Promise<SessionResult>} The destination or the refusal.
   */
  answerChallenge(answer: ChallengeAnswer, trustDevice: boolean): Promise<SessionResult>;

  /**
   * Method cancelChallenge
   *
   * @description
   * Drops the pending challenge before the person signs in again.
   */
  cancelChallenge(): void;

  /**
   * Method signUp
   *
   * @description
   * Creates the account and keeps the address and password for the verification.
   *
   * @param {{ readonly name: string; readonly email: string; readonly password: string }} account -
   * The sign-up form values.
   * @returns {Promise<StepResult>} Whether the code was sent.
   */
  signUp(account: {
    readonly name: string;
    readonly email: string;
    readonly password: string;
  }): Promise<StepResult>;

  /**
   * Method verifySignUp
   *
   * @description
   * Verifies the pending sign-up with its code and opens the first session.
   *
   * @param {string} code - The 6 digits.
   * @returns {Promise<SessionResult>} The destination or the refusal.
   */
  verifySignUp(code: string): Promise<SessionResult>;

  /**
   * Method resendSignUpCode
   *
   * @description
   * Sends a new code for the pending sign-up.
   *
   * @returns {Promise<StepResult>} Whether the request was accepted.
   */
  resendSignUpCode(): Promise<StepResult>;

  /**
   * Method requestPasswordReset
   *
   * @description
   * Sends a reset link to the address and records it.
   *
   * @param {string} email - Account address.
   * @returns {Promise<StepResult>} Whether the request was accepted.
   */
  requestPasswordReset(email: string): Promise<StepResult>;

  /**
   * Method inspectPasswordReset
   *
   * @description
   * Reads the account of a reset link.
   *
   * @param {string} token - Token from the link's fragment.
   * @returns {Promise<StepResult<PasswordResetLink>>} The account or the refusal.
   */
  inspectPasswordReset(token: string): Promise<StepResult<PasswordResetLink>>;

  /**
   * Method confirmPasswordReset
   *
   * @description
   * Sets the new password of the link's account.
   *
   * @param {string} token - Token from the link's fragment.
   * @param {string} password - New password.
   * @param {boolean} closeOtherSessions - Whether the account's sessions close.
   * @returns {Promise<StepResult<PasswordResetResult>>} The outcome or the refusal.
   */
  confirmPasswordReset(
    token: string,
    password: string,
    closeOtherSessions: boolean,
  ): Promise<StepResult<PasswordResetResult>>;

  /**
   * Method signOut
   *
   * @description
   * Closes the session of this browser and forgets the flow.
   *
   * @returns {Promise<StepResult>} Whether the gateway closed the session.
   */
  signOut(): Promise<StepResult>;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * A flow with no address, the 30-day session ticked and nothing pending.
 *
 * @type {AuthFlowState}
 */
const initialState: AuthFlowState = {
  email: '',
  prefilled: false,
  rememberMe: true,
  account: null,
  challenge: null,
  federatedStarting: false,
  _challengeToken: null,
  _signUp: null,
};

/**
 * Function createAuthFlowStore
 *
 * @description
 * Creates the flow store provided by the auth root route, so its screens share the address, the
 * pending challenge and the pending sign-up while the person moves between them. A session that
 * opens remembers its account on this device, clears the tab's challenge token, and resolves the
 * destination: the `?next=` path, else `/<slug>` of the session's organization, else
 * `/organizations` when the person must still choose.
 *
 * @returns {Type<AuthFlowStoreInstance>} The store provider.
 */
function createAuthFlowStore(): Type<AuthFlowStoreInstance> {
  return signalStore(
    withState(initialState),
    withComputed((store) => ({
      signUpEmail: (): string | null => store._signUp()?.email ?? null,
    })),
    withMethods(
      (
        store,
        api: AuthApi = inject(AuthApi),
        organizations: OrganizationApi = inject(OrganizationApi),
        storage: AuthStorageService = inject(AuthStorageService),
        accounts: RememberedAccountsService = inject(RememberedAccountsService),
      ) => {
        let finishing: Promise<SessionResult> | null = null;

        const destination: () => Promise<string> = async (): Promise<string> => {
          const next: string | null = safeReturnUrl(storage.returnUrl());
          storage.keepReturnUrl(null);
          if (next !== null) return next;
          try {
            return `/${(await organizations.current()).slug}`;
          } catch {
            return '/organizations';
          }
        };

        const opened: (account: SignedInAccount) => Promise<SessionResult> = async (
          account: SignedInAccount,
        ): Promise<SessionResult> => {
          accounts.remember(account);
          storage.keepChallengeToken(null);
          patchState(store, { account, challenge: null, _challengeToken: null, _signUp: null });
          return { kind: 'signed-in', destination: await destination() };
        };

        const settle: (outcome: () => Promise<SignInOutcome>) => Promise<SessionResult> = async (
          outcome: () => Promise<SignInOutcome>,
        ): Promise<SessionResult> => {
          let result: SignInOutcome;
          try {
            result = await outcome();
          } catch (error: unknown) {
            return { kind: 'failed', problem: authProblem(error) };
          }
          if (result.kind === 'signed-in') return opened(result.account);
          storage.keepChallengeToken(result.token);
          patchState(store, {
            email: result.challenge.email,
            challenge: result.challenge,
            _challengeToken: result.token,
          });
          return { kind: 'challenge' };
        };

        const step: <T>(operation: () => Promise<T>) => Promise<StepResult<T>> = async <T>(
          operation: () => Promise<T>,
        ): Promise<StepResult<T>> => {
          try {
            return { ok: true, value: await operation() };
          } catch (error: unknown) {
            return { ok: false, problem: authProblem(error) };
          }
        };

        const startFederated: (
          provider: FederatedProvider | { readonly email: string },
        ) => Promise<StepResult<string> | null> = async (
          provider: FederatedProvider | { readonly email: string },
        ): Promise<StepResult<string> | null> => {
          if (store.federatedStarting()) return null;
          patchState(store, { federatedStarting: true });
          const result: StepResult<string> = await step(() =>
            api.startFederatedSignIn(provider, store.rememberMe()),
          );
          patchState(store, { federatedStarting: false });
          return result;
        };

        return {
          setEmail(email: string): void {
            patchState(store, { email, prefilled: false });
          },
          prefill(email: string): void {
            patchState(store, { email, prefilled: true });
          },
          setRememberMe(rememberMe: boolean): void {
            patchState(store, { rememberMe });
          },
          setAccount(account: SignedInAccount): void {
            patchState(store, { account });
          },
          setReturnUrl(next: unknown): void {
            storage.keepReturnUrl(safeReturnUrl(next));
          },
          signInWithPassword(email: string, password: string): Promise<SessionResult> {
            patchState(store, { email });
            return settle(() => api.signInWithPassword(email, password, store.rememberMe()));
          },
          startFederatedSignIn(provider: FederatedProvider): Promise<StepResult<string> | null> {
            return startFederated(provider);
          },
          async startSso(email: string): Promise<SsoResult> {
            const methods: StepResult<readonly string[]> = await step(() =>
              api.discoverSignInMethods(email),
            );
            if (!methods.ok) return { kind: 'failed', problem: methods.problem };
            if (!methods.value.includes('saml')) return { kind: 'no-sso' };
            const started: StepResult<string> | null = await startFederated({ email });
            if (started === null) return { kind: 'failed', problem: authProblem(null) };
            return started.ok
              ? { kind: 'redirect', url: started.value }
              : { kind: 'failed', problem: started.problem };
          },
          finishFederatedSignIn(): Promise<SessionResult> {
            finishing ??= settle(() => api.finishFederatedSignIn());
            return finishing;
          },
          requestSignInCode(email: string): Promise<StepResult> {
            patchState(store, { email, prefilled: false });
            return step(() => api.requestSignInCode(email));
          },
          signInWithCode(code: string): Promise<SessionResult> {
            return settle(() => api.signInWithCode(store.email(), code, store.rememberMe()));
          },
          async loadChallenge(): Promise<boolean> {
            if (store.challenge() !== null && store._challengeToken() !== null) return true;
            const token: string | null = storage.challengeToken();
            if (token === null) return false;
            const challenge: StepResult<TwoStepChallenge> = await step(() =>
              api.inspectChallenge(token),
            );
            if (!challenge.ok) {
              storage.keepChallengeToken(null);
              return false;
            }
            patchState(store, {
              email: challenge.value.email,
              challenge: challenge.value,
              _challengeToken: token,
            });
            return true;
          },
          async answerChallenge(
            answer: ChallengeAnswer,
            trustDevice: boolean,
          ): Promise<SessionResult> {
            const token: string | null = store._challengeToken();
            if (token === null) {
              return {
                kind: 'failed',
                problem: { status: 422, code: 'auth.challenge-expired', remainingAttempts: null },
              };
            }
            const account: StepResult<SignedInAccount> = await step(() => {
              switch (answer.method) {
                case 'authenticator-app':
                  return api.answerWithAuthenticatorApp(token, answer.code, trustDevice);
                case 'backup-code':
                  return api.answerWithBackupCode(token, answer.code, trustDevice);
                case 'security-key':
                  return api.answerWithSecurityKey(token, trustDevice);
              }
            });
            if (account.ok) return opened(account.value);
            if (account.problem.code === 'auth.challenge-expired') {
              storage.keepChallengeToken(null);
              patchState(store, { challenge: null, _challengeToken: null });
            }
            return { kind: 'failed', problem: account.problem };
          },
          cancelChallenge(): void {
            storage.keepChallengeToken(null);
            patchState(store, { challenge: null, _challengeToken: null });
          },
          async signUp(account: {
            readonly name: string;
            readonly email: string;
            readonly password: string;
          }): Promise<StepResult> {
            const result: StepResult = await step(() => api.signUp(account));
            if (result.ok) {
              patchState(store, {
                email: account.email,
                _signUp: { email: account.email, password: account.password },
              });
            }
            return result;
          },
          async verifySignUp(code: string): Promise<SessionResult> {
            const pending: AuthFlowState['_signUp'] = store._signUp();
            if (pending === null) {
              return {
                kind: 'failed',
                problem: { status: 422, code: 'auth.sign-up-replaced', remainingAttempts: null },
              };
            }
            const account: StepResult<SignedInAccount> = await step(() =>
              api.verifySignUp(pending.email, code, pending.password),
            );
            return account.ok
              ? opened(account.value)
              : { kind: 'failed', problem: account.problem };
          },
          resendSignUpCode(): Promise<StepResult> {
            const email: string | null = store._signUp()?.email ?? null;
            return email === null
              ? Promise.resolve({ ok: false, problem: authProblem(null) })
              : step(() => api.resendSignUpCode(email));
          },
          requestPasswordReset(email: string): Promise<StepResult> {
            patchState(store, { email, prefilled: false });
            return step(() => api.requestPasswordReset(email));
          },
          inspectPasswordReset(token: string): Promise<StepResult<PasswordResetLink>> {
            return step(() => api.inspectPasswordReset(token));
          },
          confirmPasswordReset(
            token: string,
            password: string,
            closeOtherSessions: boolean,
          ): Promise<StepResult<PasswordResetResult>> {
            return step(() => api.confirmPasswordReset(token, password, closeOtherSessions));
          },
          async signOut(): Promise<StepResult> {
            const result: StepResult = await step(() => api.signOut());
            if (result.ok) {
              finishing = null;
              storage.keepChallengeToken(null);
              storage.keepReturnUrl(null);
              patchState(store, {
                account: null,
                challenge: null,
                _challengeToken: null,
                _signUp: null,
              });
            }
            return result;
          },
        };
      },
    ),
  );
}

/**
 * Constant AuthFlowStore
 *
 * @description
 * Flow state shared by the auth screens, provided by the auth root route (never root-provided):
 * it lives while the person stays on auth screens and is gone once they enter a workspace.
 *
 * @type {Type<AuthFlowStoreInstance>}
 */
export const AuthFlowStore: Type<AuthFlowStoreInstance> = createAuthFlowStore();

/**
 * Type AuthFlowStore
 *
 * @description
 * Instance type of the flow store.
 *
 * @type {AuthFlowStoreInstance}
 */
export type AuthFlowStore = AuthFlowStoreInstance;
