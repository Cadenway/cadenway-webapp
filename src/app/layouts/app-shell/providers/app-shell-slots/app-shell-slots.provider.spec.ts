import { Component, type InjectionToken } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { SlotContribution } from '@shared/layout-slot';
import { describe, expect, it } from 'vitest';

import {
  APP_SHELL_BANNERS_SLOT,
  APP_SHELL_ORGANIZATION_SWITCHER_SLOT,
  APP_SHELL_OVERLAYS_SLOT,
  APP_SHELL_RAIL_FOOTER_SLOT,
  APP_SHELL_RAIL_NAVIGATION_SLOT,
  APP_SHELL_SIDEBAR_FOOTER_SLOT,
  APP_SHELL_SIDEBAR_HEADER_SLOT,
  APP_SHELL_SIDEBAR_SLOT,
} from '../../slots';
import { provideAppShellSlots } from './app-shell-slots.provider';

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

describe('provideAppShellSlots', () => {
  it('registers each list as multi contributions of its slot and adds repeated calls up', () => {
    TestBed.configureTestingModule({
      providers: [
        provideAppShellSlots({
          banners: [feature('storage')],
          organizationSwitcher: [feature('organizations')],
          railNavigation: [feature('applications')],
          railFooter: [feature('search')],
          sidebarHeader: [feature('organization-row')],
          sidebar: [feature('spaces')],
          sidebarFooter: [feature('sprint')],
          overlays: [feature('palette')],
        }),
        provideAppShellSlots({ railNavigation: [feature('favorites')] }),
      ],
    });

    expect(ids(APP_SHELL_BANNERS_SLOT)).toEqual(['storage']);
    expect(ids(APP_SHELL_ORGANIZATION_SWITCHER_SLOT)).toEqual(['organizations']);
    expect(ids(APP_SHELL_RAIL_NAVIGATION_SLOT)).toEqual(['applications', 'favorites']);
    expect(ids(APP_SHELL_RAIL_FOOTER_SLOT)).toEqual(['search']);
    expect(ids(APP_SHELL_SIDEBAR_HEADER_SLOT)).toEqual(['organization-row']);
    expect(ids(APP_SHELL_SIDEBAR_SLOT)).toEqual(['spaces']);
    expect(ids(APP_SHELL_SIDEBAR_FOOTER_SLOT)).toEqual(['sprint']);
    expect(ids(APP_SHELL_OVERLAYS_SLOT)).toEqual(['palette']);
  });

  it('leaves omitted slots unprovided', () => {
    TestBed.configureTestingModule({ providers: [provideAppShellSlots({})] });

    expect(TestBed.inject(APP_SHELL_BANNERS_SLOT, null)).toBeNull();
    expect(TestBed.inject(APP_SHELL_OVERLAYS_SLOT, null)).toBeNull();
  });
});
