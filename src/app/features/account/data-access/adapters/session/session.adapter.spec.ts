import type { OpenSession } from '@cadenway/api-client';
import { describe, expect, it } from 'vitest';

import type { AccountSession } from '../../../models/session/session.interface';
import { deviceLabel, orderSessions, toAccountSession } from './session.adapter';

/**
 * Function dto
 *
 * @description
 * A session as the gateway answers it, after the mockup's `Firefox 132 · Windows 11` row
 * (`Compte.dc.html` line 1463).
 *
 * @param {Partial<OpenSession>} overrides - Members to change.
 * @returns {OpenSession} The session.
 */
function dto(overrides: Partial<OpenSession> = {}): OpenSession {
  return {
    id: 's1',
    current: true,
    device: {
      type: 'desktop',
      browser: 'Firefox',
      browserVersion: '132',
      os: 'Windows',
      osVersion: '11',
    },
    ipAddress: '192.0.2.14',
    signedInAt: '2026-11-01T08:00:00Z',
    lastActiveAt: '2026-11-08T09:00:00Z',
    expiresAt: '2026-12-01T08:00:00Z',
    inactivityTimeoutMinutes: 720,
    ...overrides,
  };
}

/**
 * Function session
 *
 * @description
 * A display session of the fixtures.
 *
 * @param {string} id - Its id.
 * @param {boolean} current - Whether it is this browser's.
 * @param {string} lastActiveAt - Its last activity.
 * @returns {AccountSession} The session.
 */
function session(id: string, current: boolean, lastActiveAt: string): AccountSession {
  return toAccountSession(dto({ id, current, lastActiveAt }));
}

describe('session adapter', () => {
  it('maps a session with its device label and address only', () => {
    expect(toAccountSession(dto())).toEqual({
      id: 's1',
      current: true,
      deviceType: 'desktop',
      device: 'Firefox 132 · Windows 11',
      ipAddress: '192.0.2.14',
      lastActiveAt: '2026-11-08T09:00:00Z',
      inactivityTimeoutMinutes: 720,
    });
  });

  it('reads an unknown device type as unknown and drops an invalid timeout', () => {
    const mapped: AccountSession = toAccountSession(
      dto({
        device: { type: 'watch', browser: null, browserVersion: null, os: null, osVersion: null },
        inactivityTimeoutMinutes: undefined,
      }),
    );
    expect(mapped.deviceType).toBe('unknown');
    expect(mapped.device).toBeNull();
    expect(mapped.inactivityTimeoutMinutes).toBeNull();
  });

  it('labels a device with what the gateway could read', () => {
    expect(
      deviceLabel({
        type: 'desktop',
        browser: 'Chrome',
        browserVersion: '131',
        os: 'macOS',
        osVersion: null,
      }),
    ).toBe('Chrome 131 · macOS');
    expect(
      deviceLabel({
        type: 'unknown',
        browser: 'Cadenway CLI',
        browserVersion: '2.4',
        os: null,
        osVersion: null,
      }),
    ).toBe('Cadenway CLI 2.4');
  });

  it('puts the current session first, then the most recently active', () => {
    const ordered: readonly AccountSession[] = orderSessions([
      session('s3', false, '2026-11-07T17:40:00Z'),
      session('s2', false, '2026-11-08T07:00:00Z'),
      session('s1', true, '2026-11-08T09:00:00Z'),
    ]);
    expect(ordered.map((item: AccountSession): string => item.id)).toEqual(['s1', 's2', 's3']);
  });
});
