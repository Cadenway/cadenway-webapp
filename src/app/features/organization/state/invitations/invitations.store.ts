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
  signalMethod,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';

import { type ApiProblem, hasProblemCode, readProblem } from '@core/api';
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
import { takesSingular } from '../../models/member/plural-form.util';

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
 * Constant CLOSED_CODES
 *
 * @description
 * Refusals meaning the invitation left the pending list meanwhile (accepted, refused or revoked).
 *
 * @type {readonly string[]}
 */
const CLOSED_CODES: readonly string[] = ['invitation.answered', 'invitation.revoked'];

/**
 * Constant EMAIL_ISSUE
 *
 * @description
 * Path of a `request.invalid` issue about one address of a batch (`emails.<index>`).
 *
 * @type {RegExp}
 */
const EMAIL_ISSUE: RegExp = /^emails\.(\d+)$/u;

/**
 * Type InviteResult
 *
 * @description
 * What became of a batch: `sent`, `failed` (the toast told why), or the addresses the API refused
 * as invalid, which the dialog shows on its field.
 *
 * @type {'sent' | 'failed' | { readonly refused: readonly string[] }}
 */
export type InviteResult = 'sent' | 'failed' | { readonly refused: readonly string[] };

/**
 * Interface InvitationsRead
 *
 * @description
 * What the invitations resource reads.
 */
interface InvitationsRead {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * Organization read.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property version
   *
   * @description
   * Read counter: raising it reads again, even while a read is under way.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;
  // #endregion
}

/**
 * Interface InvitationsSnapshot
 *
 * @description
 * An answer of the invitations resource with its read and its issue order.
 */
interface InvitationsSnapshot {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * Organization read.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property seq
   *
   * @description
   * Issue order of the read: a later read has a greater number.
   *
   * @type {number}
   * @readonly
   */
  readonly seq: number;

  /**
   * Property list
   *
   * @description
   * The invitations read.
   *
   * @type {InvitationList}
   * @readonly
   */
  readonly list: InvitationList;
  // #endregion
}

/**
 * Interface ConfirmedInvitation
 *
 * @description
 * A resend or a removal from the list the API confirmed, applied to the reads issued before it
 * settled.
 */
interface ConfirmedInvitation {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * The invitation.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property invitation
   *
   * @description
   * The invitation as the API answered it; null once it left the list.
   *
   * @type {PendingInvitation | null}
   * @readonly
   */
  readonly invitation: PendingInvitation | null;

  /**
   * Property at
   *
   * @description
   * Issue order of the last read issued when the write settled.
   *
   * @type {number}
   * @readonly
   */
  readonly at: number;
  // #endregion
}

/**
 * Interface InvitationsState
 *
 * @description
 * The read counter and the writes being sent or awaiting a newer read.
 */
interface InvitationsState {
  // #region Properties
  /**
   * Property _version
   *
   * @description
   * Read counter of `InvitationsRead.version`.
   *
   * @type {number}
   */
  _version: number;

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
   * Property _confirmed
   *
   * @description
   * Confirmed writes kept until a read issued after them lands.
   *
   * @type {readonly ConfirmedInvitation[]}
   */
  _confirmed: readonly ConfirmedInvitation[];

  /**
   * Property inviting
   *
   * @description
   * Whether a batch of invitations is being sent.
   *
   * @type {boolean}
   */
  inviting: boolean;

  /**
   * Property _last
   *
   * @description
   * The last answer of the current organization, kept while the next read is under way.
   *
   * @type {InvitationsSnapshot | null}
   */
  _last: InvitationsSnapshot | null;
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
   * The read of every pending invitation, idle for a person who may not manage them; a secondary
   * read whose failure stays in place.
   *
   * @type {ResourceRef<InvitationsSnapshot | undefined>}
   * @readonly
   */
  readonly invitations: ResourceRef<InvitationsSnapshot | undefined>;

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
   * Property loading
   *
   * @description
   * Whether a read is under way.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly loading: Signal<boolean>;

  /**
   * Property failed
   *
   * @description
   * Whether the last read failed.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly failed: Signal<boolean>;

  /**
   * Property items
   *
   * @description
   * Pending invitations shown, the writes included; the last ones read while a read is under way.
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
   * Reads the invitations again.
   */
  retry(): void;

  /**
   * Method invite
   *
   * @description
   * Sends a batch of invitations, then reads the list again. Success shows
   * `<n> invitations sent`; a `400` naming addresses answers them as `refused`, any other refusal
   * shows the failure toast.
   *
   * @param {readonly string[]} emails - Distinct addresses, 1 to 50.
   * @param {AssignableMemberRole} role - Role of every address.
   * @returns {Promise<InviteResult>} What became of the batch.
   */
  invite(emails: readonly string[], role: AssignableMemberRole): Promise<InviteResult>;

  /**
   * Method resend
   *
   * @description
   * Shows the invitation as sent again at once (`Expires in 7 days`) and resends it; a refusal
   * restores it with the failure toast, and an invitation answered or revoked meanwhile leaves the
   * list, which is read again.
   *
   * @param {PendingInvitation} invitation - The invitation.
   * @returns {Promise<boolean>} Whether the resend was confirmed.
   */
  resend(invitation: PendingInvitation): Promise<boolean>;

  /**
   * Method revoke
   *
   * @description
   * Hides the invitation at once and revokes it; a refusal shows it again with the failure toast,
   * and an invitation answered meanwhile leaves the list, which is read again. The server has no
   * undo, so the toast has none.
   *
   * @param {PendingInvitation} invitation - The invitation.
   * @returns {Promise<boolean>} Whether the revocation was confirmed.
   */
  revoke(invitation: PendingInvitation): Promise<boolean>;
  // #endregion
}

/**
 * Function refusedAddresses
 *
 * @description
 * The addresses of a batch a `400 request.invalid` names in its `details.issues` (`emails.<n>`).
 *
 * @param {unknown} error - The refusal.
 * @param {readonly string[]} emails - The batch sent.
 * @returns {readonly string[]} The addresses named; empty for any other refusal.
 */
function refusedAddresses(error: unknown, emails: readonly string[]): readonly string[] {
  const problem: ApiProblem | null = readProblem(error);
  if (problem?.status !== 400) return [];
  const issues: unknown = problem.details?.['issues'];
  if (!Array.isArray(issues)) return [];
  const refused: Set<string> = new Set<string>();
  for (const issue of issues as unknown[]) {
    const path: unknown =
      typeof issue === 'object' && issue !== null
        ? (issue as Record<string, unknown>)['path']
        : null;
    const match: RegExpExecArray | null = typeof path === 'string' ? EMAIL_ISSUE.exec(path) : null;
    const email: string | undefined = match ? emails[Number(match[1])] : undefined;
    if (email !== undefined) refused.add(email);
  }
  return [...refused];
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
  const writes: Pick<InvitationsState, '_resending' | '_revoking' | '_confirmed'> = {
    _resending: {},
    _revoking: [],
    _confirmed: [],
  };
  const initialState: InvitationsState = {
    ...writes,
    _version: 0,
    inviting: false,
    _last: null,
  };
  return signalStore(
    withState(initialState),
    withProps((store) => {
      const api: InvitationsApi = inject(InvitationsApi);
      const workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);
      const issued: { count: number } = { count: 0 };
      return {
        _api: api,
        _workspace: workspace,
        _toasts: inject(CwToastService),
        _issued: issued,
        invitations: resource({
          params: (): InvitationsRead | undefined =>
            workspace.can('admin')
              ? { organizationId: workspace.organization().id, version: store._version() }
              : undefined,
          loader: async ({
            params,
            abortSignal,
          }: {
            params: InvitationsRead;
            abortSignal: AbortSignal;
          }): Promise<InvitationsSnapshot> => {
            issued.count += 1;
            const seq: number = issued.count;
            const list: InvitationList = await api.list(abortSignal);
            return { organizationId: params.organizationId, seq, list };
          },
        }),
      };
    }),
    withComputed((store) => {
      const organizationId: () => string = () => store._workspace.organization().id;
      const current: Signal<InvitationsSnapshot | null> = computed(
        (): InvitationsSnapshot | null => {
          if (!store.invitations.hasValue()) return null;
          const snapshot: InvitationsSnapshot = store.invitations.value();
          return snapshot.organizationId === organizationId() ? snapshot : null;
        },
      );
      const shown: Signal<InvitationsSnapshot | null> = computed((): InvitationsSnapshot | null => {
        const fallback: InvitationsSnapshot | null = store._last();
        const snapshot: InvitationsSnapshot | null = current() ?? fallback;
        return snapshot?.organizationId === organizationId() ? snapshot : null;
      });
      const applied: Signal<{ items: readonly PendingInvitation[]; hidden: number } | null> =
        computed((): { items: readonly PendingInvitation[]; hidden: number } | null => {
          const snapshot: InvitationsSnapshot | null = shown();
          if (snapshot === null) return null;
          const confirmed: ReadonlyMap<string, ConfirmedInvitation> = new Map<
            string,
            ConfirmedInvitation
          >(
            store
              ._confirmed()
              .filter((write: ConfirmedInvitation): boolean => snapshot.seq <= write.at)
              .map((write: ConfirmedInvitation): [string, ConfirmedInvitation] => [
                write.id,
                write,
              ]),
          );
          const revoking: ReadonlySet<string> = new Set<string>(store._revoking());
          const resending: Readonly<Record<string, string>> = store._resending();
          const items: PendingInvitation[] = [];
          let hidden: number = 0;
          for (const item of snapshot.list.items) {
            const write: ConfirmedInvitation | undefined = confirmed.get(item.id);
            const invitation: PendingInvitation | null =
              write === undefined ? item : write.invitation;
            if (invitation === null || revoking.has(item.id)) {
              hidden += 1;
              continue;
            }
            items.push(
              item.id in resending
                ? { ...invitation, expired: false, expiresAt: resending[item.id] }
                : invitation,
            );
          }
          return { items, hidden };
        });
      return {
        _current: current,
        readable: computed((): boolean => store._workspace.can('admin')),
        loading: computed((): boolean => store.invitations.isLoading()),
        failed: computed((): boolean => store.invitations.status() === 'error'),
        items: computed((): readonly PendingInvitation[] => applied()?.items ?? []),
        total: computed((): number | null => {
          const snapshot: InvitationsSnapshot | null = shown();
          const view: { hidden: number } | null = applied();
          return snapshot === null || view === null
            ? null
            : Math.max(0, snapshot.list.total - view.hidden);
        }),
        pendingIds: computed(
          (): ReadonlySet<string> =>
            new Set<string>([...Object.keys(store._resending()), ...store._revoking()]),
        ),
      };
    }),
    withMethods((store) => {
      let followed: string | null = null;
      const bump: () => void = (): void => {
        patchState(store, { _version: store._version() + 1 });
      };
      const busy: (id: string) => boolean = (id: string): boolean =>
        id in store._resending() || store._revoking().includes(id);
      const confirm: (id: string, invitation: PendingInvitation | null) => void = (
        id: string,
        invitation: PendingInvitation | null,
      ): void => {
        patchState(store, {
          _confirmed: [
            ...store._confirmed().filter((item: ConfirmedInvitation): boolean => item.id !== id),
            { id, invitation, at: store._issued.count },
          ],
        });
      };
      // An invitation answered or revoked by someone else meanwhile: drop it and read again.
      const closed: (invitation: PendingInvitation) => void = (
        invitation: PendingInvitation,
      ): void => {
        confirm(invitation.id, null);
        bump();
        store._toasts.info(
          $localize`:@@organization.members.invitation-closed:This invitation is no longer pending`,
          { description: invitation.email },
        );
      };
      return {
        _onRead: signalMethod<unknown>((): void => {
          const snapshot: InvitationsSnapshot | null = store._current();
          if (snapshot !== null && snapshot !== store._last()) {
            patchState(store, { _last: snapshot });
          }
          if (snapshot === null || store.invitations.isLoading()) return;
          const stale: readonly ConfirmedInvitation[] = store
            ._confirmed()
            .filter((write: ConfirmedInvitation): boolean => snapshot.seq <= write.at);
          if (stale.length !== store._confirmed().length) patchState(store, { _confirmed: stale });
        }),

        _followOrganization: signalMethod<string>((organizationId: string): void => {
          if (followed !== null && followed !== organizationId) {
            patchState(store, { ...writes, inviting: false, _last: null });
          }
          followed = organizationId;
        }),

        retry(): void {
          bump();
        },

        async invite(emails: readonly string[], role: AssignableMemberRole): Promise<InviteResult> {
          if (!store.readable() || store.inviting() || emails.length === 0) return 'failed';
          const organization: string = store._workspace.organization().id;
          const moved: () => boolean = () => store._workspace.organization().id !== organization;
          patchState(store, { inviting: true });
          try {
            const outcome: InvitationOutcome = await store._api.invite(emails, role);
            if (moved()) return 'failed';
            bump();
            const skipped: string =
              outcome.skipped === 0
                ? ''
                : takesSingular(outcome.skipped)
                  ? $localize`:@@organization.members.invite-skipped-one:${outcome.skipped}:count: address skipped: already a member or invited.`
                  : $localize`:@@organization.members.invite-skipped:${outcome.skipped}:count: addresses skipped: already members or invited.`;
            if (outcome.invited === 0) {
              store._toasts.info(
                $localize`:@@organization.members.invite-none:No invitation sent`,
                {
                  description: skipped,
                },
              );
            } else {
              const expiry: string = $localize`:@@organization.members.invite-sent-text:They expire in 7 days.`;
              store._toasts.success(
                takesSingular(outcome.invited)
                  ? $localize`:@@organization.members.invite-sent-one:${outcome.invited}:count: invitation sent`
                  : $localize`:@@organization.members.invite-sent:${outcome.invited}:count: invitations sent`,
                { description: skipped === '' ? expiry : `${expiry} ${skipped}` },
              );
            }
            return 'sent';
          } catch (error: unknown) {
            if (moved()) return 'failed';
            const refused: readonly string[] = refusedAddresses(error, emails);
            if (refused.length > 0) return { refused };
            store._toasts.error(
              $localize`:@@organization.members.invite-failed:The invitations could not be sent`,
              hasProblemCode(error, 'invitation.daily-limit-reached')
                ? {
                    description: $localize`:@@organization.members.invite-failed-limit:The daily invitation limit is reached: try again later.`,
                  }
                : {},
            );
            return 'failed';
          } finally {
            if (!moved()) patchState(store, { inviting: false });
          }
        },

        async resend(invitation: PendingInvitation): Promise<boolean> {
          if (!store.readable() || busy(invitation.id)) return false;
          const organization: string = store._workspace.organization().id;
          const moved: () => boolean = () => store._workspace.organization().id !== organization;
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
            if (moved()) return false;
            confirm(invitation.id, updated);
            drop();
            store._toasts.success(
              $localize`:@@organization.members.invitation-resent:Invitation resent`,
              { description: invitation.email },
            );
            return true;
          } catch (error: unknown) {
            if (moved()) return false;
            drop();
            if (CLOSED_CODES.some((code: string): boolean => hasProblemCode(error, code))) {
              closed(invitation);
              return false;
            }
            const description: string | null = hasProblemCode(error, 'invitation.resend-throttled')
              ? $localize`:@@organization.members.resend-throttled:This invitation was just resent: try again in an hour.`
              : hasProblemCode(error, 'invitation.daily-limit-reached')
                ? $localize`:@@organization.members.resend-failed-limit:The daily invitation limit is reached: try again later.`
                : null;
            store._toasts.error(
              $localize`:@@organization.members.resend-failed:The invitation could not be resent`,
              description === null ? {} : { description },
            );
            return false;
          }
        },

        async revoke(invitation: PendingInvitation): Promise<boolean> {
          if (!store.readable() || busy(invitation.id)) return false;
          const organization: string = store._workspace.organization().id;
          const moved: () => boolean = () => store._workspace.organization().id !== organization;
          patchState(store, { _revoking: [...store._revoking(), invitation.id] });
          const drop: () => void = (): void => {
            patchState(store, {
              _revoking: store._revoking().filter((id: string): boolean => id !== invitation.id),
            });
          };
          try {
            await store._api.revoke(invitation.id);
            if (moved()) return false;
            confirm(invitation.id, null);
            drop();
            store._toasts.success(
              $localize`:@@organization.members.invitation-cancelled:Invitation cancelled`,
              { description: invitation.email },
            );
            return true;
          } catch (error: unknown) {
            if (moved()) return false;
            drop();
            if (CLOSED_CODES.some((code: string): boolean => hasProblemCode(error, code))) {
              closed(invitation);
              return false;
            }
            store._toasts.error(
              $localize`:@@organization.members.cancel-failed:The invitation could not be cancelled`,
            );
            return false;
          }
        },
      };
    }),
    withHooks({
      onInit(store): void {
        store._onRead(computed((): unknown => [store._current(), store.invitations.isLoading()]));
        store._followOrganization(computed((): string => store._workspace.organization().id));
      },
    }),
  );
}

/**
 * Constant InvitationsStore
 *
 * @description
 * The pending invitations of the members section, provided by `MembersPage` and tied to the
 * workspace organization: a switch drops the writes, and a write that settles after it changes
 * nothing. Only an owner or an administrator reads them, every page of them; for anyone else the
 * read stays idle. Resend and cancel are optimistic: the row changes at once, a refusal restores
 * it with the failure toast, and a confirmed write is applied to every read issued before it
 * settled, until a read issued after it lands. Inviting reads the list again, even while a read
 * is under way.
 *
 * @type {Type<InvitationsStoreInstance>}
 */
export const InvitationsStore: Type<InvitationsStoreInstance> = createInvitationsStore();
