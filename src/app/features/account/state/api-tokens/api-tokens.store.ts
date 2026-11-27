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

import {
  type ApiProblem,
  hasProblemCode,
  OrganizationSwitchPendingError,
  readProblem,
} from '@core/api';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { ApiTokensApi } from '../../data-access/services/api-tokens-api/api-tokens-api.service';
import type {
  ApiToken,
  ApiTokenCreateOutcome,
  ApiTokenDraft,
  CreatedApiToken,
} from '../../models/api-token/api-token.interface';
import { ReauthenticationCancelledError } from '../../reauthentication/reauthentication-cancelled.error';
import { ReauthenticationService } from '../../reauthentication/reauthentication.service';

/**
 * Type TokenWrite
 *
 * @description
 * A write the gateway confirmed, kept over the read list until a read issued after it lands:
 * `added` puts a token at the head of its organization's list, `removed` takes one out. `after`
 * is the number of reads issued when it was confirmed; a read whose issue number is greater
 * reflects it.
 *
 * @type {{ readonly organizationId: string; readonly after: number } & ({ readonly kind: 'added'; readonly token: ApiToken } | { readonly kind: 'removed'; readonly id: string })}
 */
type TokenWrite = { readonly organizationId: string; readonly after: number } & (
  | { readonly kind: 'added'; readonly token: ApiToken }
  | { readonly kind: 'removed'; readonly id: string }
);

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

  /**
   * Property highlightedId
   *
   * @description
   * The token created without its secret reaching the page, which the list highlights so the
   * person revokes it; null otherwise.
   *
   * @type {string | null}
   */
  highlightedId: string | null;

  /**
   * Property _writes
   *
   * @description
   * The confirmed writes no read issued after them has reflected yet.
   *
   * @type {readonly TokenWrite[]}
   */
  _writes: readonly TokenWrite[];

  /**
   * Property _readsIssued
   *
   * @description
   * How many reads of the list have been issued.
   *
   * @type {number}
   */
  _readsIssued: number;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * No secret, no write in progress or waiting for a read.
 *
 * @type {ApiTokensState}
 */
const initialState: ApiTokensState = {
  secret: null,
  creating: false,
  revokingId: null,
  highlightedId: null,
  _writes: [],
  _readsIssued: 0,
};

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
 * Function isUncertain
 *
 * @description
 * Whether a failed creation may still have created the token: its answer was lost (no HTTP
 * status, a timeout) or the gateway failed on its side (`5xx`). A refusal (`4xx`) created
 * nothing.
 *
 * @param {unknown} error - What the creation rejected with.
 * @returns {boolean} Whether the outcome is unknown.
 */
function isUncertain(error: unknown): boolean {
  const problem: ApiProblem | null = readProblem(error);
  return problem === null || problem.status === 0 || problem.status >= 500;
}

/**
 * Function applyWrites
 *
 * @description
 * The read list of an organization with its confirmed writes on top.
 *
 * @param {readonly ApiToken[]} tokens - The list as last read.
 * @param {readonly TokenWrite[]} writes - The writes not reflected yet, oldest first.
 * @param {string} organizationId - The organization of the list.
 * @returns {readonly ApiToken[]} The list to show.
 */
function applyWrites(
  tokens: readonly ApiToken[],
  writes: readonly TokenWrite[],
  organizationId: string,
): readonly ApiToken[] {
  return writes
    .filter((write: TokenWrite): boolean => write.organizationId === organizationId)
    .reduce((list: readonly ApiToken[], write: TokenWrite): readonly ApiToken[] => {
      if (write.kind === 'removed')
        return list.filter((token: ApiToken): boolean => token.id !== write.id);
      return list.some((token: ApiToken): boolean => token.id === write.token.id)
        ? list
        : [write.token, ...list];
    }, tokens);
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
   * error boundary through the page's read of `list()`.
   *
   * @type {ResourceRef<readonly ApiToken[] | undefined>}
   * @readonly
   */
  readonly tokens: ResourceRef<readonly ApiToken[] | undefined>;

  /**
   * Property list
   *
   * @description
   * The tokens to show: the last read with the confirmed writes no later read reflects yet, or
   * undefined while the first read of the organization loads. Reading it throws the read's error.
   *
   * @type {Signal<readonly ApiToken[] | undefined>}
   * @readonly
   */
  readonly list: Signal<readonly ApiToken[] | undefined>;

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
   * Property highlightedId
   *
   * @description
   * The token created without its secret, which the list highlights, or null.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  readonly highlightedId: Signal<string | null>;

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
   * On success `secret` holds the secret and the token heads the list. A closed reauthentication
   * dialog creates nothing and shows nothing; a refusal (`4xx`) shows the failure toast. When the
   * answer is lost or the gateway fails (`5xx`), the token may exist: the list is read again, and
   * a new token of that name is highlighted with a warning to revoke it, since its secret is gone;
   * without one, a warning says it may not have been created. The contract offers no
   * idempotency key for this operation. Ignored while a creation runs.
   *
   * @param {ApiTokenDraft} draft - What the dialog submitted.
   * @returns {Promise<ApiTokenCreateOutcome>} How it ended.
   */
  create(draft: ApiTokenDraft): Promise<ApiTokenCreateOutcome>;

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
   * the organization is unchanged, the `Token revoked` toast names it and it leaves its
   * organization's list, even when that list is being read again; any other refusal keeps it and
   * shows the failure toast. Ignored while a revocation runs.
   *
   * @param {ApiToken} token - The token.
   * @returns {Promise<boolean>} Whether the token left the list shown.
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
    withProps((store) => {
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
          loader: async ({
            params,
            abortSignal,
          }: {
            params: { organizationId: string };
            abortSignal: AbortSignal;
          }): Promise<readonly ApiToken[]> => {
            const issued: number = store._readsIssued() + 1;
            patchState(store, { _readsIssued: issued });
            const tokens: readonly ApiToken[] = await api.list(abortSignal);
            patchState(store, {
              _writes: store
                ._writes()
                .filter(
                  (write: TokenWrite): boolean =>
                    write.organizationId !== params.organizationId || write.after >= issued,
                ),
            });
            return tokens;
          },
        }),
      };
    }),
    withComputed((store) => ({
      list: (): readonly ApiToken[] | undefined => {
        const tokens: readonly ApiToken[] | undefined = store.tokens.value();
        return tokens === undefined
          ? undefined
          : applyWrites(tokens, store._writes(), store._workspace.organization().id);
      },
    })),
    withComputed((store) => ({
      isEmpty: (): boolean => store.tokens.hasValue() && (store.list() ?? []).length === 0,
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
      const record: (write: TokenWrite) => void = (write: TokenWrite): void => {
        patchState(store, { _writes: [...store._writes(), write] });
      };
      const shownIds: () => ReadonlySet<string> = (): ReadonlySet<string> =>
        new Set(
          (store.tokens.hasValue() ? store.list() : undefined)?.map(
            (token: ApiToken): string => token.id,
          ) ?? [],
        );
      const recover: (
        draft: ApiTokenDraft,
        organization: string,
        known: ReadonlySet<string>,
      ) => Promise<ApiTokenCreateOutcome> = async (
        draft: ApiTokenDraft,
        organization: string,
        known: ReadonlySet<string>,
      ): Promise<ApiTokenCreateOutcome> => {
        let orphan: ApiToken | undefined;
        try {
          ensureOrganization(organization);
          orphan = (await store._api.list()).find(
            (token: ApiToken): boolean => token.name === draft.name && !known.has(token.id),
          );
        } catch {
          orphan = undefined;
        }
        if (organization !== organizationId()) return 'cancelled';
        if (orphan === undefined) {
          store._toasts.warning(
            $localize`:@@account.api-tokens.create-unknown:The token may not have been created`,
            {
              description: $localize`:@@account.api-tokens.create-unknown-text:The answer was lost. Check the list before creating it again.`,
            },
          );
          return 'unknown';
        }
        record({
          organizationId: organization,
          after: store._readsIssued(),
          kind: 'added',
          token: orphan,
        });
        patchState(store, { highlightedId: orphan.id });
        store._toasts.warning(
          $localize`:@@account.api-tokens.created-without-secret:The token was created without its secret`,
          {
            description: $localize`:@@account.api-tokens.created-without-secret-text:Its secret could not be shown. Revoke it, then create another one.`,
          },
        );
        return 'orphaned';
      };
      return {
        async create(draft: ApiTokenDraft): Promise<ApiTokenCreateOutcome> {
          if (store.creating()) return 'cancelled';
          const organization: string = organizationId();
          const known: ReadonlySet<string> = shownIds();
          patchState(store, { creating: true, highlightedId: null });
          try {
            const created: CreatedApiToken = await store._reauthentication.run(() => {
              ensureOrganization(organization);
              return store._api.create(draft);
            });
            record({
              organizationId: organization,
              after: store._readsIssued(),
              kind: 'added',
              token: created.token,
            });
            patchState(store, { creating: false, secret: created.secret });
            return 'created';
          } catch (error: unknown) {
            if (
              error instanceof ReauthenticationCancelledError ||
              mismatched(error, organization)
            ) {
              patchState(store, { creating: false });
              return 'cancelled';
            }
            if (isUncertain(error)) {
              const outcome: ApiTokenCreateOutcome = await recover(draft, organization, known);
              patchState(store, { creating: false });
              return outcome;
            }
            patchState(store, { creating: false });
            store._toasts.error(
              $localize`:@@account.api-tokens.create-failed:The token could not be created`,
              {
                description: $localize`:@@account.api-tokens.create-failed-text:Try again in a moment.`,
              },
            );
            return 'failed';
          }
        },
        dismissSecret(): void {
          patchState(store, { secret: null });
        },
        async revoke(token: ApiToken): Promise<boolean> {
          if (store.revokingId() !== null || !shownIds().has(token.id)) return false;
          const organization: string = organizationId();
          patchState(store, { revokingId: token.id, highlightedId: null });
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
          record({
            organizationId: organization,
            after: store._readsIssued(),
            kind: 'removed',
            id: token.id,
          });
          patchState(store, { revokingId: null });
          store._toasts.success($localize`:@@account.api-tokens.revoked:Token revoked`, {
            description: $localize`:@@account.api-tokens.revoked-text:${token.name}:name: can no longer call the API.`,
          });
          return organization === organizationId();
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
 * current organization once and again after a switch. Its own confirmed writes stay over the read
 * list until a read issued after them lands, so neither a reload in progress nor an older read
 * hides them, and a write never sends the page to the error boundary. The secret of a new token
 * stays in memory until the dialog closes and dies with the page.
 *
 * @type {ReturnType<typeof createApiTokensStore>}
 */
export const ApiTokensStore: ReturnType<typeof createApiTokensStore> = createApiTokensStore();
