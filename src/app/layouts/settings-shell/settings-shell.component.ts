import { NgComponentOutlet } from '@angular/common';
import { Component, inject, LOCALE_ID, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, type Data, RouterOutlet } from '@angular/router';
import { CwAppRail, CwAppRailFooter } from '@cadenway/ui/components/app-rail';
import { CwToaster, provideCwToastLabels } from '@cadenway/ui/components/toast';
import { provideCwLocale, provideCwPhoneSheets } from '@cadenway/ui/core';
import { injectSlot, type SlotContribution } from '@shared/layout-slot';
import { map } from 'rxjs';

import type { SettingsShellRouteData } from './models/settings-shell-route-data.interface';
import {
  SETTINGS_SHELL_OVERLAYS_SLOT,
  SETTINGS_SHELL_RAIL_FOOTER_SLOT,
  SETTINGS_SHELL_RAIL_NAVIGATION_SLOT,
  SETTINGS_SHELL_SETTINGS_NAVIGATION_SLOT,
} from './slots';

/**
 * Component SettingsShell
 *
 * @description
 * The settings frame of mockups `Compte.dc.html` and `Organisation.dc.html`: the simplified 56 px
 * applications rail (`railNavigation` groups and `railFooter` items; a bottom tab bar below 768
 * px), then a rounded panel holding the 240 px settings navigation of `settingsNavigation`
 * contributions, named by the route's `SettingsShellRouteData`, and the `main` landmark with the
 * routed section. Below 768 px the navigation stacks above the content and the whole panel scrolls;
 * from 768 px the two columns sit side by side without wrapping and scroll on their own.
 * Contributions render in ascending order and an empty slot renders nothing, the settings
 * navigation landmark included. The `overlays` render after the panel, then the one `cw-toaster`
 * of the shell, where `CwToastService` shows the settings sections' toasts (with Undo). The layout
 * provides the `@cadenway/ui` locale from `LOCALE_ID`, the phone sheets and the toaster's English
 * texts to its subtree.
 */
@Component({
  selector: 'cw-settings-shell',
  imports: [CwAppRail, CwAppRailFooter, CwToaster, NgComponentOutlet, RouterOutlet],
  providers: [
    provideCwLocale(() => inject(LOCALE_ID)),
    provideCwPhoneSheets(),
    provideCwToastLabels(() => ({
      undo: $localize`:@@layouts.settings-shell.toast-undo:Undo`,
      close: $localize`:@@layouts.settings-shell.toast-close:Close the notification`,
      ariaLabel: $localize`:@@layouts.settings-shell.toast-region:Notifications (F8)`,
      older: (count: number): string =>
        $localize`:@@layouts.settings-shell.toast-older:+${count}:count: older`,
    })),
  ],
  templateUrl: './settings-shell.component.html',
})
export class SettingsShell {
  // #region Properties
  /**
   * Property railNavigation
   *
   * @description
   * Rail groups, ordered once when the shell is created.
   *
   * @type {readonly SlotContribution[]}
   * @readonly
   */
  protected readonly railNavigation: readonly SlotContribution[] = injectSlot(
    SETTINGS_SHELL_RAIL_NAVIGATION_SLOT,
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
    SETTINGS_SHELL_RAIL_FOOTER_SLOT,
  );

  /**
   * Property settingsNavigation
   *
   * @description
   * Groups of the settings navigation.
   *
   * @type {readonly SlotContribution[]}
   * @readonly
   */
  protected readonly settingsNavigation: readonly SlotContribution[] = injectSlot(
    SETTINGS_SHELL_SETTINGS_NAVIGATION_SLOT,
  );

  /**
   * Property overlays
   *
   * @description
   * Overlays rendered after the panel, before the toaster.
   *
   * @type {readonly SlotContribution[]}
   * @readonly
   */
  protected readonly overlays: readonly SlotContribution[] = injectSlot(
    SETTINGS_SHELL_OVERLAYS_SLOT,
  );

  /**
   * Property navigationLabel
   *
   * @description
   * Accessible name of the settings navigation, from the `settingsNavigationLabel` of the route
   * that loads the shell; null, and no `aria-label`, when the route gives none.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  protected readonly navigationLabel: Signal<string | null>;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Follows the route `data`, which a resolver run may replace.
   *
   * @constructor
   */
  public constructor() {
    const route: ActivatedRoute = inject(ActivatedRoute);
    const read: (data: Data) => string | null = (data: Data): string | null => {
      const label: unknown = (data as Partial<SettingsShellRouteData>).settingsNavigationLabel;
      return typeof label === 'string' && label !== '' ? label : null;
    };
    this.navigationLabel = toSignal(route.data.pipe(map(read)), {
      initialValue: read(route.snapshot.data),
    });
  }
  // #endregion
}
