import { Component, computed, inject, type Signal } from '@angular/core';
import { type IsActiveMatchOptions, RouterLink, RouterLinkActive } from '@angular/router';
import { CwAppRailGroup, CwAppRailItem } from '@cadenway/ui/components/app-rail';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

/**
 * Component DashboardsRailItem
 *
 * @description
 * The `Dashboards` item of the rail's applications (mockup `App.dc.html` line 6963, `railDefs`): a
 * link to `/<slug>/dashboards` whose bar chart turns filled and violet, with `aria-current="page"`,
 * while the dashboard is shown, whatever its query parameters (`?weeks=`, or `?task=` for a task
 * detail opened over it). It follows an organization switch in place through the `workspace`
 * port. Its host is `display: contents`, so its group joins the rail's layout.
 */
@Component({
  selector: 'cw-dashboards-rail-item',
  imports: [CwAppRailGroup, CwAppRailItem, RouterLink, RouterLinkActive],
  host: { class: 'contents' },
  template: `
    <cw-app-rail-group>
      <a
        cwAppRailItem
        icon="phosphorChartBarBold"
        activeIcon="phosphorChartBarFill"
        [routerLink]="link()"
        routerLinkActive
        #active="routerLinkActive"
        [routerLinkActiveOptions]="activeOptions"
        [current]="active.isActive"
        data-testid="dashboards-rail-item"
        i18n="@@dashboards.rail.label"
        >Dashboards</a
      >
    </cw-app-rail-group>
  `,
})
export class DashboardsRailItem {
  // #region Properties
  /**
   * Property activeOptions
   *
   * @description
   * The screen's path only: its query parameters and fragment never change the current item.
   *
   * @type {IsActiveMatchOptions}
   * @readonly
   */
  protected readonly activeOptions: IsActiveMatchOptions = {
    paths: 'exact',
    queryParams: 'ignored',
    matrixParams: 'ignored',
    fragment: 'ignored',
  };

  /**
   * Property workspace
   *
   * @description
   * Workspace context whose dashboard the item opens.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  private readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property link
   *
   * @description
   * Address of the dashboard.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly link: Signal<string> = computed(
    (): string => `/${this.workspace.organization().slug}/dashboards`,
  );
  // #endregion
}
