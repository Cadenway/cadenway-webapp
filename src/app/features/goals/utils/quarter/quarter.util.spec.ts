import { quarterOf, todayIso, toLocalDate } from './quarter.util';

describe('quarter utils', () => {
  it('names the quarter of a day and its last day', () => {
    expect(quarterOf(new Date(2026, 10, 8))).toEqual({
      key: '2026-Q4',
      year: 2026,
      number: 4,
      end: '2026-12-31',
    });
    expect(quarterOf(new Date(2027, 0, 1))).toEqual({
      key: '2027-Q1',
      year: 2027,
      number: 1,
      end: '2027-03-31',
    });
    expect(quarterOf(new Date(2028, 5, 30)).end).toBe('2028-06-30');
  });

  it('writes and reads plain local dates', () => {
    expect(todayIso(new Date(2026, 1, 3))).toBe('2026-02-03');
    expect(toLocalDate('2026-12-31')).toEqual(new Date(2026, 11, 31));
  });
});
