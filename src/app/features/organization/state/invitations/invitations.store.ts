import {
  computed,
  DestroyRef,
  inject,
  resource,
  type ResourceRef,
  type Signal,
  type Type,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import type { Subscription } from 'rxjs';

import {
  type ApiProblem,
  hasProblemCode,
  isDroppedOrganizationWrite,
  isUnknownWriteOutcome,
  OrganizationPin,
  readProblem,
} from '@core/api';
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
import { MembersStore } from '../members/members.store';
import { SubscriptionStore } from '../subscription/subscription.store';
import { INVITATION_SETTLE_DELAYS_MS } from './invitation-settle-delays.token';

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
 * What became of a batch: `sent` (every address is done), `failed` (a definite refusal, the toast
 * told why), `dropped` (the organization changed or the gateway refused the request for another
 * session organization: nothing is said), the addresses the API refused as invalid, which the
 * dialog shows on its field, or the addresses `kept` for another send (the outcome is unknown, or
 * the batch answered them with an outcome that sent nothing), which the dialog keeps; `uncertain`
 * when the outcome is unknown, so the role they may already have been invited with stays.
 *
 * @type {'sent' | 'failed' | 'dropped' | { readonly refused: readonly string[] } | { readonly kept: readonly string[]; readonly uncertain: boolean }}
 */
export type InviteResult =
  | 'sent'
  | 'failed'
  | 'dropped'
  | { readonly refused: readonly string[] }
  | { readonly kept: readonly string[]; readonly uncertain: boolean };

/**
 * Interface WriteFence
 *
 * @description
 * Binds a write to the organization shown when it starts: once another organization is committed
 * (`OrganizationPin.organizationChanges`) while the write is pending, it stays moved, a switch
 * away and back included, so its answer changes nothing.
 */
interface WriteFence {
  // #region Methods
  /**
   * Method moved
   *
   * @description
   * Whether another organization was committed since the write started, or is shown now.
   *
   * @returns {boolean} Whether the answer belongs to another organization.
   */
  moved(): boolean;

  /**
   * Method release
   *
   * @description
   * Stops listening to the organization changes once the write settled.
   */
  release(): void;
  // #endregion
}

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
   * `<n> invitations sent`; addresses the batch answered with an outcome that sent nothing are
   * `kept` with `<n> addresses could not be invited`; an unknown outcome (no answer, `408`, `5xx`,
   * `409 idempotency.request-in-progress`) keeps every address with
   * `The invitations may not have been sent`, since sending again is safe; a `400` naming addresses
   * answers them as `refused`; any other refusal shows the failure toast. A batch whose
   * organization changed while it was pending (a switch away and back included), or which the
   * gateway refused for another session organization, ends `dropped` with no toast.
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
   * list, which is read again. An unknown outcome is never resent (a second resend within the hour
   * is throttled): the row stays shown as resent and busy while the list is read after each wait of
   * `INVITATION_SETTLE_DELAYS_MS`, until the invitation itself shows a new expiry (resent); a read
   * that does not meet it proves nothing. After the last wait it is restored, the invitations,
   * members and seats are read again, and the toast says the invitation may not have been resent
   * and points at the lists. A later resend answered `429 invitation.resend-throttled` proves
   * nothing (the original invitation throttles too): the list is read, and it counts as resent
   * only when it shows another expiry than before the unknown resend, else the warning says the
   * invitation may not have been resent, with the throttle as description. A dropped resend (organization changed, a switch away and back included, refused for
   * another session organization, or the page gone) says nothing.
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
   * undo, so the toast has none. An unknown outcome keeps it hidden and busy and revokes again after
   * each wait of `INVITATION_SETTLE_DELAYS_MS` (revoking again answers `204`). Once an attempt
   * was unknown, a later refusal, or every attempt staying unknown, is not taken as a failure: the
   * row shows again with the warning that it may not have been cancelled and points at the lists,
   * which are read again with the members and seats; its absence from a read claims nothing (the
   * list is paged by cursor and cannot tell why an invitation left it). Outcomes come only from the
   * API's own answers: `Invitation cancelled` from a revoke that succeeded, accepted or declined
   * from `409 invitation.answered` and its `details.status`. A dropped revocation says nothing.
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
        _pin: inject(OrganizationPin),
        _members: inject(MembersStore, { optional: true }),
        _subscription: inject(SubscriptionStore, { optional: true }),
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
      const delays: readonly number[] = inject(INVITATION_SETTLE_DELAYS_MS);
      const destroyRef: DestroyRef = inject(DestroyRef);
      // Waits end early once the page is gone, so nothing is sent or read for it afterwards.
      const timers: Set<() => void> = new Set<() => void>();
      destroyRef.onDestroy((): void => {
        for (const stop of [...timers]) stop();
      });
      const wait: (ms: number) => Promise<void> = (ms: number): Promise<void> =>
        new Promise<void>((resolve: () => void): void => {
          const stop: () => void = (): void => {
            clearTimeout(timer);
            timers.delete(stop);
            resolve();
          };
          const timer: ReturnType<typeof setTimeout> = setTimeout(stop, ms);
          timers.add(stop);
        });
      // Invitations whose last resend ended with an unknown outcome, with the expiry the API held
      // before it: only a list showing another expiry proves a resend went out.
      const uncertainResends: Map<string, string> = new Map<string, string>();
      // The invitation as one read of the list shows it; undefined when the read failed or did not
      // meet it. Its absence proves nothing: the list is paged by cursor, most recent first, and
      // another resend can move an invitation ahead of the cursor between two pages.
      const readInvitation: (id: string) => Promise<PendingInvitation | undefined> = async (
        id: string,
      ): Promise<PendingInvitation | undefined> => {
        try {
          const list: InvitationList = await store._api.list();
          return list.items.find((item: PendingInvitation): boolean => item.id === id);
        } catch {
          return undefined;
        }
      };
      // Where an invitation of unknown outcome stands is left to the lists, read again.
      const standing: (email: string) => string = (email: string): string =>
        $localize`:@@organization.members.invitation-unsettled-text:The pending invitations and the members show where the invitation to ${email}:email: stands.`;
      // An invitee may have joined: the page's members and, for the owner, the seats are read again.
      const refreshMembers: () => void = (): void => {
        store._members?.retry();
        if (store._workspace.role() === 'owner') store._subscription?.retry();
      };
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
      // Bound to the organization shown when the write starts. The flag is set once another
      // organization is committed and never cleared, so a switch away and back while the write is
      // pending still drops its answer, which a comparison of the current ids alone would let
      // through.
      const fence: () => WriteFence = (): WriteFence => {
        const organization: string = store._workspace.organization().id;
        let switched: boolean = false;
        const changes: Subscription = store._pin.organizationChanges.subscribe((): void => {
          switched = true;
        });
        return {
          moved: (): boolean => switched || store._workspace.organization().id !== organization,
          release: (): void => {
            changes.unsubscribe();
          },
        };
      };
      const leave: () => void = (): void => {
        uncertainResends.clear();
        patchState(store, { ...writes, inviting: false, _last: null });
      };
      const skippedLine: (count: number) => string = (count: number): string =>
        takesSingular(count)
          ? $localize`:@@organization.members.invite-skipped-one:${count}:count: address skipped: already a member or invited.`
          : $localize`:@@organization.members.invite-skipped:${count}:count: addresses skipped: already members or invited.`;
      const toastOutcome: (outcome: InvitationOutcome) => void = (
        outcome: InvitationOutcome,
      ): void => {
        const skipped: string = outcome.skipped === 0 ? '' : skippedLine(outcome.skipped);
        if (outcome.invited === 0) {
          store._toasts.info($localize`:@@organization.members.invite-none:No invitation sent`, {
            description: skipped,
          });
          return;
        }
        const expiry: string = $localize`:@@organization.members.invite-sent-text:They expire in 7 days.`;
        store._toasts.success(
          takesSingular(outcome.invited)
            ? $localize`:@@organization.members.invite-sent-one:${outcome.invited}:count: invitation sent`
            : $localize`:@@organization.members.invite-sent:${outcome.invited}:count: invitations sent`,
          { description: skipped === '' ? expiry : `${expiry} ${skipped}` },
        );
      };
      // A batch that left addresses unsent: the invited ones when there are some, then one failure
      // summary, which counts the skipped addresses when none was invited, so none goes unsaid.
      const toastKept: (outcome: InvitationOutcome, kept: number) => void = (
        outcome: InvitationOutcome,
        kept: number,
      ): void => {
        if (outcome.invited > 0) toastOutcome(outcome);
        const lines: string[] = [];
        if (outcome.invited === 0 && outcome.skipped > 0) lines.push(skippedLine(outcome.skipped));
        lines.push(
          $localize`:@@organization.members.invite-not-sent-text:The addresses stay in the list: press Invite to try again.`,
        );
        store._toasts.error(
          takesSingular(kept)
            ? $localize`:@@organization.members.invite-not-sent-one:${kept}:count: address could not be invited`
            : $localize`:@@organization.members.invite-not-sent:${kept}:count: addresses could not be invited`,
          { description: lines.join(' ') },
        );
      };
      return {
        _leaveOrganization: leave,

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
          if (followed !== null && followed !== organizationId) leave();
          followed = organizationId;
        }),

        retry(): void {
          bump();
        },

        async invite(emails: readonly string[], role: AssignableMemberRole): Promise<InviteResult> {
          if (!store.readable() || store.inviting() || emails.length === 0) return 'failed';
          const write: WriteFence = fence();
          patchState(store, { inviting: true });
          try {
            const outcome: InvitationOutcome = await store._api.invite(emails, role);
            if (write.moved()) return 'dropped';
            bump();
            const unsent: ReadonlySet<string> = new Set<string>(
              outcome.notSent.map((email: string): string => email.toLowerCase()),
            );
            let kept: readonly string[] = emails.filter((email: string): boolean =>
              unsent.has(email.toLowerCase()),
            );
            if (kept.length === 0) kept = outcome.notSent;
            if (kept.length === 0) {
              toastOutcome(outcome);
              return 'sent';
            }
            toastKept(outcome, kept.length);
            return { kept, uncertain: false };
          } catch (error: unknown) {
            if (write.moved() || isDroppedOrganizationWrite(error)) return 'dropped';
            const refused: readonly string[] = refusedAddresses(error, emails);
            if (refused.length > 0) return { refused };
            if (isUnknownWriteOutcome(error)) {
              // Some may have gone out: the list is read again, and a second send answers
              // `already-invited` for an address the first one reached.
              bump();
              store._toasts.warning(
                $localize`:@@organization.members.invite-uncertain:The invitations may not have been sent`,
                {
                  description: $localize`:@@organization.members.invite-uncertain-text:Sending again is safe.`,
                },
              );
              return { kept: emails, uncertain: true };
            }
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
            write.release();
            // A moved write's state was reset with the organization change, and another send may
            // have started since.
            if (!write.moved()) patchState(store, { inviting: false });
          }
        },

        async resend(invitation: PendingInvitation): Promise<boolean> {
          if (!store.readable() || busy(invitation.id)) return false;
          const write: WriteFence = fence();
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
          const live: () => boolean = (): boolean => !write.moved() && !destroyRef.destroyed;
          // The expiry before the first resend whose outcome is unknown: only the API's list
          // showing another one proves a resend went out.
          const before: string = uncertainResends.get(invitation.id) ?? invitation.expiresAt;
          const resent: (updated: PendingInvitation) => true = (
            updated: PendingInvitation,
          ): true => {
            uncertainResends.delete(invitation.id);
            confirm(invitation.id, updated);
            drop();
            store._toasts.success(
              $localize`:@@organization.members.invitation-resent:Invitation resent`,
              { description: invitation.email },
            );
            return true;
          };
          // No answer of the API settled it: the lists are read again (the invitee may have joined)
          // and nothing is claimed.
          const unsettled: (description: string) => false = (description: string): false => {
            drop();
            bump();
            refreshMembers();
            store._toasts.warning(
              $localize`:@@organization.members.resend-uncertain:The invitation may not have been resent`,
              { description },
            );
            return false;
          };
          try {
            const updated: PendingInvitation = await store._api.resend(invitation.id);
            if (write.moved()) return false;
            return resent(updated);
          } catch (error: unknown) {
            if (write.moved()) return false;
            if (isUnknownWriteOutcome(error)) {
              // Never sent again (a second resend within the hour is refused): the row stays shown
              // as resent and busy while the list is read after each wait, until the invitation
              // itself shows another expiry. One read right away could still return the list from
              // before the resend, and a read that does not meet the invitation proves nothing.
              uncertainResends.set(invitation.id, before);
              for (const ms of delays) {
                await wait(ms);
                if (!live()) return false;
                const found: PendingInvitation | undefined = await readInvitation(invitation.id);
                if (!live()) return false;
                if (found !== undefined && found.expiresAt !== before) return resent(found);
              }
              return unsettled(standing(invitation.email));
            }
            // A throttle after a resend of unknown outcome proves nothing: the original invitation
            // or an earlier resend within the hour is throttled too. Only the invitation listed
            // with another expiry tells.
            if (
              uncertainResends.has(invitation.id) &&
              hasProblemCode(error, 'invitation.resend-throttled')
            ) {
              const found: PendingInvitation | undefined = await readInvitation(invitation.id);
              if (!live()) return false;
              if (found !== undefined && found.expiresAt !== before) return resent(found);
              return unsettled(
                $localize`:@@organization.members.resend-throttled:This invitation was just resent: try again in an hour.`,
              );
            }
            drop();
            if (isDroppedOrganizationWrite(error)) return false;
            if (CLOSED_CODES.some((code: string): boolean => hasProblemCode(error, code))) {
              uncertainResends.delete(invitation.id);
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
          } finally {
            write.release();
          }
        },

        async revoke(invitation: PendingInvitation): Promise<boolean> {
          if (!store.readable() || busy(invitation.id)) return false;
          const write: WriteFence = fence();
          patchState(store, { _revoking: [...store._revoking(), invitation.id] });
          const drop: () => void = (): void => {
            patchState(store, {
              _revoking: store._revoking().filter((id: string): boolean => id !== invitation.id),
            });
          };
          const live: () => boolean = (): boolean => !write.moved() && !destroyRef.destroyed;
          const cancelled: () => true = (): true => {
            confirm(invitation.id, null);
            drop();
            store._toasts.success(
              $localize`:@@organization.members.invitation-cancelled:Invitation cancelled`,
              { description: invitation.email },
            );
            return true;
          };
          // `409 invitation.answered` with `details.status`: the invitee answered before the
          // cancellation could be applied, so it was not cancelled. Accepting made them a member.
          const answered: (status: unknown) => false = (status: unknown): false => {
            confirm(invitation.id, null);
            drop();
            if (status === 'accepted') {
              refreshMembers();
              store._toasts.info(
                $localize`:@@organization.members.cancel-accepted:The invitation was accepted before it could be cancelled`,
                {
                  description: $localize`:@@organization.members.cancel-accepted-text:${invitation.email}:email: is now a member of the organization.`,
                },
              );
            } else {
              bump();
              store._toasts.info(
                $localize`:@@organization.members.cancel-refused:The invitation was declined before it could be cancelled`,
                { description: invitation.email },
              );
            }
            return false;
          };
          // No answer of the API settled it: the row shows again, the lists are read again (the
          // invitee may have joined) and nothing is claimed.
          const unsettled: () => false = (): false => {
            drop();
            bump();
            refreshMembers();
            store._toasts.warning(
              $localize`:@@organization.members.cancel-uncertain:The invitation may not have been cancelled`,
              { description: standing(invitation.email) },
            );
            return false;
          };
          // Set once an attempt ended with an unknown outcome: that attempt may have revoked it,
          // so a later refusal is not the cancellation's failure.
          let uncertain: boolean = false;
          try {
            // Revoking again answers `204`, so a cancellation of unknown outcome is sent again
            // after each wait while the row stays hidden and busy; one read right away could
            // still return the list from before it.
            for (let attempt: number = 0; attempt <= delays.length; attempt += 1) {
              try {
                await store._api.revoke(invitation.id);
                if (write.moved()) return false;
                return cancelled();
              } catch (error: unknown) {
                if (write.moved()) return false;
                if (isUnknownWriteOutcome(error)) uncertain = true;
                if (isUnknownWriteOutcome(error) && attempt < delays.length) {
                  await wait(delays[attempt]);
                  if (!live()) return false;
                  continue;
                }
                if (isDroppedOrganizationWrite(error)) {
                  drop();
                  return false;
                }
                if (CLOSED_CODES.some((code: string): boolean => hasProblemCode(error, code))) {
                  // `409 invitation.answered` says which answer in `details.status`.
                  const status: unknown = readProblem(error)?.details?.['status'];
                  if (
                    hasProblemCode(error, 'invitation.answered') &&
                    (status === 'accepted' || status === 'refused')
                  ) {
                    return answered(status);
                  }
                  drop();
                  closed(invitation);
                  return false;
                }
                // An earlier attempt may have revoked it, and no read of the lists can tell: only
                // the API's own answer may say cancelled, accepted or declined.
                if (uncertain) return unsettled();
                drop();
                store._toasts.error(
                  $localize`:@@organization.members.cancel-failed:The invitation could not be cancelled`,
                );
                return false;
              }
            }
            return false;
          } finally {
            write.release();
          }
        },
      };
    }),
    withHooks({
      onInit(store): void {
        store._onRead(computed((): unknown => [store._current(), store.invitations.isLoading()]));
        store._followOrganization(computed((): string => store._workspace.organization().id));
        // A committed organization change resets the writes at once, before the workspace
        // context reaches this store, so a switch away and back leaves nothing behind.
        store._pin.organizationChanges.pipe(takeUntilDestroyed()).subscribe((): void => {
          store._leaveOrganization();
        });
      },
    }),
  );
}

/**
 * Constant InvitationsStore
 *
 * @description
 * The pending invitations of the members section, provided by `MembersPage` and tied to the
 * workspace organization: a switch (the workspace's, or a commit of `OrganizationPin`) drops the
 * writes, and a write pending through a switch, a switch away and back included, changes nothing
 * and says nothing when it settles; so does one the gateway refused for another session
 * organization. Only an owner or an administrator reads them, every page of them; for anyone else
 * the read stays idle. Resend and cancel are optimistic: the row changes at once, a refusal
 * restores it with the failure toast, an unknown outcome is settled with bounded waits (a
 * cancellation sent again, a resend checked by reading the list) before a warning, and a
 * confirmed write is applied to every read issued before it settled, until
 * a read issued after it lands. Inviting reads the list again, even while a read is under way; an
 * unknown outcome is never reported as a failure.
 *
 * @type {Type<InvitationsStoreInstance>}
 */
export const InvitationsStore: Type<InvitationsStoreInstance> = createInvitationsStore();
