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

import { hasProblemCode, OrganizationSwitchPendingError, readProblem } from '@core/api';
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
 * Class OrganizationChangedError
 *
 * @description
 * The workspace now shows another organization than the one a write started in: the write is
 * not sent, and nothing is shown.
 */
class OrganizationChangedError extends Error {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Names the error.
   *
   * @constructor
   */
  public constructor() {
    super('The organization changed before the request was sent.');
    this.name = 'OrganizationChangedError';
  }
  // #endregion
}

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
   * Creates a token through the reauthentication service, in the organization the workspace shows
   * when it starts. Before each send, the retry after a reauthentication included, it checks that
   * the workspace still shows that organization and otherwise stops silently; the organization pin
   * makes the gateway refuse a session switched by another tab (`412`), which stops silently too.
   * On success `secret` holds the secret, and the token heads the list when the organization is
   * unchanged. A closed reauthentication dialog creates nothing and shows nothing; any other
   * refusal shows the failure toast. Ignored while a creation runs.
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
   * Revokes a token in the organization the workspace shows when it starts. It is not sent, and
   * nothing is shown, when the token is no longer in the list shown (the list was read again for
   * another organization) or the workspace shows another organization by then; a refusal of the
   * organization pin (`412`) stops silently too. On success, or on `404 api-token.not-found` while
   * the organization is unchanged, the `Token revoked` toast names it and it leaves the list when
   * the organization is unchanged; any other refusal keeps it and shows the failure toast. Ignored
   * while a revocation runs.
   *
   * @param {ApiToken} token - The token.
   * @returns {Promise<boolean>} Whether the token left the list.
   */
  revoke(token: ApiToken): Promise<boolean>;
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
          loader: ({ abortSignal }: { abortSignal: AbortSignal }): Promise<readonly ApiToken[]> =>
            api.list(abortSignal),
        }),
      };
    }),
    withComputed((store) => ({
      isEmpty: (): boolean => store.tokens.hasValue() && store.tokens.value().length === 0,
    })),
    withMethods((store) => {
      const organizationId: () => string = (): string => store._workspace.organization().id;
      const ensureOrganization: (organization: string) => void = (organization: string): void => {
        if (organization !== organizationId()) throw new OrganizationChangedError();
      };
      const mismatched: (error: unknown, organization: string) => boolean = (
        error: unknown,
        organization: string,
      ): boolean =>
        error instanceof OrganizationChangedError ||
        error instanceof OrganizationSwitchPendingError ||
        hasProblemCode(error, 'organization.context-changed') ||
        organization !== organizationId();
      const update: (
        organization: string,
        change: (tokens: readonly ApiToken[]) => readonly ApiToken[],
      ) => boolean = (
        organization: string,
        change: (tokens: readonly ApiToken[]) => readonly ApiToken[],
      ): boolean => {
        if (organization !== organizationId() || !store.tokens.hasValue()) return false;
        store.tokens.set(change(store.tokens.value()));
        return true;
      };
      return {
        async create(draft: ApiTokenDraft): Promise<void> {
          if (store.creating()) return;
          const organization: string = organizationId();
          patchState(store, { creating: true });
          try {
            const created: CreatedApiToken = await store._reauthentication.run(() => {
              ensureOrganization(organization);
              return store._api.create(draft);
            });
            update(organization, (tokens: readonly ApiToken[]) => [created.token, ...tokens]);
            patchState(store, { creating: false, secret: created.secret });
          } catch (error: unknown) {
            patchState(store, { creating: false });
            if (error instanceof ReauthenticationCancelledError || mismatched(error, organization))
              return;
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
        async revoke(token: ApiToken): Promise<boolean> {
          const listed: boolean =
            store.tokens.hasValue() &&
            store.tokens.value().some((item: ApiToken): boolean => item.id === token.id);
          if (store.revokingId() !== null || !listed) return false;
          const organization: string = organizationId();
          patchState(store, { revokingId: token.id });
          try {
            ensureOrganization(organization);
            await store._api.revoke(token.id);
          } catch (error: unknown) {
            const gone: boolean =
              readProblem(error)?.status === 404 &&
              hasProblemCode(error, 'api-token.not-found') &&
              organization === organizationId();
            if (!gone) {
              patchState(store, { revokingId: null });
              if (!mismatched(error, organization))
                store._toasts.error(
                  $localize`:@@account.api-tokens.revoke-failed:The token could not be revoked`,
                  {
                    description: $localize`:@@account.api-tokens.revoke-failed-text:It still works. Try again in a moment.`,
                  },
                );
              return false;
            }
          }
          const removed: boolean = update(organization, (tokens: readonly ApiToken[]) =>
            tokens.filter((item: ApiToken): boolean => item.id !== token.id),
          );
          patchState(store, { revokingId: null });
          store._toasts.success($localize`:@@account.api-tokens.revoked:Token revoked`, {
            description: $localize`:@@account.api-tokens.revoked-text:${token.name}:name: can no longer call the API.`,
          });
          return removed;
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
