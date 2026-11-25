import {
  HttpClient,
  HttpContext,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { RuntimeConfigStore } from '@core/config';

import { organizationPinInterceptor } from './organization-pin.interceptor';
import { OrganizationPin } from './organization-pin.service';
import { OrganizationSwitchPendingError } from './organization-switch-pending.error';
import { PASSIVE_REQUEST, SKIP_ORGANIZATION_PIN } from './organization-pin.token';

describe('organizationPinInterceptor', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([organizationPinInterceptor])),
        provideHttpClientTesting(),
        {
          provide: RuntimeConfigStore,
          useValue: { config: () => ({ apiUrl: 'https://api.example.test' }) },
        },
      ],
    }),
  );
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('passes configuration loading through before runtime configuration exists', async () => {
    TestBed.overrideProvider(RuntimeConfigStore, {
      useValue: {
        config: () => {
          throw new Error('Configuration not loaded');
        },
      },
    });
    const result: Promise<unknown> = firstValueFrom(TestBed.inject(HttpClient).get('/config.json'));
    TestBed.inject(HttpTestingController)
      .expectOne('/config.json')
      .flush({ apiUrl: 'https://api.example.test' });
    await expect(result).resolves.toEqual({ apiUrl: 'https://api.example.test' });
  });

  it('pins declared operations but not session switching or unsupported methods', async () => {
    const pin: OrganizationPin = TestBed.inject(OrganizationPin);
    pin.set('organization-id');
    const http: HttpClient = TestBed.inject(HttpClient);
    const testing: HttpTestingController = TestBed.inject(HttpTestingController);
    const requests: Promise<unknown>[] = [
      firstValueFrom(http.get('/v1/tasks/CAD-1')),
      firstValueFrom(http.put('/v1/session/organization', {})),
      firstValueFrom(http.post('/v1/lists/list-id', {})),
    ];
    const task: TestRequest = testing.expectOne('/v1/tasks/CAD-1');
    expect(task.request.headers.get('If-Organization-Match')).toBe('organization-id');
    task.flush({});
    for (const path of ['/v1/session/organization', '/v1/lists/list-id']) {
      const request: TestRequest = testing.expectOne(path);
      expect(request.request.headers.has('If-Organization-Match')).toBe(false);
      request.flush({});
    }
    await Promise.all(requests);
    pin.set(null);
    expect(pin.current()).toBeNull();
  });

  it('lets the guard read the actual session organization without a pin', async () => {
    TestBed.inject(OrganizationPin).set('organization-id');
    const result: Promise<unknown> = firstValueFrom(
      TestBed.inject(HttpClient).get('/v1/organization', {
        context: new HttpContext().set(SKIP_ORGANIZATION_PIN, true),
      }),
    );
    const request: TestRequest =
      TestBed.inject(HttpTestingController).expectOne('/v1/organization');
    expect(request.request.headers.has('If-Organization-Match')).toBe(false);
    request.flush({});
    await result;
  });

  it('refuses pinned requests locally during a session switch', async () => {
    const pin: OrganizationPin = TestBed.inject(OrganizationPin);
    pin.set('old-organization');
    pin.beginSwitch();
    const client: HttpClient = TestBed.inject(HttpClient);
    const http: HttpTestingController = TestBed.inject(HttpTestingController);
    await expect(firstValueFrom(client.patch('/v1/tasks/CAD-1', {}))).rejects.toBeInstanceOf(
      OrganizationSwitchPendingError,
    );
    http.expectNone('/v1/tasks/CAD-1');
    pin.set('new-organization');
    const result: Promise<unknown> = firstValueFrom(client.get('/v1/tasks/CAD-1'));
    const request: TestRequest = http.expectOne('/v1/tasks/CAD-1');
    expect(request.request.headers.get('If-Organization-Match')).toBe('new-organization');
    request.flush({});
    await result;
  });

  it('pins a realtime ticket and reports its context mismatch', async () => {
    const pin: OrganizationPin = TestBed.inject(OrganizationPin);
    pin.set('organization-id');
    const changed: Mock<() => void> = vi.fn();
    pin.contextChanged.subscribe(changed);
    const response: Promise<unknown> = firstValueFrom(
      TestBed.inject(HttpClient).post('/v1/realtime/tickets', {}),
    );
    const request: TestRequest =
      TestBed.inject(HttpTestingController).expectOne('/v1/realtime/tickets');
    expect(request.request.headers.get('If-Organization-Match')).toBe('organization-id');
    request.flush(
      { code: 'organization.context-changed' },
      { status: 412, statusText: 'Precondition Failed' },
    );
    await expect(response).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(changed).toHaveBeenCalledOnce();
    pin.beginSwitch();
    await expect(
      firstValueFrom(TestBed.inject(HttpClient).post('/v1/realtime/tickets', {})),
    ).rejects.toBeInstanceOf(OrganizationSwitchPendingError);
    TestBed.inject(HttpTestingController).expectNone('/v1/realtime/tickets');
  });

  it('marks passive mismatches stale and fences later passive requests until verification', async () => {
    const pin: OrganizationPin = TestBed.inject(OrganizationPin);
    const changed: Mock<() => void> = vi.fn();
    const verified: Mock<() => void> = vi.fn();
    pin.set('organization-id');
    pin.contextChanged.subscribe(changed);
    pin.organizationVerified.subscribe(verified);
    const http: HttpClient = TestBed.inject(HttpClient);
    const testing: HttpTestingController = TestBed.inject(HttpTestingController);
    const context: HttpContext = new HttpContext().set(PASSIVE_REQUEST, true);
    const response: Promise<unknown> = firstValueFrom(http.get('/v1/tasks/CAD-1', { context }));
    testing
      .expectOne('/v1/tasks/CAD-1')
      .flush(
        { code: 'organization.context-changed' },
        { status: 412, statusText: 'Precondition Failed' },
      );
    await expect(response).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(pin.stale()).toBe(true);
    expect(changed).not.toHaveBeenCalled();
    await expect(firstValueFrom(http.get('/v1/tasks/CAD-1', { context }))).rejects.toBeInstanceOf(
      OrganizationSwitchPendingError,
    );
    testing.expectNone('/v1/tasks/CAD-1');
    pin.set('organization-id');
    expect(pin.stale()).toBe(false);
    expect(verified).toHaveBeenCalledOnce();
    const resumed: Promise<unknown> = firstValueFrom(http.get('/v1/tasks/CAD-1', { context }));
    testing.expectOne('/v1/tasks/CAD-1').flush({});
    await resumed;
  });

  it('ignores a passive mismatch from before a verified commit', async () => {
    const pin: OrganizationPin = TestBed.inject(OrganizationPin);
    pin.set('organization-id');
    const context: HttpContext = new HttpContext().set(PASSIVE_REQUEST, true);
    const response: Promise<unknown> = firstValueFrom(
      TestBed.inject(HttpClient).get('/v1/tasks/CAD-1', { context }),
    );
    const request: TestRequest = TestBed.inject(HttpTestingController).expectOne('/v1/tasks/CAD-1');
    pin.set('organization-id');
    request.flush(
      { code: 'organization.context-changed' },
      { status: 412, statusText: 'Precondition Failed' },
    );
    await expect(response).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(pin.stale()).toBe(false);
  });

  it('reports only a context-changed 412 and preserves the error', async () => {
    const pin: OrganizationPin = TestBed.inject(OrganizationPin);
    pin.set('organization-id');
    const changed: Mock<() => void> = vi.fn();
    pin.contextChanged.subscribe(changed);
    const response: Promise<unknown> = firstValueFrom(
      TestBed.inject(HttpClient).get('/v1/tasks/CAD-1'),
    );
    TestBed.inject(HttpTestingController)
      .expectOne('/v1/tasks/CAD-1')
      .flush(
        { code: 'organization.context-changed' },
        { status: 412, statusText: 'Precondition Failed' },
      );
    await expect(response).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(changed).toHaveBeenCalledOnce();
    expect(pin.stale()).toBe(true);
  });
});
