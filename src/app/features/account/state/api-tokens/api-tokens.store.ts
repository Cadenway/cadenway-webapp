import { inject, resource, type ResourceRef, type Signal, type Type } from '@angular/core';
import { CwToastService } from '@cadenway/ui/components/toast';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';

import { readProblem } from '@core/api';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { ApiTokensApi } from '../../data-access/services/api-tokens-api/api-tokens-api.service';
import type {
  ApiToken,
  ApiTokenDraft,
  CreatedApiToken,
} from '../../models/api-token/api-token.interface';
import { ReauthenticationCancelledError } from '../../reauthentication/reauthentication-cancelled.error';
import { ReauthenticationService } from '../../reauthentication/reauthentication.service';

/**
 * Interface ApiTokensState
 *
 * @description
 * The writes of the token section and the secret of the token just created.
 */
interface ApiTokensState {
  // #region Properties
  /**
   * Property secret
   *
   * @description
   * The secret of the token just created, shown once by the create dialog, or null. It lives
   * only here, in memory, until `dismissSecret()`; it is never logged nor persisted.
   *
   * @type {string | null}
   */
  secret: string | null;

  /**
   * Property creating
   *
   * @description
   * Whether a creation is waiting for the gateway or for the reauthentication dialog.
   *
   * @type {boolean}
   */
  creating: boolean;

  /**
   * Property revokingId
   *
   * @description
   * The token whose revocation is waiting for the gateway, or null.
   *
   * @type {string | null}
   */
  revokingId: string | null;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * No secret, no write in progress.
 *
 * @type {ApiTokensState}
 */
const initialState: ApiTokensState = { secret: null, creating: false, revokingId: null };

/**
 * Interface ApiTokensStoreInstance
 *
 * @description
 * The tokens of the signed-in person in the current organization, their creation and their
 * revocation.
 */
interface ApiTokensStoreInstance {
  // #region Properties
  /**
   * Property tokens
   *
   * @description
   * The read of the tokens, again after an organization switch; its error reaches the route's
   * error boundary through the page's read of `value()`.
   *
   * @type {ResourceRef<readonly ApiToken[] | undefined>}
   * @readonly
   */
  readonly tokens: ResourceRef<readonly ApiToken[] | undefined>;

  /**
   * Property secret
   *
   * @description
   * The secret of the token just created, or null.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  readonly secret: Signal<string | null>;

  /**
   * Property creating
   *
   * @description
   * Whether a creation is in progress.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly creating: Signal<boolean>;

  /**
   * Property revokingId
   *
   * @description
   * The token being revoked, or null.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  readonly revokingId: Signal<string | null>;

  /**
   * Property isEmpty
   *
   * @description
   * Whether the read succeeded with no token.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly isEmpty: Signal<boolean>;
  // #endregion

  // #region Methods
  /**
   * Method create
   *
   * @description
   * Creates a token through the reauthentication service. On success the token heads the list
   * and `secret` holds its secret. A closed reauthentication dialog creates nothing and shows
   * nothing; any other refusal shows the failure toast. Ignored while a creation runs.
   *
   * @param {ApiTokenDraft} draft - What the dialog submitted.
   * @returns {Promise<void>} Resolves once settled.
   */
  create(draft: ApiTokenDraft): Promise<void>;

  /**
   * Method dismissSecret
   *
   * @description
   * Forgets the secret of the token just created, when its dialog closes.
   */
  dismissSecret(): void;

  /**
   * Method revoke
   *
   * @description
   * Revokes a token. On success, or when the gateway no longer knows it (`404`), it leaves the
   * list and the `Token revoked` toast names it; any other refusal keeps it and shows the failure
   * toast. Ignored while a revocation runs.
   *
   * @param {ApiToken} token - The token.
   * @returns {Promise<void>} Resolves once settled.
   */
  revoke(token: ApiToken): Promise<void>;
  // #endregion
}

/**
 * Function createApiTokensStore
 *
 * @description
 * Creates the API tokens store.
 *
 * @returns {Type<ApiTokensStoreInstance>} Injectable store constructor.
 */
function createApiTokensStore(): Type<ApiTokensStoreInstance> {
  return signalStore(
    withState(initialState),
    withProps(() => {
      const api: ApiTokensApi = inject(ApiTokensApi);
      const workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);
      return {
        _api: api,
        _workspace: workspace,
        _reauthentication: inject(ReauthenticationService),
        _toasts: inject(CwToastService),
        tokens: resource({
          params: (): { organizationId: string } => ({
            organizationId: workspace.organization().id,
          }),
          loader: (): Promise<readonly ApiToken[]> => api.list(),
        }),
      };
    }),
    withComputed((store) => ({
      isEmpty: (): boolean => store.tokens.hasValue() && store.tokens.value().length === 0,
    })),
    withMethods((store) => {
      const organizationId: () => string = (): string => store._workspace.organization().id;
      const update: (
        organization: string,
        change: (tokens: readonly ApiToken[]) => readonly ApiToken[],
      ) => void = (
        organization: string,
        change: (tokens: readonly ApiToken[]) => readonly ApiToken[],
      ): void => {
        if (organization !== organizationId() || !store.tokens.hasValue()) return;
        store.tokens.set(change(store.tokens.value()));
      };
      return {
        async create(draft: ApiTokenDraft): Promise<void> {
          if (store.creating()) return;
          const organization: string = organizationId();
          patchState(store, { creating: true });
          try {
            const created: CreatedApiToken = await store._reauthentication.run(() =>
              store._api.create(draft),
            );
            update(organization, (tokens: readonly ApiToken[]) => [created.token, ...tokens]);
            patchState(store, { creating: false, secret: created.secret });
          } catch (error: unknown) {
            patchState(store, { creating: false });
            if (error instanceof ReauthenticationCancelledError) return;
            store._toasts.error(
              $localize`:@@account.api-tokens.create-failed:The token could not be created`,
              {
                description: $localize`:@@account.api-tokens.create-failed-text:Try again in a moment.`,
              },
            );
          }
        },
        dismissSecret(): void {
          patchState(store, { secret: null });
        },
        async revoke(token: ApiToken): Promise<void> {
          if (store.revokingId() !== null) return;
          const organization: string = organizationId();
          patchState(store, { revokingId: token.id });
          try {
            await store._api.revoke(token.id);
          } catch (error: unknown) {
            if (readProblem(error)?.status !== 404) {
              patchState(store, { revokingId: null });
              store._toasts.error(
                $localize`:@@account.api-tokens.revoke-failed:The token could not be revoked`,
                {
                  description: $localize`:@@account.api-tokens.revoke-failed-text:It still works. Try again in a moment.`,
                },
              );
              return;
            }
          }
          update(organization, (tokens: readonly ApiToken[]) =>
            tokens.filter((item: ApiToken): boolean => item.id !== token.id),
          );
          patchState(store, { revokingId: null });
          store._toasts.success($localize`:@@account.api-tokens.revoked:Token revoked`, {
            description: $localize`:@@account.api-tokens.revoked-text:${token.name}:name: can no longer call the API.`,
          });
        },
      };
    }),
  );
}

/**
 * Constant ApiTokensStore
 *
 * @description
 * State of the `API tokens` section, provided by its page. It reads the person's tokens of the
 * current organization once and again after a switch, then keeps the list in step with its own
 * writes rather than reading it again, so a write never sends the page to the error boundary.
 * The secret of a new token stays in memory until the dialog closes and dies with the page.
 *
 * @type {ReturnType<typeof createApiTokensStore>}
 */
export const ApiTokensStore: ReturnType<typeof createApiTokensStore> = createApiTokensStore();
