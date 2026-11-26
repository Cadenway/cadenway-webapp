import { describe, expect, it } from 'vitest';

import { formatSprintRange, isWithin, todayIso, toLocalDate } from './calendar-date.util';

describe('calendar dates', () => {
  it('writes the local date and reads plain dates at local midnight', () => {
    expect(todayIso(new Date(2026, 10, 8, 23, 30))).toBe('2026-11-08');
    expect(toLocalDate('2026-11-03').getDate()).toBe(3);
  });

  it('writes a sprint range as the mockup does', () => {
    expect(formatSprintRange('2026-11-03', '2026-11-17', 'fr')).toBe('3 – 17 nov.');
    expect(formatSprintRange('2026-10-27', '2026-11-09', 'fr')).toBe('27 oct. – 9 nov.');
    expect(formatSprintRange('2026-11-03', '2026-11-16', 'en-US')).toBe('Nov 3 – 16');
    expect(formatSprintRange('2026-10-27', '2026-11-09', 'en-US')).toBe('Oct 27 – Nov 9');
  });

  it('checks an inclusive range', () => {
    expect(isWithin('2026-11-17', '2026-11-03', '2026-11-17')).toBe(true);
    expect(isWithin('2026-11-18', '2026-11-03', '2026-11-17')).toBe(false);
  });
});
