import { Component, computed, inject, type Signal } from '@angular/core';
import { isActive, Router, RouterLink } from '@angular/router';
import { CwAppRailGroup, CwAppRailItem } from '@cadenway/ui/components/app-rail';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

/**
 * Component DocsRailItem
 *
 * @description
 * The `Documents` item of the rail's applications (mockup `App.dc.html` line 6965, `railDefs`): a
 * link to `/<slug>/docs` whose file turns filled and violet, with `aria-current="page"`, while the
 * catalog or a document (`/<slug>/d/<id>`) is shown, whatever the query parameters (`?q=`,
 * `?mode=edit`). It follows an organization switch in place through the `workspace` port. The
 * current state comes from the router's `isActive` signals rather than `RouterLinkActive`, which
 * removes `aria-current` whenever its own link is inactive, as on a document. Its host is
 * `display: contents`, so its group joins the rail's layout.
 */
@Component({
  selector: 'cw-docs-rail-item',
  imports: [CwAppRailGroup, CwAppRailItem, RouterLink],
  host: { class: 'contents' },
  template: `
    <cw-app-rail-group>
      <a
        cwAppRailItem
        icon="phosphorFileTextBold"
        activeIcon="phosphorFileTextFill"
        [routerLink]="link()"
        [current]="current()"
        data-testid="docs-rail-item"
        i18n="@@docs.rail.label"
        >Documents</a
      >
    </cw-app-rail-group>
  `,
})
export class DocsRailItem {
  // #region Properties
  /**
   * Property workspace
   *
   * @description
   * Workspace context whose documents the item opens.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  private readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property router
   *
   * @description
   * Router whose state tells whether the catalog or a document is shown.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property link
   *
   * @description
   * Address of the documents catalog.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly link: Signal<string> = computed(
    (): string => `/${this.workspace.organization().slug}/docs`,
  );

  /**
   * Property current
   *
   * @description
   * Whether the catalog (exactly `/<slug>/docs`) or a document (below `/<slug>/d`) of the
   * workspace is shown, whatever the query parameters and the fragment.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly current: Signal<boolean> = computed((): boolean => {
    const slug: string = this.workspace.organization().slug;
    return (
      isActive(`/${slug}/docs`, this.router, { paths: 'exact', queryParams: 'ignored' })() ||
      isActive(`/${slug}/d`, this.router, { paths: 'subset', queryParams: 'ignored' })()
    );
  });
  // #endregion
}
