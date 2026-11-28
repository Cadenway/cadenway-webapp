import { DatePipe } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  type InputSignal,
  type Signal,
  signal,
  type WritableSignal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CwAlert, CwAlertDescription } from '@cadenway/ui/components/alert';
import { CwBadge } from '@cadenway/ui/components/badge';
import { CwButton } from '@cadenway/ui/components/button';
import { CwCard } from '@cadenway/ui/components/card';
import {
  CwEmpty,
  CwEmptyContent,
  CwEmptyDescription,
  CwEmptyHeader,
  CwEmptyMedia,
  CwEmptyTitle,
} from '@cadenway/ui/components/empty';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { NgIcon } from '@ng-icons/core';

import { initialsOf } from '@shared/initials';

import type { AuthProblem } from '../../../models/auth-problem/auth-problem.interface';
import type {
  OrganizationChoice,
  OrganizationRole,
  ReceivedInvitation,
} from '../../../models/organization/organization.interface';
import { AuthFlowStore, type StepResult } from '../../../state/auth-flow/auth-flow.store';
import { OrganizationChoiceStore } from '../../../state/organization-choice/organization-choice.store';

/**
 * Component OrganizationsPage
 *
 * @description
 * The chooser of `Organisations.dc.html` (`/organizations`): the account of the session, the
 * invitations addressed to it (`Accept`, `Refuse` with `Undo`), its organizations, `Create an
 * organization` and `Sign out`. Choosing an organization moves the session to it and
 * opens `/<slug>`. An invitation named by `?invitation=` stands out. A failed list shows
 * `This page could not be loaded` with `Retry`; a lost session returns to `/login`.
 */
@Component({
  selector: 'cw-organizations-page',
  imports: [
    CwAlert,
    CwAlertDescription,
    CwBadge,
    CwButton,
    CwCard,
    CwEmpty,
    CwEmptyContent,
    CwEmptyDescription,
    CwEmptyHeader,
    CwEmptyMedia,
    CwEmptyTitle,
    CwSkeleton,
    DatePipe,
    NgIcon,
    RouterLink,
  ],
  providers: [OrganizationChoiceStore],
  templateUrl: './organizations-page.component.html',
})
export class OrganizationsPage {
  // #region Properties
  /**
   * Property invitation
   *
   * @description
   * The `?invitation=` query parameter of an e-mail link, highlighted in the list.
   *
   * @type {InputSignal<string | undefined>}
   * @readonly
   */
  public readonly invitation: InputSignal<string | undefined> = input<string | undefined>();

  /**
   * Property store
   *
   * @description
   * Chooser state.
   *
   * @type {OrganizationChoiceStore}
   * @readonly
   */
  protected readonly store: OrganizationChoiceStore = inject(OrganizationChoiceStore);

  /**
   * Property flow
   *
   * @description
   * Flow state with the session's account.
   *
   * @type {AuthFlowStore}
   * @readonly
   */
  protected readonly flow: AuthFlowStore = inject(AuthFlowStore);

  /**
   * Property router
   *
   * @description
   * Opens the workspace or the sign-in screens.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property destroyRef
   *
   * @description
   * Keeps a late answer from navigating after the page closed.
   *
   * @type {DestroyRef}
   * @readonly
   */
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /**
   * Property signingOut
   *
   * @description
   * Whether the sign-out is running.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly signingOut: WritableSignal<boolean> = signal(false);

  /**
   * Property signOutFailed
   *
   * @description
   * Whether the last sign-out failed.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly signOutFailed: WritableSignal<boolean> = signal(false);

  /**
   * Property actionMessage
   *
   * @description
   * Alert of a refused action.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  protected readonly actionMessage: Signal<string | null> = computed(() => {
    const problem: AuthProblem | undefined = this.store.failure()?.problem;
    if (problem === undefined || problem.status === 401) return null;
    if (problem.code === 'organization.mfa-required') {
      return $localize`:@@auth.organizations.mfa-required:This organization requires two-step verification.`;
    }
    if (problem.status === 404) {
      return $localize`:@@auth.organizations.gone:This organization is no longer available. Refresh the list.`;
    }
    return $localize`:@@auth.organizations.action-failed:The action is unavailable. Try again in a moment.`;
  });

  /**
   * Property roles
   *
   * @description
   * Role labels.
   *
   * @type {Readonly<Record<OrganizationRole, string>>}
   * @readonly
   */
  protected readonly roles: Readonly<Record<OrganizationRole, string>> = {
    owner: $localize`:@@auth.role.owner:Owner`,
    admin: $localize`:@@auth.role.admin:Administrator`,
    member: $localize`:@@auth.role.member:Member`,
    guest: $localize`:@@auth.role.guest:Guest`,
  };

  /**
   * Property plans
   *
   * @description
   * Plan labels; an unknown plan shows its key.
   *
   * @type {Readonly<Record<string, string>>}
   * @readonly
   */
  protected readonly plans: Readonly<Record<string, string>> = {
    free: $localize`:@@auth.plan.free:Free`,
    team: $localize`:@@auth.plan.team:Team`,
    enterprise: $localize`:@@auth.plan.enterprise:Enterprise`,
  };

  /**
   * Property initials
   *
   * @description
   * The square mark of an organization or an invitation.
   *
   * @type {(name: string) => string}
   * @readonly
   */
  protected readonly initials: (name: string) => string = initialsOf;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Returns to `/login` when a read or an action finds the session gone.
   *
   * @constructor
   */
  public constructor() {
    effect(() => {
      if (
        this.store.loadProblem()?.status === 401 ||
        this.store.invitationsProblem()?.status === 401 ||
        this.store.failure()?.problem.status === 401
      ) {
        void this.router.navigateByUrl('/login', { replaceUrl: true });
      }
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method plan
   *
   * @description
   * Label of a plan.
   *
   * @param {string} key - Plan key.
   * @returns {string} Its label.
   */
  protected plan(key: string): string {
    return this.plans[key] ?? key;
  }

  /**
   * Method choose
   *
   * @description
   * Moves the session to an organization and opens its workspace.
   *
   * @param {OrganizationChoice} organization - The organization.
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async choose(organization: OrganizationChoice): Promise<void> {
    const destination: string | null = await this.store.choose(organization);
    if (destination !== null && !this.destroyRef.destroyed) {
      await this.router.navigateByUrl(destination, { replaceUrl: true });
    }
  }

  /**
   * Method isNew
   *
   * @description
   * Whether an organization was joined during this visit.
   *
   * @param {OrganizationChoice} organization - The organization.
   * @returns {boolean} Whether it shows `New`.
   */
  protected isNew(organization: OrganizationChoice): boolean {
    return this.store.joined().some((item: OrganizationChoice) => item.id === organization.id);
  }

  /**
   * Method refusedLabel
   *
   * @description
   * Status of a refused invitation.
   *
   * @param {ReceivedInvitation} invitation - The invitation.
   * @returns {string} The status.
   */
  protected refusedLabel(invitation: ReceivedInvitation): string {
    return $localize`:@@auth.organizations.refused:Invitation from ${invitation.organizationName}:organization: refused. ${invitation.inviterName}:inviter: can send you a new one.`;
  }

  /**
   * Method signOut
   *
   * @description
   * Closes the session and opens `/logged-out`.
   *
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async signOut(): Promise<void> {
    if (this.signingOut()) return;
    this.signingOut.set(true);
    this.signOutFailed.set(false);
    const result: StepResult = await this.flow.signOut();
    this.signingOut.set(false);
    if (!result.ok) {
      this.signOutFailed.set(true);
      return;
    }
    if (!this.destroyRef.destroyed) {
      await this.router.navigateByUrl('/logged-out?reason=signed-out', { replaceUrl: true });
    }
  }
  // #endregion
}
