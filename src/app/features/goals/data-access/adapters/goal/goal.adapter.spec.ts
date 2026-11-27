import type { GetGoalClientResult } from '@cadenway/api-client';
import { describe, expect, it } from 'vitest';

import { ifMatch, toGoal, toGoalCreation, versionOfEtag } from './goal.adapter';

/**
 * Constant SSO
 *
 * @description
 * The SSO goal of the contract's example, with its four kinds of key results.
 *
 * @type {GetGoalClientResult}
 */
const SSO: GetGoalClientResult = {
  id: 'g1',
  name: 'Launch SSO for enterprises',
  ownerUserId: 'u-cm',
  dueDate: '2026-12-31',
  quarter: '2026-Q4',
  spaceId: 'product',
  version: 1,
  progressPercent: 25,
  health: 'at-risk',
  results: [
    {
      kind: 'list-progress',
      id: 'k1',
      label: 'Sprint 14 tasks done',
      listId: 'sprint-14',
      eligibleTaskCount: 10,
      doneTaskCount: 6,
      progressPercent: 60,
    },
    {
      kind: 'number',
      id: 'k2',
      label: 'Customers on SSO',
      startValue: 0,
      currentValue: 4,
      targetValue: 10,
      progressPercent: 40,
    },
    {
      kind: 'checkbox',
      id: 'k3',
      label: 'SSO guide published',
      checked: false,
      progressPercent: 0,
    },
    {
      kind: 'milestone',
      id: 'k4',
      label: 'SSO demo to customers',
      taskKey: 'CAD-580',
      reached: false,
      progressPercent: 0,
    },
  ],
};

describe('goal adapter', () => {
  it('maps a goal with its four kinds of key results', () => {
    const goal: ReturnType<typeof toGoal> = toGoal(SSO);

    expect(goal.health).toBe('at-risk');
    expect(goal.results.map((result) => result.kind)).toEqual([
      'list-progress',
      'number',
      'checkbox',
      'milestone',
    ]);
    expect(goal.results[3]).toEqual({
      kind: 'milestone',
      id: 'k4',
      label: 'SSO demo to customers',
      taskKey: 'CAD-580',
      reached: false,
      progressPercent: 0,
    });
  });

  it('leaves out a health and a key result kind of a later contract', () => {
    const goal: ReturnType<typeof toGoal> = toGoal({
      ...SSO,
      health: 'paused',
      results: [
        { ...SSO.results[2], kind: 'survey' } as unknown as GetGoalClientResult['results'][number],
      ],
    });

    expect(goal.health).toBeNull();
    expect(goal.results).toEqual([]);
  });

  it('creates a goal due at the end of its quarter with a number key result', () => {
    expect(
      toGoalCreation(
        {
          name: 'Cut the support response time',
          ownerUserId: 'u-cm',
          spaceId: null,
          firstResult: { label: 'Answer within 4 h', target: 90 },
        },
        { key: '2026-Q4', year: 2026, number: 4, end: '2026-12-31' },
      ),
    ).toEqual({
      name: 'Cut the support response time',
      ownerUserId: 'u-cm',
      dueDate: '2026-12-31',
      quarter: '2026-Q4',
      spaceId: null,
      results: [
        {
          kind: 'number',
          label: 'Answer within 4 h',
          startValue: 0,
          currentValue: 0,
          targetValue: 90,
        },
      ],
    });
  });

  it('reads and writes goal versions', () => {
    expect(versionOfEtag('"12"')).toBe(12);
    expect(versionOfEtag('W/"3"')).toBe(3);
    expect(versionOfEtag(null)).toBeNull();
    expect(versionOfEtag('abc')).toBeNull();
    expect(ifMatch(12)).toEqual({ 'If-Match': '"12"' });
  });
});
