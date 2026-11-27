import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { NotificationPreferencesService } from '@cadenway/api-client';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { NotificationPreferences } from '../../../models/notification-preferences/notification-preferences.interface';
import { NotificationPreferencesApi } from './notification-preferences-api.service';

/**
 * Function answer
 *
 * @description
 * Camille Martin's preferences as the gateway answers them, with an extra field the page ignores.
 *
 * @param {number} version - Version of the preferences.
 * @returns {Record<string, unknown>} The preferences.
 */
function answer(version: number): Record<string, unknown> {
  return {
    channels: {
      mention: { inApp: true, email: true, mobile: true },
      assignment: { inApp: true, email: true, mobile: true },
      comment: { inApp: true, email: false, mobile: false },
      statusChange: { inApp: true, email: false, mobile: false },
      dueDate: { inApp: true, email: true, mobile: true },
      access: { inApp: true, email: true, mobile: false },
      billing: { inApp: true, email: true, mobile: false, sms: true },
    },
    digest: 'daily',
    doNotDisturb: true,
    version,
  };
}

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

describe('NotificationPreferencesApi', () => {
  let service: Record<string, Mock>;
  let api: NotificationPreferencesApi;

  beforeEach(() => {
    service = {
      getNotificationPreferences: vi.fn(() => of(answer(3))),
      updateNotificationPreferences: vi.fn(() => of(answer(4))),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: NotificationPreferencesService, useValue: service }],
    });
    api = TestBed.inject(NotificationPreferencesApi);
  });

  it('reads the preferences as display models', async () => {
    const preferences: NotificationPreferences = await api.read();
    expect(preferences.version).toBe(3);
    expect(preferences.channels.billing).toEqual({ inApp: true, email: true, mobile: false });
    expect(preferences.digest).toBe('daily');
  });

  it('sends one matrix box as a merge patch against its version', async () => {
    const saved: NotificationPreferences = await api.change(
      { kind: 'channel', event: 'statusChange', channel: 'mobile', enabled: true },
      3,
    );
    expect(saved.version).toBe(4);
    expect(service['updateNotificationPreferences']).toHaveBeenCalledWith(
      { channels: { statusChange: { mobile: true } } },
      { headers: { 'If-Match': '"3"' } },
    );
  });

  it('sends the digest and the quiet hours alone', async () => {
    await api.change({ kind: 'digest', digest: 'weekly' }, 3);
    await api.change({ kind: 'doNotDisturb', enabled: false }, 4);
    expect(
      service['updateNotificationPreferences'].mock.calls.map(
        ([patch]: unknown[]): unknown => patch,
      ),
    ).toEqual([{ digest: 'weekly' }, { doNotDisturb: false }]);
  });

  it('reads again and resends once after a version mismatch', async () => {
    service['updateNotificationPreferences']
      .mockReturnValueOnce(throwError(() => versionMismatch))
      .mockReturnValueOnce(of(answer(6)));
    service['getNotificationPreferences'].mockReturnValueOnce(of(answer(5)));

    const saved: NotificationPreferences = await api.change({ kind: 'digest', digest: 'never' }, 3);

    expect(saved.version).toBe(6);
    expect(
      service['updateNotificationPreferences'].mock.calls.map(
        ([, options]: unknown[]): unknown => options,
      ),
    ).toEqual([{ headers: { 'If-Match': '"3"' } }, { headers: { 'If-Match': '"5"' } }]);
  });

  it('rejects any other refusal as it is', async () => {
    const unavailable: HttpErrorResponse = new HttpErrorResponse({ status: 503 });
    service['updateNotificationPreferences'].mockReturnValueOnce(throwError(() => unavailable));

    await expect(api.change({ kind: 'digest', digest: 'never' }, 3)).rejects.toBe(unavailable);
    expect(service['getNotificationPreferences']).not.toHaveBeenCalled();
  });
});
