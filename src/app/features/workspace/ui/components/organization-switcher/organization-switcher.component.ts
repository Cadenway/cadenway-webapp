import { Component, inject, type Signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { CwAppRailItem } from '@cadenway/ui/components/app-rail';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwMenu,
  CwMenuItem,
  CwMenuItemRadio,
  CwMenuLabel,
  CwMenuRadioGroup,
  CwMenuSeparator,
  CwMenuTriggerFor,
} from '@cadenway/ui/components/menu';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { NgIcon } from '@ng-icons/core';

import { workspacePath } from '@core/routing';
import { planName } from '@features/organization/utils/plan-label';

import type { OrganizationMenuEntry } from '../../../models/organization-menu-entry/organization-menu-entry.interface';
import type { WorkspaceRole } from '../../../models/workspace-context/workspace-context.interface';
import type { WorkspaceContextPort } from '../../../ports/workspace-context/workspace-context-port.interface';
import { WORKSPACE_CONTEXT } from '../../../ports/workspace-context/workspace-context.token';
import { OrganizationMenuStore } from '../../../state/organization-menu/organization-menu.store';

/**
 * Type OrganizationSection
 *
 * @description
 * Organization settings sections the menu opens.
 *
 * @type {'general' | 'members' | 'billing'}
 */
type OrganizationSection = 'general' | 'members' | 'billing';

/**
 * Constant ROLE_NAMES
 *
 * @description
 * Display names of the roles (« Propriétaire », « Administrateur », « Membre », « Invité »).
 *
 * @type {Readonly<Record<WorkspaceRole, string>>}
 */
const ROLE_NAMES: Readonly<Record<WorkspaceRole, string>> = {
  owner: $localize`:@@workspace.organization-menu.role-owner:Owner`,
  admin: $localize`:@@workspace.organization-menu.role-admin:Administrator`,
  member: $localize`:@@workspace.organization-menu.role-member:Member`,
  guest: $localize`:@@workspace.organization-menu.role-guest:Guest`,
};

/**
 * Component OrganizationSwitcher
 *
 * @description
 * The filled square at the top of the rail and the organizations menu it opens (mockup
 * `App.dc.html` lines 33-35 and 74-90). The square shows the current organization's initials,
 * its name as the tooltip and « Changer d’organisation : <name> » as the accessible name. The
 * menu lists the caller's organizations as radio items (initials, name, « role · plan »), read
 * the first time it opens, with skeletons while loading and an inline error with « Réessayer »;
 * choosing another one navigates to `/<slug>`, whose guard switches the session. Then come
 * « Paramètres de l'organisation », « Membres et invitations » (with the member count) and
 * « Facturation et quotas », which open `/<slug>/organization/<section>`, and « Créer ou
 * rejoindre une organisation », which opens `/organizations`. It provides its own
 * `OrganizationMenuStore` and follows an organization switch in place through the `workspace`
 * port. Its host is `display: contents`, so the item joins the rail group's layout.
 */
@Component({
  selector: 'cw-organization-switcher',
  imports: [
    CwAppRailItem,
    CwButton,
    CwMenu,
    CwMenuItem,
    CwMenuItemRadio,
    CwMenuLabel,
    CwMenuRadioGroup,
    CwMenuSeparator,
    CwMenuTriggerFor,
    CwSkeleton,
    NgIcon,
  ],
  providers: [OrganizationMenuStore],
  host: { class: 'contents' },
  templateUrl: './organization-switcher.component.html',
})
export class OrganizationSwitcher {
  // #region Properties
  /**
   * Property workspace
   *
   * @description
   * Workspace context whose organization the item shows.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  protected readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property store
   *
   * @description
   * The caller's organizations, read on demand.
   *
   * @type {InstanceType<typeof OrganizationMenuStore>}
   * @readonly
   */
  protected readonly store: InstanceType<typeof OrganizationMenuStore> =
    inject(OrganizationMenuStore);

  /**
   * Property router
   *
   * @description
   * Router opening the chosen organization or settings section.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property menu
   *
   * @description
   * The organizations menu, closed after a choice.
   *
   * @type {Signal<CwMenu | undefined>}
   * @readonly
   */
  private readonly menu: Signal<CwMenu | undefined> = viewChild<CwMenu>('organizationMenu');
  // #endregion

  // #region Methods
  /**
   * Method meta
   *
   * @description
   * The second line of an organization: the caller's role and its plan (« Propriétaire · plan
   * Équipe »).
   *
   * @param {OrganizationMenuEntry} entry - A listed organization.
   * @returns {string} The role and the plan.
   */
  protected meta(entry: OrganizationMenuEntry): string {
    return $localize`:@@workspace.organization-menu.meta:${ROLE_NAMES[entry.role]}:role: · ${planName(entry.plan)}:plan: plan`;
  }

  /**
   * Method memberCount
   *
   * @description
   * Members of the current organization, once the list is read.
   *
   * @returns {number | null} The count, or null before the list arrives.
   */
  protected memberCount(): number | null {
    const id: string = this.workspace.organization().id;
    return (
      this.store.entries().find((entry: OrganizationMenuEntry) => entry.id === id)?.memberCount ??
      null
    );
  }

  /**
   * Method choose
   *
   * @description
   * Closes the menu and opens the chosen organization's workspace; choosing the current one only
   * closes the menu.
   *
   * @param {string | undefined} id - Identifier of the chosen organization.
   */
  protected choose(id: string | undefined): void {
    this.menu()?.close();
    const entry: OrganizationMenuEntry | undefined = this.store
      .entries()
      .find((candidate: OrganizationMenuEntry) => candidate.id === id);
    if (!entry || entry.id === this.workspace.organization().id) return;
    void this.router.navigateByUrl(workspacePath(entry.slug));
  }

  /**
   * Method open
   *
   * @description
   * Opens a section of the current organization's settings.
   *
   * @param {OrganizationSection} section - Section to open.
   */
  protected open(section: OrganizationSection): void {
    void this.router.navigate(['/', this.workspace.organization().slug, 'organization', section]);
  }

  /**
   * Method organizations
   *
   * @description
   * Opens the organization choice and creation of Auth.
   */
  protected organizations(): void {
    void this.router.navigateByUrl('/organizations');
  }
  // #endregion
}
