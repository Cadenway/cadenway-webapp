import { TestBed } from '@angular/core/testing';
import { CwToastService } from '@cadenway/ui/components/toast';
import { firstValueFrom, type Observable } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { ListAccessApi } from '../../data-access/services/list-access-api/list-access-api.service';
import type {
  ListAccess,
  SharePerson,
  ShareWrite,
} from '../../models/list-share/list-share.interface';
import type { TaskList } from '../../models/task-list/task-list.interface';
import { ListPageStore } from '../list-page/list-page.store';
import { ListShareStore, type ListShareStoreInstance } from './list-share.store';

/**
 * Constant sprint14
 *
 * @description
 * The mockup's `Sprint 14`, as the list page holds it.
 *
 * @type {TaskList}
 */
const sprint14: TaskList = {
  id: 'l-sprint14',
  spaceId: 'sp-product',
  name: 'Sprint 14',
  icon: 'lightning',
  color: 'violet',
  sprint: null,
  archived: false,
  canEdit: true,
  version: 4,
};

/**
 * Constant sprint14Access
 *
 * @description
 * Who has access to `Sprint 14`: Camille Martin owns the space, Léa Petit comments, the guest
 * Nadia Benali comments; Hugo Dubois is a member without a grant.
 *
 * @type {ListAccess}
 */
const sprint14Access: ListAccess = {
  listId: 'l-sprint14',
  canEdit: true,
  organizationAccess: true,
  privateSpace: false,
  ownerId: 'u-camille',
  grants: [
    { userId: 'u-lea', role: 'comment' },
    { userId: 'u-nadia', role: 'comment' },
  ],
  directory: [
    { userId: 'u-camille', name: 'Camille Martin', email: 'camille@ateliernord.fr', guest: false },
    { userId: 'u-lea', name: 'Léa Petit', email: 'lea@ateliernord.fr', guest: false },
    { userId: 'u-hugo', name: 'Hugo Dubois', email: 'hugo.dubois@ateliernord.fr', guest: false },
    { userId: 'u-nadia', name: 'Nadia Benali', email: 'nadia@studio-pixel.fr', guest: true },
  ],
};

/**
 * Function deferred
 *
 * @description
 * A promise settled by the test.
 *
 * @returns {{ promise: Promise<ShareWrite>; resolve: (value: ShareWrite) => void; reject: (error: unknown) => void }} The promise and its settlers.
 */
function deferred(): {
  promise: Promise<ShareWrite>;
  resolve: (value: ShareWrite) => void;
  reject: (error: unknown) => void;
} {
  let resolve!: (value: ShareWrite) => void;
  let reject!: (error: unknown) => void;
  const promise: Promise<ShareWrite> = new Promise<ShareWrite>((ok, ko) => {
    resolve = ok;
    reject = ko;
  });
  return { promise, resolve, reject };
}

/**
 * Function rolesOf
 *
 * @description
 * The rows as `userId:role`, for short assertions.
 *
 * @param {ListShareStoreInstance} store - The store.
 * @returns {string[]} The rows.
 */
function rolesOf(store: ListShareStoreInstance): string[] {
  return store.people().map((person: SharePerson): string => `${person.userId}:${person.role}`);
}

describe('ListShareStore', () => {
  let api: Record<string, Mock>;
  let toasts: { show: Mock; error: Mock };
  let listPage: {
    list: { hasValue: () => boolean; value: () => TaskList };
    followListEdits: Mock;
    members: { reload: Mock };
  };
  let store: ListShareStoreInstance;

  /**
   * Function open
   *
   * @description
   * Opens the store on `Sprint 14` and waits for the read.
   *
   * @returns {Promise<void>} Resolves once read.
   */
  async function open(): Promise<void> {
    store.follow({ listId: 'l-sprint14', spaceId: 'sp-product' });
    await expect.poll(() => store.access.hasValue()).toBe(true);
  }

  beforeEach(() => {
    api = {
      read: vi.fn(() => Promise.resolve(sprint14Access)),
      setRole: vi.fn(() => Promise.resolve({ version: 5 })),
      removeRole: vi.fn(() => Promise.resolve({ version: 6 })),
      setOrganizationAccess: vi.fn(() => Promise.resolve({ version: 7 })),
    };
    toasts = { show: vi.fn(), error: vi.fn() };
    listPage = {
      list: { hasValue: () => true, value: () => sprint14 },
      followListEdits: vi.fn(),
      members: { reload: vi.fn() },
    };
    TestBed.configureTestingModule({
      providers: [
        ListShareStore,
        { provide: ListAccessApi, useValue: api },
        { provide: CwToastService, useValue: toasts },
        { provide: ListPageStore, useValue: listPage },
      ],
    });
    store = TestBed.inject(ListShareStore);
  });

  it('lists the owner first, then the grants, and counts the guests', async () => {
    await open();

    expect(api['read']).toHaveBeenCalledWith('l-sprint14', 'sp-product', expect.any(AbortSignal));
    expect(rolesOf(store)).toEqual(['u-camille:owner', 'u-lea:comment', 'u-nadia:comment']);
    expect(store.people()[2]).toMatchObject({ name: 'Nadia Benali', guest: true });
    expect(store.guestCount()).toBe(1);
    expect(store.canInvite()).toBe(true);
    expect(store.organizationAccess()).toBe(true);
  });

  it('keeps a failed read apart from an empty one and reads again on retry', async () => {
    api['read'].mockRejectedValueOnce(new Error('offline'));
    store.follow({ listId: 'l-sprint14', spaceId: 'sp-product' });
    await expect.poll(() => store.access.error()).toBeTruthy();
    expect(store.people()).toEqual([]);

    store.access.reload();
    await expect.poll(() => store.access.hasValue()).toBe(true);
    expect(api['read']).toHaveBeenCalledTimes(2);
  });

  it('changes a role at once and hands the new list version to the list page', async () => {
    await open();

    const sent: Promise<boolean> = store.changeRole('u-lea', 'view');
    expect(rolesOf(store)).toContain('u-lea:view');
    await expect(sent).resolves.toBe(true);

    expect(api['setRole']).toHaveBeenCalledWith('l-sprint14', 'u-lea', 'view');
    const edits: Observable<TaskList> = listPage.followListEdits.mock
      .calls[0]?.[0] as Observable<TaskList>;
    await expect(firstValueFrom(edits)).resolves.toEqual({ ...sprint14, version: 5 });
    expect(listPage.members.reload).toHaveBeenCalled();
  });

  it('puts back the confirmed role and shows the failure toast when the gateway refuses', async () => {
    await open();
    api['setRole'].mockRejectedValueOnce(new Error('refused'));

    await expect(store.changeRole('u-lea', 'edit')).resolves.toBe(false);

    expect(rolesOf(store)).toContain('u-lea:comment');
    expect(toasts.error).toHaveBeenCalledWith('The access could not be changed');
    expect(listPage.followListEdits).not.toHaveBeenCalled();
  });

  it('sends the changes of one person in order and keeps the newer one when an older fails', async () => {
    await open();
    const first: ReturnType<typeof deferred> = deferred();
    api['setRole'].mockReturnValueOnce(first.promise);

    const older: Promise<boolean> = store.changeRole('u-lea', 'edit');
    const newer: Promise<boolean> = store.changeRole('u-lea', 'view');
    await expect.poll(() => api['setRole'].mock.calls.length).toBe(1);
    expect(rolesOf(store)).toContain('u-lea:view');
    first.reject(new Error('refused'));

    await expect(older).resolves.toBe(false);
    expect(rolesOf(store)).toContain('u-lea:view');
    await expect(newer).resolves.toBe(true);
    expect(api['setRole']).toHaveBeenLastCalledWith('l-sprint14', 'u-lea', 'view');
    expect(rolesOf(store)).toContain('u-lea:view');
  });

  it('removes a person at once and shows them again when refused', async () => {
    await open();

    await expect(store.remove('u-nadia')).resolves.toBe(true);
    expect(rolesOf(store)).toEqual(['u-camille:owner', 'u-lea:comment']);

    api['removeRole'].mockRejectedValueOnce(new Error('refused'));
    await expect(store.remove('u-lea')).resolves.toBe(false);
    expect(rolesOf(store)).toEqual(['u-camille:owner', 'u-lea:comment']);
    expect(toasts.error).toHaveBeenCalledWith('The access could not be removed');
  });

  it('never changes the owner', async () => {
    await open();

    await expect(store.changeRole('u-camille', 'view')).resolves.toBe(false);
    expect(api['setRole']).not.toHaveBeenCalled();
  });

  it('invites a member by address, then confirms with Invitation sent', async () => {
    await open();

    expect(store.invite('  Hugo.Dubois@ateliernord.fr ', 'edit')).toBe('sent');
    expect(rolesOf(store)).toEqual([
      'u-camille:owner',
      'u-lea:comment',
      'u-nadia:comment',
      'u-hugo:edit',
    ]);
    await expect.poll(() => toasts.show.mock.calls.length).toBe(1);
    expect(toasts.show).toHaveBeenCalledWith('Invitation sent', {
      description: 'hugo.dubois@ateliernord.fr can now edit the list.',
    });
  });

  it('removes an invited person again when the invitation is refused', async () => {
    await open();
    api['setRole'].mockRejectedValueOnce(new Error('refused'));

    expect(store.invite('hugo.dubois@ateliernord.fr', 'view')).toBe('sent');
    await expect.poll(() => toasts.error.mock.calls.length).toBe(1);

    expect(rolesOf(store)).not.toContain('u-hugo:view');
    expect(toasts.error).toHaveBeenCalledWith('The person could not be invited');
    expect(toasts.show).not.toHaveBeenCalled();
  });

  it('tells apart an incomplete address, an unknown one and the owner', async () => {
    await open();

    expect(store.invite('', 'edit')).toBe('ignored');
    expect(store.invite('hugo@ateliernord', 'edit')).toBe('invalid');
    expect(store.invite('someone@elsewhere.com', 'edit')).toBe('unknown');
    expect(store.invite('camille@ateliernord.fr', 'edit')).toBe('owner');
    expect(api['setRole']).not.toHaveBeenCalled();
  });

  it('turns the organization access at once and back when refused', async () => {
    await open();

    await expect(store.setOrganizationAccess(false)).resolves.toBe(true);
    expect(store.organizationAccess()).toBe(false);

    api['setOrganizationAccess'].mockRejectedValueOnce(new Error('refused'));
    await expect(store.setOrganizationAccess(true)).resolves.toBe(false);
    expect(store.organizationAccess()).toBe(false);
    expect(toasts.error).toHaveBeenCalledWith('The organization access could not be changed');
  });

  it('changes nothing for a caller without edit', async () => {
    api['read'].mockResolvedValueOnce({ ...sprint14Access, canEdit: false });
    await open();

    expect(store.canInvite()).toBe(false);
    expect(store.invite('hugo.dubois@ateliernord.fr', 'edit')).toBe('ignored');
    await expect(store.setOrganizationAccess(false)).resolves.toBe(false);
    expect(api['setOrganizationAccess']).not.toHaveBeenCalled();
  });

  it('forgets the changes when the dialog closes and drops answers for a list it left', async () => {
    await open();
    const pending: ReturnType<typeof deferred> = deferred();
    api['setRole'].mockReturnValueOnce(pending.promise);
    const sent: Promise<boolean> = store.changeRole('u-lea', 'view');

    store.follow(null);
    pending.resolve({ version: 9 });
    await sent;

    expect(store.people()).toEqual([]);
    expect(listPage.followListEdits).not.toHaveBeenCalled();
    await open();
    expect(rolesOf(store)).toContain('u-lea:comment');
  });
});
