import { InjectionToken } from '@angular/core';
import type { SlotContribution } from '@shared/layout-slot';

/**
 * Constant APP_SHELL_BANNERS_SLOT
 *
 * @description
 * Additive application-wide banners rendered above the rail and the main panel, such as the storage quota banner built on cw-banner with placement top.
 *
 * @type {InjectionToken<readonly SlotContribution[]>}
 */
export const APP_SHELL_BANNERS_SLOT: InjectionToken<readonly SlotContribution[]> =
  new InjectionToken<readonly SlotContribution[]>('APP_SHELL_BANNERS_SLOT');
