import type {
  ApiToken as ApiTokenDto,
  ApiTokenCreated as ApiTokenCreatedDto,
} from '@cadenway/api-client';

import type {
  ApiToken,
  ApiTokenExpiry,
  ApiTokenLastUse,
  CreatedApiToken,
} from '../../../models/api-token/api-token.interface';

/**
 * Constant MINUTE_MS
 *
 * @description
 * One minute, in milliseconds.
 *
 * @type {number}
 */
const MINUTE_MS: number = 60_000;

/**
 * Constant HOUR_MS
 *
 * @description
 * One hour, in milliseconds.
 *
 * @type {number}
 */
const HOUR_MS: number = 60 * MINUTE_MS;

/**
 * Constant DAY_MS
 *
 * @description
 * One day, in milliseconds.
 *
 * @type {number}
 */
const DAY_MS: number = 24 * HOUR_MS;

/**
 * Constant RECENT_USE_DAYS
 *
 * @description
 * Up to how many days ago a last use is counted in days; an older one shows its date.
 *
 * @type {number}
 */
const RECENT_USE_DAYS: number = 60;

/**
 * Constant NEAR_EXPIRY_DAYS
 *
 * @description
 * Up to how many days an expiry is counted in days: the longest day option of the create dialog
 * (`90 days`, `Compte.dc.html` line 815).
 *
 * @type {number}
 */
const NEAR_EXPIRY_DAYS: number = 90;

/**
 * Constant SOON_DAYS
 *
 * @description
 * Within how many days an expiry is shown in grenat (the mockup's `In 6 days`, line 1487).
 *
 * @type {number}
 */
const SOON_DAYS: number = 7;

/**
 * Function calendarDate
 *
 * @description
 * The `YYYY-MM-DD` date of an instant, in the person's time zone.
 *
 * @param {number} time - The instant, in milliseconds.
 * @returns {string} The date.
 */
function calendarDate(time: number): string {
  const date: Date = new Date(time);
  const month: string = String(date.getMonth() + 1).padStart(2, '0');
  const day: string = String(date.getDate()).padStart(2, '0');
  return `${String(date.getFullYear())}-${month}-${day}`;
}

/**
 * Function toLastUse
 *
 * @description
 * Words the last use of a token relative to now: minutes (at least 1) within the hour, hours
 * within the day, days within 60 days, then the date. A use the clock places in the future counts
 * as a minute ago.
 *
 * @param {string | null} lastUsedAt - The last request, ISO 8601, or null before the first.
 * @param {number} now - The current instant, in milliseconds.
 * @returns {ApiTokenLastUse} The last use.
 */
export function toLastUse(lastUsedAt: string | null, now: number): ApiTokenLastUse {
  if (lastUsedAt === null) return { kind: 'never' };
  const time: number = Date.parse(lastUsedAt);
  if (Number.isNaN(time)) return { kind: 'never' };
  const elapsed: number = Math.max(0, now - time);
  if (elapsed < HOUR_MS)
    return { kind: 'minutes', count: Math.max(1, Math.floor(elapsed / MINUTE_MS)) };
  if (elapsed < DAY_MS) return { kind: 'hours', count: Math.floor(elapsed / HOUR_MS) };
  const days: number = Math.floor(elapsed / DAY_MS);
  return days <= RECENT_USE_DAYS
    ? { kind: 'days', count: days }
    : { kind: 'date', date: calendarDate(time) };
}

/**
 * Function wholeYearsAhead
 *
 * @description
 * How many whole years separate two instants when the later one falls on the same calendar day
 * and month as the earlier one, in the person's time zone.
 *
 * @param {number} from - The earlier instant, in milliseconds.
 * @param {number} to - The later instant, in milliseconds.
 * @returns {number} The years, or 0 when the dates do not line up.
 */
function wholeYearsAhead(from: number, to: number): number {
  const start: Date = new Date(from);
  const end: Date = new Date(to);
  const years: number = end.getFullYear() - start.getFullYear();
  return years > 0 && end.getMonth() === start.getMonth() && end.getDate() === start.getDate()
    ? years
    : 0;
}

/**
 * Function toExpiry
 *
 * @description
 * Words when a token stops working relative to now: never; in days (at least 1, rounded up) up
 * to 90 days; in years when it falls on today's date a whole number of years ahead; otherwise its
 * date. Within 7 days it is `soon`.
 *
 * @param {string | null} expiresAt - The expiry, ISO 8601, or null for a token without one.
 * @param {number} now - The current instant, in milliseconds.
 * @returns {ApiTokenExpiry} The expiry.
 */
export function toExpiry(expiresAt: string | null, now: number): ApiTokenExpiry {
  if (expiresAt === null) return { kind: 'never', soon: false };
  const time: number = Date.parse(expiresAt);
  if (Number.isNaN(time)) return { kind: 'never', soon: false };
  const days: number = Math.max(1, Math.ceil((time - now) / DAY_MS));
  if (days <= NEAR_EXPIRY_DAYS) return { kind: 'days', count: days, soon: days <= SOON_DAYS };
  const years: number = wholeYearsAhead(now, time);
  return years > 0
    ? { kind: 'years', count: years, soon: false }
    : { kind: 'date', date: calendarDate(time), soon: false };
}

/**
 * Function toApiToken
 *
 * @description
 * Maps a listed token to the row the token list shows.
 *
 * @param {ApiTokenDto} token - The token the gateway lists.
 * @param {number} now - The current instant, in milliseconds.
 * @returns {ApiToken} The display model.
 */
export function toApiToken(token: ApiTokenDto, now: number): ApiToken {
  return {
    id: token.id,
    name: token.name,
    prefix: `${token.prefix}…`,
    scopes: token.scopes,
    lastUse: toLastUse(token.lastUsedAt, now),
    expiry: toExpiry(token.expiresAt, now),
  };
}

/**
 * Function toCreatedApiToken
 *
 * @description
 * Maps the answer of a creation to the new row and its secret.
 *
 * @param {ApiTokenCreatedDto} created - The gateway's answer.
 * @param {number} now - The current instant, in milliseconds.
 * @returns {CreatedApiToken} The new token and its secret.
 */
export function toCreatedApiToken(created: ApiTokenCreatedDto, now: number): CreatedApiToken {
  return { token: toApiToken(created.apiToken, now), secret: created.secret };
}
