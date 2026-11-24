import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { SlotContribution } from '@shared/layout-slot';
import { describe, expect, it } from 'vitest';

import { AUTH_FOOTER_LINKS_SLOT, AUTH_HEADER_ACTIONS_SLOT } from '../../slots';
import { provideAuthLayoutSlots } from './auth-layout-slots.provider';

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
 * @param {readonly SlotContribution[] | null} contributions - Injected slot value.
 * @returns {string[]} Contribution ids in registration order.
 */
function ids(contributions: readonly SlotContribution[] | null): string[] {
  return (contributions ?? []).map((item: SlotContribution): string => item.id);
}

describe('provideAuthLayoutSlots', () => {
  it('registers each list as multi contributions of its slot and adds repeated calls up', () => {
    TestBed.configureTestingModule({
      providers: [
        provideAuthLayoutSlots({
          headerActions: [feature('theme')],
          footerLinks: [feature('privacy')],
        }),
        provideAuthLayoutSlots({ footerLinks: [feature('help')] }),
      ],
    });

    expect(ids(TestBed.inject(AUTH_HEADER_ACTIONS_SLOT))).toEqual(['theme']);
    expect(ids(TestBed.inject(AUTH_FOOTER_LINKS_SLOT))).toEqual(['privacy', 'help']);
  });

  it('leaves an omitted slot unprovided', () => {
    TestBed.configureTestingModule({ providers: [provideAuthLayoutSlots({})] });

    expect(TestBed.inject(AUTH_HEADER_ACTIONS_SLOT, null)).toBeNull();
    expect(TestBed.inject(AUTH_FOOTER_LINKS_SLOT, null)).toBeNull();
  });
});
