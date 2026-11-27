import { describe, expect, it } from 'vitest';

import type { AccountSession } from '../../models/session/session.interface';
import { describeActivity, describeTimeout } from './session-activity.util';

/**
 * Function session
 *
 * @description
 * A session of the mockup's list (`Compte.dc.html` line 1464) with a given last activity.
 *
 * @param {string} id - Its id.
 * @param {boolean} current - Whether it is this browser's.
 * @param {string} lastActiveAt - Its last activity.
 * @returns {AccountSession} The session.
 */
function session(id: string, current: boolean, lastActiveAt: string): AccountSession {
  return {
    id,
    current,
    deviceType: 'mobile',
    device: 'Cadenway · iPhone 15',
    ipAddress: '198.51.100.7',
    lastActiveAt,
    inactivityTimeoutMinutes: 720,
  };
}

describe('session activity', () => {
  it('words the last activity as the mockup does', () => {
    const now: Date = new Date(2026, 10, 8, 10, 0);
    const at: (date: Date) => AccountSession = (date: Date): AccountSession =>
      session('s2', false, date.toISOString());
    expect(describeActivity(session('s1', true, '2020-01-01T00:00:00Z'), now)).toEqual({
      kind: 'now',
    });
    expect(describeActivity(at(new Date(2026, 10, 8, 9, 59)), now)).toEqual({ kind: 'now' });
    expect(describeActivity(at(new Date(2026, 10, 8, 9, 35)), now)).toEqual({
      kind: 'minutes',
      count: 25,
    });
    expect(describeActivity(at(new Date(2026, 10, 8, 8, 0)), now)).toEqual({
      kind: 'hours',
      count: 2,
    });
    expect(describeActivity(at(new Date(2026, 10, 7, 18, 40)), now)).toEqual({
      kind: 'yesterday',
      at: new Date(2026, 10, 7, 18, 40),
    });
    expect(describeActivity(at(new Date(2026, 10, 5, 12, 0)), now)).toEqual({
      kind: 'days',
      count: 3,
    });
    expect(describeActivity(at(new Date(2026, 8, 1, 12, 0)), now).kind).toBe('date');
  });

  it('words a timeout in its largest whole unit', () => {
    expect(describeTimeout(720)).toEqual({ unit: 'hours', count: 12 });
    expect(describeTimeout(10080)).toEqual({ unit: 'days', count: 7 });
    expect(describeTimeout(45)).toEqual({ unit: 'minutes', count: 45 });
  });
});
