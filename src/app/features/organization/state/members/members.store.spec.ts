import { HttpErrorResponse } from '@angular/common/http';
import { ApplicationRef, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CwToastService } from '@cadenway/ui/components/toast';
import { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { RealtimeConnection } from '@core/realtime';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
  type WorkspaceOrganization,
  type WorkspaceRole,
} from '@features/workspace/ports/workspace-context';

import { MembersApi } from '../../data-access/services/members-api/members-api.service';
import type {
  MemberPage,
  MemberQuery,
  MemberRow,
  OrganizationMember,
} from '../../models/member/member.interface';
import {
  MembersStore,
  type MembersStoreInstance,
  PRESENCE_READ_LIMIT,
  SEARCH_DEBOUNCE_MS,
} from './members.store';

/**
 * Type ApiFake
 *
 * @description
 * Fake of the members data access, one mock per method.
 *
 * @type {Record<'page' | 'all' | 'changeRole' | 'remove', Mock>}
 */
type ApiFake = Record<'page' | 'all' | 'changeRole' | 'remove', Mock>;

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
 * Constant ATELIER_NORD
 *
 * @description
 * The organization of the workspace.
 *
 * @type {WorkspaceOrganization}
 */
const ATELIER_NORD: WorkspaceOrganization = {
  id: 'o1',
  slug: 'atelier-nord',
  name: 'Atelier Nord',
  initials: 'AN',
  role: 'owner',
  plan: 'team',
};

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
  return {
    items,
    total,
    counts: { owner: 1, admin: 2, member: 15, guest: 4 },
    nextCursor,
    truncated: false,
  };
}

/**
 * Interface Deferred
 *
 * @description
 * A promise settled by the test.
 */
interface Deferred<T> {
  // #region Properties
  /**
   * Property promise
   *
   * @description
   * The promise.
   *
   * @type {Promise<T>}
   * @readonly
   */
  readonly promise: Promise<T>;

  /**
   * Property resolve
   *
   * @description
   * Resolves it.
   *
   * @type {(value: T) => void}
   * @readonly
   */
  readonly resolve: (value: T) => void;

  /**
   * Property reject
   *
   * @description
   * Rejects it.
   *
   * @type {(error: Error) => void}
   * @readonly
   */
  readonly reject: (error: Error) => void;
  // #endregion
}

/**
 * Function deferred
 *
 * @description
 * Creates a promise the test settles.
 *
 * @template T
 * @returns {Deferred<T>} The promise and its settlers.
 */
function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise: Promise<T> = new Promise<T>(
    (done: (value: T) => void, fail: (error: Error) => void) => {
      resolve = done;
      reject = fail;
    },
  );
  return { promise, resolve, reject };
}

/**
 * Function refusal
 *
 * @description
 * An API refusal as the generated client rejects it.
 *
 * @param {number} status - HTTP status.
 * @param {string} [code] - Problem code.
 * @returns {HttpErrorResponse} The refusal.
 */
function refusal(status: number, code?: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: code === undefined ? null : { code } });
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
   * @type {ApiFake}
   * @readonly
   */
  readonly api: ApiFake;

  /**
   * Property toasts
   *
   * @description
   * Fake of the toast service.
   *
   * @type {Record<'success' | 'error' | 'warning', Mock>}
   * @readonly
   */
  readonly toasts: Record<'success' | 'error' | 'warning', Mock>;

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

  /**
   * Property organization
   *
   * @description
   * The workspace organization, switchable.
   *
   * @type {WritableSignal<WorkspaceOrganization>}
   * @readonly
   */
  readonly organization: WritableSignal<WorkspaceOrganization>;

  /**
   * Property realtime
   *
   * @description
   * How often the fake presence stream was subscribed and torn down; subscribing starts the
   * connection.
   *
   * @type {{ started: number; stopped: number }}
   * @readonly
   */
  readonly realtime: { started: number; stopped: number };
  // #endregion
}

/**
 * Function setup
 *
 * @description
 * Creates the store for a role over a fake data access and waits for its first read.
 *
 * @param {Partial<ApiFake>} overrides - Fakes.
 * @param {WorkspaceRole} [role] - The person's role.
 * @returns {Promise<Harness>} The store and its fakes.
 */
async function setup(overrides: Partial<ApiFake>, role: WorkspaceRole = 'owner'): Promise<Harness> {
  const api: ApiFake = {
    page: vi.fn(() => Promise.resolve(page([CAMILLE, INES, THEO, NADIA]))),
    all: vi.fn(() => Promise.resolve(page([CAMILLE, INES, THEO, NADIA]))),
    changeRole: vi.fn(),
    remove: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
  const toasts: Record<'success' | 'error' | 'warning', Mock> = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  };
  const presences: WritableSignal<ReadonlyMap<string, 'online' | 'away' | 'do-not-disturb'>> =
    signal(new Map([['ir', 'online' as const]]));
  const organization: WritableSignal<WorkspaceOrganization> = signal({ ...ATELIER_NORD, role });
  const ranks: readonly WorkspaceRole[] = ['guest', 'member', 'admin', 'owner'];
  const realtime: { started: number; stopped: number } = { started: 0, stopped: 0 };
  const presenceChanges: Observable<never> = new Observable<never>(() => {
    realtime.started += 1;
    return () => {
      realtime.stopped += 1;
    };
  });
  const workspace: WorkspaceContextPort = {
    user: signal({
      id: CAMILLE.userId,
      name: CAMILLE.name,
      firstName: 'Camille',
      displayName: null,
      email: CAMILLE.email,
      initials: 'CM',
    }),
    organization,
    role: signal(role),
    can: (least: WorkspaceRole): boolean => ranks.indexOf(role) >= ranks.indexOf(least),
  };
  TestBed.configureTestingModule({
    providers: [
      MembersStore,
      { provide: MembersApi, useValue: api },
      { provide: CwToastService, useValue: toasts },
      { provide: RealtimeConnection, useValue: { presences, presenceChanges } },
      { provide: WORKSPACE_CONTEXT, useValue: workspace },
    ],
  });
  const store: MembersStoreInstance = TestBed.inject(MembersStore);
  await settle();
  return { store, api, toasts, presences, organization, realtime };
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
 * Function flush
 *
 * @description
 * Runs the effects and the microtasks while a read is still pending, which `whenStable` would
 * wait for.
 *
 * @returns {Promise<void>} Resolves once flushed.
 */
async function flush(): Promise<void> {
  TestBed.tick();
  await vi.advanceTimersByTimeAsync(0);
  TestBed.tick();
}

/**
 * Function ids
 *
 * @description
 * Ids of the rows shown.
 *
 * @param {MembersStoreInstance} store - The store.
 * @returns {string[]} The ids.
 */
function ids(store: MembersStoreInstance): string[] {
  return store.rows().map((row: MemberRow) => row.id);
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
    expect(ids(store)).toEqual(['cm', 'ir', 'tb', 'ng']);
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

  it('lets Clear filters win over a search still waiting for the pause', async () => {
    const { store, api }: Harness = await setup({});

    store.setSearch('lea');
    store.clearFilters();
    await settle();

    expect(store.search()).toBe('');
    expect(api.page).toHaveBeenCalledTimes(1);
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
    expect(ids(store)).toEqual(['tb', 'ng']);
    expect([store.rangeFirst(), store.rangeLast(), store.hasNext()]).toEqual([9, 10, false]);
    store.previous();
    await settle();

    expect(api.page.mock.calls.map((call: unknown[]) => call[2])).toEqual([null, 'c2', null]);
    expect(ids(store)).toEqual(['cm', 'ir']);
  });

  it('keeps the counts and the range while the next view is read', async () => {
    const next: Deferred<MemberPage> = deferred<MemberPage>();
    const { store, api }: Harness = await setup({});
    api.page.mockReturnValueOnce(next.promise);

    store.setRole('guest');
    await flush();

    expect(store.loading()).toBe(true);
    expect(store.counts()).toEqual({ owner: 1, admin: 2, member: 15, guest: 4 });
    expect([store.rangeFirst(), store.rangeLast(), store.total()]).toEqual([1, 4, 4]);
    next.resolve(page([NADIA]));
    await settle();
    expect(store.total()).toBe(1);
  });

  it('reads the role tab once for a presence filter and searches it in the browser', async () => {
    const { store, api, presences }: Harness = await setup({});

    store.setPresence('online');
    await settle();
    store.setSearch('ines');
    await settle();
    expect(ids(store)).toEqual(['ir']);
    store.setSearch('theo');
    presences.set(new Map([['tb', 'away' as const]]));
    await settle();

    expect(api.all).toHaveBeenCalledTimes(1);
    expect(api.all).toHaveBeenCalledWith(
      { search: '', roles: [] },
      PRESENCE_READ_LIMIT,
      expect.anything(),
    );
    expect(ids(store)).toEqual(['tb']);
    expect(store.filtered()).toBe(true);
  });

  it('starts the realtime presence on a direct visit and stops it with the page', async () => {
    const { realtime }: Harness = await setup({});

    expect(realtime).toEqual({ started: 1, stopped: 0 });
    TestBed.resetTestingModule();
    expect(realtime).toEqual({ started: 1, stopped: 1 });
  });

  it('goes back to the last page with rows when live presence shrinks the online list', async () => {
    const many: OrganizationMember[] = Array.from(
      { length: 10 },
      (_value: unknown, index: number) =>
        person(`p${String(index)}`, `Person ${String(index)}`, 'member'),
    );
    const { store, presences }: Harness = await setup({
      all: vi.fn(() => Promise.resolve(page(many))),
    });
    presences.set(new Map(many.map((item: OrganizationMember) => [item.id, 'online' as const])));
    store.setPresence('online');
    await settle();
    store.next();
    await settle();
    expect(store.pageIndex()).toBe(1);

    presences.set(new Map([['p0', 'online' as const]]));
    await settle();

    expect(store.pageIndex()).toBe(0);
    expect(ids(store)).toEqual(['p0']);
  });

  it('flags a presence read that reached its member limit', async () => {
    const { store }: Harness = await setup({
      all: vi.fn(() => Promise.resolve({ ...page([INES]), truncated: true })),
    });

    store.setPresence('online');
    await settle();

    expect(store.truncated()).toBe(true);
  });

  it('shows a new role at once, sends the version and keeps it once confirmed', async () => {
    const answer: Deferred<OrganizationMember> = deferred<OrganizationMember>();
    const { store, api, toasts }: Harness = await setup({
      changeRole: vi.fn(() => answer.promise),
    });

    const done: Promise<boolean> = store.changeRole(rowOf(store, 'tb'), 'admin');
    expect(rowOf(store, 'tb')).toMatchObject({ role: 'admin', pending: true });
    expect(store.counts()).toEqual({ owner: 1, admin: 3, member: 14, guest: 4 });
    answer.resolve({ ...THEO, role: 'admin', version: 2 });

    await expect(done).resolves.toBe(true);
    expect(api.changeRole).toHaveBeenCalledWith('tb', 'admin', 1);
    expect(rowOf(store, 'tb')).toMatchObject({ role: 'admin', pending: false, version: 2 });
    expect(api.page).toHaveBeenCalledTimes(1);
    expect(toasts.success).toHaveBeenCalledWith('Role changed', {
      description: 'Théo Bernard is now Administrator.',
    });
  });

  it('keeps a confirmed role over a read issued before the change settled', async () => {
    const answer: Deferred<OrganizationMember> = deferred<OrganizationMember>();
    const stale: Deferred<MemberPage> = deferred<MemberPage>();
    const { store, api }: Harness = await setup({ changeRole: vi.fn(() => answer.promise) });

    const done: Promise<boolean> = store.changeRole(rowOf(store, 'tb'), 'admin');
    api.page.mockReturnValueOnce(stale.promise);
    store.retry();
    await flush();
    answer.resolve({ ...THEO, role: 'admin', version: 2 });
    await done;
    stale.resolve(page([CAMILLE, INES, THEO, NADIA]));
    await settle();

    expect(rowOf(store, 'tb').role).toBe('admin');
    expect(store.counts()?.admin).toBe(3);
    api.page.mockResolvedValueOnce(page([CAMILLE, INES, { ...THEO, role: 'member' }, NADIA]));
    store.retry();
    await settle();
    expect(rowOf(store, 'tb').role).toBe('member');
  });

  it('reads the page again when a confirmed role leaves the role tab', async () => {
    const { store, api }: Harness = await setup({
      page: vi.fn(() => Promise.resolve(page([NADIA]))),
      changeRole: vi.fn(() => Promise.resolve({ ...NADIA, role: 'member', version: 2 })),
    });
    store.setRole('guest');
    await settle();

    api.page.mockResolvedValueOnce(page([]));
    await store.changeRole(rowOf(store, 'ng'), 'member');
    await settle();

    expect(api.page).toHaveBeenCalledTimes(3);
    expect(ids(store)).toEqual([]);
  });

  it('restores the confirmed role and shows the failure when the change is refused', async () => {
    const { store, toasts }: Harness = await setup({
      changeRole: vi.fn().mockRejectedValue(refusal(409, 'organization.seat-quota-exceeded')),
    });

    await expect(store.changeRole(rowOf(store, 'ng'), 'member')).resolves.toBe(false);

    expect(rowOf(store, 'ng')).toMatchObject({ role: 'guest', pending: false });
    expect(store.counts()).toEqual({ owner: 1, admin: 2, member: 15, guest: 4 });
    expect(toasts.error).toHaveBeenCalledWith('The role could not be changed', {
      description: 'No seat is free: add some from Billing.',
    });
  });

  it('reads the page again with a warning when the member changed meanwhile', async () => {
    const { store, api, toasts }: Harness = await setup({
      changeRole: vi.fn().mockRejectedValue(refusal(412, 'request.version-mismatch')),
    });

    await store.changeRole(rowOf(store, 'tb'), 'guest');
    await settle();

    expect(api.page).toHaveBeenCalledTimes(2);
    expect(toasts.warning).toHaveBeenCalledWith('This member changed meanwhile', {
      description: 'The list was read again: check the role and try again.',
    });
    expect(toasts.error).not.toHaveBeenCalled();
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
    const answer: Deferred<undefined> = deferred<undefined>();
    const { store, toasts }: Harness = await setup({ remove: vi.fn(() => answer.promise) });

    const done: Promise<boolean> = store.remove(rowOf(store, 'tb'));
    expect(ids(store)).toEqual(['cm', 'ir', 'ng']);
    expect(store.total()).toBe(3);
    answer.reject(new Error('Server error'));

    await expect(done).resolves.toBe(false);
    expect(ids(store)).toEqual(['cm', 'ir', 'tb', 'ng']);
    expect(toasts.error).toHaveBeenCalledWith('The member could not be removed');
  });

  it('reads the current cursor page again after a removal and drops the later cursors', async () => {
    const { store, api, toasts }: Harness = await setup({
      page: vi.fn((_query: MemberQuery, _limit: number, cursor: string | null) =>
        Promise.resolve(
          cursor === null ? page([CAMILLE, INES], 'c2', 4) : page([THEO, NADIA], 'c3', 4),
        ),
      ),
    });
    store.next();
    await settle();

    api.page.mockResolvedValueOnce(page([NADIA], null, 3));
    await expect(store.remove(rowOf(store, 'tb'))).resolves.toBe(true);
    expect(ids(store)).toEqual(['ng']);
    await settle();

    expect(api.page.mock.calls.map((call: unknown[]) => call[2])).toEqual([null, 'c2', 'c2']);
    expect(ids(store)).toEqual(['ng']);
    expect(store.counts()?.member).toBe(15);
    expect(toasts.success).toHaveBeenCalledWith('Théo Bernard removed', {
      description: 'Their tasks stay assigned; a seat is freed.',
    });
  });

  it('goes back a page only once the read after a removal settles empty', async () => {
    const reread: Deferred<MemberPage> = deferred<MemberPage>();
    const { store, api }: Harness = await setup({
      page: vi.fn((_query: MemberQuery, _limit: number, cursor: string | null) =>
        Promise.resolve(cursor === null ? page([CAMILLE, INES], 'c2', 3) : page([THEO], null, 3)),
      ),
    });
    store.next();
    await settle();
    api.page.mockReturnValueOnce(reread.promise);

    await store.remove(rowOf(store, 'tb'));
    await flush();
    expect(store.pageIndex()).toBe(1);
    reread.resolve(page([], null, 2));
    await settle();

    expect(store.pageIndex()).toBe(0);
    expect(ids(store)).toEqual(['cm', 'ir']);
  });

  it('shows the skeleton again for the next organization and lets its failure reach the boundary', async () => {
    const { store, api, organization }: Harness = await setup({});
    api.page.mockRejectedValueOnce(refusal(503));

    organization.set({ ...ATELIER_NORD, id: 'o2', slug: 'lumen', name: 'Lumen' });
    await settle();

    expect(store.shown()).toBe(false);
    expect(store.failed()).toBe(true);
    expect(() => store.members.value()).toThrow();
  });

  it('resets the filters and forgets a write that settles after an organization switch', async () => {
    const answer: Deferred<OrganizationMember> = deferred<OrganizationMember>();
    const { store, api, toasts, organization }: Harness = await setup({
      changeRole: vi.fn(() => answer.promise),
    });
    store.setRole('member');
    await settle();
    const done: Promise<boolean> = store.changeRole(rowOf(store, 'tb'), 'admin');

    organization.set({ ...ATELIER_NORD, id: 'o2', slug: 'lumen', name: 'Lumen' });
    await settle();
    answer.resolve({ ...THEO, role: 'admin', version: 2 });

    await expect(done).resolves.toBe(false);
    expect(store.role()).toBe('all');
    expect(toasts.success).not.toHaveBeenCalled();
    expect(api.page).toHaveBeenLastCalledWith(
      { search: '', roles: [] },
      8,
      null,
      expect.anything(),
    );
  });

  it('flags a failed later read, keeps it apart from an empty result and retries', async () => {
    const { store, api }: Harness = await setup({});
    api.page.mockRejectedValueOnce(refusal(503));

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
