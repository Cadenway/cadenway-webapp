import { InjectionToken } from '@angular/core';
import type { SlotContribution } from '@shared/layout-slot';

/**
 * Constant APP_SHELL_SIDEBAR_SLOT
 *
 * @description
 * Additive content of the scrolling body of the space sidebar, such as favorites and the spaces
 * tree.
 *
 * @type {InjectionToken<readonly SlotContribution[]>}
 */
export const APP_SHELL_SIDEBAR_SLOT: InjectionToken<readonly SlotContribution[]> =
  new InjectionToken<readonly SlotContribution[]>('APP_SHELL_SIDEBAR_SLOT');
