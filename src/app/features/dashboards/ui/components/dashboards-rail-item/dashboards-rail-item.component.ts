import { Component, computed, inject, type Signal } from '@angular/core';
import { isActive, Router, RouterLink } from '@angular/router';
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
 * The current state comes from the router's `isActive` signal rather than `RouterLinkActive`,
 * which removes `aria-current` on each of its updates, a query-only navigation included.
 */
@Component({
  selector: 'cw-dashboards-rail-item',
  imports: [CwAppRailGroup, CwAppRailItem, RouterLink],
  host: { class: 'contents' },
  template: `
    <cw-app-rail-group>
      <a
        cwAppRailItem
        icon="phosphorChartBarBold"
        activeIcon="phosphorChartBarFill"
        [routerLink]="link()"
        [current]="current()"
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
   * Property router
   *
   * @description
   * Router whose state tells whether the dashboard is shown.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

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

  /**
   * Property current
   *
   * @description
   * Whether the dashboard of the workspace (exactly `/<slug>/dashboards`) is shown, whatever the query
   * parameters and the fragment.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly current: Signal<boolean> = computed((): boolean =>
    isActive(this.link(), this.router, { paths: 'exact', queryParams: 'ignored' })(),
  );
  // #endregion
}
