import type { Device, OpenSession } from '@cadenway/api-client';

import type { AccountSession, SessionDeviceType } from '../../../models/session/session.interface';

/**
 * Function part
 *
 * @description
 * A name followed by its version when both are known (`Firefox 132`), the name alone, or null.
 *
 * @param {string | null} name - The browser or system name.
 * @param {string | null} version - Its version.
 * @returns {string | null} The label part.
 */
function part(name: string | null, version: string | null): string | null {
  const trimmed: string = name?.trim() ?? '';
  if (trimmed === '') return null;
  const release: string = version?.trim() ?? '';
  return release === '' ? trimmed : `${trimmed} ${release}`;
}

/**
 * Function deviceLabel
 *
 * @description
 * The browser and system of a device as one label (`Firefox 132 · Windows 11`), skipping what
 * the gateway could not read; null when it read neither.
 *
 * @param {Device} device - The device the gateway answered.
 * @returns {string | null} The label.
 */
export function deviceLabel(device: Device): string | null {
  const parts: string[] = [
    part(device.browser, device.browserVersion),
    part(device.os, device.osVersion),
  ].filter((value: string | null): value is string => value !== null);
  return parts.length === 0 ? null : parts.join(' · ');
}

/**
 * Function toAccountSession
 *
 * @description
 * Maps an open session to the card's model; a device type this version does not know becomes
 * `unknown`, and a missing or invalid inactivity timeout becomes null.
 *
 * @param {OpenSession} dto - The session the gateway answered.
 * @returns {AccountSession} The display model.
 */
export function toAccountSession(dto: OpenSession): AccountSession {
  const type: string = dto.device.type;
  const deviceType: SessionDeviceType =
    type === 'desktop' || type === 'mobile' || type === 'tablet' ? type : 'unknown';
  const timeout: number | undefined = dto.inactivityTimeoutMinutes;
  return {
    id: dto.id,
    current: dto.current,
    deviceType,
    device: deviceLabel(dto.device),
    ipAddress: dto.ipAddress,
    lastActiveAt: dto.lastActiveAt,
    inactivityTimeoutMinutes:
      typeof timeout === 'number' && Number.isInteger(timeout) && timeout > 0 ? timeout : null,
  };
}

/**
 * Function orderSessions
 *
 * @description
 * Orders the sessions as the contract asks the web application to: the current one first, then
 * the others by their last activity, the most recent first (then by id, so the order is stable).
 *
 * @param {readonly AccountSession[]} sessions - The sessions in the gateway's order.
 * @returns {readonly AccountSession[]} The sessions to show.
 */
export function orderSessions(sessions: readonly AccountSession[]): readonly AccountSession[] {
  return [...sessions].sort((left: AccountSession, right: AccountSession): number => {
    if (left.current !== right.current) return left.current ? -1 : 1;
    const activity: number = Date.parse(right.lastActiveAt) - Date.parse(left.lastActiveAt);
    if (activity !== 0 && Number.isFinite(activity)) return activity;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
}
