import { Component, computed, inject, type Signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  CwAppRailGroup,
  CwAppRailItem,
  CwAppRailSeparator,
} from '@cadenway/ui/components/app-rail';

import type { WorkspaceContextPort } from '../../../ports/workspace-context/workspace-context-port.interface';
import { WORKSPACE_CONTEXT } from '../../../ports/workspace-context/workspace-context.token';

/**
 * Component OrganizationHomeItem
 *
 * @description
 * The top of the settings rail (mockup `Compte.dc.html` lines 18-22): the filled square with the
 * organization's initials, its name as the tooltip and `<name>, back to the application` as the
 * accessible name, which opens the workspace's home `/<slug>`, then the rail separator. Unlike the
 * application shell's organization switcher it opens no menu, and it stays in the settings rail's
 * phone column. It follows an organization switch in place through the workspace port. Its host
 * is `display: contents`, so its group joins the rail's layout.
 */
@Component({
  selector: 'cw-organization-home-item',
  imports: [CwAppRailGroup, CwAppRailItem, CwAppRailSeparator, RouterLink],
  host: { class: 'contents' },
  template: `
    <cw-app-rail-group>
      <a
        cwAppRailItem
        variant="primary"
        [routerLink]="link()"
        [tooltip]="workspace.organization().name"
        data-testid="settings-organization-home"
      >
        <span cwAppRailItemMedia>{{ workspace.organization().initials }}</span>
        <ng-container i18n="@@workspace.settings.organization-home"
          >{{ workspace.organization().name }}, back to the application</ng-container
        >
      </a>
    </cw-app-rail-group>
    <cw-app-rail-separator />
  `,
})
export class OrganizationHomeItem {
  // #region Properties
  /**
   * Property workspace
   *
   * @description
   * Workspace context whose organization the square shows.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  protected readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property link
   *
   * @description
   * Commands of the workspace home.
   *
   * @type {Signal<readonly string[]>}
   * @readonly
   */
  protected readonly link: Signal<readonly string[]> = computed((): readonly string[] => [
    '/',
    this.workspace.organization().slug,
  ]);
  // #endregion
}
