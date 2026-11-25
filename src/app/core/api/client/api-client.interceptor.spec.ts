import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '@cadenway/api-client';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RuntimeConfigStore } from '@core/config';

import { apiClientInterceptor } from './api-client.interceptor';

describe('apiClientInterceptor', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiClientInterceptor])),
        provideHttpClientTesting(),
        {
          provide: RuntimeConfigStore,
          useValue: { config: () => ({ apiUrl: 'https://api.cadenway.example/' }) },
        },
      ],
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('uses the configured origin and cookie for a generated request', async () => {
    const response: Promise<unknown> = firstValueFrom(TestBed.inject(AuthService).getCurrentUser());
    const client: HttpTestingController = TestBed.inject(HttpTestingController);
    const pending: TestRequest = client.expectOne(
      'https://api.cadenway.example/v1/me',
      'generated account read',
    );
    expect(pending.request.withCredentials).toBe(true);
    expect(pending.request.headers.has('Authorization')).toBe(false);
    pending.flush({ name: 'Test account' });
    await expect(response).resolves.toEqual({ name: 'Test account' });
  });

  it('preserves the URL and credential policy for an asset', async () => {
    const response: Promise<unknown> = firstValueFrom(
      TestBed.inject(HttpClient).get('/config.json'),
    );
    const client: HttpTestingController = TestBed.inject(HttpTestingController);
    const pending: TestRequest = client.expectOne('/config.json');
    expect(pending.request.withCredentials).toBe(false);
    pending.flush({ apiUrl: 'https://api.cadenway.example' });
    await expect(response).resolves.toEqual({ apiUrl: 'https://api.cadenway.example' });
  });
});
