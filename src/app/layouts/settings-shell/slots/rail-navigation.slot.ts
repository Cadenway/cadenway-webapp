import { InjectionToken } from '@angular/core';
import type { SlotContribution } from '@shared/layout-slot';

/**
 * Constant SETTINGS_SHELL_RAIL_NAVIGATION_SLOT
 *
 * @description
 * Additive rail navigation of the settings shell. Each contribution renders its own cw-app-rail-group, optionally preceded by a cw-app-rail-separator.
 *
 * @type {InjectionToken<readonly SlotContribution[]>}
 */
export const SETTINGS_SHELL_RAIL_NAVIGATION_SLOT: InjectionToken<readonly SlotContribution[]> =
  new InjectionToken<readonly SlotContribution[]>('SETTINGS_SHELL_RAIL_NAVIGATION_SLOT');
