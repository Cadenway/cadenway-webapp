import { HttpErrorResponse } from '@angular/common/http';
import { createEnvironmentInjector, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NotificationPreferencesService } from '@cadenway/api-client';
import { CwToastService } from '@cadenway/ui/components/toast';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { NotificationPreferencesApi } from '../../data-access/services/notification-preferences-api/notification-preferences-api.service';
import type {
  NotificationPreferenceChange,
  NotificationPreferences,
} from '../../models/notification-preferences/notification-preferences.interface';
import {
  applied,
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
 * Constant commentByEmail
 *
 * @description
 * Ticking `Comments by email`.
 *
 * @type {NotificationPreferenceChange}
 */
const commentByEmail: NotificationPreferenceChange = {
  kind: 'channel',
  event: 'comment',
  channel: 'email',
  enabled: true,
};

describe('NotificationPreferencesStore', () => {
  let read: Mock<NotificationPreferencesApi['read']>;
  let change: Mock<NotificationPreferencesApi['change']>;
  let toasts: { error: Mock; dismiss: Mock };
  let recorded: NotificationPreferences;
  let store: NotificationPreferencesStoreInstance;

  beforeEach(() => {
    recorded = camille;
    read = vi.fn<NotificationPreferencesApi['read']>(() => Promise.resolve(recorded));
    change = vi.fn<NotificationPreferencesApi['change']>((next, version) => {
      recorded = { ...applied(recorded, next), version: version + 1 };
      return Promise.resolve(recorded);
    });
    toasts = { error: vi.fn(() => 'toast-1'), dismiss: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        NotificationPreferencesStore,
        { provide: NotificationPreferencesApi, useValue: { read, change } },
        { provide: CwToastService, useValue: toasts },
      ],
    });
  });

  /**
   * Function loaded
   *
   * @description
   * Waits for the primary read.
   *
   * @returns {Promise<void>} Resolves once the preferences show.
   */
  async function loaded(): Promise<void> {
    store = TestBed.inject(NotificationPreferencesStore);
    TestBed.tick();
    await expect.poll(() => store.preferences()).not.toBeNull();
  }

  it('shows nothing while loading, then the preferences read', async () => {
    store = TestBed.inject(NotificationPreferencesStore);
    expect(store.preferences()).toBeNull();
    await loaded();
    expect(store.preferences()).toEqual(camille);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('keeps a failed read in the resource error, for the route boundary', async () => {
    read.mockRejectedValueOnce(new Error('503'));
    store = TestBed.inject(NotificationPreferencesStore);
    TestBed.tick();
    await expect.poll(() => store.saved.status()).toBe('error');
    expect(() => store.saved.value()).toThrow();
    expect(store.preferences()).toBeNull();
  });

  it('shows a change at once and records the answered version', async () => {
    await loaded();
    const answer: ReturnType<typeof deferred<NotificationPreferences>> =
      deferred<NotificationPreferences>();
    change.mockReturnValueOnce(answer.promise);

    store.change(commentByEmail);
    expect(store.preferences()?.channels.comment.email).toBe(true);
    await expect.poll(() => change.mock.calls.length).toBe(1);
    expect(change).toHaveBeenCalledWith(commentByEmail, 1);

    answer.resolve({ ...applied(camille, commentByEmail), version: 2 });
    await expect.poll(() => store.saved.value()?.version).toBe(2);
    expect(store.preferences()?.channels.comment.email).toBe(true);
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('sends the writes one after the other, each from the previous version', async () => {
    await loaded();
    store.change(commentByEmail);
    store.change({ kind: 'digest', digest: 'weekly' });
    store.change({ kind: 'doNotDisturb', enabled: false });

    await expect.poll(() => change.mock.calls.length).toBe(3);
    expect(
      change.mock.calls.map(
        ([, version]: [NotificationPreferenceChange, number]): number => version,
      ),
    ).toEqual([1, 2, 3]);
    await expect.poll(() => store.saved.value()?.version).toBe(4);
    expect(store.preferences()).toMatchObject({ digest: 'weekly', doNotDisturb: false });
  });

  it('rolls a refused change back to the confirmed value and says so', async () => {
    await loaded();
    change.mockRejectedValueOnce(forbidden);

    store.change({ kind: 'doNotDisturb', enabled: false });
    expect(store.preferences()?.doNotDisturb).toBe(false);

    await expect.poll(() => store.preferences()?.doNotDisturb).toBe(true);
    expect(toasts.error).toHaveBeenCalledWith('Could not save', {
      description: 'The previous setting is back. Try again in a moment.',
    });
    expect(store.saved.value()?.version).toBe(1);
    expect(read).toHaveBeenCalledTimes(1);

    store.change({ kind: 'doNotDisturb', enabled: false });
    await expect.poll(() => store.saved.value()?.doNotDisturb).toBe(false);
    expect(change).toHaveBeenCalledTimes(2);
  });

  it('replaces the previous failure toast instead of stacking them', async () => {
    await loaded();
    change.mockRejectedValue(forbidden);

    store.change(commentByEmail);
    store.change({ kind: 'digest', digest: 'never' });

    await expect.poll(() => toasts.error.mock.calls.length).toBe(2);
    expect(toasts.dismiss).toHaveBeenCalledWith('toast-1');
    expect(store.preferences()).toEqual(camille);
  });

  it('keeps a newer change of the same setting when an earlier write fails', async () => {
    await loaded();
    const first: ReturnType<typeof deferred<NotificationPreferences>> =
      deferred<NotificationPreferences>();
    change.mockReturnValueOnce(first.promise);

    store.change({ kind: 'digest', digest: 'weekly' });
    await expect.poll(() => change.mock.calls.length).toBe(1);
    store.change({ kind: 'digest', digest: 'never' });
    first.reject(new Error('503'));

    await expect.poll(() => change.mock.calls.length).toBe(2);
    expect(change.mock.calls[1]?.[0]).toEqual({ kind: 'digest', digest: 'never' });
    await expect.poll(() => store.saved.value()?.digest).toBe('never');
    expect(store.preferences()?.digest).toBe('never');
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('sends nothing for a setting turned back to its confirmed value', async () => {
    await loaded();
    store.change({ kind: 'doNotDisturb', enabled: false });
    store.change({ kind: 'doNotDisturb', enabled: true });

    await Promise.resolve();
    await Promise.resolve();
    expect(change).not.toHaveBeenCalled();
    expect(store.preferences()).toEqual(camille);
  });

  it('sends only the last change of a burst on one setting', async () => {
    await loaded();
    const first: ReturnType<typeof deferred<NotificationPreferences>> =
      deferred<NotificationPreferences>();
    change.mockReturnValueOnce(first.promise);

    store.change({ kind: 'doNotDisturb', enabled: false });
    await expect.poll(() => change.mock.calls.length).toBe(1);
    store.change({ kind: 'doNotDisturb', enabled: true });
    store.change({ kind: 'doNotDisturb', enabled: false });
    store.change({ kind: 'doNotDisturb', enabled: true });
    first.resolve({ ...camille, doNotDisturb: false, version: 2 });

    await expect.poll(() => change.mock.calls.length).toBe(2);
    expect(change.mock.calls[1]).toEqual([{ kind: 'doNotDisturb', enabled: true }, 2]);
  });

  it('sends the writes still queued once the page is gone', async () => {
    const page: EnvironmentInjector = createEnvironmentInjector(
      [NotificationPreferencesStore],
      TestBed.inject(EnvironmentInjector),
    );
    store = page.get(NotificationPreferencesStore);
    TestBed.tick();
    await expect.poll(() => store.preferences()).not.toBeNull();
    const first: ReturnType<typeof deferred<NotificationPreferences>> =
      deferred<NotificationPreferences>();
    change.mockReturnValueOnce(first.promise);

    store.change(commentByEmail);
    store.change({ kind: 'digest', digest: 'weekly' });
    store.change({ kind: 'doNotDisturb', enabled: false });
    await expect.poll(() => change.mock.calls.length).toBe(1);
    page.destroy();
    recorded = { ...applied(camille, commentByEmail), version: 2 };
    first.resolve(recorded);

    await expect.poll(() => change.mock.calls.length).toBe(3);
    expect(
      change.mock.calls.map(
        ([next, version]: [NotificationPreferenceChange, number]): [string, number] => [
          next.kind,
          version,
        ],
      ),
    ).toEqual([
      ['channel', 1],
      ['digest', 2],
      ['doNotDisturb', 3],
    ]);
    expect(recorded).toMatchObject({ digest: 'weekly', doNotDisturb: false, version: 4 });
  });

  it('reads again after a write without an answer, and sends a reversal made meanwhile', async () => {
    await loaded();
    const lost: ReturnType<typeof deferred<NotificationPreferences>> =
      deferred<NotificationPreferences>();
    change.mockImplementationOnce((next: NotificationPreferenceChange, version: number) => {
      recorded = { ...applied(recorded, next), version: version + 1 };
      return lost.promise;
    });

    store.change({ kind: 'doNotDisturb', enabled: false });
    await expect.poll(() => change.mock.calls.length).toBe(1);
    store.change({ kind: 'doNotDisturb', enabled: true });
    lost.reject(new HttpErrorResponse({ status: 0 }));

    await expect.poll(() => change.mock.calls.length).toBe(2);
    expect(read).toHaveBeenCalledTimes(2);
    expect(change.mock.calls[1]).toEqual([{ kind: 'doNotDisturb', enabled: true }, 2]);
    await expect.poll(() => recorded.doNotDisturb).toBe(true);
    expect(store.preferences()?.doNotDisturb).toBe(true);
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('keeps a change whose answer was lost when the preferences read again hold it', async () => {
    await loaded();
    const lost: ReturnType<typeof deferred<NotificationPreferences>> =
      deferred<NotificationPreferences>();
    change.mockImplementationOnce((next: NotificationPreferenceChange, version: number) => {
      recorded = { ...applied(recorded, next), version: version + 1 };
      return lost.promise;
    });

    store.change({ kind: 'digest', digest: 'weekly' });
    await expect.poll(() => change.mock.calls.length).toBe(1);
    lost.reject(new HttpErrorResponse({ status: 504 }));

    await expect.poll(() => store.saved.value()?.version).toBe(2);
    expect(store.preferences()?.digest).toBe('weekly');
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('restores a change whose answer was lost when the preferences read again lack it', async () => {
    await loaded();
    change.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));

    store.change({ kind: 'digest', digest: 'weekly' });

    await expect.poll(() => toasts.error.mock.calls.length).toBe(1);
    expect(read).toHaveBeenCalledTimes(2);
    expect(store.preferences()?.digest).toBe('daily');
  });

  it('reads first at the next change when the read after a lost answer failed too', async () => {
    await loaded();
    change.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));
    read.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));

    store.change({ kind: 'digest', digest: 'weekly' });
    await expect.poll(() => toasts.error.mock.calls.length).toBe(1);
    expect(store.preferences()?.digest).toBe('daily');

    recorded = { ...recorded, digest: 'never', version: 7 };
    store.change({ kind: 'digest', digest: 'weekly' });

    await expect.poll(() => change.mock.calls.length).toBe(2);
    expect(read).toHaveBeenCalledTimes(3);
    expect(change.mock.calls[1]).toEqual([{ kind: 'digest', digest: 'weekly' }, 7]);
  });
});

describe('NotificationPreferencesStore over the gateway client', () => {
  let client: { getNotificationPreferences: Mock; updateNotificationPreferences: Mock };
  let toasts: { error: Mock; dismiss: Mock };

  beforeEach(() => {
    client = {
      getNotificationPreferences: vi.fn(() => of(camille)),
      updateNotificationPreferences: vi.fn(),
    };
    toasts = { error: vi.fn(() => 'toast-1'), dismiss: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        NotificationPreferencesStore,
        { provide: NotificationPreferencesService, useValue: client },
        { provide: CwToastService, useValue: toasts },
      ],
    });
  });

  it('rolls back with a toast when the resend after a version mismatch is refused', async () => {
    const store: NotificationPreferencesStoreInstance = TestBed.inject(
      NotificationPreferencesStore,
    );
    TestBed.tick();
    await expect.poll(() => store.preferences()).not.toBeNull();
    client.getNotificationPreferences.mockReturnValue(of({ ...camille, version: 5 }));
    client.updateNotificationPreferences
      .mockReturnValueOnce(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 412,
              error: { type: 'about:blank', status: 412, code: 'request.version-mismatch' },
            }),
        ),
      )
      .mockReturnValueOnce(throwError(() => forbidden));

    store.change({ kind: 'doNotDisturb', enabled: false });
    expect(store.preferences()?.doNotDisturb).toBe(false);

    await expect.poll(() => toasts.error.mock.calls.length).toBe(1);
    expect(client.updateNotificationPreferences).toHaveBeenCalledTimes(2);
    expect(
      client.updateNotificationPreferences.mock.calls.map(
        ([, options]: unknown[]): unknown => options,
      ),
    ).toEqual([{ headers: { 'If-Match': '"1"' } }, { headers: { 'If-Match': '"5"' } }]);
    expect(store.preferences()?.doNotDisturb).toBe(true);
  });
});
