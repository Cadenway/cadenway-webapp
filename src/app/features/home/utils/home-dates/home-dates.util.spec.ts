import { describe, expect, it } from 'vitest';

import { formatSprintRange, localDay } from './home-dates.util';

describe('home dates', () => {
  it('writes the local day of a moment', () => {
    expect(localDay(new Date(2026, 10, 8, 23, 59))).toBe('2026-11-08');
    expect(localDay(new Date(2027, 0, 3, 0, 1))).toBe('2027-01-03');
  });

  it('writes a sprint range with the month once within a month and twice across two', () => {
    expect(formatSprintRange('2026-11-03', '2026-11-17', 'en')).toBe('Nov 3 – 17');
    expect(formatSprintRange('2026-10-27', '2026-11-09', 'en')).toBe('Oct 27 – Nov 9');
  });
});
