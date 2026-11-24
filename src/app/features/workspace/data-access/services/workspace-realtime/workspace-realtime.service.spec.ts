import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';

import { WorkspaceRealtime } from './workspace-realtime.service';

describe('WorkspaceRealtime', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('returns the token issued by the generated realtime client', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const result: Promise<string> = TestBed.inject(WorkspaceRealtime).issueTicket();
    TestBed.inject(HttpTestingController)
      .expectOne({ method: 'POST', url: '/v1/realtime/tickets' })
      .flush({ token: 'test-ticket', expiresAt: '2026-11-08T11:00:00Z' });
    await expect(result).resolves.toBe('test-ticket');
  });
});
