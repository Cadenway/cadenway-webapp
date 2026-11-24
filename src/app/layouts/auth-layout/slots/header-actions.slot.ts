import { InjectionToken } from '@angular/core';
import type { SlotContribution } from '@shared/layout-slot';

/**
 * Constant AUTH_HEADER_ACTIONS_SLOT
 *
 * @description
 * Additive actions at the right of the sign-in header, such as the theme toggle. The layout sorts them by order and renders nothing when the slot is empty.
 *
 * @type {InjectionToken<readonly SlotContribution[]>}
 */
export const AUTH_HEADER_ACTIONS_SLOT: InjectionToken<readonly SlotContribution[]> =
  new InjectionToken<readonly SlotContribution[]>('AUTH_HEADER_ACTIONS_SLOT');
