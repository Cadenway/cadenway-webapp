import {
  Component,
  computed,
  inject,
  type Signal,
  signal,
  type WritableSignal,
} from '@angular/core';
import {
  CwAlertDialog,
  CwAlertDialogAction,
  CwAlertDialogCancel,
  CwAlertDialogDescription,
  CwAlertDialogMedia,
  CwAlertDialogTitle,
  provideCwAlertDialogLabels,
} from '@cadenway/ui/components/alert-dialog';
import { provideCwAvatarLabels } from '@cadenway/ui/components/avatar';
import { CwButton } from '@cadenway/ui/components/button';
import { provideCwDialogLabels } from '@cadenway/ui/components/dialog';
import {
  CwEmpty,
  CwEmptyContent,
  CwEmptyDescription,
  CwEmptyHeader,
  CwEmptyMedia,
  CwEmptyTitle,
} from '@cadenway/ui/components/empty';
import { provideCwSelectLabels } from '@cadenway/ui/components/select';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { NgIcon } from '@ng-icons/core';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import type {
  MemberPage,
  MemberRoleCounts,
  MemberRow,
} from '../../../models/member/member.interface';
import type { OrganizationSubscription } from '../../../models/organization-subscription/organization-subscription.interface';
import { InvitationsStore } from '../../../state/invitations/invitations.store';
import { MembersStore } from '../../../state/members/members.store';
import { SubscriptionStore } from '../../../state/subscription/subscription.store';
import { planName } from '../../../utils/plan-label';
import { InvitationsList } from '../../components/invitations-list/invitations-list.component';
import {
  type MemberRoleChange,
  MembersTable,
} from '../../components/members-table/members-table.component';
import { MembersToolbar } from '../../components/members-toolbar/members-toolbar.component';
import {
  InviteDialog,
  type InviteRequest,
} from '../../dialogs/invite-dialog/invite-dialog.component';

/**
 * Component MembersPage
 *
 * @description
 * The organization settings section `Members` (`Organisation.dc.html` lines 226-316, the phone
 * version `OrganisationMobile.dc.html`): the title with the summary (`18 members and 3 guests ·
 * 7 free seats · 3 pending invitations`) and `Invite members`, the toolbar, the members table with
 * its pagination, and `Pending invitations`. Everyone from a member up reads the list; the owner
 * and administrators (`WORKSPACE_CONTEXT.can('admin')`) also change roles, remove members after
 * the confirmation `Remove <name> from the organization?`, invite, and see the pending
 * invitations and the `Two-step` column, which the API gives them only. Members see a read-only
 * view. The free seats show to the owner only, who alone reads billing (gap Q1); the last
 * activity column (gap M1) and the invitation link card (B12) have no contract and are left out.
 * States: the section skeleton until the first read resolves; a failed first read throws into the
 * route's error boundary (`Could not load this section`, whose Retry runs the route again); a
 * later failed read shows the same panel in place with `Retry`. Provides its page-scoped
 * `MembersStore` and `InvitationsStore`, and the English texts of the bricks it renders.
 */
@Component({
  selector: 'cw-members-page',
  imports: [
    CwAlertDialog,
    CwAlertDialogAction,
    CwAlertDialogCancel,
    CwAlertDialogDescription,
    CwAlertDialogMedia,
    CwAlertDialogTitle,
    CwButton,
    CwEmpty,
    CwEmptyContent,
    CwEmptyDescription,
    CwEmptyHeader,
    CwEmptyMedia,
    CwEmptyTitle,
    CwSkeleton,
    InvitationsList,
    InviteDialog,
    MembersTable,
    MembersToolbar,
    NgIcon,
  ],
  providers: [
    MembersStore,
    InvitationsStore,
    provideCwAvatarLabels(() => ({
      unknown: $localize`:@@organization.members.avatar-unknown:Unknown user`,
      online: $localize`:@@organization.members.avatar-online:online`,
      away: $localize`:@@organization.members.avatar-away:away`,
      dnd: $localize`:@@organization.members.avatar-dnd:do not disturb`,
      invisible: $localize`:@@organization.members.avatar-offline:offline`,
      disabled: $localize`:@@organization.members.avatar-disabled:disabled`,
      group: $localize`:@@organization.members.avatar-group:Members`,
      othersPrefix: $localize`:@@organization.members.avatar-others:and`,
      add: $localize`:@@organization.members.avatar-add:Add`,
    })),
    provideCwAlertDialogLabels(() => ({
      confirm: $localize`:@@organization.members.alert-confirm:To confirm, type`,
      more: (count: number): string =>
        $localize`:@@organization.members.alert-more:+ ${count}:count: others`,
    })),
    provideCwDialogLabels(() => ({
      close: $localize`:@@organization.members.dialog-close:Close`,
    })),
    provideCwSelectLabels(() => ({
      placeholder: $localize`:@@organization.members.select-placeholder:Choose…`,
      emptyText: $localize`:@@organization.members.select-empty:No option`,
    })),
  ],
  templateUrl: './members-page.component.html',
})
export class MembersPage {
  // #region Properties
  /**
   * Property store
   *
   * @description
   * Members, filters, pages and the role and removal writes.
   *
   * @type {InstanceType<typeof MembersStore>}
   * @readonly
   */
  protected readonly store: InstanceType<typeof MembersStore> = inject(MembersStore);

  /**
   * Property invitations
   *
   * @description
   * Pending invitations and the invite, resend and cancel writes.
   *
   * @type {InstanceType<typeof InvitationsStore>}
   * @readonly
   */
  protected readonly invitations: InstanceType<typeof InvitationsStore> = inject(InvitationsStore);

  /**
   * Property inviteOpen
   *
   * @description
   * Whether the invite dialog is open.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly inviteOpen: WritableSignal<boolean> = signal<boolean>(false);

  /**
   * Property removing
   *
   * @description
   * Member the removal confirmation is about; null when none was asked.
   *
   * @type {WritableSignal<MemberRow | null>}
   * @readonly
   */
  protected readonly removing: WritableSignal<MemberRow | null> = signal<MemberRow | null>(null);

  /**
   * Property confirmOpen
   *
   * @description
   * Whether the removal confirmation is open.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly confirmOpen: WritableSignal<boolean> = signal<boolean>(false);

  /**
   * Property skeleton
   *
   * @description
   * Keys of the eight table lines of the section skeleton.
   *
   * @type {readonly number[]}
   * @readonly
   */
  protected readonly skeleton: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7];

  /**
   * Property workspace
   *
   * @description
   * The organization and the person's role.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  private readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property subscription
   *
   * @description
   * The plan and its seats, read for the owner only.
   *
   * @type {InstanceType<typeof SubscriptionStore>}
   * @readonly
   */
  private readonly subscription: InstanceType<typeof SubscriptionStore> = inject(SubscriptionStore);

  /**
   * Property canInvite
   *
   * @description
   * Whether the person may invite (owner or administrator).
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly canInvite: Signal<boolean> = computed((): boolean =>
    this.workspace.can('admin'),
  );

  /**
   * Property primary
   *
   * @description
   * The first read while nothing is shown. Reading it after a failed first read throws the
   * resource's error, which the route's error boundary renders; once a read resolved it is null
   * and later failures stay in place.
   *
   * @type {Signal<MemberPage | null | undefined>}
   * @readonly
   */
  protected readonly primary: Signal<MemberPage | null | undefined> = computed(
    (): MemberPage | null | undefined => (this.store.shown() ? null : this.store.members.value()),
  );

  /**
   * Property seatsFree
   *
   * @description
   * Seats left on the plan; null for anyone who may not read billing.
   *
   * @type {Signal<number | null>}
   * @readonly
   */
  protected readonly seatsFree: Signal<number | null> = computed((): number | null => {
    const current: OrganizationSubscription | null = this.subscription.current();
    return current === null ? null : Math.max(0, current.seatsLimit - current.seatsUsed);
  });

  /**
   * Property planLabel
   *
   * @description
   * Name of the plan (`Team`), from the subscription when read, else from the organization.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly planLabel: Signal<string> = computed((): string =>
    planName(this.subscription.current()?.plan ?? this.workspace.organization().plan),
  );

  /**
   * Property summary
   *
   * @description
   * The line under the title (`Organisation.dc.html` line 1830): the members and guests, then the
   * free seats for the owner and the pending invitations for whoever reads them.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly summary: Signal<string> = computed((): string => {
    const counts: MemberRoleCounts | null = this.store.counts();
    if (counts === null) return '';
    const seated: number = counts.owner + counts.admin + counts.member;
    const members: string =
      seated === 1
        ? $localize`:@@organization.members.summary-member:1 member`
        : $localize`:@@organization.members.summary-members:${seated}:count: members`;
    const guests: string =
      counts.guest === 1
        ? $localize`:@@organization.members.summary-guest:1 guest`
        : $localize`:@@organization.members.summary-guests:${counts.guest}:count: guests`;
    const parts: string[] = [
      $localize`:@@organization.members.summary-people:${members}:members: and ${guests}:guests:`,
    ];
    const free: number | null = this.seatsFree();
    if (free !== null) {
      parts.push(
        free === 1
          ? $localize`:@@organization.members.summary-seat:1 free seat`
          : $localize`:@@organization.members.summary-seats:${free}:count: free seats`,
      );
    }
    const pending: number | null = this.invitations.readable() ? this.invitations.total() : null;
    if (pending !== null) {
      parts.push(
        pending === 1
          ? $localize`:@@organization.members.summary-invitation:1 pending invitation`
          : $localize`:@@organization.members.summary-invitations:${pending}:count: pending invitations`,
      );
    }
    return parts.join(' · ');
  });
  // #endregion

  // #region Methods
  /**
   * Method changeRole
   *
   * @description
   * Sends a role picked in the table; a confirmed change reads the seats again, as a guest who
   * becomes a member takes one.
   *
   * @param {MemberRoleChange} change - The row and its new role.
   * @returns {Promise<void>} Resolves once the change is settled.
   */
  protected async changeRole(change: MemberRoleChange): Promise<void> {
    if (await this.store.changeRole(change.member, change.role)) this.refreshSeats();
  }

  /**
   * Method askRemove
   *
   * @description
   * Opens the removal confirmation for a member.
   *
   * @param {MemberRow} member - The member.
   */
  protected askRemove(member: MemberRow): void {
    this.removing.set(member);
    this.confirmOpen.set(true);
  }

  /**
   * Method confirmRemove
   *
   * @description
   * Removes the confirmed member; a confirmed removal reads the seats again.
   *
   * @param {MemberRow} member - The member.
   * @returns {Promise<void>} Resolves once the removal is settled.
   */
  protected async confirmRemove(member: MemberRow): Promise<void> {
    this.confirmOpen.set(false);
    if (await this.store.remove(member)) this.refreshSeats();
  }

  /**
   * Method removeTitle
   *
   * @description
   * Title of the removal confirmation.
   *
   * @param {MemberRow} member - The member.
   * @returns {string} `Remove <name> from the organization?`.
   */
  protected removeTitle(member: MemberRow): string {
    return $localize`:@@organization.members.remove-title:Remove ${member.name}:name: from the organization?`;
  }

  /**
   * Method removeText
   *
   * @description
   * Text of the removal confirmation.
   *
   * @param {MemberRow} member - The member.
   * @returns {string} What the removal does.
   */
  protected removeText(member: MemberRow): string {
    const organization: string = this.workspace.organization().name;
    return $localize`:@@organization.members.remove-text:${member.name}:name: loses access to every space of ${organization}:organization:. Their tasks stay assigned and a seat is freed.`;
  }

  /**
   * Method invite
   *
   * @description
   * Sends the dialog's invitations and closes it once they are accepted; a refusal keeps it open.
   *
   * @param {InviteRequest} request - Addresses and role.
   * @returns {Promise<void>} Resolves once the batch is settled.
   */
  protected async invite(request: InviteRequest): Promise<void> {
    if (await this.invitations.invite(request.emails, request.role)) this.inviteOpen.set(false);
  }

  /**
   * Method refreshSeats
   *
   * @description
   * Reads the subscription again after a write that changes the seats; only an owner reads it.
   */
  private refreshSeats(): void {
    if (this.workspace.role() === 'owner') this.subscription.retry();
  }
  // #endregion
}
