import { describe, expect, it } from 'vitest';

import {
  addDays,
  dayOffset,
  durationSuggestions,
  formatMinutes,
  formatSpan,
  longDayLabel,
  nextOccurrence,
  parseMinutes,
  shortDayLabel,
} from './task-property.util';

describe('task property utils', () => {
  it('reads durations, a bare number in hours for an estimate and in minutes for spent time', () => {
    expect(parseMinutes('1h30', 'hours')).toBe(90);
    expect(parseMinutes('3', 'hours')).toBe(180);
    expect(parseMinutes('45', 'minutes')).toBe(45);
    expect(parseMinutes('soon', 'minutes')).toBeNull();
    expect(parseMinutes('', 'hours')).toBeNull();
  });

  it('writes minutes as the design system does', () => {
    expect(formatMinutes(90)).toBe('1 h 30');
    expect(formatMinutes(45)).toBe('45 min');
  });

  it('suggests durations from the typed beginning', () => {
    expect(durationSuggestions('', 'hours')).toEqual([15, 30, 60, 90, 120, 240, 480]);
    expect(durationSuggestions('2', 'hours')).toEqual([120, 150, 2, 20]);
    expect(durationSuggestions('2', 'minutes')).toEqual([2, 20, 120, 150]);
    expect(durationSuggestions('2h', 'hours')).toEqual([120, 135, 150, 165]);
  });

  it('writes the time in a status rounded to the hour', () => {
    expect(formatSpan(20 * 60_000)).toBe('less than 1 h');
    expect(formatSpan(5 * 3_600_000)).toBe('5 h');
    expect(formatSpan(51 * 3_600_000)).toBe('2 d 3 h');
    expect(formatSpan(48 * 3_600_000)).toBe('2 d');
  });

  it('counts days between calendar days', () => {
    expect(addDays('2026-11-30', 2)).toBe('2026-12-02');
    expect(dayOffset('2026-11-07', '2026-11-08')).toBe(-1);
  });

  it('labels days relative to today', () => {
    expect(shortDayLabel('2026-11-08', '2026-11-08', 'en-US')).toBe('Today');
    expect(shortDayLabel('2026-11-09', '2026-11-08', 'en-US')).toBe('Tomorrow');
    expect(shortDayLabel('2026-11-07', '2026-11-08', 'en-US')).toBe('Yesterday');
    expect(shortDayLabel('2026-11-12', '2026-11-08', 'en-US')).toBe('Thu 12 Nov');
    expect(shortDayLabel('2027-01-04', '2026-11-08', 'en-US')).toBe('Mon 4 Jan 2027');
    expect(longDayLabel('2026-11-08', '2026-11-08', 'en-US')).toBe('Today, Sunday, November 8');
    expect(longDayLabel('2026-11-09', '2026-11-08', 'en-US')).toBe('Monday, November 9');
    expect(longDayLabel('2027-01-04', '2026-11-08', 'en-US')).toBe('Monday, January 4, 2027');
  });

  it('finds the next occurrence of a repeating task', () => {
    expect(nextOccurrence('2026-11-13', 'daily')).toBe('2026-11-16');
    expect(nextOccurrence('2026-11-12', 'weekly')).toBe('2026-11-19');
    expect(nextOccurrence('2026-11-12', 'biweekly')).toBe('2026-11-26');
    expect(nextOccurrence('2026-11-12', 'monthly')).toBe('2026-12-12');
    expect(nextOccurrence('2026-11-12', 'none')).toBe('2026-11-12');
  });
});
