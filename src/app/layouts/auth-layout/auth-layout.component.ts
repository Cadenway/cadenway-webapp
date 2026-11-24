import { NgComponentOutlet } from '@angular/common';
import { Component, inject, LOCALE_ID } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { CwLogo } from '@cadenway/ui/components/logo';
import { provideCwLocale, provideCwPhoneSheets } from '@cadenway/ui/core';
import { injectSlot, type SlotContribution } from '@shared/layout-slot';

import { AUTH_FOOTER_LINKS_SLOT, AUTH_HEADER_ACTIONS_SLOT } from './slots';

/**
 * Component AuthLayout
 *
 * @description
 * The sign-in frame of mockup `Main.dc.html`: a 56 px header with the Cadenway lockup linking to
 * the root and the `headerActions` contributions, a centred card of at most 400 px holding the
 * routed screen, and a footer of `footerLinks` contributions. Contributions render in ascending
 * order; an empty slot renders nothing, the footer landmark included. The routed screen is a flex
 * item of the card's 24 px column. The layout provides the `@cadenway/ui` locale from `LOCALE_ID`
 * and the phone sheets to its subtree.
 */
@Component({
  selector: 'cw-auth-layout',
  imports: [CwLogo, NgComponentOutlet, RouterLink, RouterOutlet],
  providers: [provideCwLocale(() => inject(LOCALE_ID)), provideCwPhoneSheets()],
  templateUrl: './auth-layout.component.html',
})
export class AuthLayout {
  // #region Properties
  /**
   * Property headerActions
   *
   * @description
   * Header actions, ordered once when the layout is created.
   *
   * @type {readonly SlotContribution[]}
   * @readonly
   */
  protected readonly headerActions: readonly SlotContribution[] =
    injectSlot(AUTH_HEADER_ACTIONS_SLOT);

  /**
   * Property footerLinks
   *
   * @description
   * Footer entries, ordered once when the layout is created.
   *
   * @type {readonly SlotContribution[]}
   * @readonly
   */
  protected readonly footerLinks: readonly SlotContribution[] = injectSlot(AUTH_FOOTER_LINKS_SLOT);
  // #endregion
}
