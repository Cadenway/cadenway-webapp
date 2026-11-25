import { NgComponentOutlet } from '@angular/common';
import {
  afterNextRender,
  Component,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  Injector,
  LOCALE_ID,
  type Signal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {
  CwAppRail,
  CwAppRailFooter,
  CwAppRailGroup,
  CwAppRailSeparator,
} from '@cadenway/ui/components/app-rail';
import { CwButton } from '@cadenway/ui/components/button';
import { CwSidebar, CwSidebarFooter, CwSidebarHeader } from '@cadenway/ui/components/sidebar';
import { CwToaster, provideCwToastLabels } from '@cadenway/ui/components/toast';
import { provideCwLocale, provideCwPhoneSheets } from '@cadenway/ui/core';
import { NgIcon } from '@ng-icons/core';
import { injectSlot, SHELL_SIDEBAR, type SlotContribution } from '@shared/layout-slot';

import { AppShellSidebar } from './services/app-shell-sidebar/app-shell-sidebar.service';
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
 * Constant FOCUSABLE
 *
 * @description
 * Selector of the elements focus may move to inside the sidebar.
 *
 * @type {string}
 */
const FOCUSABLE: string =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Component AppShell
 *
 * @description
 * The application frame of mockup `App.dc.html`: the `banners` across the top, then the 56 px
 * applications rail (`nav[cwAppRail]`, a bottom tab bar below 768 px) holding the
 * `organizationSwitcher`, the `railNavigation` groups and the `railFooter` items, and the rounded
 * main panel. The panel holds the off-canvas space sidebar (`sidebarHeader`, `sidebar` and
 * `sidebarFooter`) with the default `cw-sidebar` behavior, and the `main` landmark with the routed
 * screen. The first row of the sidebar header ends with a collapse button; while the sidebar is collapsed, an
 * expand toggle sits above the routed screen unless a screen claimed it through `SHELL_SIDEBAR`.
 * Opening with either toggle moves focus to the first control of the sidebar; any collapse that
 * leaves focus in the sidebar or on the page body returns it to the opener, or else to the expand
 * toggle. The `overlays` render last, then the one `cw-toaster` of the shell, where
 * `CwToastService` shows the contributions' toasts. Contributions render in ascending order and an empty slot
 * renders nothing. The route provides the `phosphorSidebarSimpleBold` icon through
 * `provideCadenwayIcons()`. The layout provides the `@cadenway/ui` locale from `LOCALE_ID`, the
 * phone sheets and `AppShellSidebar` to its subtree.
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
    CwToaster,
    NgComponentOutlet,
    NgIcon,
    RouterOutlet,
  ],
  providers: [
    provideCwLocale(() => inject(LOCALE_ID)),
    provideCwPhoneSheets(),
    provideCwToastLabels(() => ({
      undo: $localize`:@@layouts.app-shell.toast-undo:Undo`,
      close: $localize`:@@layouts.app-shell.toast-close:Close the notification`,
      ariaLabel: $localize`:@@layouts.app-shell.toast-region:Notifications (F8)`,
      older: (count: number): string =>
        $localize`:@@layouts.app-shell.toast-older:+${count}:count: older`,
    })),
    AppShellSidebar,
    { provide: SHELL_SIDEBAR, useExisting: AppShellSidebar },
  ],
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
   * Sidebar state shared with `cw-sidebar` and the routed screens.
   *
   * @type {AppShellSidebar}
   * @readonly
   */
  protected readonly sidebarState: AppShellSidebar = inject(AppShellSidebar);

  /**
   * Property spaceSidebar
   *
   * @description
   * The rendered `cw-sidebar`, whose `nav` id locates the focus targets.
   *
   * @type {Signal<CwSidebar | undefined>}
   * @readonly
   */
  private readonly spaceSidebar: Signal<CwSidebar | undefined> = viewChild(CwSidebar);

  /**
   * Property expandToggle
   *
   * @description
   * The shell's expand toggle, rendered while the sidebar is collapsed and the toggle unclaimed.
   *
   * @type {Signal<ElementRef<HTMLButtonElement> | undefined>}
   * @readonly
   */
  private readonly expandToggle: Signal<ElementRef<HTMLButtonElement> | undefined> = viewChild<
    string,
    ElementRef<HTMLButtonElement>
  >('expandToggle', { read: ElementRef });

  /**
   * Property document
   *
   * @description
   * Document holding the sidebar and the focused element.
   *
   * @type {Document}
   * @readonly
   */
  private readonly document: Document = inject(DOCUMENT);

  /**
   * Property injector
   *
   * @description
   * Injector scheduling the focus moves after rendering.
   *
   * @type {Injector}
   * @readonly
   */
  private readonly injector: Injector = inject(Injector);
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Moves focus after each sidebar state change, once the change is rendered; the initial state
   * moves nothing.
   *
   * @constructor
   */
  public constructor() {
    let initial: boolean = true;
    effect((): void => {
      const expanded: boolean = this.sidebarState.expanded();
      if (initial) {
        initial = false;
        return;
      }
      untracked((): void => {
        afterNextRender(
          (): void => {
            this.moveFocus(expanded);
          },
          { injector: this.injector },
        );
      });
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method moveFocus
   *
   * @description
   * After an opening by `toggle()`, focuses the first control of the sidebar. After a collapse that
   * left focus in the sidebar or on the body, focuses the opener, or else the expand toggle.
   *
   * @param {boolean} expanded - State that was just rendered.
   */
  private moveFocus(expanded: boolean): void {
    const id: string | undefined = this.spaceSidebar()?.id;
    const nav: HTMLElement | null = id ? this.document.getElementById(id) : null;
    if (expanded) {
      if (this.sidebarState.takeFocusRequest()) nav?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
      return;
    }
    const active: Element | null = this.document.activeElement;
    if (active && active !== this.document.body && !nav?.contains(active)) return;
    (this.sidebarState.returnTarget() ?? this.expandToggle()?.nativeElement)?.focus();
  }
  // #endregion
}
