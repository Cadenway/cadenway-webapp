import type { AutomationRule as AutomationRuleDto } from '@cadenway/api-client';
import { describe, expect, it } from 'vitest';

import {
  toAutomationRule,
  toAutomationRuleCreate,
  toAutomationRun,
} from './automation-rule.adapter';

/**
 * Constant HUGO
 *
 * @description
 * User id of Hugo Dubois, an Atelier Nord member.
 *
 * @type {string}
 */
const HUGO: string = '019a5f3c-a0b1-7c2d-9e3f-5a6b7c8d9e32';

describe('automation rule adapter', () => {
  it('maps a rule of the gateway', () => {
    const rule: AutomationRuleDto = {
      ruleId: 'r-1',
      trigger: { type: 'status', status: 'done' },
      action: { type: 'notify', userId: HUGO },
      enabled: true,
      version: 3,
      createdAt: '2026-11-20T08:00:00Z',
    };

    expect(toAutomationRule(rule)).toEqual({
      id: 'r-1',
      trigger: { type: 'status', status: 'done' },
      action: { type: 'notify', userId: HUGO },
      enabled: true,
      version: 3,
    });
    expect(
      toAutomationRule({
        ...rule,
        trigger: { type: 'created' },
        action: { type: 'comment', body: 'Ready' },
      }),
    ).toMatchObject({ trigger: { type: 'created' }, action: { type: 'comment', body: 'Ready' } });
  });

  it('maps a run, a comment run without text', () => {
    expect(
      toAutomationRun({
        executionId: 'x-1',
        ruleId: 'r-1',
        taskKey: 'CAD-482',
        action: { type: 'comment' },
        executedAt: '2026-11-20T08:05:00Z',
      }),
    ).toEqual({
      id: 'x-1',
      ruleId: 'r-1',
      taskKey: 'CAD-482',
      action: { type: 'comment' },
      executedAt: '2026-11-20T08:05:00Z',
    });
  });

  it('builds the creation body, with the comment trimmed', () => {
    expect(
      toAutomationRuleCreate({
        trigger: { type: 'status', status: 'blocked' },
        action: { type: 'priority', priority: 'urgente' },
      }),
    ).toEqual({
      trigger: { type: 'status', status: 'blocked' },
      action: { type: 'priority', priority: 'urgente' },
    });
    expect(
      toAutomationRuleCreate({
        trigger: { type: 'created' },
        action: { type: 'comment', body: '  Welcome  ' },
      }),
    ).toEqual({ trigger: { type: 'created' }, action: { type: 'comment', body: 'Welcome' } });
  });
});
