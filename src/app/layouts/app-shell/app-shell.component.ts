import { NgComponentOutlet } from '@angular/common';
import { Component, DOCUMENT, inject, LOCALE_ID, signal, type WritableSignal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {
  CwAppRail,
  CwAppRailFooter,
  CwAppRailGroup,
  CwAppRailSeparator,
} from '@cadenway/ui/components/app-rail';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwSidebar,
  CwSidebarFooter,
  CwSidebarHeader,
  type CwSidebarState,
  CwSidebarToggle,
} from '@cadenway/ui/components/sidebar';
import { provideCwLocale, provideCwPhoneSheets } from '@cadenway/ui/core';
import { NgIcon } from '@ng-icons/core';
import { injectSlot, type SlotContribution } from '@shared/layout-slot';

import { SIDEBAR_OVERLAY_QUERY } from './constants/app-shell.constants';
import {
  APP_SHELL_BANNERS_SLOT,
  APP_SHELL_ORGANIZATION_SWITCHER_SLOT,
  APP_SHELL_OVERLAYS_SLOT,
  APP_SHELL_RAIL_FOOTER_SLOT,
  APP_SHELL_RAIL_NAVIGATION_SLOT,
  APP_SHELL_SIDEBAR_FOOTER_SLOT,
  APP_SHELL_SIDEBAR_HEADER_SLOT,
  APP_SHELL_SIDEBAR_SLOT,
} from './slots';

/**
 * Component AppShell
 *
 * @description
 * The application frame of mockup `App.dc.html`: the `banners` across the top, then the 56 px
 * applications rail (`nav[cwAppRail]`, a bottom tab bar below 768 px) holding the
 * `organizationSwitcher`, the `railNavigation` groups and the `railFooter` items, and the rounded
 * main panel. The panel holds the off-canvas space sidebar (`sidebarHeader`, `sidebar` and
 * `sidebarFooter`), which
 * starts closed below 1024 px and then covers the content, and the `main` landmark with the routed
 * screen; while the sidebar is closed, a toggle above the routed screen opens it. The `overlays`
 * render last. Contributions render in ascending order and an empty slot renders nothing. The
 * routed icons (`phosphorSidebarSimpleBold`) come from the route's `provideCadenwayIcons()`. The
 * layout provides the `@cadenway/ui` locale from `LOCALE_ID` and the phone sheets to its subtree.
 */
@Component({
  selector: 'cw-app-shell',
  imports: [
    CwAppRail,
    CwAppRailFooter,
    CwAppRailGroup,
    CwAppRailSeparator,
    CwButton,
    CwSidebar,
    CwSidebarFooter,
    CwSidebarHeader,
    CwSidebarToggle,
    NgComponentOutlet,
    NgIcon,
    RouterOutlet,
  ],
  providers: [provideCwLocale(() => inject(LOCALE_ID)), provideCwPhoneSheets()],
  templateUrl: './app-shell.component.html',
})
export class AppShell {
  // #region Properties
  /**
   * Property banners
   *
   * @description
   * Application-wide banners, ordered once when the shell is created.
   *
   * @type {readonly SlotContribution[]}
   * @readonly
   */
  protected readonly banners: readonly SlotContribution[] = injectSlot(APP_SHELL_BANNERS_SLOT);

  /**
   * Property organizationSwitcher
   *
   * @description
   * Organization switcher contributions, first in the rail.
   *
   * @type {readonly SlotContribution[]}
   * @readonly
   */
  protected readonly organizationSwitcher: readonly SlotContribution[] = injectSlot(
    APP_SHELL_ORGANIZATION_SWITCHER_SLOT,
  );

  /**
   * Property railNavigation
   *
   * @description
   * Rail groups between the organization switcher and the rail footer.
   *
   * @type {readonly SlotContribution[]}
   * @readonly
   */
  protected readonly railNavigation: readonly SlotContribution[] = injectSlot(
    APP_SHELL_RAIL_NAVIGATION_SLOT,
  );

  /**
   * Property railFooter
   *
   * @description
   * Rail items pushed to the bottom of the rail.
   *
   * @type {readonly SlotContribution[]}
   * @readonly
   */
  protected readonly railFooter: readonly SlotContribution[] = injectSlot(
    APP_SHELL_RAIL_FOOTER_SLOT,
  );

  /**
   * Property sidebarHeader
   *
   * @description
   * Non-scrolling header rows of the space sidebar.
   *
   * @type {readonly SlotContribution[]}
   * @readonly
   */
  protected readonly sidebarHeader: readonly SlotContribution[] = injectSlot(
    APP_SHELL_SIDEBAR_HEADER_SLOT,
  );

  /**
   * Property sidebar
   *
   * @description
   * Content of the scrolling body of the space sidebar.
   *
   * @type {readonly SlotContribution[]}
   * @readonly
   */
  protected readonly sidebar: readonly SlotContribution[] = injectSlot(APP_SHELL_SIDEBAR_SLOT);

  /**
   * Property sidebarFooter
   *
   * @description
   * Rows of the sidebar footer.
   *
   * @type {readonly SlotContribution[]}
   * @readonly
   */
  protected readonly sidebarFooter: readonly SlotContribution[] = injectSlot(
    APP_SHELL_SIDEBAR_FOOTER_SLOT,
  );

  /**
   * Property overlays
   *
   * @description
   * Application-wide overlays rendered after the shell.
   *
   * @type {readonly SlotContribution[]}
   * @readonly
   */
  protected readonly overlays: readonly SlotContribution[] = injectSlot(APP_SHELL_OVERLAYS_SLOT);

  /**
   * Property sidebarState
   *
   * @description
   * Expanded or collapsed state of the space sidebar, two-way bound to `cw-sidebar`. It starts
   * collapsed below 1024 px, where the sidebar covers the content, and expanded otherwise or when
   * the viewport cannot be queried.
   *
   * @type {WritableSignal<CwSidebarState>}
   * @readonly
   */
  protected readonly sidebarState: WritableSignal<CwSidebarState> = signal<CwSidebarState>(
    this.overlaidSidebar() ? 'collapsed' : 'expanded',
  );
  // #endregion

  // #region Methods
  /**
   * Method overlaidSidebar
   *
   * @description
   * Tells whether the current viewport is narrower than 1024 px.
   *
   * @returns {boolean} True when the sidebar covers the content at this width.
   */
  private overlaidSidebar(): boolean {
    const view: Window | null = inject(DOCUMENT).defaultView;
    return typeof view?.matchMedia === 'function' && view.matchMedia(SIDEBAR_OVERLAY_QUERY).matches;
  }
  // #endregion
}
