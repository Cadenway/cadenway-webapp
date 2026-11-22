import { inject, type Signal, type Type } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';

import { AuthEntryService } from '../../data-access/services/entry/auth-entry.service';
import type { AuthProblem } from '../../models/auth/auth.interface';
import type { AuthResult } from '../../models/auth/auth.type';

/**
 * Interface OrganizationActionsStoreInstance
 *
 * @description
 * Session actions and their status for the organization entry screens.
 */
interface OrganizationActionsStoreInstance {
  // #region Properties
  /**
   * Property pending
   *
   * @description
   * A session write is currently in progress.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly pending: Signal<boolean>;

  /**
   * Property problem
   *
   * @description
   * The latest refusal returned by the gateway.
   *
   * @type {Signal<AuthProblem | null>}
   * @readonly
   */
  readonly problem: Signal<AuthProblem | null>;
  // #endregion

  // #region Methods
  /**
   * Method choose
   *
   * @description
   * Switches the organization for the current session.
   *
   * @param {string} organizationId - The choice from the server-provided organization list.
   * @returns {Promise<boolean>} Whether to move the caller after completion or expiration.
   */
  choose(organizationId: string): Promise<boolean>;

  /**
   * Method signOut
   *
   * @description
   * Closes the cookie session at the gateway.
   *
   * @returns {Promise<boolean>} Whether the session has ended.
   */
  signOut(): Promise<boolean>;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * No pending action before the visitor chooses an organization or signs out.
 *
 * @type {{ pending: boolean; problem: AuthProblem | null }}
 */
const initialState: { pending: boolean; problem: AuthProblem | null } = {
  pending: false,
  problem: null,
};

/**
 * Constant OrganizationActionsStore
 *
 * @description
 * Prevents simultaneous session writes while the caller is choosing an organization or signing out.
 *
 * @type {Type<OrganizationActionsStoreInstance>}
 */
export const OrganizationActionsStore: Type<OrganizationActionsStoreInstance> = signalStore(
  withState(initialState),
  withMethods((store, api = inject(AuthEntryService)) => {
    const settle: (result: AuthResult<void>) => boolean = (result): boolean => {
      patchState(store, { pending: false, problem: result.ok ? null : result.problem });
      return result.ok || result.problem.status === 401;
    };

    return {
      /** Requests an organization change for the current cookie session. */
      async choose(organizationId: string): Promise<boolean> {
        if (store.pending()) return false;
        patchState(store, { pending: true, problem: null });
        return settle(await firstValueFrom(api.choose(organizationId)));
      },

      /** Names the session ended when the gateway confirms closure or expiration. */
      async signOut(): Promise<boolean> {
        if (store.pending()) return false;
        patchState(store, { pending: true, problem: null });
        return settle(await firstValueFrom(api.signOut()));
      },
    };
  }),
);
