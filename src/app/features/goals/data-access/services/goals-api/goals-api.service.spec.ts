import {
  type HttpContext,
  HttpErrorResponse,
  HttpHeaders,
  HttpResponse,
} from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { GoalsService, MembersService, TasksService } from '@cadenway/api-client';
import { firstValueFrom, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { PASSIVE_REQUEST } from '@core/api';

import type { GoalList, Quarter } from '../../../models/goal/goal.interface';
import {
  GoalsApi,
  isGone,
  isUncertainWrite,
  isVersionMismatch,
  type KeyResultWrite,
} from './goals-api.service';

/**
 * Constant Q4
 *
 * @description
 * The mockup's quarter.
 *
 * @type {Quarter}
 */
const Q4: Quarter = { key: '2026-Q4', year: 2026, number: 4, end: '2026-12-31' };

/**
 * Function page
 *
 * @description
 * A page of goals.
 *
 * @param {readonly string[]} ids - Ids of its goals.
 * @param {string | null} nextCursor - Cursor of the next page.
 * @param {number} expected - Expected progress of its summary.
 * @returns {Record<string, unknown>} The page.
 */
function page(
  ids: readonly string[],
  nextCursor: string | null,
  expected: number,
): Record<string, unknown> {
  return {
    items: ids.map((id: string) => ({
      id,
      name: id,
      ownerUserId: 'u-cm',
      dueDate: '2026-12-31',
      quarter: '2026-Q4',
      spaceId: null,
      version: 1,
      progressPercent: 0,
      health: 'behind',
      results: [],
    })),
    nextCursor,
    summary: {
      goalCount: 3,
      expectedProgressPercent: expected,
      averageProgressPercent: 0,
      onTrackOrAchievedCount: 0,
      achievedCount: 0,
      atRiskOrBehindCount: 3,
    },
  };
}

describe('GoalsApi', () => {
  let goals: Record<
    | 'listGoals'
    | 'getGoal'
    | 'createGoal'
    | 'deleteGoal'
    | 'createGoalResult'
    | 'updateGoalResult'
    | 'deleteGoalResult',
    Mock
  >;
  let members: { listMembers: Mock };
  let tasks: { getTask: Mock };

  beforeEach(() => {
    goals = {
      listGoals: vi.fn(),
      getGoal: vi.fn(),
      createGoal: vi.fn(),
      deleteGoal: vi.fn(() => of(undefined)),
      createGoalResult: vi.fn(),
      updateGoalResult: vi.fn(),
      deleteGoalResult: vi.fn(() => of(undefined)),
    };
    members = { listMembers: vi.fn() };
    tasks = { getTask: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        GoalsApi,
        { provide: GoalsService, useValue: goals },
        { provide: MembersService, useValue: members },
        { provide: TasksService, useValue: tasks },
      ],
    });
  });

  it('reads every page of a quarter, passively in the background', async () => {
    goals.listGoals
      .mockReturnValueOnce(of(page(['g1', 'g2'], 'next', 41.3)))
      .mockReturnValueOnce(of(page(['g3'], null, 42)));

    const list: GoalList = await TestBed.inject(GoalsApi).list(Q4, '2026-11-08', true);

    expect(list.goals.map((goal) => goal.id)).toEqual(['g1', 'g2', 'g3']);
    expect(list.expectedProgressPercent).toBe(41.3);
    expect(goals.listGoals.mock.calls[1][0]).toEqual({
      quarter: '2026-Q4',
      today: '2026-11-08',
      limit: 100,
      cursor: 'next',
    });
    const options: { context: HttpContext } = goals.listGoals.mock.calls[0][1] as {
      context: HttpContext;
    };
    expect(options.context.get(PASSIVE_REQUEST)).toBe(true);
  });

  it('sends the version shown as If-Match and reads the new one from the ETag', async () => {
    goals.updateGoalResult.mockReturnValue(
      of(
        new HttpResponse({
          body: { kind: 'checkbox', id: 'k3', label: 'Guide', checked: true, progressPercent: 100 },
          headers: new HttpHeaders({ ETag: '"8"' }),
        }),
      ),
    );
    const api: GoalsApi = TestBed.inject(GoalsApi);

    const write: KeyResultWrite = await api.updateResult('g1', 'k3', 7, { checked: true });
    await api.delete('g1', 8);
    await api.deleteResult('g1', 'k3', 8);

    expect(write.version).toBe(8);
    expect(write.result).toMatchObject({ kind: 'checkbox', checked: true });
    expect(
      (goals.updateGoalResult.mock.calls[0][3] as { headers: Record<string, string> }).headers,
    ).toEqual({ 'If-Match': '"7"' });
    expect(goals.deleteGoal).toHaveBeenCalledWith('g1', { headers: { 'If-Match': '"8"' } });
    expect(goals.deleteGoalResult).toHaveBeenCalledWith('g1', 'k3', {
      headers: { 'If-Match': '"8"' },
    });
  });

  it('reads a missing milestone task as missing and another failure as unknown', async () => {
    const api: GoalsApi = TestBed.inject(GoalsApi);
    tasks.getTask
      .mockReturnValueOnce(of({ key: 'CAD-580', dueDate: '2026-12-10' }))
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 404 })))
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 503 })));

    expect(await firstValueFrom(api.milestone('CAD-580'))).toEqual({
      key: 'CAD-580',
      dueDate: '2026-12-10',
    });
    expect(await firstValueFrom(api.milestone('CAD-581'))).toBe('missing');
    expect(await firstValueFrom(api.milestone('CAD-582'))).toBe('unknown');
  });

  it('classifies failures', () => {
    expect(isUncertainWrite(new HttpErrorResponse({ status: 0 }))).toBe(true);
    expect(isUncertainWrite(new HttpErrorResponse({ status: 502 }))).toBe(true);
    expect(isUncertainWrite(new HttpErrorResponse({ status: 403 }))).toBe(false);
    expect(
      isVersionMismatch(
        new HttpErrorResponse({ status: 412, error: { code: 'request.version-mismatch' } }),
      ),
    ).toBe(true);
    expect(isGone(new HttpErrorResponse({ status: 404, error: { code: 'goal.not-found' } }))).toBe(
      true,
    );
  });
});
