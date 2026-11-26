import { describe, expect, it } from 'vitest';

import type { SprintReport } from '../../models/sprint-report/sprint-report.interface';
import {
  averageVelocity,
  deliveredShare,
  isOnTrack,
  projectedEnd,
  scopeTaskCount,
  shortSprintName,
  sprintDayOf,
  velocityBars,
} from './sprint-report.util';

/**
 * Constant sprint14
 *
 * @description
 * The mockup's `Sprint 14` report, from November 3 to 17, after the four earlier sprints.
 *
 * @type {SprintReport}
 */
const sprint14: SprintReport = {
  listId: 'l-sprint14',
  name: 'Sprint 14',
  startDate: '2026-11-03',
  endDate: '2026-11-17',
  committed: 42,
  delivered: { points: 15, taskCount: 6, tasks: [] },
  remaining: { points: 27, taskCount: 9, tasks: [] },
  projected: null,
  days: [],
  velocity: [
    { listId: 'l-sprint10', name: 'Sprint 10', committed: 176, delivered: 148 },
    { listId: 'l-sprint11', name: 'Sprint 11', committed: 188, delivered: 171 },
    { listId: 'l-sprint12', name: 'Sprint 12', committed: 204, delivered: null },
    { listId: 'l-sprint13', name: 'Sprint 13', committed: 210, delivered: 194 },
  ],
};

describe('sprint report helpers', () => {
  it('counts the day of the sprint, held within its days', () => {
    expect(sprintDayOf('2026-11-08', '2026-11-03', '2026-11-17')).toEqual({ day: 6, days: 15 });
    expect(sprintDayOf('2026-10-30', '2026-11-03', '2026-11-17')).toEqual({ day: 1, days: 15 });
    expect(sprintDayOf('2026-12-01', '2026-11-03', '2026-11-17')).toEqual({ day: 15, days: 15 });
  });

  it('takes the forecast, then what remains only once the sprint has closed', () => {
    expect(projectedEnd({ ...sprint14, projected: 4 }, '2026-11-08')).toBe(4);
    expect(projectedEnd(sprint14, '2026-11-08')).toBe(null);
    expect(projectedEnd(sprint14, '2026-11-17')).toBe(null);
    expect(projectedEnd(sprint14, '2026-11-18')).toBe(27);
    expect(isOnTrack(0.5)).toBe(true);
    expect(isOnTrack(0.6)).toBe(false);
  });

  it('shares the delivered points of the scope and counts its tasks', () => {
    expect(deliveredShare(sprint14)).toBe(36);
    expect(scopeTaskCount(sprint14)).toBe(15);
    expect(deliveredShare({ ...sprint14, remaining: null })).toBe(null);
    expect(scopeTaskCount({ ...sprint14, delivered: null })).toBe(null);
  });

  it('averages the earlier sprints with history', () => {
    expect(averageVelocity(sprint14.velocity)).toBe(171);
    expect(averageVelocity([])).toBe(null);
  });

  it('draws the earlier sprints, then the current one, under unique short names', () => {
    expect(shortSprintName('Sprint 13')).toBe('S13');
    expect(shortSprintName('Hardening')).toBe('Hardening');
    expect(velocityBars(sprint14).map((bar: { key: string }) => bar.key)).toEqual([
      'S10',
      'S11',
      'S12',
      'S13',
      'S14',
    ]);
    expect(velocityBars(sprint14).at(-1)).toEqual({
      key: 'S14',
      name: 'Sprint 14',
      committed: 42,
      delivered: 15,
      current: true,
    });
    const twins: SprintReport = {
      ...sprint14,
      velocity: [{ listId: 'l-old', name: 'Sprint 14', committed: 10, delivered: 9 }],
    };
    expect(velocityBars(twins).map((bar: { key: string }) => bar.key)).toEqual([
      'S14',
      'Sprint 14',
    ]);
  });
});
