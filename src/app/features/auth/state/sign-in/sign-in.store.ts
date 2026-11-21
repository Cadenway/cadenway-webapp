import { computed, inject, type Signal, type Type } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';

import { AuthEntryService } from '../../data-access/services/entry/auth-entry.service';
import type {
  AuthProblem,
  SignInChallenge,
  SignInCredentials,
} from '../../models/auth/auth.interface';
import type {
  AuthResult,
  FederatedSignInRequest,
  SignInOutcome,
} from '../../models/auth/auth.type';

/**
 * Interface SignInStoreInstance
 *
 * @description
 * The page's view of sign-in state. The challenge secret remains inside the store.
 */
interface SignInStoreInstance {
  // #region Properties
  /**
   * Property challengeEmail
   *
   * @description
   * Account address when the second step is still required.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  readonly challengeEmail: Signal<string | null>;

  /**
   * Property problem
   *
   * @description
   * Latest failure available for the current form to display.
   *
   * @type {Signal<AuthProblem | null>}
   * @readonly
   */
  readonly problem: Signal<AuthProblem | null>;

  /**
   * Property federatedStarting
   *
   * @description
   * Indicates that the gateway is preparing a provider redirect.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly federatedStarting: Signal<boolean>;
  // #endregion

  // #region Methods
  /**
   * Method signIn
   *
   * @description
   * Checks the password and stores any second-step challenge privately.
   *
   * @param {SignInCredentials} credentials - The password form.
   * @returns {Promise<boolean>} Whether the gateway opened the session.
   */
  signIn(credentials: SignInCredentials): Promise<boolean>;

  /**
   * Method startFederated
   *
   * @description
   * Prepares one browser-bound provider redirect.
   *
   * @param {FederatedSignInRequest} request - The selected provider and form values.
   * @returns {Promise<string | null>} The provider destination or a refusal.
   */
  startFederated(request: FederatedSignInRequest): Promise<string | null>;

  /**
   * Method finishFederated
   *
   * @description
   * Checks the continuation cookie and stores any second-step challenge privately.
   *
   * @returns {Promise<boolean>} Whether the gateway opened the session.
   */
  finishFederated(): Promise<boolean>;

  /**
   * Method answer
   *
   * @description
   * Submits an authenticator code if there is a challenge to answer.
   *
   * @param {string} code - The six digits from the authenticator.
   * @returns {Promise<boolean>} Whether the gateway accepted the answer and opened the session.
   */
  answer(code: string): Promise<boolean>;

  /**
   * Method cancelChallenge
   *
   * @description
   * Clears the second step before the person returns to password sign-in.
   */
  cancelChallenge(): void;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * The challenge is private to this page store and is erased on completion or cancellation.
 *
 * @type {{ _challenge: SignInChallenge | null; problem: AuthProblem | null; federatedStarting: boolean }}
 */
const initialState: {
  _challenge: SignInChallenge | null;
  problem: AuthProblem | null;
  federatedStarting: boolean;
} = {
  _challenge: null,
  problem: null,
  federatedStarting: false,
};

/**
 * Constant SignInStore
 *
 * @description
 * Coordinates password and federated sign-in and their authenticator challenges.
 *
 * @type {Type<SignInStoreInstance>}
 */
export const SignInStore: Type<SignInStoreInstance> = signalStore(
  withState(initialState),
  withComputed(({ _challenge }: { _challenge: Signal<SignInChallenge | null> }) => ({
    challengeEmail: computed(() => _challenge()?.email ?? null),
  })),
  withMethods((store, api = inject(AuthEntryService)) => {
    const acceptFirstFactor: (result: AuthResult<SignInOutcome>) => boolean = (result) => {
      if (!result.ok) {
        patchState(store, { problem: result.problem });
        return false;
      }

      if (result.value.kind === 'challenge') {
        patchState(store, { _challenge: result.value.challenge });
        return false;
      }

      return true;
    };

    return {
      /** Checks the password and exposes any required second step. */
      async signIn(credentials: SignInCredentials): Promise<boolean> {
        patchState(store, { problem: null });
        return acceptFirstFactor(await firstValueFrom(api.signIn(credentials)));
      },

      /** Opens one pending browser flow and returns its provider destination. */
      async startFederated(request: FederatedSignInRequest): Promise<string | null> {
        if (store.federatedStarting()) return null;
        patchState(store, { problem: null, federatedStarting: true });
        const result: AuthResult<string> = await firstValueFrom(api.startFederated(request));
        if (result.ok) {
          patchState(store, { federatedStarting: false });
          return result.value;
        }
        patchState(store, { problem: result.problem, federatedStarting: false });
        return null;
      },

      /** Redeems the continuation cookie from the browser redirect page. */
      async finishFederated(): Promise<boolean> {
        return acceptFirstFactor(await firstValueFrom(api.finishFederated()));
      },

      /** Answers the outstanding challenge using the six digits from the authenticator. */
      async answer(code: string): Promise<boolean> {
        const challenge: SignInChallenge | null = store._challenge();
        if (!challenge) {
          return false;
        }

        patchState(store, { problem: null });
        const result: AuthResult<void> = await firstValueFrom(
          api.answerWithCode(challenge.token, code),
        );
        if (!result.ok) {
          patchState(store, {
            problem: result.problem,
            ...(result.problem.code === 'auth.challenge-expired' ? { _challenge: null } : {}),
          });
          return false;
        }

        patchState(store, { _challenge: null });
        return true;
      },

      /** Clears the challenge when the caller returns to password entry. */
      cancelChallenge(): void {
        patchState(store, { _challenge: null, problem: null });
      },
    };
  }),
);
