import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  AuthService,
  type NotificationPreferencesPatch,
  NotificationPreferencesService,
} from '@cadenway/api-client';
import { CwToastService } from '@cadenway/ui/components/toast';
import { from, type Observable, of, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { AccountChangedError } from '../../data-access/services/notification-preferences-api/account-changed.error';
import { NotificationPreferencesApi } from '../../data-access/services/notification-preferences-api/notification-preferences-api.service';
import type {
  NotificationPreferenceChange,
  NotificationPreferences,
} from '../../models/notification-preferences/notification-preferences.interface';
import { applied, NotificationPreferencesSync } from './notification-preferences-sync.service';

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
 * Constant forbidden
 *
 * @description
 * A refusal of the gateway (`403`), which recorded nothing.
 *
 * @type {HttpErrorResponse}
 */
const forbidden: HttpErrorResponse = new HttpErrorResponse({
  status: 403,
  error: { type: 'about:blank', status: 403, code: 'account.write-forbidden' },
});

/**
 * Constant versionMismatch
 *
 * @description
 * The gateway's `412 request.version-mismatch`.
 *
 * @type {HttpErrorResponse}
 */
const versionMismatch: HttpErrorResponse = new HttpErrorResponse({
  status: 412,
  error: { type: 'about:blank', status: 412, code: 'request.version-mismatch' },
});

/**
 * Constant dndOff
 *
 * @description
 * Turning `Do not disturb` off.
 *
 * @type {NotificationPreferenceChange}
 */
const dndOff: NotificationPreferenceChange = { kind: 'doNotDisturb', enabled: false };

/**
 * Function rejection
 *
 * @description
 * A promise rejected with a gateway failure.
 *
 * @param {unknown} error - The failure.
 * @returns {Promise<never>} The rejected promise.
 */
function rejection(error: unknown): Promise<never> {
  let reject!: (reason: unknown) => void;
  const promise: Promise<never> = new Promise<never>((_resolve, ko) => {
    reject = ko;
  });
  reject(error);
  return promise;
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

describe('NotificationPreferencesSync', () => {
  let server: NotificationPreferences;
  let read: Mock<NotificationPreferencesApi['read']>;
  let write: Mock<NotificationPreferencesApi['write']>;
  let toasts: { error: Mock; dismiss: Mock };
  let sync: NotificationPreferencesSync;

  /**
   * Function commit
   *
   * @description
   * What the gateway does with a patch: it refuses a stale version, otherwise records it.
   *
   * @param {NotificationPreferenceChange} change - The change.
   * @param {number} version - Version it is sent against.
   * @returns {boolean} Whether it was recorded.
   */
  function commit(change: NotificationPreferenceChange, version: number): boolean {
    if (version !== server.version) return false;
    server = { ...applied(server, change), version: server.version + 1 };
    return true;
  }

  /**
   * Function answer
   *
   * @description
   * The gateway's answer to a patch: the recorded preferences, or the version mismatch.
   *
   * @param {NotificationPreferenceChange} change - The change.
   * @param {number} version - Version it is sent against.
   * @returns {Promise<NotificationPreferences>} The answer.
   */
  function answer(
    change: NotificationPreferenceChange,
    version: number,
  ): Promise<NotificationPreferences> {
    return commit(change, version) ? Promise.resolve(server) : rejection(versionMismatch);
  }

  /**
   * Function writes
   *
   * @description
   * The changes sent, with the version each was sent against.
   *
   * @returns {[string, number][]} Kind and version of each write.
   */
  function writes(): [string, number][] {
    return write.mock.calls.map(
      ([change, version]: [NotificationPreferenceChange, number, string]): [string, number] => [
        change.kind,
        version,
      ],
    );
  }

  /**
   * Function shown
   *
   * @description
   * The preferences a page shows: the confirmed ones with the pending changes over them.
   *
   * @returns {NotificationPreferences | null} The preferences.
   */
  function shown(): NotificationPreferences | null {
    const confirmed: NotificationPreferences | null = sync.confirmed();
    return confirmed === null ? null : Object.values(sync.pending()).reduce(applied, confirmed);
  }

  beforeEach(async () => {
    server = camille;
    read = vi.fn<NotificationPreferencesApi['read']>(() => Promise.resolve(server));
    write = vi.fn<NotificationPreferencesApi['write']>((change, version) =>
      answer(change, version),
    );
    toasts = { error: vi.fn(() => 'toast-1'), dismiss: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: NotificationPreferencesApi, useValue: { read, write } },
        { provide: CwToastService, useValue: toasts },
      ],
    });
    sync = TestBed.inject(NotificationPreferencesSync);
    await sync.load('u-camille');
  });

  it('saves the changes in order, each from the version the previous one recorded', async () => {
    sync.change({ kind: 'channel', event: 'comment', channel: 'email', enabled: true });
    sync.change({ kind: 'digest', digest: 'weekly' });
    sync.change(dndOff);
    expect(shown()).toMatchObject({ digest: 'weekly', doNotDisturb: false });

    await expect.poll(() => sync.confirmed()?.version).toBe(4);
    expect(writes()).toEqual([
      ['channel', 1],
      ['digest', 2],
      ['doNotDisturb', 3],
    ]);
    expect(write.mock.calls.every(([, , userId]: unknown[]) => userId === 'u-camille')).toBe(true);
    expect(sync.pending()).toEqual({});
  });

  it('rolls a refused change back to the confirmed value and says so', async () => {
    write.mockRejectedValueOnce(forbidden);

    sync.change(dndOff);
    expect(shown()?.doNotDisturb).toBe(false);

    await expect.poll(() => shown()?.doNotDisturb).toBe(true);
    expect(toasts.error).toHaveBeenCalledWith('Could not save', {
      description: 'The previous setting is back. Try again in a moment.',
    });
    expect(read).toHaveBeenCalledTimes(1);

    sync.change(dndOff);
    await expect.poll(() => sync.confirmed()?.doNotDisturb).toBe(false);
  });

  it('replaces the previous failure toast instead of stacking them', async () => {
    write.mockRejectedValue(forbidden);

    sync.change(dndOff);
    sync.change({ kind: 'digest', digest: 'never' });

    await expect.poll(() => toasts.error.mock.calls.length).toBe(2);
    expect(toasts.dismiss).toHaveBeenCalledWith('toast-1');
    expect(shown()).toEqual(camille);
  });

  it('keeps a newer change of the same setting when an earlier write is refused', async () => {
    const first: ReturnType<typeof deferred<NotificationPreferences>> =
      deferred<NotificationPreferences>();
    write.mockReturnValueOnce(first.promise);

    sync.change({ kind: 'digest', digest: 'weekly' });
    await expect.poll(() => write.mock.calls.length).toBe(1);
    sync.change({ kind: 'digest', digest: 'never' });
    first.reject(forbidden);

    await expect.poll(() => sync.confirmed()?.digest).toBe('never');
    expect(write.mock.calls[1]?.[0]).toEqual({ kind: 'digest', digest: 'never' });
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('sends nothing for a setting turned back to its confirmed value', async () => {
    sync.change(dndOff);
    sync.change({ kind: 'doNotDisturb', enabled: true });

    await Promise.resolve();
    await Promise.resolve();
    expect(write).not.toHaveBeenCalled();
    expect(shown()).toEqual(camille);
  });

  it('sends only the last change of a burst on one setting', async () => {
    const first: ReturnType<typeof deferred<NotificationPreferences>> =
      deferred<NotificationPreferences>();
    write.mockReturnValueOnce(first.promise);

    sync.change(dndOff);
    await expect.poll(() => write.mock.calls.length).toBe(1);
    sync.change({ kind: 'doNotDisturb', enabled: true });
    sync.change(dndOff);
    sync.change({ kind: 'doNotDisturb', enabled: true });
    server = { ...camille, doNotDisturb: false, version: 2 };
    first.resolve(server);

    await expect.poll(() => write.mock.calls.length).toBe(2);
    expect(write.mock.calls[1]).toEqual([{ kind: 'doNotDisturb', enabled: true }, 2, 'u-camille']);
  });

  it('adopts the preferences read after a version mismatch and resends against them', async () => {
    server = { ...camille, digest: 'never', version: 5 };

    sync.change(dndOff);

    await expect.poll(() => sync.confirmed()?.version).toBe(6);
    expect(writes()).toEqual([
      ['doNotDisturb', 1],
      ['doNotDisturb', 5],
    ]);
    expect(sync.confirmed()).toMatchObject({ digest: 'never', doNotDisturb: false });
  });

  it('keeps the preferences read after a version mismatch when the resend is refused', async () => {
    server = { ...camille, digest: 'never', version: 5 };
    write.mockImplementationOnce((change, version) => answer(change, version));
    write.mockRejectedValueOnce(forbidden);

    sync.change(dndOff);

    await expect.poll(() => toasts.error.mock.calls.length).toBe(1);
    expect(writes()).toEqual([
      ['doNotDisturb', 1],
      ['doNotDisturb', 5],
    ]);
    expect(sync.confirmed()).toMatchObject({ digest: 'never', doNotDisturb: true, version: 5 });
    expect(shown()).toMatchObject({ digest: 'never', doNotDisturb: true });
  });

  it('keeps a change whose answer was lost when the preferences read again hold it', async () => {
    const lost: ReturnType<typeof deferred<NotificationPreferences>> =
      deferred<NotificationPreferences>();
    write.mockImplementationOnce((change, version) => {
      commit(change, version);
      return lost.promise;
    });

    sync.change({ kind: 'digest', digest: 'weekly' });
    await expect.poll(() => write.mock.calls.length).toBe(1);
    lost.reject(new HttpErrorResponse({ status: 504 }));

    await expect.poll(() => sync.confirmed()?.version).toBe(2);
    expect(sync.confirmed()?.digest).toBe('weekly');
    expect(write).toHaveBeenCalledTimes(1);
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('sends a reversal made while a write lost its answer', async () => {
    const lost: ReturnType<typeof deferred<NotificationPreferences>> =
      deferred<NotificationPreferences>();
    write.mockImplementationOnce((change, version) => {
      commit(change, version);
      return lost.promise;
    });

    sync.change(dndOff);
    await expect.poll(() => write.mock.calls.length).toBe(1);
    sync.change({ kind: 'doNotDisturb', enabled: true });
    lost.reject(new HttpErrorResponse({ status: 0 }));

    await expect.poll(() => server.version).toBe(3);
    expect(write.mock.calls[1]).toEqual([{ kind: 'doNotDisturb', enabled: true }, 2, 'u-camille']);
    expect(server.doNotDisturb).toBe(true);
    expect(shown()?.doNotDisturb).toBe(true);
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('resends a write whose answer was lost when the read lacks it, then it lands', async () => {
    write.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));

    sync.change({ kind: 'digest', digest: 'weekly' });

    await expect.poll(() => sync.confirmed()?.digest).toBe('weekly');
    expect(writes()).toEqual([
      ['digest', 1],
      ['digest', 1],
    ]);
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('settles a timed-out write that lands after the recovery read', async () => {
    const lost: ReturnType<typeof deferred<NotificationPreferences>> =
      deferred<NotificationPreferences>();
    write.mockReturnValueOnce(lost.promise);
    read.mockImplementationOnce(() => {
      const before: NotificationPreferences = server;
      commit(dndOff, 1);
      return Promise.resolve(before);
    });

    sync.change(dndOff);
    await expect.poll(() => write.mock.calls.length).toBe(1);
    lost.reject(new HttpErrorResponse({ status: 0 }));

    await expect.poll(() => sync.confirmed()?.version).toBe(2);
    expect(writes()).toEqual([
      ['doNotDisturb', 1],
      ['doNotDisturb', 1],
    ]);
    expect(sync.confirmed()?.doNotDisturb).toBe(false);
    expect(shown()?.doNotDisturb).toBe(false);
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('restores a change whose retry still has no answer, and reads first at the next change', async () => {
    write
      .mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }))
      .mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));

    sync.change({ kind: 'digest', digest: 'weekly' });
    await expect.poll(() => toasts.error.mock.calls.length).toBe(1);
    expect(shown()?.digest).toBe('daily');

    server = { ...server, digest: 'never', version: 7 };
    sync.change({ kind: 'digest', digest: 'weekly' });

    await expect.poll(() => sync.confirmed()?.version).toBe(8);
    expect(read).toHaveBeenCalledTimes(4);
    expect(write.mock.calls[2]).toEqual([{ kind: 'digest', digest: 'weekly' }, 7, 'u-camille']);
  });

  it('stops when the session no longer belongs to the account: nothing more is sent', async () => {
    const first: ReturnType<typeof deferred<NotificationPreferences>> =
      deferred<NotificationPreferences>();
    write.mockReturnValueOnce(first.promise).mockRejectedValueOnce(new AccountChangedError());

    sync.change({ kind: 'digest', digest: 'weekly' });
    sync.change(dndOff);
    sync.change({ kind: 'digest', digest: 'never' });
    await expect.poll(() => write.mock.calls.length).toBe(1);
    first.reject(new HttpErrorResponse({ status: 403 }));

    await expect.poll(() => sync.confirmed()).toBeNull();
    expect(sync.pending()).toEqual({});
    expect(write).toHaveBeenCalledTimes(2);
    sync.change(dndOff);
    await Promise.resolve();
    expect(write).toHaveBeenCalledTimes(2);
  });

  it('drops the unsent changes of a previous account and ignores its late answers', async () => {
    const first: ReturnType<typeof deferred<NotificationPreferences>> =
      deferred<NotificationPreferences>();
    write.mockReturnValueOnce(first.promise);
    sync.change({ kind: 'digest', digest: 'weekly' });
    sync.change(dndOff);
    await expect.poll(() => write.mock.calls.length).toBe(1);

    const lucas: NotificationPreferences = { ...camille, digest: 'never', version: 9 };
    read.mockResolvedValueOnce(lucas);
    await expect(sync.load('u-lucas')).resolves.toEqual(lucas);
    first.resolve({ ...camille, digest: 'weekly', version: 2 });
    await Promise.resolve();
    await Promise.resolve();

    expect(sync.confirmed()).toEqual(lucas);
    expect(sync.pending()).toEqual({});
    expect(write).toHaveBeenCalledTimes(1);
  });
});

describe('NotificationPreferencesSync over the gateway', () => {
  let session: string;
  let accounts: Record<string, NotificationPreferences>;
  let patches: Subject<NotificationPreferences>;
  let client: { getNotificationPreferences: Mock; updateNotificationPreferences: Mock };
  let sync: NotificationPreferencesSync;

  beforeEach(() => {
    session = 'u-camille';
    accounts = { 'u-camille': camille, 'u-lucas': { ...camille, digest: 'never', version: 4 } };
    patches = new Subject<NotificationPreferences>();
    vi.stubGlobal('navigator', {
      locks: {
        request: (_name: string, _options: LockOptions, run: () => Promise<void>): Promise<void> =>
          run(),
      },
    });
    client = {
      getNotificationPreferences: vi.fn(() => of(accounts[session])),
      updateNotificationPreferences: vi.fn(
        (patch: NotificationPreferencesPatch): Observable<NotificationPreferences> => {
          const owner: string = session;
          const before: NotificationPreferences = accounts[owner];
          accounts[owner] = {
            ...before,
            ...(patch.digest === undefined ? {} : { digest: patch.digest }),
            ...(patch.doNotDisturb === undefined ? {} : { doNotDisturb: patch.doNotDisturb }),
            version: before.version + 1,
          };
          return owner === 'u-camille' ? patches : of(accounts[owner]);
        },
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: NotificationPreferencesService, useValue: client },
        {
          provide: AuthService,
          useValue: { getCurrentUser: () => from(Promise.resolve({ id: session })) },
        },
        { provide: CwToastService, useValue: { error: vi.fn(), dismiss: vi.fn() } },
      ],
    });
    sync = TestBed.inject(NotificationPreferencesSync);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends nothing to the next account after a delayed write, a sign-out and a sign-in', async () => {
    await sync.load('u-camille');
    sync.change({ kind: 'digest', digest: 'weekly' });
    sync.change(dndOff);
    await expect.poll(() => client.updateNotificationPreferences.mock.calls.length).toBe(1);

    session = 'u-lucas';
    patches.next(accounts['u-camille']);
    patches.complete();

    await expect.poll(() => sync.confirmed()).toBeNull();
    expect(client.updateNotificationPreferences).toHaveBeenCalledTimes(1);
    expect(accounts['u-lucas']).toMatchObject({ digest: 'never', doNotDisturb: true, version: 4 });
    expect(sync.pending()).toEqual({});

    await expect(sync.load('u-lucas')).resolves.toMatchObject({ digest: 'never', version: 4 });
    expect(client.updateNotificationPreferences).toHaveBeenCalledTimes(1);
  });
});
