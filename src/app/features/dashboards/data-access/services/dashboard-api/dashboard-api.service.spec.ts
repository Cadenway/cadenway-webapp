import type { HttpContext } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MembersService, TeamReportsService } from '@cadenway/api-client';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { PASSIVE_REQUEST } from '@core/api';
import type { Person } from '@features/task';

import { DashboardApi } from './dashboard-api.service';

/**
 * Function member
 *
 * @description
 * A member of Atelier Nord as `listMembers` returns it.
 *
 * @param {string} userId - Its account.
 * @param {string} name - Its full name.
 * @returns {Record<string, unknown>} The member.
 */
function member(userId: string, name: string): Record<string, unknown> {
  return { id: `m-${userId}`, userId, name, email: `${userId}@atelier-nord.test`, role: 'member' };
}

describe('DashboardApi', () => {
  let getTeamDashboard: Mock;
  let listMembers: Mock;

  beforeEach(() => {
    getTeamDashboard = vi.fn(() =>
      of({
        today: '2026-11-08',
        weeks: 12,
        openCount: 0,
        lateCount: 0,
        blockedCount: 0,
        completedCount: 0,
        byStatus: [],
        overdueTasks: [],
        assigneeThreshold: 6,
        assignees: [],
        completions: [],
      }),
    );
    listMembers = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: TeamReportsService, useValue: { getTeamDashboard } },
        { provide: MembersService, useValue: { listMembers } },
      ],
    });
  });

  it('reads the dashboard past the cache, fenced as a background read when passive', async () => {
    const api: DashboardApi = TestBed.inject(DashboardApi);

    await api.dashboard({ today: '2026-11-08', timeZone: 'Europe/Paris', weeks: 12 }, true);
    await api.dashboard({ today: '2026-11-08', timeZone: 'Europe/Paris', weeks: 8 }, false);

    expect(getTeamDashboard.mock.calls[0][0]).toEqual({
      today: '2026-11-08',
      timeZone: 'Europe/Paris',
      weeks: 12,
    });
    const [first, second]: { cache: string; context: HttpContext }[] =
      getTeamDashboard.mock.calls.map((call: unknown[]) => call[1] as never);
    expect(first.cache).toBe('no-store');
    expect(first.context.get(PASSIVE_REQUEST)).toBe(true);
    expect(second.context.get(PASSIVE_REQUEST)).toBe(false);
  });

  it('reads every member page and names people with their initials', async () => {
    listMembers
      .mockReturnValueOnce(of({ items: [member('u-camille', 'Camille Martin')], nextCursor: 'c2' }))
      .mockReturnValueOnce(of({ items: [member('u-hugo', 'Hugo Dubois')], nextCursor: null }));

    const people: readonly Person[] = await TestBed.inject(DashboardApi).people();

    expect(listMembers.mock.calls.map((call: unknown[]) => call[0])).toEqual([
      { limit: 100 },
      { limit: 100, cursor: 'c2' },
    ]);
    expect(people).toEqual([
      { id: 'u-camille', name: 'Camille Martin', initials: 'CM', avatar: null },
      { id: 'u-hugo', name: 'Hugo Dubois', initials: 'HD', avatar: null },
    ]);
  });

  it('fails rather than loop on a cursor given twice', async () => {
    listMembers.mockReturnValue(of({ items: [], nextCursor: 'again' }));

    await expect(TestBed.inject(DashboardApi).people()).rejects.toThrow();
    expect(listMembers).toHaveBeenCalledTimes(2);
  });
});
