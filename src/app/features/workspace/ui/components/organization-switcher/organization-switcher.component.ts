import {
  Component,
  DOCUMENT,
  inject,
  input,
  type InputSignal,
  type Signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { CwAppRailItem } from '@cadenway/ui/components/app-rail';
import { CwButton } from '@cadenway/ui/components/button';
import { CwLogo } from '@cadenway/ui/components/logo';
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
import { CwToastService } from '@cadenway/ui/components/toast';
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
 * Type OrganizationSwitcherPlacement
 *
 * @description
 * Where the switcher renders its trigger: the filled square of the rail (desktop only) or the
 * organization row of the sidebar header (every width, the phone entry point).
 *
 * @type {'rail' | 'sidebar'}
 */
export type OrganizationSwitcherPlacement = 'rail' | 'sidebar';

/**
 * Constant ROLE_NAMES
 *
 * @description
 * Display names of the roles (`Owner`, `Administrator`, `Member`, `Guest`).
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
 * The organizations menu (mockup `App.dc.html` lines 74-90) and its trigger, chosen by
 * `placement`. In the rail (lines 33-35), the trigger is the filled square with the current
 * organization's initials, its name as the tooltip and `Switch organization: <name>` as the
 * accessible name; it is hidden from the phone tab bar. In the sidebar header (lines 183-187), it
 * is the organization row: the Cadenway mark, the organization's name, `<host>/<slug>` from the
 * page address and an up-down caret; the shell's collapse button ends that row. The menu lists the caller's organizations as radio items (initials, name, `role · plan`), read
 * the first time it opens, with skeletons while loading and an inline error with `Retry`;
 * choosing another one navigates to `/<slug>`, whose guard switches the session, and once that
 * organization is the workspace's, confirms with `Organization: <name>` (lines 8256-8262). Then
 * come `Organization settings` (administrators), `Members and invitations` (members, with the
 * member count) and `Billing and quotas` (the owner), each shown only to the roles whose section
 * guard lets them in, which open `/<slug>/organization/<section>`, and `Create or join an
 * organization`, which opens `/organizations`. The rail trigger keeps 4 px below it before the
 * separator (`mb-1`, line 33), and the menu is at least 256 px wide (`min-w-64`, line 74): its
 * heading holds the 246 px inside the panel's padding and border, since `cw-menu` takes no width.
 * It provides its own
 * `OrganizationMenuStore` and follows an organization switch in place through the `workspace`
 * port. Its host is `display: contents`, so the item joins the rail group's layout.
 */
@Component({
  selector: 'cw-organization-switcher',
  imports: [
    CwAppRailItem,
    CwButton,
    CwLogo,
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
   * Property placement
   *
   * @description
   * Trigger rendered: the rail square (default) or the sidebar header's organization row.
   *
   * @type {InputSignal<OrganizationSwitcherPlacement>}
   * @readonly
   */
  public readonly placement: InputSignal<OrganizationSwitcherPlacement> =
    input<OrganizationSwitcherPlacement>('rail');

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
   * Property toasts
   *
   * @description
   * Toasts confirming a completed organization switch.
   *
   * @type {CwToastService}
   * @readonly
   */
  private readonly toasts: CwToastService = inject(CwToastService);

  /**
   * Property document
   *
   * @description
   * Document whose address gives the host shown on the organization row.
   *
   * @type {Document}
   * @readonly
   */
  private readonly document: Document = inject(DOCUMENT);

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
   * Method address
   *
   * @description
   * The second line of the organization row: the application host and the organization's slug
   * (`app.cadenway.example/atelier-nord`).
   *
   * @returns {string} The host and the slug.
   */
  protected address(): string {
    return `${this.document.location.host}/${this.workspace.organization().slug}`;
  }

  /**
   * Method meta
   *
   * @description
   * The second line of an organization: the caller's role and its plan (`Owner · Team
   * plan`).
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
   * closes the menu. Once the navigation succeeds and the workspace shows the chosen organization,
   * a toast confirms the switch; a cancelled or redirected navigation confirms nothing.
   *
   * @param {string | undefined} id - Identifier of the chosen organization.
   * @returns {Promise<void>} Resolves once the navigation settles.
   */
  protected async choose(id: string | undefined): Promise<void> {
    this.menu()?.close();
    const entry: OrganizationMenuEntry | undefined = this.store
      .entries()
      .find((candidate: OrganizationMenuEntry) => candidate.id === id);
    if (!entry || entry.id === this.workspace.organization().id) return;
    const opened: boolean = await this.router.navigateByUrl(workspacePath(entry.slug));
    if (!opened || this.workspace.organization().id !== entry.id) return;
    this.toasts.show(
      $localize`:@@workspace.organization-menu.switched:Organization: ${entry.name}:name:`,
      {
        description: $localize`:@@workspace.organization-menu.switched-text:Your spaces and settings follow the chosen organization.`,
      },
    );
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
