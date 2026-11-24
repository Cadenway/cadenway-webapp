import { NgComponentOutlet } from '@angular/common';
import { Component, inject, LOCALE_ID } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CwAppRail, CwAppRailFooter } from '@cadenway/ui/components/app-rail';
import { provideCwLocale, provideCwPhoneSheets } from '@cadenway/ui/core';
import { injectSlot, type SlotContribution } from '@shared/layout-slot';

import {
  SETTINGS_SHELL_RAIL_FOOTER_SLOT,
  SETTINGS_SHELL_RAIL_NAVIGATION_SLOT,
  SETTINGS_SHELL_SETTINGS_NAVIGATION_SLOT,
} from './slots';

/**
 * Component SettingsShell
 *
 * @description
 * The settings frame of mockups `Compte.dc.html` and `Organisation.dc.html`: the simplified 56 px
 * applications rail (`railNavigation` groups and `railFooter` items; a bottom tab bar below
 * 768 px), then a rounded panel holding the 240 px « Settings » navigation of `settingsNavigation`
 * contributions and the `main` landmark with the routed section. Below 768 px the navigation
 * stacks above the content and the whole panel scrolls; from 768 px both columns scroll on their
 * own. Contributions render in ascending order and an empty slot renders nothing, the settings
 * navigation landmark included. The layout provides the `@cadenway/ui` locale from `LOCALE_ID`
 * and the phone sheets to its subtree.
 */
@Component({
  selector: 'cw-settings-shell',
  imports: [CwAppRail, CwAppRailFooter, NgComponentOutlet, RouterOutlet],
  providers: [provideCwLocale(() => inject(LOCALE_ID)), provideCwPhoneSheets()],
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
  // #endregion
}
