import { describe, expect, it } from 'vitest';

import { dueBucket, localDay } from './due-bucket.util';

describe('dueBucket', () => {
  const today: string = '2026-11-12';

  it('places an open task by the days left until its due date', () => {
    expect(dueBucket('2026-11-11', 'todo', today)).toBe('late');
    expect(dueBucket('2026-11-12', 'progress', today)).toBe('today');
    expect(dueBucket('2026-11-13', 'todo', today)).toBe('week');
    expect(dueBucket('2026-11-19', 'review', today)).toBe('week');
    expect(dueBucket('2026-11-20', 'todo', today)).toBe('later');
    expect(dueBucket(null, 'backlog', today)).toBe('none');
  });

  it('puts a done or cancelled task in the closed group whatever its date', () => {
    expect(dueBucket('2026-11-01', 'done', today)).toBe('closed');
    expect(dueBucket(null, 'cancelled', today)).toBe('closed');
  });

  it('counts calendar days across a month and a year', () => {
    expect(dueBucket('2027-01-02', 'todo', '2026-12-31')).toBe('week');
    expect(dueBucket('2026-12-31', 'todo', '2027-01-01')).toBe('late');
  });
});

describe('localDay', () => {
  it('formats the local calendar day of a moment', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
