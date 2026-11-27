import { Component, computed, inject, type Signal } from '@angular/core';
import { isActive, Router, RouterLink } from '@angular/router';
import { CwAppRailGroup, CwAppRailItem } from '@cadenway/ui/components/app-rail';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

/**
 * Component GoalsRailItem
 *
 * @description
 * The `Goals` item of the rail's applications (mockup `App.dc.html` line 6964, `railDefs`): a link
 * to `/<slug>/goals`, violet with `aria-current="page"` while the goals are shown, whatever the
 * query parameters. The target keeps its Bold weight in both states, as the mockup draws it. It
 * follows an organization switch in place through the `workspace` port. Its host is
 * `display: contents`, so its group joins the rail's layout.
 * The current state comes from the router's `isActive` signal rather than `RouterLinkActive`,
 * which removes `aria-current` on each of its updates, a query-only navigation included.
 */
@Component({
  selector: 'cw-goals-rail-item',
  imports: [CwAppRailGroup, CwAppRailItem, RouterLink],
  host: { class: 'contents' },
  template: `
    <cw-app-rail-group>
      <a
        cwAppRailItem
        icon="phosphorTargetBold"
        activeIcon="phosphorTargetBold"
        [routerLink]="link()"
        [current]="current()"
        data-testid="goals-rail-item"
        i18n="@@goals.rail.label"
        >Goals</a
      >
    </cw-app-rail-group>
  `,
})
export class GoalsRailItem {
  // #region Properties
  /**
   * Property workspace
   *
   * @description
   * Workspace context whose goals the item opens.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  private readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property router
   *
   * @description
   * Router whose state tells whether the goals is shown.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property link
   *
   * @description
   * Address of the goals screen.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly link: Signal<string> = computed(
    (): string => `/${this.workspace.organization().slug}/goals`,
  );

  /**
   * Property current
   *
   * @description
   * Whether the goals of the workspace (exactly `/<slug>/goals`) is shown, whatever the query
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
