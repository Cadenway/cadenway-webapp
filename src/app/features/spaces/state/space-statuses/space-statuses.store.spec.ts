import { HttpErrorResponse } from '@angular/common/http';
import {
  createEnvironmentInjector,
  EnvironmentInjector,
  type ResourceStatus,
  signal,
  type WritableSignal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { STATUS_ORDER } from '../../constants/statuses/statuses.constants';
import { SpaceStatusesApi } from '../../data-access/services/space-statuses-api/space-statuses-api.service';
import type { StatusKey } from '../../models/list-view-config/list-view-config.interface';
import type { SpaceDetails, SpaceStatusOption } from '../../models/space/space.interface';
import { ListPageStore } from '../list-page/list-page.store';
import { SpacesNavigationStore } from '../spaces-navigation/spaces-navigation.store';
import { type SpaceStatusesOutcome, SpaceStatusesStore } from './space-statuses.store';

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

/**
 * Function problem
 *
 * @description
 * A failed gateway answer.
 *
 * @param {number} status - HTTP status, zero for a network failure.
 * @param {string | undefined} code - Problem code of the body, if any.
 * @returns {HttpErrorResponse} The failure.
 */
function problem(status: number, code?: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: code ? { status, code } : null });
}

describe('SpaceStatusesStore', () => {
  let update: Mock;
  let read: Mock;
  let reloadSpace: Mock;
  let spaceStatus: WritableSignal<ResourceStatus>;
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
    read = vi.fn();
    spaceStatus = signal<ResourceStatus>('resolved');
    reloadSpace = vi.fn((): boolean => spaceStatus() !== 'loading');
    refresh = vi.fn();
    space = signal<SpaceDetails | null>(product(7, { testing: { hidden: true } }));
    TestBed.configureTestingModule({
      providers: [
        SpaceStatusesStore,
        { provide: SpaceStatusesApi, useValue: { update, read } },
        {
          provide: ListPageStore,
          useValue: {
            space: {
              reload: reloadSpace,
              status: spaceStatus,
              isLoading: (): boolean => spaceStatus() === 'loading',
            },
          },
        },
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

    const written: Promise<SpaceStatusesOutcome> = store.setUsed('review', false);

    expect(shown('review')?.hidden).toBe(true);
    expect(store.usedCount()).toBe(8);
    expect(store.saving()).toBe(true);
    expect(await written).toBe('saved');
    expect(update).toHaveBeenCalledWith('sp-product', 7, { review: { hidden: true } });
    await Promise.resolve();
    expect(store.saving()).toBe(false);
    expect(reloadSpace).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('puts back the recorded state when the gateway refuses the change, without reading', async () => {
    update.mockRejectedValueOnce(problem(412, 'request.version-mismatch'));

    const written: Promise<SpaceStatusesOutcome> = store.setUsed('testing', true);
    expect(shown('testing')?.hidden).toBe(false);

    expect(await written).toBe('refused');
    expect(read).not.toHaveBeenCalled();
    expect(shown('testing')?.hidden).toBe(true);
    expect(store.usedCount()).toBe(9);
    expect(store.saving()).toBe(false);
  });

  it('never stops using To do or Done, and sends nothing for a state already shown', async () => {
    expect(await store.setUsed('todo', false)).toBe('saved');
    expect(await store.setUsed('done', false)).toBe('saved');
    expect(await store.setUsed('review', true)).toBe('saved');

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

    const renamed: Promise<SpaceStatusesOutcome> = store.rename('review', '  Code review  ');
    const hidden: Promise<SpaceStatusesOutcome> = store.setUsed('backlog', false);
    expect(shown('review')?.name).toBe('Code review');
    expect(shown('backlog')?.hidden).toBe(true);
    await Promise.resolve();
    expect(update).toHaveBeenCalledTimes(1);

    first.resolve(product(8, { testing: { hidden: true }, review: { name: 'Code review' } }));
    expect(await renamed).toBe('saved');
    expect(shown('backlog')?.hidden).toBe(true);
    expect(await hidden).toBe('saved');

    expect(update).toHaveBeenNthCalledWith(1, 'sp-product', 7, { review: { name: 'Code review' } });
    expect(update).toHaveBeenNthCalledWith(2, 'sp-product', 8, { backlog: { hidden: true } });
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('takes back only the refused change and keeps the next one', async () => {
    update
      .mockRejectedValueOnce(problem(422, 'space.status-required'))
      .mockResolvedValueOnce(product(8, { testing: { hidden: true }, backlog: { hidden: true } }));

    const renamed: Promise<SpaceStatusesOutcome> = store.rename('review', 'QA');
    const hidden: Promise<SpaceStatusesOutcome> = store.setUsed('backlog', false);

    expect(await renamed).toBe('refused');
    expect(shown('review')?.name).toBeNull();
    expect(shown('backlog')?.hidden).toBe(true);
    expect(await hidden).toBe('saved');
    expect(update).toHaveBeenNthCalledWith(2, 'sp-product', 7, { backlog: { hidden: true } });
  });

  it('reads the space again after an unanswered write and counts it saved when the read holds it', async () => {
    update.mockRejectedValueOnce(problem(0)).mockResolvedValueOnce(
      product(10, {
        testing: { hidden: true },
        review: { hidden: true },
        waiting: { hidden: true },
      }),
    );
    read.mockResolvedValueOnce(product(9, { testing: { hidden: true }, review: { hidden: true } }));

    const hidden: Promise<SpaceStatusesOutcome> = store.setUsed('review', false);
    const next: Promise<SpaceStatusesOutcome> = store.setUsed('waiting', false);

    expect(await hidden).toBe('saved');
    expect(read).toHaveBeenCalledWith('sp-product');
    expect(shown('review')?.hidden).toBe(true);
    expect(await next).toBe('saved');
    expect(update).toHaveBeenNthCalledWith(2, 'sp-product', 9, { waiting: { hidden: true } });
  });

  it('takes back an unanswered write the read does not hold, and goes on from the version read', async () => {
    update
      .mockRejectedValueOnce(problem(503, 'service.unavailable'))
      .mockResolvedValueOnce(product(10, { testing: { hidden: true }, waiting: { hidden: true } }));
    read.mockResolvedValueOnce(
      product(9, { testing: { hidden: true }, blocked: { hidden: true } }),
    );

    const renamed: Promise<SpaceStatusesOutcome> = store.rename('review', 'QA');
    const next: Promise<SpaceStatusesOutcome> = store.setUsed('waiting', false);

    expect(await renamed).toBe('refused');
    expect(shown('review')?.name).toBeNull();
    expect(shown('blocked')?.hidden).toBe(true);
    expect(await next).toBe('saved');
    expect(update).toHaveBeenNthCalledWith(2, 'sp-product', 9, { waiting: { hidden: true } });
  });

  it('reports an unknown outcome when the read after an unanswered write fails too', async () => {
    update.mockRejectedValueOnce(new Error('timeout'));
    read.mockRejectedValueOnce(problem(0));

    const written: Promise<SpaceStatusesOutcome> = store.setUsed('review', false);

    expect(await written).toBe('unknown');
    expect(shown('review')?.hidden).toBe(false);
    expect(store.saving()).toBe(false);
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('puts back the default label for an empty name and cuts a name to 24 characters', async () => {
    space.set(product(7, { review: { name: 'Code review' } }));
    TestBed.tick();
    update
      .mockResolvedValueOnce(product(8))
      .mockResolvedValueOnce(product(9, { review: { name: 'A'.repeat(24) } }));

    expect(await store.rename('review', '   ')).toBe('saved');
    expect(await store.rename('review', 'A'.repeat(30))).toBe('saved');
    expect(await store.rename('review', ` ${'A'.repeat(24)} `)).toBe('saved');

    expect(update).toHaveBeenNthCalledWith(1, 'sp-product', 7, { review: { name: null } });
    expect(update).toHaveBeenNthCalledWith(2, 'sp-product', 8, {
      review: { name: 'A'.repeat(24) },
    });
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('resets every status with a null change, and sends nothing when they are the defaults', async () => {
    update.mockResolvedValueOnce(product(8));

    const written: Promise<SpaceStatusesOutcome> = store.reset();
    expect(store.usedCount()).toBe(10);
    expect(await written).toBe('saved');
    expect(update).toHaveBeenCalledWith('sp-product', 7, null);

    expect(await store.reset()).toBe('saved');
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('keeps a pending change over a newer read, then takes reads at least as new', async () => {
    const first: Deferred = deferred();
    update.mockReturnValueOnce(first.promise);

    const written: Promise<SpaceStatusesOutcome> = store.setUsed('review', false);
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

  it('reads the list page space once more when its read was in flight as the writes ended', async () => {
    update.mockResolvedValueOnce(
      product(8, { testing: { hidden: true }, review: { hidden: true } }),
    );
    spaceStatus.set('loading');

    await store.setUsed('review', false);
    await Promise.resolve();
    expect(reloadSpace).toHaveBeenCalledTimes(1);

    spaceStatus.set('resolved');
    TestBed.tick();
    expect(reloadSpace).toHaveBeenCalledTimes(2);
    spaceStatus.set('reloading');
    TestBed.tick();
    spaceStatus.set('resolved');
    TestBed.tick();
    expect(reloadSpace).toHaveBeenCalledTimes(2);
  });

  it('changes nothing for a caller who may not edit the space', async () => {
    space.set({ ...product(7), id: 'sp-design', canEdit: false });
    TestBed.tick();

    expect(await store.setUsed('review', false)).toBe('refused');
    expect(update).not.toHaveBeenCalled();
    expect(shown('review')?.hidden).toBe(false);
  });
});

describe('SpaceStatusesStore teardown', () => {
  it('sends every accepted edit and reads the space again after the dialog is destroyed', async () => {
    const first: Deferred = deferred();
    const update: Mock = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(product(9, { review: { hidden: true }, waiting: { hidden: true } }));
    const reload: Mock = vi.fn((): boolean => false);
    const refresh: Mock = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: SpaceStatusesApi, useValue: { update, read: vi.fn() } },
        {
          provide: ListPageStore,
          useValue: {
            space: { reload, status: signal<ResourceStatus>('idle'), isLoading: () => false },
          },
        },
        { provide: SpacesNavigationStore, useValue: { refresh } },
      ],
    });
    const dialog: EnvironmentInjector = createEnvironmentInjector(
      [SpaceStatusesStore],
      TestBed.inject(EnvironmentInjector),
    );
    const store: InstanceType<typeof SpaceStatusesStore> = dialog.get(SpaceStatusesStore);
    store.follow(product(7));
    const hidden: Promise<SpaceStatusesOutcome> = store.setUsed('review', false);
    const next: Promise<SpaceStatusesOutcome> = store.setUsed('waiting', false);

    dialog.destroy();
    first.resolve(product(8, { review: { hidden: true } }));

    expect(await hidden).toBe('saved');
    expect(await next).toBe('saved');
    expect(update).toHaveBeenNthCalledWith(1, 'sp-product', 7, { review: { hidden: true } });
    expect(update).toHaveBeenNthCalledWith(2, 'sp-product', 8, { waiting: { hidden: true } });
    await Promise.resolve();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
