import { TestBed } from '@angular/core/testing';
import { type Observable, of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorRecovery } from '../../data-access/services/error-recovery/error-recovery.service';
import type { RestoreOutcome } from '../../models/error-recovery/error-recovery.type';
import { ErrorRecoveryStore } from './error-recovery.store';

describe('ErrorRecoveryStore', () => {
  let recovery: {
    requestAccess: ReturnType<typeof vi.fn<(...args: unknown[]) => Observable<void>>>;
    restoreTask: ReturnType<typeof vi.fn<(entryId: string) => Observable<RestoreOutcome>>>;
  };
  let store: InstanceType<typeof ErrorRecoveryStore>;

  beforeEach(() => {
    recovery = {
      requestAccess: vi.fn(() => of(undefined)),
      restoreTask: vi.fn(() => of<RestoreOutcome>('restored')),
    };
    TestBed.configureTestingModule({
      providers: [ErrorRecoveryStore, { provide: ErrorRecovery, useValue: recovery }],
    });
    store = TestBed.inject(ErrorRecoveryStore);
  });

  it('sends one access request while it is pending, then reports it sent', async () => {
    const response: Subject<void> = new Subject<void>();
    recovery.requestAccess.mockReturnValue(response);

    const first: Promise<void> = store.requestAccess({ kind: 'space', id: 's1' }, 'Bonjour');
    await store.requestAccess({ kind: 'space', id: 's1' }, 'Bonjour');
    expect(store.accessRequest()).toBe('sending');
    response.next();
    response.complete();
    await first;

    expect(recovery.requestAccess).toHaveBeenCalledTimes(1);
    expect(store.accessRequest()).toBe('sent');
    await store.requestAccess({ kind: 'space', id: 's1' }, 'Bonjour');
    expect(recovery.requestAccess).toHaveBeenCalledTimes(1);
  });

  it('lets the person ask again after a failed access request', async () => {
    recovery.requestAccess.mockReturnValueOnce(throwError(() => new Error('429')));

    await store.requestAccess({ kind: 'list', id: 'l1' }, '');
    expect(store.accessRequest()).toBe('idle');
    await store.requestAccess({ kind: 'list', id: 'l1' }, '');

    expect(store.accessRequest()).toBe('sent');
    expect(recovery.requestAccess).toHaveBeenCalledTimes(2);
  });

  it('reports a restored task once', async () => {
    await expect(store.restoreTask('entry-1')).resolves.toBe(true);
    expect(store.restore()).toBe('restored');
    await expect(store.restoreTask('entry-1')).resolves.toBe(false);
    expect(recovery.restoreTask).toHaveBeenCalledTimes(1);
  });

  it('reports a task that is no longer in the trash as already restored', async () => {
    recovery.restoreTask.mockReturnValue(of<RestoreOutcome>('already-restored'));

    await expect(store.restoreTask('entry-1')).resolves.toBe(false);
    expect(store.restore()).toBe('already-restored');
  });

  it('lets the person try again after a failed restore', async () => {
    recovery.restoreTask.mockReturnValueOnce(throwError(() => new Error('503')));

    await expect(store.restoreTask('entry-1')).resolves.toBe(false);
    expect(store.restore()).toBe('idle');
    await expect(store.restoreTask('entry-1')).resolves.toBe(true);
  });
});
