import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { type AutomationRule as AutomationRuleDto, AutomationsService } from '@cadenway/api-client';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { AutomationRule } from '../../../models/automation-rule/automation-rule.interface';
import {
  AutomationsApi,
  isStaleAutomationRule,
  isUncertainAutomationCreate,
  isUncertainAutomationWrite,
} from './automations-api.service';

/**
 * Constant CAMILLE
 *
 * @description
 * User id of Camille Martin, an Atelier Nord member.
 *
 * @type {string}
 */
const CAMILLE: string = '019a5f3c-a0b1-7c2d-9e3f-5a6b7c8d9e31';

/**
 * Constant RULE
 *
 * @description
 * `When a task is created, assign to Camille Martin`, at version 2.
 *
 * @type {AutomationRule}
 */
const RULE: AutomationRule = {
  id: 'r-1',
  trigger: { type: 'created' },
  action: { type: 'assign', userId: CAMILLE },
  enabled: true,
  version: 2,
};

/**
 * Function problem
 *
 * @description
 * A refused call of the gateway.
 *
 * @param {number} status - HTTP status.
 * @param {string} code - Problem code.
 * @returns {HttpErrorResponse} The error.
 */
function problem(status: number, code: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { type: 'about:blank', title: '', status, code } });
}

describe('AutomationsApi', () => {
  let client: Record<string, Mock>;
  let api: AutomationsApi;

  beforeEach(() => {
    const dto: AutomationRuleDto = {
      ruleId: 'r-1',
      trigger: { type: 'created' },
      action: { type: 'assign', userId: CAMILLE },
      enabled: true,
      version: 2,
      createdAt: '2026-11-20T08:00:00Z',
    };
    client = {
      listAutomationRules: vi
        .fn()
        .mockReturnValueOnce(of({ items: [dto], nextCursor: 'c2' }))
        .mockReturnValueOnce(
          of({ items: [{ ...dto, ruleId: 'r-2', enabled: false }], nextCursor: null }),
        ),
      createAutomationRule: vi.fn(() => of({ ...dto, ruleId: 'r-3', version: 1 })),
      updateAutomationRule: vi.fn(() => of({ ...dto, enabled: false, version: 3 })),
      deleteAutomationRule: vi.fn(() => of(undefined)),
      listRecentAutomationRuns: vi.fn(() =>
        of({
          items: [
            {
              executionId: 'x-1',
              ruleId: 'r-1',
              taskKey: 'CAD-482',
              action: { type: 'assign', userId: CAMILLE },
              executedAt: '2026-11-20T08:05:00Z',
            },
          ],
        }),
      ),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: AutomationsService, useValue: client }],
    });
    api = TestBed.inject(AutomationsApi);
  });

  it('follows every page of the rules', async () => {
    expect((await api.rules()).map((rule: AutomationRule): string => rule.id)).toEqual([
      'r-1',
      'r-2',
    ]);
    expect(client['listAutomationRules']).toHaveBeenLastCalledWith({ limit: 100, cursor: 'c2' });
  });

  it('creates a rule with its idempotency key', async () => {
    const created: AutomationRule = await api.create(
      { trigger: { type: 'created' }, action: { type: 'assign', userId: CAMILLE } },
      'key-1',
    );

    expect(created.id).toBe('r-3');
    expect(client['createAutomationRule']).toHaveBeenCalledWith(
      { trigger: { type: 'created' }, action: { type: 'assign', userId: CAMILLE } },
      { headers: { 'Idempotency-Key': 'key-1' } },
    );
  });

  it('writes from the rule version', async () => {
    expect((await api.setEnabled(RULE, false)).version).toBe(3);
    expect(client['updateAutomationRule']).toHaveBeenCalledWith(
      'r-1',
      { enabled: false },
      { headers: { 'If-Match': '"2"' } },
    );

    await api.delete(RULE);
    expect(client['deleteAutomationRule']).toHaveBeenCalledWith('r-1', {
      headers: { 'If-Match': '"2"' },
    });
  });

  it('counts a rule already gone as deleted, and rethrows another refusal', async () => {
    client['deleteAutomationRule'].mockReturnValueOnce(
      throwError(() => problem(404, 'automation.rule-not-found')),
    );
    await expect(api.delete(RULE)).resolves.toBeUndefined();

    client['deleteAutomationRule'].mockReturnValueOnce(
      throwError(() => problem(403, 'organization.role-forbidden')),
    );
    await expect(api.delete(RULE)).rejects.toBeInstanceOf(HttpErrorResponse);
  });

  it('reads the recent runs', async () => {
    expect(await api.runs()).toEqual([
      {
        id: 'x-1',
        ruleId: 'r-1',
        taskKey: 'CAD-482',
        action: { type: 'assign', userId: CAMILLE },
        executedAt: '2026-11-20T08:05:00Z',
      },
    ]);
  });

  it('tells an out-of-date rule from another refusal', () => {
    expect(isStaleAutomationRule(problem(412, 'request.version-mismatch'))).toBe(true);
    expect(isStaleAutomationRule(problem(404, 'automation.rule-not-found'))).toBe(true);
    expect(isStaleAutomationRule(problem(503, 'upstream.unavailable'))).toBe(false);
    expect(isStaleAutomationRule(new Error('offline'))).toBe(false);
  });

  it('tells a lost answer from a definite refusal', () => {
    expect(isUncertainAutomationWrite(new HttpErrorResponse({ status: 0 }))).toBe(true);
    expect(isUncertainAutomationWrite(new HttpErrorResponse({ status: 408 }))).toBe(true);
    expect(isUncertainAutomationWrite(problem(503, 'upstream.unavailable'))).toBe(true);
    expect(isUncertainAutomationWrite(new Error('aborted'))).toBe(true);
    expect(isUncertainAutomationWrite(problem(403, 'organization.role-forbidden'))).toBe(false);
    expect(isUncertainAutomationWrite(problem(412, 'request.version-mismatch'))).toBe(false);
  });

  it('counts a creation still in progress under its key as a lost answer', () => {
    expect(isUncertainAutomationCreate(problem(409, 'idempotency.request-in-progress'))).toBe(true);
    expect(isUncertainAutomationCreate(problem(503, 'upstream.unavailable'))).toBe(true);
    expect(isUncertainAutomationCreate(problem(422, 'idempotency.key-reused'))).toBe(false);
    expect(isUncertainAutomationCreate(problem(422, 'automation.recipient-ineligible'))).toBe(
      false,
    );
  });
});
