import { HttpErrorResponse } from '@angular/common/http';
import { createEnvironmentInjector, EnvironmentInjector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CwToastService } from '@cadenway/ui/components/toast';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { NotificationPreferencesApi } from '../../data-access/services/notification-preferences-api/notification-preferences-api.service';
import type {
  NotificationPreferenceChange,
  NotificationPreferences,
} from '../../models/notification-preferences/notification-preferences.interface';
import { applied } from '../../services/notification-preferences-sync/notification-preferences-sync.service';
import {
  NotificationPreferencesStore,
  type NotificationPreferencesStoreInstance,
} from './notification-preferences.store';

/**
 * Constant camille
 *
 * @description
 * Camille Martin's preferences at version 1, the contract's defaults.
 *
 * @type {NotificationPreferences}
 */
const camille: NotificationPreferences = {
  channels: {
    mention: { inApp: true, email: true, mobile: true },
    assignment: { inApp: true, email: true, mobile: true },
    comment: { inApp: true, email: false, mobile: false },
    statusChange: { inApp: true, email: false, mobile: false },
    dueDate: { inApp: true, email: true, mobile: true },
    access: { inApp: true, email: true, mobile: false },
    billing: { inApp: true, email: true, mobile: false },
  },
  digest: 'daily',
  doNotDisturb: true,
  version: 1,
};

/**
 * Constant workspace
 *
 * @description
 * Camille Martin in Atelier Nord.
 *
 * @type {WorkspaceContextPort}
 */
const workspace: WorkspaceContextPort = {
  user: signal({
    id: 'u-camille',
    name: 'Camille Martin',
    firstName: 'Camille',
    displayName: null,
    email: 'camille.martin@ateliernord.fr',
    initials: 'CM',
  }),
  organization: signal({
    id: 'o1',
    slug: 'atelier-nord',
    name: 'Atelier Nord',
    initials: 'AN',
    role: 'owner',
    plan: 'team',
  }),
  role: signal('owner'),
  can: () => true,
};

/**
 * Interface OpenedPage
 *
 * @description
 * A notifications page opened in its own injector.
 */
interface OpenedPage {
  // #region Properties
  /**
   * Property page
   *
   * @description
   * The page's injector, destroyed when the page closes.
   *
   * @type {EnvironmentInjector}
   * @readonly
   */
  readonly page: EnvironmentInjector;

  /**
   * Property store
   *
   * @description
   * The page's store.
   *
   * @type {NotificationPreferencesStoreInstance}
   * @readonly
   */
  readonly store: NotificationPreferencesStoreInstance;
  // #endregion
}

/**
 * Function deferred
 *
 * @description
 * A promise settled from the test.
 *
 * @returns {{ promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void }} The promise and its settlers.
 */
function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise: Promise<T> = new Promise<T>((ok, ko) => {
    resolve = ok;
    reject = ko;
  });
  return { promise, resolve, reject };
}

describe('NotificationPreferencesStore', () => {
  let server: NotificationPreferences;
  let read: Mock<NotificationPreferencesApi['read']>;
  let write: Mock<NotificationPreferencesApi['write']>;

  beforeEach(() => {
    server = camille;
    read = vi.fn<NotificationPreferencesApi['read']>(() => Promise.resolve(server));
    write = vi.fn<NotificationPreferencesApi['write']>((change, version) => {
      server = { ...applied(server, change), version: version + 1 };
      return Promise.resolve(server);
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: NotificationPreferencesApi, useValue: { read, write } },
        { provide: CwToastService, useValue: { error: vi.fn(), dismiss: vi.fn() } },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
      ],
    });
  });

  /**
   * Function openPage
   *
   * @description
   * Opens a notifications page in its own injector and waits for its preferences.
   *
   * @returns {Promise<OpenedPage>} The page's injector and store.
   */
  async function openPage(): Promise<OpenedPage> {
    const page: EnvironmentInjector = createEnvironmentInjector(
      [NotificationPreferencesStore],
      TestBed.inject(EnvironmentInjector),
    );
    const store: NotificationPreferencesStoreInstance = page.get(NotificationPreferencesStore);
    TestBed.tick();
    await expect.poll(() => store.preferences()).not.toBeNull();
    return { page, store };
  }

  it('shows nothing while loading, then the preferences of the signed-in person', async () => {
    const { store }: OpenedPage = await openPage();
    expect(store.preferences()).toEqual(camille);
    expect(read).toHaveBeenCalledWith('u-camille', expect.any(AbortSignal));
  });

  it('keeps a failed read in the resource error, for the route boundary', async () => {
    read.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));
    const store: NotificationPreferencesStoreInstance = createEnvironmentInjector(
      [NotificationPreferencesStore],
      TestBed.inject(EnvironmentInjector),
    ).get(NotificationPreferencesStore);
    TestBed.tick();
    await expect.poll(() => store.saved.status()).toBe('error');
    expect(() => store.saved.value()).toThrow();
    expect(store.preferences()).toBeNull();
  });

  it('sends the writes still queued once the page is gone', async () => {
    const { page, store }: OpenedPage = await openPage();
    const first: ReturnType<typeof deferred<NotificationPreferences>> =
      deferred<NotificationPreferences>();
    write.mockReturnValueOnce(first.promise);

    store.change({ kind: 'channel', event: 'comment', channel: 'email', enabled: true });
    store.change({ kind: 'digest', digest: 'weekly' });
    store.change({ kind: 'doNotDisturb', enabled: false });
    await expect.poll(() => write.mock.calls.length).toBe(1);
    page.destroy();
    server = {
      ...applied(camille, { kind: 'channel', event: 'comment', channel: 'email', enabled: true }),
      version: 2,
    };
    first.resolve(server);

    await expect.poll(() => write.mock.calls.length).toBe(3);
    expect(
      write.mock.calls.map(
        ([change, version]: [NotificationPreferenceChange, number, string]): [string, number] => [
          change.kind,
          version,
        ],
      ),
    ).toEqual([
      ['channel', 1],
      ['digest', 2],
      ['doNotDisturb', 3],
    ]);
    await expect.poll(() => server.version).toBe(4);
    expect(server).toMatchObject({ digest: 'weekly', doNotDisturb: false });
  });

  it('shows the pending choice on a reopened page, and sends its newest choice last', async () => {
    const first: ReturnType<typeof deferred<NotificationPreferences>> =
      deferred<NotificationPreferences>();
    write.mockReturnValueOnce(first.promise);
    const before: OpenedPage = await openPage();
    before.store.change({ kind: 'doNotDisturb', enabled: false });
    await expect.poll(() => write.mock.calls.length).toBe(1);
    before.page.destroy();

    const { store }: OpenedPage = await openPage();
    expect(store.preferences()?.doNotDisturb).toBe(false);
    expect(read).toHaveBeenCalledTimes(1);

    store.change({ kind: 'doNotDisturb', enabled: true });
    server = { ...camille, doNotDisturb: false, version: 2 };
    first.resolve(server);

    await expect.poll(() => write.mock.calls.length).toBe(2);
    expect(write.mock.calls[1]).toEqual([{ kind: 'doNotDisturb', enabled: true }, 2, 'u-camille']);
    await expect.poll(() => server.doNotDisturb).toBe(true);
    expect(store.preferences()?.doNotDisturb).toBe(true);
  });
});
