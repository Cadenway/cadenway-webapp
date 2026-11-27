import { HttpErrorResponse } from '@angular/common/http';
import { ApplicationRef, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CwToastService } from '@cadenway/ui/components/toast';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { RealtimeConnection } from '@core/realtime';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
  type WorkspaceRole,
} from '@features/workspace/ports/workspace-context';

import { MembersApi } from '../../data-access/services/members-api/members-api.service';
import type {
  MemberPage,
  MemberQuery,
  MemberRow,
  OrganizationMember,
} from '../../models/member/member.interface';
import { MembersStore, type MembersStoreInstance, SEARCH_DEBOUNCE_MS } from './members.store';

/**
 * Function person
 *
 * @description
 * A member of Atelier Nord, as the mockup lists them.
 *
 * @param {string} id - Membership id.
 * @param {string} name - Full name.
 * @param {OrganizationMember['role']} role - Role.
 * @returns {OrganizationMember} The member.
 */
function person(id: string, name: string, role: OrganizationMember['role']): OrganizationMember {
  return {
    id,
    userId: `u-${id}`,
    name,
    email: `${id}@ateliernord.fr`,
    role,
    twoStepVerification: true,
    version: 1,
  };
}

/**
 * Constant CAMILLE
 *
 * @description
 * The owner, signed in.
 *
 * @type {OrganizationMember}
 */
const CAMILLE: OrganizationMember = person('cm', 'Camille Martin', 'owner');

/**
 * Constant INES
 *
 * @description
 * An administrator.
 *
 * @type {OrganizationMember}
 */
const INES: OrganizationMember = person('ir', 'Inès Robert', 'admin');

/**
 * Constant THEO
 *
 * @description
 * A member.
 *
 * @type {OrganizationMember}
 */
const THEO: OrganizationMember = person('tb', 'Théo Bernard', 'member');

/**
 * Constant NADIA
 *
 * @description
 * A guest.
 *
 * @type {OrganizationMember}
 */
const NADIA: OrganizationMember = person('ng', 'Nadia Garnier', 'guest');

/**
 * Function page
 *
 * @description
 * A page of members with the mockup's counts.
 *
 * @param {readonly OrganizationMember[]} items - Members of the page.
 * @param {string | null} [nextCursor] - Cursor of the next page.
 * @param {number} [total] - Matching members on every page.
 * @returns {MemberPage} The page.
 */
function page(
  items: readonly OrganizationMember[],
  nextCursor: string | null = null,
  total: number = items.length,
): MemberPage {
  return { items, total, counts: { owner: 1, admin: 2, member: 15, guest: 4 }, nextCursor };
}

/**
 * Interface Harness
 *
 * @description
 * The store under test and its fakes.
 */
interface Harness {
  // #region Properties
  /**
   * Property store
   *
   * @description
   * The store.
   *
   * @type {MembersStoreInstance}
   * @readonly
   */
  readonly store: MembersStoreInstance;

  /**
   * Property api
   *
   * @description
   * Fake of the members data access.
   *
   * @type {Record<'page' | 'all' | 'changeRole' | 'remove', Mock>}
   * @readonly
   */
  readonly api: Record<'page' | 'all' | 'changeRole' | 'remove', Mock>;

  /**
   * Property toasts
   *
   * @description
   * Fake of the toast service.
   *
   * @type {Record<'success' | 'error', Mock>}
   * @readonly
   */
  readonly toasts: Record<'success' | 'error', Mock>;

  /**
   * Property presences
   *
   * @description
   * Live presence of the fake realtime connection.
   *
   * @type {WritableSignal<ReadonlyMap<string, 'online' | 'away' | 'do-not-disturb'>>}
   * @readonly
   */
  readonly presences: WritableSignal<ReadonlyMap<string, 'online' | 'away' | 'do-not-disturb'>>;
  // #endregion
}

/**
 * Function setup
 *
 * @description
 * Creates the store for a role over a fake data access and waits for its first read.
 *
 * @param {Partial<Record<'page' | 'all' | 'changeRole' | 'remove', Mock>>} overrides - Fakes.
 * @param {WorkspaceRole} [role] - The person's role.
 * @returns {Promise<Harness>} The store and its fakes.
 */
async function setup(
  overrides: Partial<Record<'page' | 'all' | 'changeRole' | 'remove', Mock>>,
  role: WorkspaceRole = 'owner',
): Promise<Harness> {
  const api: Record<'page' | 'all' | 'changeRole' | 'remove', Mock> = {
    page: vi.fn(() => Promise.resolve(page([CAMILLE, INES, THEO, NADIA]))),
    all: vi.fn(() => Promise.resolve(page([CAMILLE, INES, THEO, NADIA]))),
    changeRole: vi.fn(),
    remove: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
  const toasts: Record<'success' | 'error', Mock> = { success: vi.fn(), error: vi.fn() };
  const presences: WritableSignal<ReadonlyMap<string, 'online' | 'away' | 'do-not-disturb'>> =
    signal(new Map([['ir', 'online' as const]]));
  const ranks: readonly WorkspaceRole[] = ['guest', 'member', 'admin', 'owner'];
  const workspace: WorkspaceContextPort = {
    user: signal({
      id: CAMILLE.userId,
      name: CAMILLE.name,
      firstName: 'Camille',
      displayName: null,
      email: CAMILLE.email,
      initials: 'CM',
    }),
    organization: signal({
      id: 'o1',
      slug: 'atelier-nord',
      name: 'Atelier Nord',
      initials: 'AN',
      role,
      plan: 'team',
    }),
    role: signal(role),
    can: (least: WorkspaceRole): boolean => ranks.indexOf(role) >= ranks.indexOf(least),
  };
  TestBed.configureTestingModule({
    providers: [
      MembersStore,
      { provide: MembersApi, useValue: api },
      { provide: CwToastService, useValue: toasts },
      { provide: RealtimeConnection, useValue: { presences } },
      { provide: WORKSPACE_CONTEXT, useValue: workspace },
    ],
  });
  const store: MembersStoreInstance = TestBed.inject(MembersStore);
  await settle();
  return { store, api, toasts, presences };
}

/**
 * Function settle
 *
 * @description
 * Lets the timers and the resource reads run.
 *
 * @returns {Promise<void>} Resolves once stable.
 */
async function settle(): Promise<void> {
  await vi.runAllTimersAsync();
  await TestBed.inject(ApplicationRef).whenStable();
}

/**
 * Function rowOf
 *
 * @description
 * Finds a row of the page shown.
 *
 * @param {MembersStoreInstance} store - The store.
 * @param {string} id - Membership id.
 * @returns {MemberRow} The row.
 */
function rowOf(store: MembersStoreInstance, id: string): MemberRow {
  const row: MemberRow | undefined = store.rows().find((item: MemberRow) => item.id === id);
  if (row === undefined) throw new Error(`No row ${id}`);
  return row;
}

describe('MembersStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads the first page of 8 and marks the own row and the live presence', async () => {
    const { store, api }: Harness = await setup({});

    expect(api.page).toHaveBeenCalledWith({ search: '', roles: [] }, 8, null, expect.anything());
    expect(store.shown()).toBe(true);
    expect(store.rows().map((row: MemberRow) => row.id)).toEqual(['cm', 'ir', 'tb', 'ng']);
    expect(rowOf(store, 'cm').me).toBe(true);
    expect(rowOf(store, 'ir').presence).toBe('online');
    expect(rowOf(store, 'tb').presence).toBe('offline');
    expect(store.onlineCount()).toBe(1);
    expect([store.rangeFirst(), store.rangeLast(), store.total()]).toEqual([1, 4, 4]);
  });

  it('sends the search once the typing pauses and the administrators tab with the owner', async () => {
    const { store, api }: Harness = await setup({});

    store.setSearch('l');
    store.setSearch('lea');
    expect(store.search()).toBe('lea');
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    await settle();
    store.setRole('admin');
    await settle();

    const queries: MemberQuery[] = api.page.mock.calls.map(
      (call: unknown[]) => call[0] as MemberQuery,
    );
    expect(queries).toEqual([
      { search: '', roles: [] },
      { search: 'lea', roles: [] },
      { search: 'lea', roles: ['owner', 'admin'] },
    ]);
  });

  it('pages by cursor and goes back with the cursor kept', async () => {
    const { store, api }: Harness = await setup({
      page: vi.fn((_query: MemberQuery, _limit: number, cursor: string | null) =>
        Promise.resolve(
          cursor === null ? page([CAMILLE, INES], 'c2', 4) : page([THEO, NADIA], null, 4),
        ),
      ),
    });

    expect(store.hasNext()).toBe(true);
    store.next();
    await settle();
    expect(store.rows().map((row: MemberRow) => row.id)).toEqual(['tb', 'ng']);
    expect([store.rangeFirst(), store.rangeLast(), store.hasNext()]).toEqual([9, 10, false]);
    store.previous();
    await settle();

    expect(api.page.mock.calls.map((call: unknown[]) => call[2])).toEqual([null, 'c2', null]);
    expect(store.rows().map((row: MemberRow) => row.id)).toEqual(['cm', 'ir']);
  });

  it('reads every member for a presence filter and keeps those online', async () => {
    const { store, api, presences }: Harness = await setup({});

    store.setPresence('online');
    await settle();

    expect(api.all).toHaveBeenCalledWith({ search: '', roles: [] }, expect.anything());
    expect(store.rows().map((row: MemberRow) => row.id)).toEqual(['ir']);
    presences.set(new Map([['tb', 'away' as const]]));
    expect(store.rows().map((row: MemberRow) => row.id)).toEqual(['tb']);
    expect(store.filtered()).toBe(true);
  });

  it('shows a new role at once and keeps it once confirmed', async () => {
    let confirm: (member: OrganizationMember) => void = () => undefined;
    const { store, toasts }: Harness = await setup({
      changeRole: vi.fn(
        () =>
          new Promise<OrganizationMember>((resolve: (member: OrganizationMember) => void) => {
            confirm = resolve;
          }),
      ),
    });

    const done: Promise<boolean> = store.changeRole(rowOf(store, 'tb'), 'admin');
    expect(rowOf(store, 'tb').role).toBe('admin');
    expect(rowOf(store, 'tb').pending).toBe(true);
    expect(store.counts()).toEqual({ owner: 1, admin: 3, member: 14, guest: 4 });
    confirm({ ...THEO, role: 'admin', version: 2 });

    await expect(done).resolves.toBe(true);
    expect(rowOf(store, 'tb')).toMatchObject({ role: 'admin', pending: false });
    expect(toasts.success).toHaveBeenCalledWith('Role changed', {
      description: 'Théo Bernard is now Administrator.',
    });
  });

  it('restores the confirmed role and shows the failure when the change is refused', async () => {
    const { store, toasts }: Harness = await setup({
      changeRole: vi.fn().mockRejectedValue(
        new HttpErrorResponse({
          status: 409,
          error: { code: 'organization.seat-quota-exceeded' },
        }),
      ),
    });

    await expect(store.changeRole(rowOf(store, 'ng'), 'member')).resolves.toBe(false);

    expect(rowOf(store, 'ng')).toMatchObject({ role: 'guest', pending: false });
    expect(store.counts()).toEqual({ owner: 1, admin: 2, member: 15, guest: 4 });
    expect(toasts.error).toHaveBeenCalledWith('The role could not be changed', {
      description: 'No seat is free: add some from Billing.',
    });
  });

  it('never edits the owner or the own row, and a member cannot edit anyone', async () => {
    const owner: Harness = await setup({});

    await expect(owner.store.changeRole(rowOf(owner.store, 'cm'), 'admin')).resolves.toBe(false);
    TestBed.resetTestingModule();
    const member: Harness = await setup({}, 'member');
    await expect(member.store.remove(rowOf(member.store, 'tb'))).resolves.toBe(false);

    expect(owner.api.changeRole).not.toHaveBeenCalled();
    expect(member.api.remove).not.toHaveBeenCalled();
    expect(member.store.editable()).toBe(false);
  });

  it('hides a removed member at once and shows them again when the removal fails', async () => {
    let refuse: (error: unknown) => void = () => undefined;
    const { store, toasts }: Harness = await setup({
      remove: vi.fn(
        () =>
          new Promise<void>((_resolve: () => void, reject: (error: unknown) => void) => {
            refuse = reject;
          }),
      ),
    });

    const done: Promise<boolean> = store.remove(rowOf(store, 'tb'));
    expect(store.rows().map((row: MemberRow) => row.id)).toEqual(['cm', 'ir', 'ng']);
    expect(store.total()).toBe(3);
    refuse(new HttpErrorResponse({ status: 500 }));

    await expect(done).resolves.toBe(false);
    expect(store.rows().map((row: MemberRow) => row.id)).toEqual(['cm', 'ir', 'tb', 'ng']);
    expect(toasts.error).toHaveBeenCalledWith('The member could not be removed');
  });

  it('drops a confirmed removal from the read with its seat', async () => {
    const { store, toasts }: Harness = await setup({});

    await expect(store.remove(rowOf(store, 'tb'))).resolves.toBe(true);

    expect(store.rows().map((row: MemberRow) => row.id)).toEqual(['cm', 'ir', 'ng']);
    expect(store.counts()?.member).toBe(14);
    expect(toasts.success).toHaveBeenCalledWith('Théo Bernard removed', {
      description: 'Their tasks stay assigned; a seat is freed.',
    });
  });

  it('flags a failed later read, keeps it apart from an empty result and retries', async () => {
    const { store, api }: Harness = await setup({});
    api.page.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));

    store.setRole('guest');
    await settle();
    expect(store.failed()).toBe(true);
    expect(store.shown()).toBe(true);
    api.page.mockResolvedValueOnce(page([], null, 0));
    store.retry();
    await settle();

    expect(store.failed()).toBe(false);
    expect(store.rows()).toEqual([]);
    expect(store.total()).toBe(0);
    expect(api.page).toHaveBeenCalledTimes(3);
  });
});
