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
  PendingInvitation,
} from '../../../models/invitation/invitation.interface';
import type { AssignableMemberRole } from '../../../models/member/member.interface';
import {
  toInvitationList,
  toInvitationOutcome,
  toPendingInvitation,
} from '../../adapters/invitation/invitation.adapter';

/**
 * Constant LIST_LIMIT
 *
 * @description
 * Invitations read for the list: the most recent 100, the largest page; `total` counts them all.
 *
 * @type {number}
 */
const LIST_LIMIT: number = 100;

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
 * display models. Every operation is owner and administrator only.
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
   * Reads the pending invitations, expired ones included, the most recently sent first.
   *
   * @param {AbortSignal} [signal] - Abort signal of the resource.
   * @returns {Promise<InvitationList>} The invitations and their total.
   */
  public async list(signal?: AbortSignal): Promise<InvitationList> {
    const page: InvitationPage = await abortable(
      this.invitations.listInvitations({ limit: LIST_LIMIT }),
      signal,
    );
    return toInvitationList(page);
  }

  /**
   * Method invite
   *
   * @description
   * Invites addresses with one role. Rejects with `429 invitation.daily-limit-reached` when the
   * batch exceeds the daily allowance, nothing being sent.
   *
   * @param {readonly string[]} emails - Distinct addresses, 1 to 50.
   * @param {AssignableMemberRole} role - Role of every address.
   * @returns {Promise<InvitationOutcome>} How many were invited and skipped.
   */
  public async invite(
    emails: readonly string[],
    role: AssignableMemberRole,
  ): Promise<InvitationOutcome> {
    const result: InvitationBatchResult = await firstValueFrom(
      this.invitations.inviteMembers({ emails: [...emails], role }),
    );
    return toInvitationOutcome(result);
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
