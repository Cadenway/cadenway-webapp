import {
  DestroyRef,
  inject,
  resource,
  type ResourceRef,
  type Signal,
  type Type,
} from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';

import { hasProblemCode, OrganizationSwitchPendingError } from '@core/api';
import {
  ReauthenticationCancelledError,
  ReauthenticationService,
} from '@features/account/reauthentication';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { AuthenticationPolicyApi } from '../../data-access/services/authentication-policy-api/authentication-policy-api.service';
import type {
  AuthenticationPolicy,
  AuthenticationPolicyChange,
  AuthenticationPolicySaveOutcome,
} from '../../models/authentication-policy/authentication-policy.interface';

/**
 * Interface AuthenticationPolicyState
 *
 * @description
 * What the store holds besides the read.
 */
interface AuthenticationPolicyState {
  // #region Properties
  /**
   * Property saving
   *
   * @description
   * Whether a save is waiting for the gateway (or for the reauthentication dialog).
   *
   * @type {boolean}
   * @readonly
   */
  readonly saving: boolean;
  // #endregion
}

/**
 * Interface AuthenticationPolicyStoreInstance
 *
 * @description
 * The authentication policy of the current organization, read once by the security section and
 * changed by its `Save`.
 */
interface AuthenticationPolicyStoreInstance {
  // #region Properties
  /**
   * Property policy
   *
   * @description
   * The read of the policy, the page's primary read: a rejection reaches the route's error
   * boundary. A save writes the answered policy into it.
   *
   * @type {ResourceRef<AuthenticationPolicy | undefined>}
   * @readonly
   */
  readonly policy: ResourceRef<AuthenticationPolicy | undefined>;

  /**
   * Property current
   *
   * @description
   * The saved policy, or null while it is read or when the read failed.
   *
   * @type {Signal<AuthenticationPolicy | null>}
   * @readonly
   */
  readonly current: Signal<AuthenticationPolicy | null>;

  /**
   * Property saving
   *
   * @description
   * Whether a save is under way.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly saving: Signal<boolean>;
  // #endregion

  // #region Methods
  /**
   * Method save
   *
   * @description
   * Sends a change from the current version through `ReauthenticationService.run`, so a
   * `403 auth.reauthentication-required` asks the person to confirm their identity and sends it
   * once more.
   *
   * @param {AuthenticationPolicyChange} change - What changes.
   * @returns {Promise<AuthenticationPolicySaveOutcome>} How the save ended.
   */
  save(change: AuthenticationPolicyChange): Promise<AuthenticationPolicySaveOutcome>;
  // #endregion
}

/**
 * Function createAuthenticationPolicyStore
 *
 * @description
 * Creates the authentication policy store.
 *
 * @returns {Type<AuthenticationPolicyStoreInstance>} Injectable store constructor.
 */
function createAuthenticationPolicyStore(): Type<AuthenticationPolicyStoreInstance> {
  return signalStore(
    withState<AuthenticationPolicyState>({ saving: false }),
    withProps(() => {
      const api: AuthenticationPolicyApi = inject(AuthenticationPolicyApi);
      const workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);
      return {
        policy: resource({
          params: (): string => workspace.organization().id,
          loader: (): Promise<AuthenticationPolicy> => api.policy(),
        }),
      };
    }),
    withComputed((store) => ({
      current: (): AuthenticationPolicy | null =>
        store.policy.hasValue() ? store.policy.value() : null,
    })),
    withMethods(
      (
        store,
        api: AuthenticationPolicyApi = inject(AuthenticationPolicyApi),
        reauthentication: ReauthenticationService = inject(ReauthenticationService),
        workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT),
        destroyRef: DestroyRef = inject(DestroyRef),
      ) => ({
        async save(change: AuthenticationPolicyChange): Promise<AuthenticationPolicySaveOutcome> {
          const current: AuthenticationPolicy | null = store.current();
          if (current === null || store.saving() || Object.keys(change).length === 0) {
            return 'skipped';
          }
          // The edit belongs to the organization shown when Save starts: a switch to another
          // organization, or the page going away, abandons it before any send, the first one or
          // the retry after a reauthentication, and drops its answer.
          const organizationId: string = workspace.organization().id;
          const abandoned: Error = new Error('The policy edit was abandoned.');
          const stillWanted: () => boolean = (): boolean =>
            !destroyRef.destroyed && workspace.organization().id === organizationId;
          patchState(store, { saving: true });
          try {
            const updated: AuthenticationPolicy = await reauthentication.run(
              (): Promise<AuthenticationPolicy> => {
                if (!stillWanted()) return Promise.reject(abandoned);
                return api.update(change, current.version);
              },
            );
            if (!stillWanted()) return 'cancelled';
            store.policy.set(updated);
            return 'saved';
          } catch (error: unknown) {
            if (error === abandoned || error instanceof ReauthenticationCancelledError) {
              return 'cancelled';
            }
            if (!stillWanted()) return 'cancelled';
            if (
              error instanceof OrganizationSwitchPendingError ||
              hasProblemCode(error, 'organization.context-changed')
            ) {
              return 'context-changed';
            }
            if (hasProblemCode(error, 'request.version-mismatch')) {
              store.policy.reload();
              return 'outdated';
            }
            if (hasProblemCode(error, 'auth.two-step-not-enabled')) return 'two-step-not-enabled';
            return 'failed';
          } finally {
            patchState(store, { saving: false });
          }
        },
      }),
    ),
  );
}

/**
 * Constant AuthenticationPolicyStore
 *
 * @description
 * The organization's authentication policy for the `Security and SSO` section, provided by its
 * page. The read is the page's primary read, keyed by the workspace organization, so a page the
 * router reuses for another organization reads that one's policy. A save sends only what changed,
 * from the version read (`If-Match`), through the reauthentication the gateway may ask for. It is
 * bound to the organization shown when it starts and to the page: once either changes, it sends
 * nothing more, the retry after a reauthentication included, and ends `cancelled`. A saved change
 * replaces the read with the gateway's answer; a stale version (`412 request.version-mismatch`)
 * reads the policy again; a changed organization context (`412 organization.context-changed`, or
 * a switch in progress) ends `context-changed`, which the workspace recovery takes over.
 *
 * @type {ReturnType<typeof createAuthenticationPolicyStore>}
 */
export const AuthenticationPolicyStore: ReturnType<typeof createAuthenticationPolicyStore> =
  createAuthenticationPolicyStore();
