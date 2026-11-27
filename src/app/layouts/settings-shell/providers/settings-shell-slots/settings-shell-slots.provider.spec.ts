import { Component, type InjectionToken } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { SlotContribution } from '@shared/layout-slot';
import { describe, expect, it } from 'vitest';

import {
  SETTINGS_SHELL_OVERLAYS_SLOT,
  SETTINGS_SHELL_RAIL_FOOTER_SLOT,
  SETTINGS_SHELL_RAIL_NAVIGATION_SLOT,
  SETTINGS_SHELL_SETTINGS_NAVIGATION_SLOT,
} from '../../slots';
import { provideSettingsShellSlots } from './settings-shell-slots.provider';

/**
 * Component SlotStub
 *
 * @description
 * Placeholder component carried by the contributions under test.
 */
@Component({ selector: 'cw-slot-stub', template: '' })
class SlotStub {}

/**
 * Function feature
 *
 * @description
 * Builds a slot feature contributing the stub under the given id.
 *
 * @param {string} id - Contribution id.
 * @returns {{ useFactory: () => SlotContribution }} The slot feature.
 */
function feature(id: string): { useFactory: () => SlotContribution } {
  return { useFactory: (): SlotContribution => ({ id, order: 0, component: SlotStub }) };
}

/**
 * Function ids
 *
 * @description
 * Lists the ids of the contributions registered on a slot.
 *
 * @param {InjectionToken<readonly SlotContribution[]>} slot - Slot to read.
 * @returns {string[]} Contribution ids in registration order.
 */
function ids(slot: InjectionToken<readonly SlotContribution[]>): string[] {
  return (TestBed.inject(slot, null) ?? []).map((item: SlotContribution): string => item.id);
}

describe('provideSettingsShellSlots', () => {
  it('registers each list as multi contributions of its slot and adds repeated calls up', () => {
    TestBed.configureTestingModule({
      providers: [
        provideSettingsShellSlots({
          railNavigation: [feature('applications')],
          railFooter: [feature('search')],
          settingsNavigation: [feature('account')],
          overlays: [feature('palette')],
        }),
        provideSettingsShellSlots({ settingsNavigation: [feature('organization')] }),
      ],
    });

    expect(ids(SETTINGS_SHELL_RAIL_NAVIGATION_SLOT)).toEqual(['applications']);
    expect(ids(SETTINGS_SHELL_RAIL_FOOTER_SLOT)).toEqual(['search']);
    expect(ids(SETTINGS_SHELL_SETTINGS_NAVIGATION_SLOT)).toEqual(['account', 'organization']);
    expect(ids(SETTINGS_SHELL_OVERLAYS_SLOT)).toEqual(['palette']);
  });

  it('leaves omitted slots unprovided', () => {
    TestBed.configureTestingModule({ providers: [provideSettingsShellSlots({})] });

    expect(TestBed.inject(SETTINGS_SHELL_RAIL_NAVIGATION_SLOT, null)).toBeNull();
    expect(TestBed.inject(SETTINGS_SHELL_SETTINGS_NAVIGATION_SLOT, null)).toBeNull();
    expect(TestBed.inject(SETTINGS_SHELL_OVERLAYS_SLOT, null)).toBeNull();
  });
});
