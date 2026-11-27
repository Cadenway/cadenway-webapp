import { describe, expect, it } from 'vitest';

import { updatedLabel } from './updated-label.util';

/**
 * Constant NOW
 *
 * @description
 * Friday 27 November 2026, 2:00 PM local time.
 *
 * @type {Date}
 */
const NOW: Date = new Date(2026, 10, 27, 14, 0);

describe('updatedLabel', () => {
  it('words today and yesterday with the time, at the start of a cell or inside a sentence', () => {
    const today: string = new Date(2026, 10, 27, 9, 40).toISOString();
    const yesterday: string = new Date(2026, 10, 26, 17, 20).toISOString();

    expect(updatedLabel(today, 'en-US', 'start', NOW)).toBe('Today, 9:40 AM');
    expect(updatedLabel(today, 'en-US', 'inline', NOW)).toBe('today, 9:40 AM');
    expect(updatedLabel(yesterday, 'en-US', 'start', NOW)).toBe('Yesterday, 5:20 PM');
    expect(updatedLabel(yesterday, 'en-US', 'inline', NOW)).toBe('yesterday, 5:20 PM');
  });

  it('words an older day as a date, with the year once it is another year', () => {
    expect(updatedLabel(new Date(2026, 10, 4, 12).toISOString(), 'en-US', 'start', NOW)).toBe(
      'Nov 4',
    );
    expect(updatedLabel(new Date(2025, 9, 31, 12).toISOString(), 'en-US', 'start', NOW)).toBe(
      'Oct 31, 2025',
    );
    expect(updatedLabel(new Date(2026, 10, 4, 12).toISOString(), 'fr', 'start', NOW)).toBe(
      '4 nov.',
    );
  });

  it('keeps a value that is not a date as it is', () => {
    expect(updatedLabel('soon', 'en-US', 'start', NOW)).toBe('soon');
  });
});
