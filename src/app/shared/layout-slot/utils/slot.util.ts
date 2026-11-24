import { inject, type InjectionToken, type Provider } from '@angular/core';

import type { SlotContribution } from '../models/slot-contribution.interface';
import type { SlotFeature } from '../models/slot-feature.interface';

/**
 * Function slotProviders
 *
 * @description
 * Binds each slot feature to the slot token as an Angular multi provider, so several features
 * listed in the providers of the same route add to the slot instead of replacing each other.
 *
 * @param {InjectionToken<readonly SlotContribution[]>} slot - Slot token receiving the
 * contributions.
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
 * empty list, so a layout renders nothing for it. Ids must be unique within a slot, since layouts
 * track rendered contributions by id: in development mode a duplicate id throws at once, naming
 * the slot and the id, instead of being dropped silently; production builds skip the check.
 *
 * @param {InjectionToken<readonly SlotContribution[]>} slot - Slot token to read.
 * @returns {readonly SlotContribution[]} The ordered contributions.
 * @throws {Error} In development mode, when two contributions of the slot share an id.
 */
export function injectSlot(
  slot: InjectionToken<readonly SlotContribution[]>,
): readonly SlotContribution[] {
  const contributions: readonly SlotContribution[] =
    inject<readonly SlotContribution[]>(slot, { optional: true }) ?? [];
  if (ngDevMode) {
    const seen: Set<string> = new Set<string>();
    for (const { id } of contributions) {
      if (seen.has(id)) {
        throw new Error(`Duplicate contribution id "${id}" in ${slot.toString()}.`);
      }
      seen.add(id);
    }
  }
  return [...contributions].sort(
    (left: SlotContribution, right: SlotContribution): number => left.order - right.order,
  );
}
