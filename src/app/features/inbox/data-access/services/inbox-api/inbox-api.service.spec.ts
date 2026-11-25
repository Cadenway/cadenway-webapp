import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PASSIVE_REQUEST } from '@core/api';

import { InboxApi } from './inbox-api.service';

describe('InboxApi request contexts', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }),
  );
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('marks automatic badge and reminder lookups passive', async () => {
    const api: InboxApi = TestBed.inject(InboxApi);
    const count: Promise<number> = firstValueFrom(api.unreadCount());
    const badge: TestRequest =
      TestBed.inject(HttpTestingController).expectOne('/v1/inbox/unread-count');
    expect(badge.request.context.get(PASSIVE_REQUEST)).toBe(true);
    badge.flush({ unreadCount: 2 });
    await expect(count).resolves.toBe(2);
    const reminder: Promise<unknown> = api.reminder('r1');
    const lookup: TestRequest = TestBed.inject(HttpTestingController).expectOne('/v1/reminders/r1');
    expect(lookup.request.context.get(PASSIVE_REQUEST)).toBe(true);
    lookup.flush({}, { status: 404, statusText: 'Not Found' });
    await expect(reminder).rejects.toBeDefined();
  });

  it('preserves the cause of list refreshes in their contexts', async () => {
    const api: InboxApi = TestBed.inject(InboxApi);
    const testing: HttpTestingController = TestBed.inject(HttpTestingController);
    const notifications: Promise<unknown> = api.notifications(true);
    const notices: TestRequest = testing.expectOne(
      (request) => request.url === '/v1/inbox/notifications',
    );
    expect(notices.request.context.get(PASSIVE_REQUEST)).toBe(true);
    notices.flush({}, { status: 503, statusText: 'Unavailable' });
    await expect(notifications).rejects.toBeDefined();
    const reminders: Promise<unknown> = api.pendingReminders();
    const list: TestRequest = testing.expectOne((request) => request.url === '/v1/reminders');
    expect(list.request.context.get(PASSIVE_REQUEST)).toBe(false);
    list.flush({}, { status: 503, statusText: 'Unavailable' });
    await expect(reminders).rejects.toBeDefined();
  });
});
