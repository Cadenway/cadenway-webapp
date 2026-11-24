import { InjectionToken } from '@angular/core';
import type { SlotContribution } from '@shared/layout-slot';

/**
 * Constant AUTH_FOOTER_LINKS_SLOT
 *
 * @description
 * Additive entries of the sign-in footer, such as the workspace name and the privacy, terms and
 * help links. The footer renders only when the slot has contributions.
 *
 * @type {InjectionToken<readonly SlotContribution[]>}
 */
export const AUTH_FOOTER_LINKS_SLOT: InjectionToken<readonly SlotContribution[]> =
  new InjectionToken<readonly SlotContribution[]>('AUTH_FOOTER_LINKS_SLOT');
