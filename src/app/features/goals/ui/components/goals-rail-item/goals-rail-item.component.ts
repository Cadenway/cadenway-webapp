import { Component, computed, inject, type Signal } from '@angular/core';
import { type IsActiveMatchOptions, RouterLink, RouterLinkActive } from '@angular/router';
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
 */
@Component({
  selector: 'cw-goals-rail-item',
  imports: [CwAppRailGroup, CwAppRailItem, RouterLink, RouterLinkActive],
  host: { class: 'contents' },
  template: `
    <cw-app-rail-group>
      <a
        cwAppRailItem
        icon="phosphorTargetBold"
        activeIcon="phosphorTargetBold"
        [routerLink]="link()"
        routerLinkActive
        #active="routerLinkActive"
        [routerLinkActiveOptions]="activeOptions"
        [current]="active.isActive"
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
   * Workspace context whose goals the item opens.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  private readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

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
  // #endregion
}
