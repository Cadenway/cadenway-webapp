import { describe, expect, it } from 'vitest';

import type { InboxReminder } from '../../models/inbox-reminder/inbox-reminder.interface';
import { overdueCount, relativeTime, reminderTime, tomorrowMorning } from './inbox-time.util';

/**
 * Constant NOW
 *
 * @description
 * The mockup's « today »: Sunday 8 November 2026, 10 h local time.
 *
 * @type {Date}
 */
const NOW: Date = new Date(2026, 10, 8, 10, 0);

/**
 * Function at
 *
 * @description
 * A local moment of November 2026, as ISO 8601.
 *
 * @param {number} day - Day of the month.
 * @param {number} hour - Local hour.
 * @param {number} minute - Minute.
 * @returns {string} The instant.
 */
function at(day: number, hour: number, minute: number = 0): string {
  return new Date(2026, 10, day, hour, minute).toISOString();
}

describe('relativeTime', () => {
  it('writes the mockup’s relative times', () => {
    expect(relativeTime(at(8, 9, 48), NOW, 'fr')).toBe('12 min');
    expect(relativeTime(at(8, 9, 59), NOW, 'fr')).toBe('1 min');
    expect(relativeTime(at(8, 9, 0), NOW, 'fr')).toBe('1 h');
    expect(relativeTime(at(7, 18), NOW, 'fr')).toBe('hier');
    expect(relativeTime(at(2, 18), NOW, 'fr')).toBe('lun.');
    expect(relativeTime(at(1, 18), NOW, 'fr')).toBe('1 nov.');
  });
});

describe('reminderTime', () => {
  it('writes the mockup’s due times', () => {
    expect(reminderTime(at(8, 9), NOW, 'fr')).toBe('Aujourd’hui, 9 h');
    expect(reminderTime(at(9, 15, 30), NOW, 'fr')).toBe('Demain, 15 h 30');
    expect(reminderTime(at(16, 9), NOW, 'fr')).toBe('Lun. 16 nov., 9 h');
  });
});

describe('tomorrowMorning', () => {
  it('is 9 h tomorrow, local time', () => {
    expect(tomorrowMorning(NOW)).toBe(at(9, 9));
  });
});

describe('overdueCount', () => {
  it('counts the reminders due at the given moment', () => {
    const reminder: (id: string, offset: number) => InboxReminder = (
      id: string,
      offset: number,
    ): InboxReminder => ({
      id,
      taskKey: 'CAD-479',
      taskName: 'Prévenir le support',
      remindAt: new Date(NOW.getTime() + offset).toISOString(),
      note: null,
    });

    expect(
      overdueCount([reminder('r0', -60_000), reminder('r1', 0), reminder('r2', 60_000)], NOW),
    ).toBe(2);
    expect(overdueCount([], NOW)).toBe(0);
  });
});
