import { Component, InjectionToken, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import type { SlotContribution } from '../models/slot-contribution.interface';
import { injectSlot, slotProviders } from './slot.util';

/**
 * Component SlotStub
 *
 * @description
 * Placeholder component carried by the contributions under test.
 */
@Component({ selector: 'cw-slot-stub', template: '' })
class SlotStub {}

/**
 * Constant TEST_SLOT
 *
 * @description
 * Slot token the specs register contributions on.
 *
 * @type {InjectionToken<readonly SlotContribution[]>}
 */
const TEST_SLOT: InjectionToken<readonly SlotContribution[]> = new InjectionToken<
  readonly SlotContribution[]
>('TEST_SLOT');

/**
 * Constant CONTEXT
 *
 * @description
 * Value a contribution factory injects to prove it runs in an injection context.
 *
 * @type {InjectionToken<string>}
 */
const CONTEXT: InjectionToken<string> = new InjectionToken<string>('CONTEXT');

/**
 * Function contribution
 *
 * @description
 * Builds a contribution of the stub component.
 *
 * @param {string} id - Contribution id.
 * @param {number} order - Contribution order.
 * @returns {SlotContribution} The contribution.
 */
function contribution(id: string, order: number): SlotContribution {
  return { id, order, component: SlotStub };
}

describe('slotProviders', () => {
  it('registers each feature as a multi contribution built in an injection context', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: CONTEXT, useValue: 'from-context' },
        ...slotProviders(TEST_SLOT, [
          { useFactory: (): SlotContribution => contribution('first', 1) },
          { useFactory: (): SlotContribution => contribution(inject(CONTEXT), 2) },
        ]),
        ...slotProviders(TEST_SLOT, [
          { useFactory: (): SlotContribution => contribution('third', 3) },
        ]),
      ],
    });

    expect(TestBed.inject(TEST_SLOT).map((item: SlotContribution): string => item.id)).toEqual([
      'first',
      'from-context',
      'third',
    ]);
  });

  it('registers nothing for an omitted list', () => {
    expect(slotProviders(TEST_SLOT, undefined)).toEqual([]);
  });
});

describe('injectSlot', () => {
  it('sorts the contributions by ascending order and keeps ties in registration order', () => {
    TestBed.configureTestingModule({
      providers: slotProviders(TEST_SLOT, [
        { useFactory: (): SlotContribution => contribution('late', 20) },
        { useFactory: (): SlotContribution => contribution('tie-a', 10) },
        { useFactory: (): SlotContribution => contribution('early', 0) },
        { useFactory: (): SlotContribution => contribution('tie-b', 10) },
      ]),
    });

    const ordered: readonly SlotContribution[] = TestBed.runInInjectionContext(
      (): readonly SlotContribution[] => injectSlot(TEST_SLOT),
    );

    expect(ordered.map((item: SlotContribution): string => item.id)).toEqual([
      'early',
      'tie-a',
      'tie-b',
      'late',
    ]);
  });

  it('returns an empty list for a slot nobody provides', () => {
    expect(
      TestBed.runInInjectionContext((): readonly SlotContribution[] => injectSlot(TEST_SLOT)),
    ).toEqual([]);
  });
});
