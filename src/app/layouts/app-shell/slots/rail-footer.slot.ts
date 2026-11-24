import { InjectionToken } from '@angular/core';
import type { SlotContribution } from '@shared/layout-slot';

/**
 * Constant APP_SHELL_RAIL_FOOTER_SLOT
 *
 * @description
 * Additive rail items pushed to the bottom of the rail inside cw-app-rail-footer, such as search, theme and the account menu.
 *
 * @type {InjectionToken<readonly SlotContribution[]>}
 */
export const APP_SHELL_RAIL_FOOTER_SLOT: InjectionToken<readonly SlotContribution[]> =
  new InjectionToken<readonly SlotContribution[]>('APP_SHELL_RAIL_FOOTER_SLOT');
