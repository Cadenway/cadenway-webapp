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
import { SKIP_ORGANIZATION_PIN } from './organization-pin.token';

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
  });
});
