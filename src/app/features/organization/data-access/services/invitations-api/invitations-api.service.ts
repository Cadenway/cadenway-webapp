import { inject, Service } from '@angular/core';
import {
  type Invitation,
  type InvitationBatchResult,
  type InvitationPage,
  InvitationsService,
} from '@cadenway/api-client';
import { firstValueFrom, fromEvent, type Observable, takeUntil } from 'rxjs';

import type {
  InvitationList,
  InvitationOutcome,
  InvitationStanding,
  PendingInvitation,
} from '../../../models/invitation/invitation.interface';
import type { AssignableMemberRole } from '../../../models/member/member.interface';
import {
  type InvitationStateDto,
  toInvitationList,
  toInvitationOutcome,
  toInvitationStanding,
  toPendingInvitation,
} from '../../adapters/invitation/invitation.adapter';

/**
 * Constant PAGE_LIMIT
 *
 * @description
 * Invitations read per page, the largest the contract accepts.
 *
 * @type {number}
 */
const PAGE_LIMIT: number = 100;

/**
 * Function abortable
 *
 * @description
 * Reads the first value of a request, given up when the signal aborts.
 *
 * @template T
 * @param {Observable<T>} source - Request of the generated client.
 * @param {AbortSignal} [signal] - Abort signal of the resource.
 * @returns {Promise<T>} The answer.
 */
function abortable<T>(source: Observable<T>, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  return firstValueFrom(signal ? source.pipe(takeUntil(fromEvent(signal, 'abort'))) : source);
}

/**
 * Service InvitationsApi
 *
 * @description
 * The organization feature's access to the invitations of the current organization, mapped to
 * display models. Every operation is owner and administrator only. Core's `OrganizationPin` adds
 * `If-Organization-Match` to each of them.
 */
@Service()
export class InvitationsApi {
  // #region Properties
  /**
   * Property invitations
   *
   * @description
   * Generated invitations operations.
   *
   * @type {InvitationsService}
   * @readonly
   */
  private readonly invitations: InvitationsService = inject(InvitationsService);
  // #endregion

  // #region Methods
  /**
   * Method list
   *
   * @description
   * Reads every pending invitation, expired ones included, the most recently sent first, following
   * the cursor page after page. Aborting the signal stops between pages and rejects.
   *
   * @param {AbortSignal} [signal] - Abort signal of the resource.
   * @returns {Promise<InvitationList>} The invitations and their total.
   */
  public async list(signal?: AbortSignal): Promise<InvitationList> {
    const items: PendingInvitation[] = [];
    let cursor: string | null = null;
    let total: number;
    do {
      const page: InvitationPage = await abortable(
        this.invitations.listInvitations({
          limit: PAGE_LIMIT,
          ...(cursor === null ? {} : { cursor }),
        }),
        signal,
      );
      const list: InvitationList = toInvitationList(page);
      items.push(...list.items);
      total = list.total;
      cursor = page.nextCursor ?? null;
    } while (cursor !== null);
    return { items, total };
  }

  /**
   * Method invite
   *
   * @description
   * Invites addresses with one role, under the batch's `Idempotency-Key`. The key is scoped to the
   * organization, the person and this operation: the same key with the same body replays the
   * original `200` for 24 hours without sending again, so send it again after an unknown outcome;
   * another body under it answers `422 idempotency.key-reused`, an equivalent request still running
   * `409 idempotency.request-in-progress`, and `503 upstream.unavailable` (with `Retry-After`) while
   * the serving release cannot replay keyed batches yet, nothing being run. Rejects with
   * `429 invitation.daily-limit-reached` when the batch exceeds the daily allowance, nothing being
   * sent and nothing stored, so the same key may run again.
   *
   * @param {readonly string[]} emails - Distinct addresses, 1 to 50.
   * @param {AssignableMemberRole} role - Role of every address.
   * @param {string} idempotencyKey - Key of this body (`Idempotency-Key`, 1 to 255 characters).
   * @returns {Promise<InvitationOutcome>} How many were invited and skipped, and the addresses
   * not sent.
   */
  public async invite(
    emails: readonly string[],
    role: AssignableMemberRole,
    idempotencyKey: string,
  ): Promise<InvitationOutcome> {
    const result: InvitationBatchResult = await firstValueFrom(
      this.invitations.inviteMembers(
        { emails: [...emails], role },
        { headers: { 'Idempotency-Key': idempotencyKey } },
      ),
    );
    return toInvitationOutcome(result, emails);
  }

  /**
   * Method standing
   *
   * @description
   * Reads one invitation in any state of its lifecycle (`getInvitation`), to settle a resend or a
   * cancellation of unknown outcome. The answer is `Cache-Control: private, no-store` and is never
   * kept here: each call is a fresh read. Rejects with `404 invitation.not-found` when the
   * organization holds no such invitation; aborting the signal gives the read up and rejects.
   *
   * @param {string} invitationId - The invitation.
   * @param {AbortSignal} [signal] - Abort signal of the write being settled.
   * @returns {Promise<InvitationStanding>} Where the invitation stands now.
   */
  public async standing(invitationId: string, signal?: AbortSignal): Promise<InvitationStanding> {
    const state: InvitationStateDto = await abortable(
      this.invitations.getInvitation(invitationId),
      signal,
    );
    return toInvitationStanding(state);
  }

  /**
   * Method resend
   *
   * @description
   * Sends an invitation again and starts its 7 days again. Rejects with
   * `429 invitation.resend-throttled` within an hour of its last sending.
   *
   * @param {string} invitationId - The invitation.
   * @returns {Promise<PendingInvitation>} The invitation as the API now holds it.
   */
  public async resend(invitationId: string): Promise<PendingInvitation> {
    const invitation: Invitation = await firstValueFrom(
      this.invitations.resendInvitation(invitationId, {}),
    );
    return toPendingInvitation(invitation);
  }

  /**
   * Method revoke
   *
   * @description
   * Revokes a pending invitation; revoking it again succeeds too.
   *
   * @param {string} invitationId - The invitation.
   * @returns {Promise<void>} Resolves once revoked.
   */
  public async revoke(invitationId: string): Promise<void> {
    await firstValueFrom(this.invitations.revokeInvitation(invitationId), {
      defaultValue: undefined,
    });
  }
  // #endregion
}
