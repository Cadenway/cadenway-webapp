import { Component, inject, computed, type Signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CwAppRailGroup, CwAppRailItem } from '@cadenway/ui/components/app-rail';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

/**
 * Component HomeRailItem
 *
 * @description
 * The « Accueil » item at the top of the rail's applications (mockup `App.dc.html` line 38,
 * `railDefs`): a link to `/<slug>` whose house turns filled and violet, with `aria-current="page"`,
 * while the home screen is shown. It follows an organization switch in place through the
 * `workspace` port. Its host is `display: contents`, so its group joins the rail's layout.
 */
@Component({
  selector: 'cw-home-rail-item',
  imports: [CwAppRailGroup, CwAppRailItem, RouterLink, RouterLinkActive],
  host: { class: 'contents' },
  template: `
    <cw-app-rail-group>
      <a
        cwAppRailItem
        icon="phosphorHouseBold"
        activeIcon="phosphorHouseFill"
        [routerLink]="link()"
        routerLinkActive
        #active="routerLinkActive"
        [routerLinkActiveOptions]="{ exact: true }"
        [current]="active.isActive"
        data-testid="home-rail-item"
        i18n="@@home.rail.label"
        >Home</a
      >
    </cw-app-rail-group>
  `,
})
export class HomeRailItem {
  // #region Properties
  /**
   * Property workspace
   *
   * @description
   * Workspace context whose home screen the item opens.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  protected readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property link
   *
   * @description
   * Address of the home screen.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly link: Signal<string> = computed(
    (): string => `/${this.workspace.organization().slug}`,
  );
  // #endregion
}
