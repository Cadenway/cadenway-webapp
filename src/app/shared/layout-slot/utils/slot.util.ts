import { inject, type InjectionToken, type Provider } from '@angular/core';

import type { SlotContribution } from '../models/slot-contribution.interface';
import type { SlotFeature } from '../models/slot-feature.interface';

/**
 * Function slotProviders
 *
 * @description
 * Binds each slot feature to the slot token as an Angular multi provider, so several features (or
 * several routes) add to the same slot instead of replacing each other.
 *
 * @param {InjectionToken<readonly SlotContribution[]>} slot - Slot token receiving the contributions.
 * @param {readonly SlotFeature<SlotContribution>[] | undefined} features - Contribution factories;
 * an omitted list registers nothing.
 * @returns {Provider[]} One multi factory provider per feature, in the given order.
 */
export function slotProviders(
  slot: InjectionToken<readonly SlotContribution[]>,
  features: readonly SlotFeature<SlotContribution>[] | undefined,
): Provider[] {
  return (features ?? []).map((feature: SlotFeature<SlotContribution>): Provider => ({
    provide: slot,
    useFactory: feature.useFactory,
    multi: true,
  }));
}

/**
 * Function injectSlot
 *
 * @description
 * Reads a slot in an injection context and returns its contributions sorted by ascending `order`;
 * contributions with the same order keep their registration order. A slot nobody provides gives an
 * empty list, so a layout renders nothing for it.
 *
 * @param {InjectionToken<readonly SlotContribution[]>} slot - Slot token to read.
 * @returns {readonly SlotContribution[]} The ordered contributions.
 */
export function injectSlot(
  slot: InjectionToken<readonly SlotContribution[]>,
): readonly SlotContribution[] {
  const contributions: readonly SlotContribution[] =
    inject<readonly SlotContribution[]>(slot, { optional: true }) ?? [];
  return [...contributions].sort(
    (left: SlotContribution, right: SlotContribution): number => left.order - right.order,
  );
}
