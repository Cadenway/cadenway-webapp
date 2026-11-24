import { inject, Injector, type Signal, type Type } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';

import type { ErrorRecovery } from '../../data-access/services/error-recovery/error-recovery.service';
import type {
  AccessRequestStatus,
  RestoreOutcome,
  RestoreStatus,
} from '../../models/error-recovery/error-recovery.type';

/**
 * Interface ErrorRecoveryState
 *
 * @description
 * Progress of the writes offered by one route error state.
 */
interface ErrorRecoveryState {
  // #region Properties
  /**
   * Property accessRequest
   *
   * @description
   * Progress of the access request.
   *
   * @type {AccessRequestStatus}
   * @readonly
   */
  readonly accessRequest: AccessRequestStatus;

  /**
   * Property restore
   *
   * @description
   * Progress of the task restore.
   *
   * @type {RestoreStatus}
   * @readonly
   */
  readonly restore: RestoreStatus;
  // #endregion
}

/**
 * Interface ErrorRecoveryStoreInstance
 *
 * @description
 * Progress signals and writes of the route error page.
 */
interface ErrorRecoveryStoreInstance {
  // #region Properties
  /**
   * Property accessRequest
   *
   * @description
   * Progress of the access request.
   *
   * @type {Signal<AccessRequestStatus>}
   * @readonly
   */
  readonly accessRequest: Signal<AccessRequestStatus>;

  /**
   * Property restore
   *
   * @description
   * Progress of the task restore.
   *
   * @type {Signal<RestoreStatus>}
   * @readonly
   */
  readonly restore: Signal<RestoreStatus>;
  // #endregion

  // #region Methods
  /**
   * Method requestAccess
   *
   * @description
   * Sends the access request once: further calls while sending or after it was sent do nothing. A
   * failure returns to `idle` so the person can send again.
   *
   * @param {{ readonly kind: 'space' | 'list'; readonly id: string }} target - Space or list to ask for.
   * @param {string} message - Optional message to the owner.
   * @returns {Promise<void>} Resolves once the request settled.
   */
  requestAccess(
    target: { readonly kind: 'space' | 'list'; readonly id: string },
    message: string,
  ): Promise<void>;

  /**
   * Method restoreTask
   *
   * @description
   * Restores the deleted task once: further calls while restoring or after an outcome do nothing.
   * A failure returns to `idle` so the person can try again.
   *
   * @param {string} entryId - Trash entry of the task.
   * @returns {Promise<boolean>} Whether this call restored the task.
   */
  restoreTask(entryId: string): Promise<boolean>;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * Nothing sent yet.
 *
 * @type {ErrorRecoveryState}
 */
const initialState: ErrorRecoveryState = { accessRequest: 'idle', restore: 'idle' };

/**
 * Function createErrorRecoveryStore
 *
 * @description
 * Creates the page-scoped store of the route error page.
 *
 * @returns {Type<ErrorRecoveryStoreInstance>} Injectable store constructor.
 */
function createErrorRecoveryStore(): Type<ErrorRecoveryStoreInstance> {
  return signalStore(
    withState(initialState),
    withMethods((store, injector: Injector = inject(Injector)) => {
      /**
       * Function loadRecovery
       *
       * @description
       * Loads the recovery service on the first action, so the generated client stays out of the
       * initial bundle: the error page is the router's default error component and loads eagerly.
       *
       * @returns {Promise<ErrorRecovery>} The root recovery service.
       */
      async function loadRecovery(): Promise<ErrorRecovery> {
        const loaded: typeof import('../../data-access/services/error-recovery/error-recovery.service') =
          await import('../../data-access/services/error-recovery/error-recovery.service');
        return injector.get(loaded.ErrorRecovery);
      }
      return {
        async requestAccess(
          target: { readonly kind: 'space' | 'list'; readonly id: string },
          message: string,
        ): Promise<void> {
          if (store.accessRequest() !== 'idle') return;
          patchState(store, { accessRequest: 'sending' });
          try {
            const recovery: ErrorRecovery = await loadRecovery();
            await firstValueFrom(recovery.requestAccess(target, message));
            patchState(store, { accessRequest: 'sent' });
          } catch {
            patchState(store, { accessRequest: 'idle' });
          }
        },
        async restoreTask(entryId: string): Promise<boolean> {
          if (store.restore() !== 'idle') return false;
          patchState(store, { restore: 'restoring' });
          try {
            const recovery: ErrorRecovery = await loadRecovery();
            const outcome: RestoreOutcome = await firstValueFrom(recovery.restoreTask(entryId));
            patchState(store, { restore: outcome });
            return outcome === 'restored';
          } catch {
            patchState(store, { restore: 'idle' });
            return false;
          }
        },
      };
    }),
  );
}

/**
 * Constant ErrorRecoveryStore
 *
 * @description
 * Progress of the access request and the task restore of one route error page, provided by the
 * page so it starts over with each failure the boundary renders.
 *
 * @type {ReturnType<typeof createErrorRecoveryStore>}
 */
export const ErrorRecoveryStore: ReturnType<typeof createErrorRecoveryStore> =
  createErrorRecoveryStore();
