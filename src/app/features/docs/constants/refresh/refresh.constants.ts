/**
 * Constant REFRESH_INTERVAL_MS
 *
 * @description
 * Least time, in milliseconds, between a settled read of the catalog or of a document and a
 * background read when the window regains focus (gap G-C4: no realtime notice reaches documents).
 *
 * @type {number}
 */
export const REFRESH_INTERVAL_MS: number = 30_000;
