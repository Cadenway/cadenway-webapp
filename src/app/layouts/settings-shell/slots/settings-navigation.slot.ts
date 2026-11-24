import { InjectionToken } from '@angular/core';
import type { SlotContribution } from '@shared/layout-slot';

/**
 * Constant SETTINGS_SHELL_SETTINGS_NAVIGATION_SLOT
 *
 * @description
 * Additive groups of the settings navigation, such as the back link, the account sections and the organization sections. The navigation renders only when the slot has contributions.
 *
 * @type {InjectionToken<readonly SlotContribution[]>}
 */
export const SETTINGS_SHELL_SETTINGS_NAVIGATION_SLOT: InjectionToken<readonly SlotContribution[]> =
  new InjectionToken<readonly SlotContribution[]>('SETTINGS_SHELL_SETTINGS_NAVIGATION_SLOT');
