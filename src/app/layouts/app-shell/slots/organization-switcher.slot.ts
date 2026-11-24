import { InjectionToken } from '@angular/core';
import type { SlotContribution } from '@shared/layout-slot';

/**
 * Constant APP_SHELL_ORGANIZATION_SWITCHER_SLOT
 *
 * @description
 * Additive organization switcher rendered first in the rail, in a desktop-only rail group followed by a separator.
 *
 * @type {InjectionToken<readonly SlotContribution[]>}
 */
export const APP_SHELL_ORGANIZATION_SWITCHER_SLOT: InjectionToken<readonly SlotContribution[]> =
  new InjectionToken<readonly SlotContribution[]>('APP_SHELL_ORGANIZATION_SWITCHER_SLOT');
