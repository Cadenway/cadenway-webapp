import {
  computed,
  inject,
  resource,
  type ResourceRef,
  type Signal,
  type Type,
} from '@angular/core';
import { CwToastService } from '@cadenway/ui/components/toast';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';

import { hasProblemCode } from '@core/api';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { InvitationsApi } from '../../data-access/services/invitations-api/invitations-api.service';
import type {
  InvitationList,
  InvitationOutcome,
  PendingInvitation,
} from '../../models/invitation/invitation.interface';
import type { AssignableMemberRole } from '../../models/member/member.interface';

/**
 * Constant VALIDITY_MS
 *
 * @description
 * How long an invitation stays valid after it is sent: 7 days.
 *
 * @type {number}
 */
const VALIDITY_MS: number = 7 * 24 * 60 * 60 * 1000;

/**
 * Interface InvitationsState
 *
 * @description
 * The writes being sent.
 */
interface InvitationsState {
  // #region Properties
  /**
   * Property _resending
   *
   * @description
   * Invitations shown as sent again while the resend is sent, with their new expiry.
   *
   * @type {Readonly<Record<string, string>>}
   */
  _resending: Readonly<Record<string, string>>;

  /**
   * Property _revoking
   *
   * @description
   * Invitations hidden while their revocation is sent.
   *
   * @type {readonly string[]}
   */
  _revoking: readonly string[];

  /**
   * Property inviting
   *
   * @description
   * Whether a batch of invitations is being sent.
   *
   * @type {boolean}
   */
  inviting: boolean;
  // #endregion
}

/**
 * Interface InvitationsStoreInstance
 *
 * @description
 * The pending invitations of the members section and the invite, resend and cancel writes.
 */
export interface InvitationsStoreInstance {
  // #region Properties
  /**
   * Property invitations
   *
   * @description
   * The read of the pending invitations, idle for a person who may not manage them; a secondary
   * read whose failure stays in place.
   *
   * @type {ResourceRef<InvitationList | undefined>}
   * @readonly
   */
  readonly invitations: ResourceRef<InvitationList | undefined>;

  /**
   * Property readable
   *
   * @description
   * Whether the person may read and manage invitations (owner or administrator).
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly readable: Signal<boolean>;

  /**
   * Property items
   *
   * @description
   * Pending invitations shown, the writes being sent included.
   *
   * @type {Signal<readonly PendingInvitation[]>}
   * @readonly
   */
  readonly items: Signal<readonly PendingInvitation[]>;

  /**
   * Property total
   *
   * @description
   * Pending invitations of the organization; null before a read.
   *
   * @type {Signal<number | null>}
   * @readonly
   */
  readonly total: Signal<number | null>;

  /**
   * Property pendingIds
   *
   * @description
   * Invitations whose resend or revocation is being sent.
   *
   * @type {Signal<ReadonlySet<string>>}
   * @readonly
   */
  readonly pendingIds: Signal<ReadonlySet<string>>;

  /**
   * Property inviting
   *
   * @description
   * Whether a batch of invitations is being sent.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly inviting: Signal<boolean>;
  // #endregion

  // #region Methods
  /**
   * Method retry
   *
   * @description
   * Reads the invitations again after a failure.
   */
  retry(): void;

  /**
   * Method invite
   *
   * @description
   * Sends a batch of invitations, then reads the list again. Success shows
   * `<n> invitations sent`; a refusal shows the failure toast.
   *
   * @param {readonly string[]} emails - Distinct addresses, 1 to 50.
   * @param {AssignableMemberRole} role - Role of every address.
   * @returns {Promise<boolean>} Whether the batch was accepted.
   */
  invite(emails: readonly string[], role: AssignableMemberRole): Promise<boolean>;

  /**
   * Method resend
   *
   * @description
   * Shows the invitation as sent again at once (`Expires in 7 days`) and resends it; a refusal
   * restores it and shows the failure toast.
   *
   * @param {PendingInvitation} invitation - The invitation.
   * @returns {Promise<boolean>} Whether the resend was confirmed.
   */
  resend(invitation: PendingInvitation): Promise<boolean>;

  /**
   * Method revoke
   *
   * @description
   * Hides the invitation at once and revokes it; a refusal shows it again with the failure toast.
   * The server has no undo, so the toast has none.
   *
   * @param {PendingInvitation} invitation - The invitation.
   * @returns {Promise<boolean>} Whether the revocation was confirmed.
   */
  revoke(invitation: PendingInvitation): Promise<boolean>;
  // #endregion
}

/**
 * Function createInvitationsStore
 *
 * @description
 * Creates the invitations store.
 *
 * @returns {Type<InvitationsStoreInstance>} Injectable store constructor.
 */
function createInvitationsStore(): Type<InvitationsStoreInstance> {
  const initialState: InvitationsState = { _resending: {}, _revoking: [], inviting: false };
  return signalStore(
    withState(initialState),
    withProps(() => {
      const api: InvitationsApi = inject(InvitationsApi);
      const workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);
      return {
        _api: api,
        _workspace: workspace,
        _toasts: inject(CwToastService),
        invitations: resource({
          params: (): string | undefined =>
            workspace.can('admin') ? workspace.organization().id : undefined,
          loader: ({ abortSignal }: { abortSignal: AbortSignal }): Promise<InvitationList> =>
            api.list(abortSignal),
        }),
      };
    }),
    withComputed((store) => {
      const value: Signal<InvitationList | null> = computed((): InvitationList | null =>
        store.invitations.hasValue() ? store.invitations.value() : null,
      );
      return {
        readable: computed((): boolean => store._workspace.can('admin')),
        items: computed((): readonly PendingInvitation[] => {
          const list: InvitationList | null = value();
          if (list === null) return [];
          const revoking: ReadonlySet<string> = new Set<string>(store._revoking());
          const resending: Readonly<Record<string, string>> = store._resending();
          return list.items
            .filter((invitation: PendingInvitation): boolean => !revoking.has(invitation.id))
            .map((invitation: PendingInvitation): PendingInvitation => {
              return invitation.id in resending
                ? { ...invitation, expired: false, expiresAt: resending[invitation.id] }
                : invitation;
            });
        }),
        total: computed((): number | null => {
          const list: InvitationList | null = value();
          if (list === null) return null;
          const hidden: number = list.items.filter((invitation: PendingInvitation): boolean =>
            store._revoking().includes(invitation.id),
          ).length;
          return Math.max(0, list.total - hidden);
        }),
        pendingIds: computed(
          (): ReadonlySet<string> =>
            new Set<string>([...Object.keys(store._resending()), ...store._revoking()]),
        ),
      };
    }),
    withMethods((store) => {
      const settled: () => boolean = (): boolean =>
        store.invitations.hasValue() && !store.invitations.isLoading();
      const busy: (id: string) => boolean = (id: string): boolean =>
        id in store._resending() || store._revoking().includes(id);
      return {
        retry(): void {
          store.invitations.reload();
        },

        async invite(emails: readonly string[], role: AssignableMemberRole): Promise<boolean> {
          if (!store.readable() || store.inviting() || emails.length === 0) return false;
          patchState(store, { inviting: true });
          try {
            const outcome: InvitationOutcome = await store._api.invite(emails, role);
            store.invitations.reload();
            const skipped: string =
              outcome.skipped === 0
                ? ''
                : outcome.skipped === 1
                  ? $localize`:@@organization.members.invite-skipped-one:1 address skipped: already a member or invited.`
                  : $localize`:@@organization.members.invite-skipped:${outcome.skipped}:count: addresses skipped: already members or invited.`;
            if (outcome.invited === 0) {
              store._toasts.info(
                $localize`:@@organization.members.invite-none:No invitation sent`,
                { description: skipped },
              );
            } else {
              const expiry: string = $localize`:@@organization.members.invite-sent-text:They expire in 7 days.`;
              store._toasts.success(
                outcome.invited === 1
                  ? $localize`:@@organization.members.invite-sent-one:1 invitation sent`
                  : $localize`:@@organization.members.invite-sent:${outcome.invited}:count: invitations sent`,
                { description: skipped === '' ? expiry : `${expiry} ${skipped}` },
              );
            }
            return true;
          } catch (error: unknown) {
            store._toasts.error(
              $localize`:@@organization.members.invite-failed:The invitations could not be sent`,
              hasProblemCode(error, 'invitation.daily-limit-reached')
                ? {
                    description: $localize`:@@organization.members.invite-failed-limit:The daily invitation limit is reached: try again later.`,
                  }
                : {},
            );
            return false;
          } finally {
            patchState(store, { inviting: false });
          }
        },

        async resend(invitation: PendingInvitation): Promise<boolean> {
          if (!store.readable() || busy(invitation.id)) return false;
          const expiresAt: string = new Date(Date.now() + VALIDITY_MS).toISOString();
          patchState(store, { _resending: { ...store._resending(), [invitation.id]: expiresAt } });
          const drop: () => void = (): void => {
            patchState(store, {
              _resending: Object.fromEntries(
                Object.entries(store._resending()).filter(
                  ([id]: [string, string]): boolean => id !== invitation.id,
                ),
              ),
            });
          };
          try {
            const updated: PendingInvitation = await store._api.resend(invitation.id);
            if (settled()) {
              store.invitations.update(
                (list: InvitationList | undefined): InvitationList | undefined =>
                  list && {
                    ...list,
                    items: list.items.map((item: PendingInvitation): PendingInvitation =>
                      item.id === updated.id ? updated : item,
                    ),
                  },
              );
            }
            drop();
            store._toasts.success(
              $localize`:@@organization.members.invitation-resent:Invitation resent`,
              { description: invitation.email },
            );
            return true;
          } catch (error: unknown) {
            drop();
            store._toasts.error(
              $localize`:@@organization.members.resend-failed:The invitation could not be resent`,
              hasProblemCode(error, 'invitation.resend-throttled')
                ? {
                    description: $localize`:@@organization.members.resend-throttled:This invitation was just resent: try again in an hour.`,
                  }
                : {},
            );
            return false;
          }
        },

        async revoke(invitation: PendingInvitation): Promise<boolean> {
          if (!store.readable() || busy(invitation.id)) return false;
          patchState(store, { _revoking: [...store._revoking(), invitation.id] });
          const drop: () => void = (): void => {
            patchState(store, {
              _revoking: store._revoking().filter((id: string): boolean => id !== invitation.id),
            });
          };
          try {
            await store._api.revoke(invitation.id);
            if (settled()) {
              store.invitations.update(
                (list: InvitationList | undefined): InvitationList | undefined =>
                  list && {
                    total: Math.max(0, list.total - 1),
                    items: list.items.filter(
                      (item: PendingInvitation): boolean => item.id !== invitation.id,
                    ),
                  },
              );
            }
            drop();
            store._toasts.success(
              $localize`:@@organization.members.invitation-cancelled:Invitation cancelled`,
              { description: invitation.email },
            );
            return true;
          } catch {
            drop();
            store._toasts.error(
              $localize`:@@organization.members.cancel-failed:The invitation could not be cancelled`,
            );
            return false;
          }
        },
      };
    }),
  );
}

/**
 * Constant InvitationsStore
 *
 * @description
 * The pending invitations of the members section, provided by `MembersPage`. Only an owner or an
 * administrator reads them; for anyone else the read stays idle. Resend and cancel are
 * optimistic: the row changes at once, a refusal restores it with the failure toast, and a
 * confirmation writes the answer into the read. Inviting reads the list again.
 *
 * @type {Type<InvitationsStoreInstance>}
 */
export const InvitationsStore: Type<InvitationsStoreInstance> = createInvitationsStore();
