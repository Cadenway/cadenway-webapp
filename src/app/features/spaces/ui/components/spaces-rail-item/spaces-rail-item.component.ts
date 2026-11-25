import { Component, inject, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { type Event as RouterEvent, NavigationEnd, Router } from '@angular/router';
import { CwAppRailGroup, CwAppRailItem } from '@cadenway/ui/components/app-rail';
import { filter, map } from 'rxjs';

import { SHELL_SIDEBAR, type ShellSidebar } from '@shared/layout-slot';

/**
 * Constant SPACES_PATH
 *
 * @description
 * Addresses of the spaces screens below a slug: a space overview or a list.
 *
 * @type {RegExp}
 */
const SPACES_PATH: RegExp = /^\/[^/?#]+\/(?:spaces|l)\//u;

/**
 * Component SpacesRailItem
 *
 * @description
 * The « Espaces » item of the rail (`railDefs` of `App.dc.html`): it toggles the shell's sidebar,
 * which holds the spaces, through `SHELL_SIDEBAR`, and shows the filled squares while a space
 * overview or a list is shown. Outside a shell that provides the port it is disabled. Its host is
 * `display: contents`, so its group joins the rail's layout.
 */
@Component({
  selector: 'cw-spaces-rail-item',
  imports: [CwAppRailGroup, CwAppRailItem],
  host: { class: 'contents' },
  template: `
    <cw-app-rail-group>
      <button
        type="button"
        cwAppRailItem
        icon="phosphorSquaresFourBold"
        activeIcon="phosphorSquaresFourFill"
        [current]="onSpaces()"
        [attr.aria-expanded]="sidebar?.expanded() ?? null"
        [disabled]="!sidebar"
        data-testid="spaces-rail-item"
        (click)="sidebar?.toggle()"
        i18n="@@spaces.rail.label"
      >
        Spaces
      </button>
    </cw-app-rail-group>
  `,
})
export class SpacesRailItem {
  // #region Properties
  /**
   * Property sidebar
   *
   * @description
   * Sidebar of the hosting shell, or null outside one.
   *
   * @type {ShellSidebar | null}
   * @readonly
   */
  protected readonly sidebar: ShellSidebar | null = inject(SHELL_SIDEBAR, { optional: true });

  /**
   * Property router
   *
   * @description
   * Router whose address marks the item current.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property onSpaces
   *
   * @description
   * Whether a spaces screen is shown.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly onSpaces: Signal<boolean> = toSignal(
    this.router.events.pipe(
      filter((event: RouterEvent): event is NavigationEnd => event instanceof NavigationEnd),
      map((event: NavigationEnd): boolean => SPACES_PATH.test(event.urlAfterRedirects)),
    ),
    { initialValue: SPACES_PATH.test(this.router.url) },
  );
  // #endregion
}
