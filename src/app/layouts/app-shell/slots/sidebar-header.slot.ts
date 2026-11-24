import { InjectionToken } from '@angular/core';
import type { SlotContribution } from '@shared/layout-slot';

/**
 * Constant APP_SHELL_SIDEBAR_HEADER_SLOT
 *
 * @description
 * Additive rows of the non-scrolling sidebar header inside cw-sidebar-header, such as the
 * organization switcher row and the search button that opens the command palette.
 *
 * @type {InjectionToken<readonly SlotContribution[]>}
 */
export const APP_SHELL_SIDEBAR_HEADER_SLOT: InjectionToken<readonly SlotContribution[]> =
  new InjectionToken<readonly SlotContribution[]>('APP_SHELL_SIDEBAR_HEADER_SLOT');
