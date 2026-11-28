import { describe, expect, it } from 'vitest';

import {
  type ReminderPreset,
  reminderDays,
  reminderPresets,
  reminderTimeLabel,
} from './reminder-time.util';

describe('reminderPresets', () => {
  it('offers the mockup moments from Sunday 8 November, 10 h', () => {
    const presets: readonly ReminderPreset[] = reminderPresets(
      new Date(2026, 10, 8, 10, 0, 0),
      '2026-11-12',
    );

    expect(presets.map((preset: ReminderPreset) => [preset.key, preset.at])).toEqual([
      ['hour', new Date(2026, 10, 8, 11, 0, 0)],
      ['afternoon', new Date(2026, 10, 8, 15, 0, 0)],
      ['tomorrow', new Date(2026, 10, 9, 9, 0, 0)],
      ['week', new Date(2026, 10, 16, 9, 0, 0)],
      ['due', new Date(2026, 10, 11, 9, 0, 0)],
    ]);
  });

  it('offers in one hour a full hour ahead at a time that is not on the hour', () => {
    expect(reminderPresets(new Date(2026, 10, 8, 10, 59, 0), null)[0]).toEqual({
      key: 'hour',
      at: new Date(2026, 10, 8, 11, 59, 0),
    });
    expect(reminderPresets(new Date(2026, 10, 8, 10, 42, 30), null)[0]).toEqual({
      key: 'hour',
      at: new Date(2026, 10, 8, 11, 43, 0),
    });
  });

  it('leaves out a past afternoon and the eve of a missing or past due date', () => {
    const keys: string[] = reminderPresets(new Date(2026, 10, 10, 16, 0, 0), '2026-11-10').map(
      (preset: ReminderPreset) => preset.key,
    );

    expect(keys).toEqual(['hour', 'tomorrow', 'week']);
    expect(reminderPresets(new Date(2026, 10, 10, 9, 0, 0), null).at(-1)?.key).toBe('week');
  });

  it('offers next week as the following Monday from a weekday', () => {
    const week: ReminderPreset | undefined = reminderPresets(
      new Date(2026, 10, 10, 9, 0, 0),
      null,
    ).find((preset: ReminderPreset) => preset.key === 'week');

    expect(week?.at).toEqual(new Date(2026, 10, 16, 9, 0, 0));
  });
});

describe('reminderDays', () => {
  it('offers today and the 13 next days', () => {
    const days: readonly Date[] = reminderDays(new Date(2026, 10, 8, 10, 0, 0));

    expect(days).toHaveLength(14);
    expect(days[0]).toEqual(new Date(2026, 10, 8));
    expect(days[13]).toEqual(new Date(2026, 10, 21));
  });
});

describe('reminderTimeLabel', () => {
  it('reads a whole hour and a time with minutes in the same format', () => {
    expect(reminderTimeLabel(11, 0)).toBe('11:00');
    expect(reminderTimeLabel(9, 0)).toBe('9:00');
    expect(reminderTimeLabel(14, 19)).toBe('14:19');
    expect(reminderTimeLabel(8, 5)).toBe('8:05');
  });
});
