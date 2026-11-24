import { InjectionToken } from '@angular/core';
import type { SlotContribution } from '@shared/layout-slot';

/**
 * Constant APP_SHELL_SIDEBAR_FOOTER_SLOT
 *
 * @description
 * Additive rows of the sidebar footer inside cw-sidebar-footer, such as the sprint progress and the
 * trash and archives links.
 *
 * @type {InjectionToken<readonly SlotContribution[]>}
 */
export const APP_SHELL_SIDEBAR_FOOTER_SLOT: InjectionToken<readonly SlotContribution[]> =
  new InjectionToken<readonly SlotContribution[]>('APP_SHELL_SIDEBAR_FOOTER_SLOT');
