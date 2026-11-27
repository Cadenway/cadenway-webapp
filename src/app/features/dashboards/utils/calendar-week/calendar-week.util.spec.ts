import { describe, expect, it } from 'vitest';

import { isoWeekOf, todayIso, toLocalDate } from './calendar-week.util';

describe('calendar-week util', () => {
  it('numbers the weeks the ISO way', () => {
    expect(isoWeekOf('2026-11-02')).toBe(45);
    expect(isoWeekOf('2026-11-08')).toBe(45);
    expect(isoWeekOf('2026-09-14')).toBe(38);
    expect(isoWeekOf('2025-12-29')).toBe(1);
    expect(isoWeekOf('2021-01-03')).toBe(53);
  });

  it('reads and writes local calendar dates', () => {
    expect(todayIso(new Date(2026, 10, 8, 23, 30))).toBe('2026-11-08');
    const date: Date = toLocalDate('2026-11-08');
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 10, 8]);
  });
});
