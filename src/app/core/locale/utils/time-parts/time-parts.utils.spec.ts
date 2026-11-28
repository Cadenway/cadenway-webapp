import { describe, expect, it } from 'vitest';

import { timeParts } from './time-parts.utils';

describe('timeParts', () => {
  it('cuts the time on a 12-hour clock, the day period after the minutes', () => {
    const afternoon: Date = new Date(2026, 10, 8, 15, 0);
    const morning: Date = new Date(2026, 10, 8, 9, 5);
    const format: Intl.DateTimeFormat = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    expect(timeParts(afternoon, 'en-US')).toEqual({
      hour: '3',
      minute: '00',
      period: format.format(afternoon).slice('3:00'.length),
    });
    const { hour, minute, period } = timeParts(morning, 'en-US');
    expect(`${hour}:${minute}${period}`).toBe(format.format(morning));
    expect(period.trim()).toBe('AM');
  });

  it('cuts the time on a 24-hour clock, without a day period', () => {
    expect(timeParts(new Date(2026, 10, 8, 14, 19), 'fr')).toEqual({
      hour: '14',
      minute: '19',
      period: '',
    });
    expect(timeParts(new Date(2026, 10, 8, 9, 0), 'fr')).toEqual({
      hour: '9',
      minute: '00',
      period: '',
    });
  });
});
