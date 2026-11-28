import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { recentReadInterceptor } from './recent-read.interceptor';
import { RECORD_READ, REUSE_READ_WITHIN_MS } from './recent-read.token';

/**
 * Constant ACCOUNT
 *
 * @description
 * The address of the session's account, as the gateway serves it.
 *
 * @type {string}
 */
const ACCOUNT: string = 'https://api.example.test/v1/me';

/**
 * Function context
 *
 * @description
 * A request context that records the answer or reuses one at most `within` milliseconds old.
 *
 * @param {boolean} record - Whether the answer is kept.
 * @param {number} within - How old a kept answer may be.
 * @returns {HttpContext} The context.
 */
function context(record: boolean, within: number = 0): HttpContext {
  return new HttpContext().set(RECORD_READ, record).set(REUSE_READ_WITHIN_MS, within);
}

describe('recentReadInterceptor', () => {
  let http: HttpClient;
  let testing: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([recentReadInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    testing = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    testing.verify();
    vi.useRealTimers();
  });

  it('hands a recorded answer to a reader of the same address soon after', async () => {
    const first: Promise<unknown> = firstValueFrom(http.get(ACCOUNT, { context: context(true) }));
    testing.expectOne(ACCOUNT).flush({ id: 'u-camille' });
    await first;

    vi.advanceTimersByTime(2000);
    await expect(
      firstValueFrom(http.get(ACCOUNT, { context: context(false, 2000) })),
    ).resolves.toEqual({ id: 'u-camille' });
    testing.expectNone(ACCOUNT);
  });

  it('asks the gateway again once the answer is older, or for a reader that reuses nothing', async () => {
    const first: Promise<unknown> = firstValueFrom(http.get(ACCOUNT, { context: context(true) }));
    testing.expectOne(ACCOUNT).flush({ id: 'u-camille' });
    await first;

    const fresh: Promise<unknown> = firstValueFrom(http.get(ACCOUNT));
    testing.expectOne(ACCOUNT).flush({ id: 'u-camille' });
    await fresh;

    vi.advanceTimersByTime(2001);
    const late: Promise<unknown> = firstValueFrom(
      http.get(ACCOUNT, { context: context(false, 2000) }),
    );
    testing.expectOne(ACCOUNT).flush({ id: 'u-lucas' });
    await expect(late).resolves.toEqual({ id: 'u-lucas' });
  });

  it('forgets the recorded answers on a write', async () => {
    const first: Promise<unknown> = firstValueFrom(http.get(ACCOUNT, { context: context(true) }));
    testing.expectOne(ACCOUNT).flush({ id: 'u-camille' });
    await first;
    const write: Promise<unknown> = firstValueFrom(
      http.post('https://api.example.test/v1/auth/logout', {}),
    );
    testing.expectOne('https://api.example.test/v1/auth/logout').flush(null);
    await write;

    const after: Promise<unknown> = firstValueFrom(
      http.get(ACCOUNT, { context: context(false, 2000) }),
    );
    testing.expectOne(ACCOUNT).flush({ id: 'u-lucas' });
    await expect(after).resolves.toEqual({ id: 'u-lucas' });
  });

  it('keeps no failed answer', async () => {
    const first: Promise<unknown> = firstValueFrom(
      http.get(ACCOUNT, { context: context(true) }),
    ).catch((): null => null);
    testing.expectOne(ACCOUNT).flush(null, { status: 401, statusText: 'Unauthorized' });
    await first;

    const next: Promise<unknown> = firstValueFrom(
      http.get(ACCOUNT, { context: context(false, 2000) }),
    );
    testing.expectOne(ACCOUNT).flush({ id: 'u-camille' });
    await expect(next).resolves.toEqual({ id: 'u-camille' });
  });
});
