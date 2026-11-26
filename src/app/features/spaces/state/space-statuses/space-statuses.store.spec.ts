import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { STATUS_ORDER } from '../../constants/statuses/statuses.constants';
import { SpaceStatusesApi } from '../../data-access/services/space-statuses-api/space-statuses-api.service';
import type { StatusKey } from '../../models/list-view-config/list-view-config.interface';
import type { SpaceDetails, SpaceStatusOption } from '../../models/space/space.interface';
import { ListPageStore } from '../list-page/list-page.store';
import { SpacesNavigationStore } from '../spaces-navigation/spaces-navigation.store';
import { SpaceStatusesStore } from './space-statuses.store';

/**
 * Function statuses
 *
 * @description
 * The ten statuses of a space, with some renamed or hidden.
 *
 * @param {Partial<Record<StatusKey, Partial<SpaceStatusOption>>>} overrides - Changes by key.
 * @returns {readonly SpaceStatusOption[]} The statuses in workflow order.
 */
function statuses(
  overrides: Partial<Record<StatusKey, Partial<SpaceStatusOption>>> = {},
): readonly SpaceStatusOption[] {
  return STATUS_ORDER.map((key: StatusKey): SpaceStatusOption => ({
    key,
    name: null,
    hidden: false,
    ...overrides[key],
  }));
}

/**
 * Function product
 *
 * @description
 * The `Product` space of Atelier Nord at a version.
 *
 * @param {number} version - Its version.
 * @param {Partial<Record<StatusKey, Partial<SpaceStatusOption>>>} overrides - Its status changes.
 * @returns {SpaceDetails} The space.
 */
function product(
  version: number,
  overrides: Partial<Record<StatusKey, Partial<SpaceStatusOption>>> = {},
): SpaceDetails {
  return {
    id: 'sp-product',
    name: 'Product',
    prefix: 'CAD',
    canEdit: true,
    canManage: true,
    version,
    description: null,
    icon: 'rocket',
    color: 'violet',
    private: false,
    statuses: statuses(overrides),
  };
}

/**
 * Interface Deferred
 *
 * @description
 * A promise a test settles by hand.
 */
interface Deferred {
  // #region Properties
  /**
   * Property promise
   *
   * @description
   * The pending promise.
   *
   * @type {Promise<SpaceDetails>}
   * @readonly
   */
  readonly promise: Promise<SpaceDetails>;

  /**
   * Property resolve
   *
   * @description
   * Settles it with a space.
   *
   * @type {(space: SpaceDetails) => void}
   * @readonly
   */
  readonly resolve: (space: SpaceDetails) => void;

  /**
   * Property reject
   *
   * @description
   * Refuses it.
   *
   * @type {(error: unknown) => void}
   * @readonly
   */
  readonly reject: (error: unknown) => void;
  // #endregion
}

/**
 * Function deferred
 *
 * @description
 * Creates a promise a test settles by hand.
 *
 * @returns {Deferred} The promise and its settlers.
 */
function deferred(): Deferred {
  let resolve!: (space: SpaceDetails) => void;
  let reject!: (error: unknown) => void;
  const promise: Promise<SpaceDetails> = new Promise<SpaceDetails>(
    (done: (space: SpaceDetails) => void, fail: (error: unknown) => void): void => {
      resolve = done;
      reject = fail;
    },
  );
  return { promise, resolve, reject };
}

describe('SpaceStatusesStore', () => {
  let update: Mock;
  let reloadSpace: Mock;
  let refresh: Mock;
  let space: WritableSignal<SpaceDetails | null>;
  let store: InstanceType<typeof SpaceStatusesStore>;

  /**
   * Function shown
   *
   * @description
   * The status shown for a key.
   *
   * @param {StatusKey} key - The status.
   * @returns {SpaceStatusOption | undefined} The status.
   */
  function shown(key: StatusKey): SpaceStatusOption | undefined {
    return store.statuses().find((status: SpaceStatusOption): boolean => status.key === key);
  }

  beforeEach(() => {
    update = vi.fn();
    reloadSpace = vi.fn();
    refresh = vi.fn();
    space = signal<SpaceDetails | null>(product(7, { testing: { hidden: true } }));
    TestBed.configureTestingModule({
      providers: [
        SpaceStatusesStore,
        { provide: SpaceStatusesApi, useValue: { update } },
        { provide: ListPageStore, useValue: { space: { reload: reloadSpace } } },
        { provide: SpacesNavigationStore, useValue: { refresh } },
      ],
    });
    store = TestBed.inject(SpaceStatusesStore);
    store.follow(space);
    TestBed.tick();
  });

  it('shows the statuses of the space followed and counts those used', () => {
    expect(store.spaceId()).toBe('sp-product');
    expect(store.canEdit()).toBe(true);
    expect(store.statuses()).toHaveLength(10);
    expect(shown('testing')?.hidden).toBe(true);
    expect(store.usedCount()).toBe(9);
    expect(store.saving()).toBe(false);
  });

  it('stops using a status at once, records it from the version shown, then reads again', async () => {
    update.mockResolvedValueOnce(
      product(8, { testing: { hidden: true }, review: { hidden: true } }),
    );

    const written: Promise<boolean> = store.setUsed('review', false);

    expect(shown('review')?.hidden).toBe(true);
    expect(store.usedCount()).toBe(8);
    expect(store.saving()).toBe(true);
    expect(await written).toBe(true);
    expect(update).toHaveBeenCalledWith('sp-product', 7, { review: { hidden: true } });
    await Promise.resolve();
    expect(store.saving()).toBe(false);
    expect(reloadSpace).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('puts back the recorded state when the gateway refuses the change', async () => {
    update.mockRejectedValueOnce(new Error('412'));

    const written: Promise<boolean> = store.setUsed('testing', true);
    expect(shown('testing')?.hidden).toBe(false);

    expect(await written).toBe(false);
    expect(shown('testing')?.hidden).toBe(true);
    expect(store.usedCount()).toBe(9);
    expect(store.saving()).toBe(false);
  });

  it('never stops using To do or Done, and sends nothing for a state already shown', async () => {
    expect(await store.setUsed('todo', false)).toBe(true);
    expect(await store.setUsed('done', false)).toBe(true);
    expect(await store.setUsed('review', true)).toBe(true);

    expect(update).not.toHaveBeenCalled();
    expect(shown('todo')?.hidden).toBe(false);
  });

  it('writes the changes one after the other, each from the version the previous one recorded', async () => {
    const first: Deferred = deferred();
    const recorded: SpaceDetails = product(9, {
      testing: { hidden: true },
      review: { name: 'Code review' },
      backlog: { hidden: true },
    });
    update.mockReturnValueOnce(first.promise);
    update.mockResolvedValueOnce(recorded);

    const renamed: Promise<boolean> = store.rename('review', '  Code review  ');
    const hidden: Promise<boolean> = store.setUsed('backlog', false);
    expect(shown('review')?.name).toBe('Code review');
    expect(shown('backlog')?.hidden).toBe(true);
    await Promise.resolve();
    expect(update).toHaveBeenCalledTimes(1);

    first.resolve(product(8, { testing: { hidden: true }, review: { name: 'Code review' } }));
    expect(await renamed).toBe(true);
    expect(shown('backlog')?.hidden).toBe(true);
    expect(await hidden).toBe(true);

    expect(update).toHaveBeenNthCalledWith(1, 'sp-product', 7, { review: { name: 'Code review' } });
    expect(update).toHaveBeenNthCalledWith(2, 'sp-product', 8, { backlog: { hidden: true } });
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('takes back only the refused change and keeps the next one', async () => {
    update
      .mockRejectedValueOnce(new Error('422'))
      .mockResolvedValueOnce(product(8, { testing: { hidden: true }, backlog: { hidden: true } }));

    const renamed: Promise<boolean> = store.rename('review', 'QA');
    const hidden: Promise<boolean> = store.setUsed('backlog', false);

    expect(await renamed).toBe(false);
    expect(shown('review')?.name).toBeNull();
    expect(shown('backlog')?.hidden).toBe(true);
    expect(await hidden).toBe(true);
    expect(update).toHaveBeenNthCalledWith(2, 'sp-product', 7, { backlog: { hidden: true } });
  });

  it('puts back the default label for an empty name and cuts a name to 24 characters', async () => {
    space.set(product(7, { review: { name: 'Code review' } }));
    TestBed.tick();
    update
      .mockResolvedValueOnce(product(8))
      .mockResolvedValueOnce(product(9, { review: { name: 'A'.repeat(24) } }));

    expect(await store.rename('review', '   ')).toBe(true);
    expect(await store.rename('review', 'A'.repeat(30))).toBe(true);
    expect(await store.rename('review', ` ${'A'.repeat(24)} `)).toBe(true);

    expect(update).toHaveBeenNthCalledWith(1, 'sp-product', 7, { review: { name: null } });
    expect(update).toHaveBeenNthCalledWith(2, 'sp-product', 8, {
      review: { name: 'A'.repeat(24) },
    });
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('resets every status with a null change, and sends nothing when they are the defaults', async () => {
    update.mockResolvedValueOnce(product(8));

    const written: Promise<boolean> = store.reset();
    expect(store.usedCount()).toBe(10);
    expect(await written).toBe(true);
    expect(update).toHaveBeenCalledWith('sp-product', 7, null);

    expect(await store.reset()).toBe(true);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('keeps a pending change over a newer read, then takes reads at least as new', async () => {
    const first: Deferred = deferred();
    update.mockReturnValueOnce(first.promise);

    const written: Promise<boolean> = store.setUsed('review', false);
    space.set(product(8, { testing: { hidden: true }, blocked: { hidden: true } }));
    TestBed.tick();
    expect(shown('review')?.hidden).toBe(true);
    expect(shown('blocked')?.hidden).toBe(false);

    first.resolve(product(9, { testing: { hidden: true }, review: { hidden: true } }));
    await written;
    space.set(product(8, { blocked: { hidden: true } }));
    TestBed.tick();
    expect(shown('blocked')?.hidden).toBe(false);

    space.set(product(10, { blocked: { hidden: true } }));
    TestBed.tick();
    expect(shown('blocked')?.hidden).toBe(true);
    expect(shown('review')?.hidden).toBe(false);
  });

  it('changes nothing for a caller who may not edit the space', async () => {
    space.set({ ...product(7), id: 'sp-design', canEdit: false });
    TestBed.tick();

    expect(await store.setUsed('review', false)).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(shown('review')?.hidden).toBe(false);
  });
});
