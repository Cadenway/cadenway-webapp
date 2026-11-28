import { Component, computed, inject, type Signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';

import type { WorkspaceContextPort } from '../../../ports/workspace-context/workspace-context-port.interface';
import { WORKSPACE_CONTEXT } from '../../../ports/workspace-context/workspace-context.token';

/**
 * Component BackToAppLink
 *
 * @description
 * The first row of the settings navigation (mockup `Compte.dc.html` line 59 and
 * `Organisation.dc.html` line 48): an arrow and `Back to the application`. The mockup opens the
 * spaces screen (`goAppSpaces`); the application has no spaces index yet, so the link opens the
 * workspace's home, `/<slug>`. It follows an organization switch in place through the workspace
 * port. It is a `settingsNavigation` slot contribution.
 */
@Component({
  selector: 'cw-back-to-app-link',
  imports: [NgIcon, RouterLink],
  host: { class: 'contents' },
  template: `
    <a
      [routerLink]="link()"
      class="flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none focus-visible:ring-inset"
      data-testid="settings-back-to-app"
    >
      <ng-icon size="1rem" name="phosphorArrowLeftBold" class="shrink-0" aria-hidden="true" />
      <ng-container i18n="@@workspace.settings.back-to-app">Back to the application</ng-container>
    </a>
  `,
})
export class BackToAppLink {
  // #region Properties
  /**
   * Property workspace
   *
   * @description
   * Workspace context whose slug the link opens.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  private readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

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
