import { InjectionToken } from '@angular/core';
import type { SlotContribution } from '@shared/layout-slot';

/**
 * Constant SETTINGS_SHELL_OVERLAYS_SLOT
 *
 * @description
 * Additive overlays rendered after the settings shell, such as the command palette the rail's
 * search opens, the shortcuts dialog and the reauthentication dialog.
 *
 * @type {InjectionToken<readonly SlotContribution[]>}
 */
export const SETTINGS_SHELL_OVERLAYS_SLOT: InjectionToken<readonly SlotContribution[]> =
  new InjectionToken<readonly SlotContribution[]>('SETTINGS_SHELL_OVERLAYS_SLOT');
