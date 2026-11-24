import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { RestoreOutcome } from '../../../models/error-recovery/error-recovery.type';
import { ErrorRecovery } from './error-recovery.service';

describe('ErrorRecovery', () => {
  let http: HttpTestingController;
  let recovery: ErrorRecovery;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    recovery = TestBed.inject(ErrorRecovery);
  });

  afterEach(() => {
    http.verify();
  });

  it('asks for a space with the trimmed message', async () => {
    const sent: Promise<void> = firstValueFrom(
      recovery.requestAccess({ kind: 'space', id: 's1' }, '  Budget 2027  '),
    );
    const request: TestRequest = http.expectOne({ method: 'POST', url: '/v1/access-requests' });
    expect(request.request.body).toEqual({ spaceId: 's1', message: 'Budget 2027' });
    request.flush(null, { status: 202, statusText: 'Accepted' });

    await expect(sent).resolves.toBeUndefined();
  });

  it('asks for a list without a message', async () => {
    const sent: Promise<void> = firstValueFrom(
      recovery.requestAccess({ kind: 'list', id: 'l1' }, '   '),
    );
    const request: TestRequest = http.expectOne('/v1/access-requests');
    expect(request.request.body).toEqual({ listId: 'l1', message: null });
    request.flush(null, { status: 202, statusText: 'Accepted' });

    await sent;
  });

  it('restores a trash entry', async () => {
    const outcome: Promise<RestoreOutcome> = firstValueFrom(recovery.restoreTask('entry-1'));
    const request: TestRequest = http.expectOne({
      method: 'POST',
      url: '/v1/trash/entries/entry-1/restore',
    });
    expect(request.request.body).toEqual({});
    request.flush({});

    await expect(outcome).resolves.toBe('restored');
  });

  it('reports an entry that is gone as already restored', async () => {
    const outcome: Promise<RestoreOutcome> = firstValueFrom(recovery.restoreTask('entry-1'));
    http
      .expectOne('/v1/trash/entries/entry-1/restore')
      .flush(
        { type: 'about:blank', title: 'Introuvable', status: 404, code: 'trash-entry.not-found' },
        { status: 404, statusText: 'Not Found' },
      );

    await expect(outcome).resolves.toBe('already-restored');
  });

  it('propagates any other failure', async () => {
    const outcome: Promise<RestoreOutcome> = firstValueFrom(recovery.restoreTask('entry-1'));
    http
      .expectOne('/v1/trash/entries/entry-1/restore')
      .flush(null, { status: 503, statusText: 'Service Unavailable' });

    await expect(outcome).rejects.toBeTruthy();
  });
});
