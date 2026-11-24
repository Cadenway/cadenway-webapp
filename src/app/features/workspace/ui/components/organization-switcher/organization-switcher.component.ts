import { Component, input, type InputSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CwAppRailItem } from '@cadenway/ui/components/app-rail';

import type { WorkspaceContextPort } from '../../../ports/workspace-context/workspace-context-port.interface';

/**
 * Component OrganizationSwitcher
 *
 * @description
 * The filled square at the top of the rail (mockup `App.dc.html` lines 33-35): the current
 * organization's initials, its name as the tooltip, and « Changer d’organisation : <name> » as the
 * accessible name. It links to the organization choice of Auth (`/organizations`); the
 * organization menu of the mockup comes with the organization settings. It follows an organization
 * switch in place through the `workspace` port. Its host is `display: contents`, so the item joins
 * the rail group's layout.
 */
@Component({
  selector: 'cw-organization-switcher',
  imports: [CwAppRailItem, RouterLink],
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
   * @type {InputSignal<WorkspaceContextPort>}
   * @readonly
   */
  public readonly workspace: InputSignal<WorkspaceContextPort> =
    input.required<WorkspaceContextPort>();
  // #endregion
}
