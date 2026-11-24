import { InjectionToken } from '@angular/core';
import type { SlotContribution } from '@shared/layout-slot';

/**
 * Constant APP_SHELL_RAIL_NAVIGATION_SLOT
 *
 * @description
 * Additive rail navigation. Each contribution renders its own cw-app-rail-group, optionally preceded by a cw-app-rail-separator, such as the applications and the favorite spaces.
 *
 * @type {InjectionToken<readonly SlotContribution[]>}
 */
export const APP_SHELL_RAIL_NAVIGATION_SLOT: InjectionToken<readonly SlotContribution[]> =
  new InjectionToken<readonly SlotContribution[]>('APP_SHELL_RAIL_NAVIGATION_SLOT');
