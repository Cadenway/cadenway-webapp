import { inject, resource, type ResourceRef, type Signal, type Type } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';

import { authProblem } from '../../utils/auth-problem/auth-problem.util';
import { OrganizationApi } from '../../data-access/services/organization-api/organization-api.service';
import type { AuthProblem } from '../../models/auth-problem/auth-problem.interface';
import type {
  OrganizationChoice,
  ReceivedInvitation,
} from '../../models/organization/organization.interface';

/**
 * Constant UNDO_DELAY_MS
 *
 * @description
 * How long a refusal can be undone before it is sent, as long as the mockup's toasts last.
 *
 * @type {number}
 */
const UNDO_DELAY_MS: number = 6_000;

/**
 * Type ChoiceAction
 *
 * @description
 * The chooser action a refusal belongs to.
 *
 * @type {'choose' | 'accept' | 'refuse'}
 */
export type ChoiceAction = 'choose' | 'accept' | 'refuse';

/**
 * Interface OrganizationChoiceState
 *
 * @description
 * Actions of the chooser on top of its two reads.
 */
interface OrganizationChoiceState {
  // #region Properties
  /**
   * Property pendingId
   *
   * @description
   * Organization or invitation being acted on, or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly pendingId: string | null;

  /**
   * Property failure
   *
   * @description
   * The last refused action and its problem, or null.
   *
   * @type {{ readonly action: ChoiceAction; readonly problem: AuthProblem } | null}
   * @readonly
   */
  readonly failure: { readonly action: ChoiceAction; readonly problem: AuthProblem } | null;

  /**
   * Property joined
   *
   * @description
   * Organizations joined during this visit, shown first with "Nouveau".
   *
   * @type {readonly OrganizationChoice[]}
   * @readonly
   */
  readonly joined: readonly OrganizationChoice[];

  /**
   * Property refused
   *
   * @description
   * The invitation refused last, still undoable, or null.
   *
   * @type {ReceivedInvitation | null}
   * @readonly
   */
  readonly refused: ReceivedInvitation | null;

  /**
   * Property _answered
   *
   * @description
   * Invitations accepted or refused during this visit, hidden from the list.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly _answered: readonly string[];
  // #endregion
}

/**
 * Interface OrganizationChoiceStoreInstance
 *
 * @description
 * Public API of the chooser store.
 */
interface OrganizationChoiceStoreInstance {
  // #region Properties
  /**
   * Property organizations
   *
   * @description
   * The caller's organizations, loading, loaded or failed.
   *
   * @type {ResourceRef<readonly OrganizationChoice[] | undefined>}
   * @readonly
   */
  readonly organizations: ResourceRef<readonly OrganizationChoice[] | undefined>;

  /**
   * Property invitations
   *
   * @description
   * The invitations addressed to the caller, loading, loaded or failed.
   *
   * @type {ResourceRef<readonly ReceivedInvitation[] | undefined>}
   * @readonly
   */
  readonly invitations: ResourceRef<readonly ReceivedInvitation[] | undefined>;

  /**
   * Property choices
   *
   * @description
   * Organizations joined during this visit first, then the listed ones.
   *
   * @type {Signal<readonly OrganizationChoice[]>}
   * @readonly
   */
  readonly choices: Signal<readonly OrganizationChoice[]>;

  /**
   * Property pendingInvitations
   *
   * @description
   * Invitations still to answer.
   *
   * @type {Signal<readonly ReceivedInvitation[]>}
   * @readonly
   */
  readonly pendingInvitations: Signal<readonly ReceivedInvitation[]>;

  /**
   * Property loadProblem
   *
   * @description
   * Problem of the failed organization list, or null.
   *
   * @type {Signal<AuthProblem | null>}
   * @readonly
   */
  readonly loadProblem: Signal<AuthProblem | null>;

  /**
   * Property pendingId
   *
   * @description
   * Organization or invitation being acted on.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  readonly pendingId: Signal<string | null>;

  /**
   * Property failure
   *
   * @description
   * The last refused action.
   *
   * @type {Signal<{ readonly action: ChoiceAction; readonly problem: AuthProblem } | null>}
   * @readonly
   */
  readonly failure: Signal<{ readonly action: ChoiceAction; readonly problem: AuthProblem } | null>;

  /**
   * Property joined
   *
   * @description
   * Organizations joined during this visit.
   *
   * @type {Signal<readonly OrganizationChoice[]>}
   * @readonly
   */
  readonly joined: Signal<readonly OrganizationChoice[]>;

  /**
   * Property refused
   *
   * @description
   * The invitation refused last, still undoable.
   *
   * @type {Signal<ReceivedInvitation | null>}
   * @readonly
   */
  readonly refused: Signal<ReceivedInvitation | null>;
  // #endregion

  // #region Methods
  /**
   * Method reload
   *
   * @description
   * Reads the organizations and the invitations again (Réessayer).
   */
  reload(): void;

  /**
   * Method choose
   *
   * @description
   * Makes an organization the session's current one.
   *
   * @param {OrganizationChoice} organization - The chosen organization.
   * @returns {Promise<string | null>} Its workspace path, or null when refused.
   */
  choose(organization: OrganizationChoice): Promise<string | null>;

  /**
   * Method accept
   *
   * @description
   * Joins the organization of an invitation; it then shows first with "Nouveau".
   *
   * @param {ReceivedInvitation} invitation - The invitation.
   * @returns {Promise<void>} Resolves once handled.
   */
  accept(invitation: ReceivedInvitation): Promise<void>;

  /**
   * Method refuse
   *
   * @description
   * Hides an invitation at once and refuses it 6 seconds later unless undone; a refusal still
   * waiting is sent first.
   *
   * @param {ReceivedInvitation} invitation - The invitation.
   */
  refuse(invitation: ReceivedInvitation): void;

  /**
   * Method undoRefuse
   *
   * @description
   * Cancels the waiting refusal and shows the invitation again (Annuler).
   */
  undoRefuse(): void;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * Nothing pending, joined or refused.
 *
 * @type {OrganizationChoiceState}
 */
const initialState: OrganizationChoiceState = {
  pendingId: null,
  failure: null,
  joined: [],
  refused: null,
  _answered: [],
};

/**
 * Function createOrganizationChoiceStore
 *
 * @description
 * Creates the chooser store, provided by the organizations page. Its two reads are independent
 * resources: a failed one shows its own error with Réessayer and never empties the other. A
 * refusal waits 6 seconds for Annuler and is sent at once when the page closes.
 *
 * @returns {Type<OrganizationChoiceStoreInstance>} The store provider.
 */
function createOrganizationChoiceStore(): Type<OrganizationChoiceStoreInstance> {
  return signalStore(
    withState(initialState),
    withProps(() => {
      const api: OrganizationApi = inject(OrganizationApi);
      return {
        _api: api,
        organizations: resource({ loader: () => api.listMine() }),
        invitations: resource({ loader: () => api.listReceivedInvitations() }),
      };
    }),
    withComputed((store) => ({
      choices: (): readonly OrganizationChoice[] => {
        const listed: readonly OrganizationChoice[] = store.organizations.hasValue()
          ? store.organizations.value()
          : [];
        return [
          ...store.joined(),
          ...listed.filter(
            (item: OrganizationChoice) =>
              !store.joined().some((added: OrganizationChoice) => added.id === item.id),
          ),
        ];
      },
      pendingInvitations: (): readonly ReceivedInvitation[] =>
        (store.invitations.hasValue() ? store.invitations.value() : []).filter(
          (item: ReceivedInvitation) => !store._answered().includes(item.id),
        ),
      loadProblem: (): AuthProblem | null => {
        const error: Error | undefined = store.organizations.error();
        return error === undefined ? null : authProblem(error.cause ?? error);
      },
    })),
    withMethods((store) => {
      let refusal: { readonly id: string; readonly timer: ReturnType<typeof setTimeout> } | null =
        null;

      const sendRefusal: (id: string) => Promise<void> = async (id: string): Promise<void> => {
        refusal = null;
        patchState(store, { refused: null });
        try {
          await store._api.refuseInvitation(id);
        } catch (error: unknown) {
          patchState(store, (state: OrganizationChoiceState) => ({
            _answered: state._answered.filter((answered: string) => answered !== id),
            failure: { action: 'refuse' as const, problem: authProblem(error) },
          }));
        }
      };

      const flush: () => void = (): void => {
        if (refusal === null) return;
        clearTimeout(refusal.timer);
        void sendRefusal(refusal.id);
      };

      return {
        reload(): void {
          store.organizations.reload();
          store.invitations.reload();
        },
        async choose(organization: OrganizationChoice): Promise<string | null> {
          if (store.pendingId() !== null) return null;
          patchState(store, { pendingId: organization.id, failure: null });
          try {
            await store._api.choose(
              organization.id,
              store.joined().some((item: OrganizationChoice) => item.id === organization.id),
            );
            patchState(store, { pendingId: null });
            return `/${organization.slug}`;
          } catch (error: unknown) {
            patchState(store, {
              pendingId: null,
              failure: { action: 'choose', problem: authProblem(error) },
            });
            return null;
          }
        },
        async accept(invitation: ReceivedInvitation): Promise<void> {
          if (store.pendingId() !== null) return;
          patchState(store, { pendingId: invitation.id, failure: null });
          try {
            const organization: OrganizationChoice = await store._api.acceptInvitation(
              invitation.id,
            );
            patchState(store, (state: OrganizationChoiceState) => ({
              pendingId: null,
              joined: [organization, ...state.joined],
              _answered: [...state._answered, invitation.id],
            }));
          } catch (error: unknown) {
            patchState(store, {
              pendingId: null,
              failure: { action: 'accept', problem: authProblem(error) },
            });
          }
        },
        refuse(invitation: ReceivedInvitation): void {
          flush();
          patchState(store, (state: OrganizationChoiceState) => ({
            refused: invitation,
            failure: null,
            _answered: [...state._answered, invitation.id],
          }));
          refusal = {
            id: invitation.id,
            timer: setTimeout(() => {
              void sendRefusal(invitation.id);
            }, UNDO_DELAY_MS),
          };
        },
        undoRefuse(): void {
          if (refusal === null) return;
          clearTimeout(refusal.timer);
          const id: string = refusal.id;
          refusal = null;
          patchState(store, (state: OrganizationChoiceState) => ({
            refused: null,
            _answered: state._answered.filter((answered: string) => answered !== id),
          }));
        },
        _flush: flush,
      };
    }),
    withHooks({
      onDestroy(store): void {
        store._flush();
      },
    }),
  );
}

/**
 * Constant OrganizationChoiceStore
 *
 * @description
 * Chooser state, provided by the organizations page.
 *
 * @type {Type<OrganizationChoiceStoreInstance>}
 */
export const OrganizationChoiceStore: Type<OrganizationChoiceStoreInstance> =
  createOrganizationChoiceStore();

/**
 * Type OrganizationChoiceStore
 *
 * @description
 * Instance type of the chooser store.
 *
 * @type {OrganizationChoiceStoreInstance}
 */
export type OrganizationChoiceStore = OrganizationChoiceStoreInstance;
