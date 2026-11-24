import { InjectionToken } from '@angular/core';
import type { SlotContribution } from '@shared/layout-slot';

/**
 * Constant SETTINGS_SHELL_RAIL_FOOTER_SLOT
 *
 * @description
 * Additive rail items pushed to the bottom of the settings rail inside cw-app-rail-footer, such as search, theme and the account avatar.
 *
 * @type {InjectionToken<readonly SlotContribution[]>}
 */
export const SETTINGS_SHELL_RAIL_FOOTER_SLOT: InjectionToken<readonly SlotContribution[]> =
  new InjectionToken<readonly SlotContribution[]>('SETTINGS_SHELL_RAIL_FOOTER_SLOT');
