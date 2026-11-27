import { formatDate } from '@angular/common';
import {
  Component,
  inject,
  input,
  type InputSignal,
  LOCALE_ID,
  output,
  type OutputEmitterRef,
} from '@angular/core';
import { CwButton } from '@cadenway/ui/components/button';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import {
  CwTable,
  CwTableBody,
  CwTableCell,
  CwTableContainer,
  CwTableEmpty,
  CwTableRow,
} from '@cadenway/ui/components/table';
import { NgIcon } from '@ng-icons/core';

import type { PendingInvitation } from '../../../models/invitation/invitation.interface';
import { memberRoleLabel } from '../../../models/member/member-role-label.util';

/**
 * Constant DAY_MS
 *
 * @description
 * Milliseconds in a day.
 *
 * @type {number}
 */
const DAY_MS: number = 24 * 60 * 60 * 1000;

/**
 * Component InvitationsList
 *
 * @description
 * The section `Pending invitations <n>` of the members page (`Organisation.dc.html` lines
 * 281-296): one row per invitation with its address, `Invited by <name>`, its role, `Expires in
 * <n> days` or, in grenat with a warning icon, `Expired on <date>`, then `Resend` and `Cancel`,
 * disabled while a write of the row is sent. `No pending invitation.` when there is none; a
 * failed read shows an inline error with `Retry`. Below 768 px each row becomes a card.
 * Presentational: every action is emitted; the dates follow `LOCALE_ID`.
 */
@Component({
  selector: 'cw-invitations-list',
  imports: [
    CwButton,
    CwSkeleton,
    CwTable,
    CwTableBody,
    CwTableCell,
    CwTableContainer,
    CwTableEmpty,
    CwTableRow,
    NgIcon,
  ],
  host: { class: 'flex flex-col gap-3' },
  templateUrl: './invitations-list.component.html',
})
export class InvitationsList {
  // #region Properties
  /**
   * Property invitations
   *
   * @description
   * Pending invitations shown.
   *
   * @type {InputSignal<readonly PendingInvitation[]>}
   * @readonly
   */
  public readonly invitations: InputSignal<readonly PendingInvitation[]> = input<
    readonly PendingInvitation[]
  >([]);

  /**
   * Property total
   *
   * @description
   * Pending invitations of the organization, shown after the title; null hides it.
   *
   * @type {InputSignal<number | null>}
   * @readonly
   */
  public readonly total: InputSignal<number | null> = input<number | null>(null);

  /**
   * Property pendingIds
   *
   * @description
   * Invitations whose resend or cancellation is being sent.
   *
   * @type {InputSignal<ReadonlySet<string>>}
   * @readonly
   */
  public readonly pendingIds: InputSignal<ReadonlySet<string>> = input<ReadonlySet<string>>(
    new Set<string>(),
  );

  /**
   * Property loading
   *
   * @description
   * Whether the read is under way.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly loading: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property failed
   *
   * @description
   * Whether the read failed.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly failed: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property resent
   *
   * @description
   * Emits the invitation whose `Resend` was pressed.
   *
   * @type {OutputEmitterRef<PendingInvitation>}
   * @readonly
   */
  public readonly resent: OutputEmitterRef<PendingInvitation> = output<PendingInvitation>();

  /**
   * Property cancelled
   *
   * @description
   * Emits the invitation whose `Cancel` was pressed.
   *
   * @type {OutputEmitterRef<PendingInvitation>}
   * @readonly
   */
  public readonly cancelled: OutputEmitterRef<PendingInvitation> = output<PendingInvitation>();

  /**
   * Property retried
   *
   * @description
   * Emits on the `Retry` of a failed read.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly retried: OutputEmitterRef<void> = output();

  /**
   * Property locale
   *
   * @description
   * Locale of the expiry dates.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);
  // #endregion

  // #region Methods
  /**
   * Method invitedBy
   *
   * @description
   * `Invited by <name>`.
   *
   * @param {PendingInvitation} invitation - The invitation.
   * @returns {string} The line.
   */
  protected invitedBy(invitation: PendingInvitation): string {
    return $localize`:@@organization.members.invited-by:Invited by ${invitation.invitedBy}:name:`;
  }

  /**
   * Method roleName
   *
   * @description
   * Name of the invitation's role.
   *
   * @param {PendingInvitation} invitation - The invitation.
   * @returns {string} The role's name.
   */
  protected roleName(invitation: PendingInvitation): string {
    return memberRoleLabel(invitation.role);
  }

  /**
   * Method expiry
   *
   * @description
   * `Expires in <n> days` (whole days left, rounded up, at least one) or `Expired on <date>`.
   *
   * @param {PendingInvitation} invitation - The invitation.
   * @returns {string} The line.
   */
  protected expiry(invitation: PendingInvitation): string {
    if (invitation.expired) {
      const date: string = formatDate(invitation.expiresAt, 'd MMM', this.locale);
      return $localize`:@@organization.members.expired-on:Expired on ${date}:date:`;
    }
    const days: number = Math.max(
      1,
      Math.ceil((Date.parse(invitation.expiresAt) - Date.now()) / DAY_MS),
    );
    return days === 1
      ? $localize`:@@organization.members.expires-in-one:Expires in 1 day`
      : $localize`:@@organization.members.expires-in:Expires in ${days}:count: days`;
  }
  // #endregion
}
