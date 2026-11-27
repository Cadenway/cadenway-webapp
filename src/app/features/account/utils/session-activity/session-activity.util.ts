import type {
  AccountSession,
  SessionActivity,
  SessionTimeout,
} from '../../models/session/session.interface';

/**
 * Constant MINUTE
 *
 * @description
 * One minute, in milliseconds.
 *
 * @type {number}
 */
const MINUTE: number = 60_000;

/**
 * Function startOfDay
 *
 * @description
 * Midnight of a moment's local day, in milliseconds.
 *
 * @param {Date} moment - The moment.
 * @returns {number} Its day's start.
 */
function startOfDay(moment: Date): number {
  return new Date(moment.getFullYear(), moment.getMonth(), moment.getDate()).getTime();
}

/**
 * Function describeActivity
 *
 * @description
 * Words a session's last activity relative to now, in local time (see `SessionActivity`). This
 * browser's session is always active now; an unreadable date reads as now.
 *
 * @param {AccountSession} session - The session.
 * @param {Date} now - The present moment.
 * @returns {SessionActivity} How to word it.
 */
export function describeActivity(session: AccountSession, now: Date): SessionActivity {
  const at: Date = new Date(session.lastActiveAt);
  const elapsed: number = now.getTime() - at.getTime();
  if (session.current || !Number.isFinite(elapsed) || elapsed < 2 * MINUTE) return { kind: 'now' };
  const today: number = startOfDay(now);
  if (at.getTime() >= today) {
    return elapsed < 60 * MINUTE
      ? { kind: 'minutes', count: Math.floor(elapsed / MINUTE) }
      : { kind: 'hours', count: Math.floor(elapsed / (60 * MINUTE)) };
  }
  const days: number = Math.round((today - startOfDay(at)) / (24 * 60 * MINUTE));
  if (days <= 1) return { kind: 'yesterday', at };
  return days <= 30 ? { kind: 'days', count: days } : { kind: 'date', at };
}

/**
 * Function describeTimeout
 *
 * @description
 * An inactivity timeout in its largest whole unit (`720` is 12 hours, `10080` is 7 days).
 *
 * @param {number} minutes - The timeout, in minutes.
 * @returns {SessionTimeout} How to word it.
 */
export function describeTimeout(minutes: number): SessionTimeout {
  if (minutes % 1440 === 0) return { unit: 'days', count: minutes / 1440 };
  if (minutes % 60 === 0) return { unit: 'hours', count: minutes / 60 };
  return { unit: 'minutes', count: minutes };
}
