import { InjectionToken } from '@angular/core';
import type { SlotContribution } from '@shared/layout-slot';

/**
 * Constant APP_SHELL_OVERLAYS_SLOT
 *
 * @description
 * Additive application-wide overlays rendered after the shell, such as the command palette and the shortcuts dialog.
 *
 * @type {InjectionToken<readonly SlotContribution[]>}
 */
export const APP_SHELL_OVERLAYS_SLOT: InjectionToken<readonly SlotContribution[]> =
  new InjectionToken<readonly SlotContribution[]>('APP_SHELL_OVERLAYS_SLOT');
