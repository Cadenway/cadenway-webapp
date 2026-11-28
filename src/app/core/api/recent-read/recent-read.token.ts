import { HttpContextToken } from '@angular/common/http';

/**
 * Constant RECORD_READ
 *
 * @description
 * Marks a read whose successful answer `recentReadInterceptor` keeps, so that another reader of
 * the same address during the same screen load may take it (`REUSE_READ_WITHIN_MS`). The workspace
 * guard's account read is one.
 *
 * @type {HttpContextToken<boolean>}
 */
export const RECORD_READ: HttpContextToken<boolean> = new HttpContextToken<boolean>(() => false);

/**
 * Constant REUSE_READ_WITHIN_MS
 *
 * @description
 * How old, in milliseconds, a recorded answer of the same address may be for this read to take it
 * instead of asking the gateway; 0, the default, always asks.
 *
 * @type {HttpContextToken<number>}
 */
export const REUSE_READ_WITHIN_MS: HttpContextToken<number> = new HttpContextToken<number>(() => 0);
