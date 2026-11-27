import { describe, expect, it } from 'vitest';

import { daysLeft, daysSince } from './trash-time.util';

/**
 * Constant NOW
 *
 * @description
 * Mid-afternoon of the mockup's today, local time.
 *
 * @type {number}
 */
const NOW: number = new Date(2026, 10, 27, 15, 0).getTime();

describe('trash time', () => {
  it('counts calendar days since a deletion', () => {
    expect(daysSince(new Date(2026, 10, 27, 0, 5).toISOString(), NOW)).toBe(0);
    expect(daysSince(new Date(2026, 10, 26, 23, 55).toISOString(), NOW)).toBe(1);
    expect(daysSince(new Date(2026, 10, 6, 9, 0).toISOString(), NOW)).toBe(21);
    expect(daysSince(new Date(2026, 10, 28, 9, 0).toISOString(), NOW)).toBe(0);
  });

  it('rounds the days left up and never below zero', () => {
    expect(daysLeft(new Date(NOW + 60_000).toISOString(), NOW)).toBe(1);
    expect(daysLeft(new Date(NOW + 9 * 86_400_000).toISOString(), NOW)).toBe(9);
    expect(daysLeft(new Date(NOW - 60_000).toISOString(), NOW)).toBe(0);
  });
});
