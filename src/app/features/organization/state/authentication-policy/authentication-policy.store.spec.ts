import { HttpErrorResponse } from '@angular/common/http';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import {
  ReauthenticationCancelledError,
  ReauthenticationService,
} from '@features/account/reauthentication';

import { AuthenticationPolicyApi } from '../../data-access/services/authentication-policy-api/authentication-policy-api.service';
import type {
  AuthenticationPolicy,
  AuthenticationPolicySaveOutcome,
} from '../../models/authentication-policy/authentication-policy.interface';
import { AuthenticationPolicyStore } from './authentication-policy.store';

/**
 * Constant ATELIER_NORD
 *
 * @description
 * The policy of Atelier Nord: administrators required, 12 hours, version 2.
 *
 * @type {AuthenticationPolicy}
 */
const ATELIER_NORD: AuthenticationPolicy = {
  twoStepRequiredFor: 'admins',
  sessionTimeoutMinutes: 720,
  membersWithoutTwoStep: { admins: 0, everyone: 7 },
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

describe('AuthenticationPolicyStore', () => {
  let api: { policy: Mock; update: Mock };
  let run: Mock;

  /**
   * Function store
   *
   * @description
   * Creates the store and waits for its read.
   *
   * @returns {Promise<InstanceType<typeof AuthenticationPolicyStore>>} The store after the read.
   */
  async function store(): Promise<InstanceType<typeof AuthenticationPolicyStore>> {
    TestBed.configureTestingModule({
      providers: [
        AuthenticationPolicyStore,
        { provide: AuthenticationPolicyApi, useValue: api },
        { provide: ReauthenticationService, useValue: { run } },
      ],
    });
    const instance: InstanceType<typeof AuthenticationPolicyStore> =
      TestBed.inject(AuthenticationPolicyStore);
    await TestBed.inject(ApplicationRef).whenStable();
    return instance;
  }

  beforeEach(() => {
    api = {
      policy: vi.fn(() => Promise.resolve(ATELIER_NORD)),
      update: vi.fn(() =>
        Promise.resolve({ ...ATELIER_NORD, sessionTimeoutMinutes: 60, version: 3 }),
      ),
    };
    run = vi.fn((operation: () => Promise<unknown>) => operation());
  });

  it('reads the policy', async () => {
    const instance: InstanceType<typeof AuthenticationPolicyStore> = await store();

    expect(instance.current()).toEqual(ATELIER_NORD);
    expect(instance.saving()).toBe(false);
  });

  it('saves a change through the reauthentication and shows the answer', async () => {
    const instance: InstanceType<typeof AuthenticationPolicyStore> = await store();

    const outcome: AuthenticationPolicySaveOutcome = await instance.save({
      sessionTimeoutMinutes: 60,
    });

    expect(outcome).toBe('saved');
    expect(run).toHaveBeenCalledTimes(1);
    expect(api.update).toHaveBeenCalledWith({ sessionTimeoutMinutes: 60 }, 2);
    expect(instance.current()?.sessionTimeoutMinutes).toBe(60);
    expect(instance.current()?.version).toBe(3);
    expect(instance.saving()).toBe(false);
  });

  it('marks the save as running until it ends', async () => {
    let answer: (policy: AuthenticationPolicy) => void = (): void => undefined;
    api.update.mockReturnValue(
      new Promise<AuthenticationPolicy>((resolve: (policy: AuthenticationPolicy) => void) => {
        answer = resolve;
      }),
    );
    const instance: InstanceType<typeof AuthenticationPolicyStore> = await store();

    const saving: Promise<AuthenticationPolicySaveOutcome> = instance.save({
      twoStepRequiredFor: 'everyone',
    });

    expect(instance.saving()).toBe(true);
    expect(await instance.save({ sessionTimeoutMinutes: 60 })).toBe('skipped');
    answer({ ...ATELIER_NORD, twoStepRequiredFor: 'everyone', version: 3 });
    expect(await saving).toBe('saved');
    expect(instance.saving()).toBe(false);
    expect(api.update).toHaveBeenCalledTimes(1);
  });

  it('sends nothing for an empty change', async () => {
    const instance: InstanceType<typeof AuthenticationPolicyStore> = await store();

    expect(await instance.save({})).toBe('skipped');
    expect(api.update).not.toHaveBeenCalled();
  });

  it('keeps the policy when the person closes the reauthentication', async () => {
    run.mockRejectedValue(new ReauthenticationCancelledError());
    const instance: InstanceType<typeof AuthenticationPolicyStore> = await store();

    expect(await instance.save({ sessionTimeoutMinutes: 60 })).toBe('cancelled');
    expect(instance.current()).toEqual(ATELIER_NORD);
  });

  it('reads the latest policy again after a stale version', async () => {
    api.update.mockRejectedValue(problem(412, 'request.version-mismatch'));
    const instance: InstanceType<typeof AuthenticationPolicyStore> = await store();
    api.policy.mockResolvedValue({ ...ATELIER_NORD, sessionTimeoutMinutes: 10080, version: 4 });

    expect(await instance.save({ sessionTimeoutMinutes: 60 })).toBe('outdated');
    await TestBed.inject(ApplicationRef).whenStable();

    expect(api.policy).toHaveBeenCalledTimes(2);
    expect(instance.current()?.sessionTimeoutMinutes).toBe(10080);
    expect(instance.current()?.version).toBe(4);
  });

  it.each([
    [problem(409, 'auth.two-step-not-enabled'), 'two-step-not-enabled'],
    [problem(503, 'service.unavailable'), 'failed'],
    [new HttpErrorResponse({ status: 0 }), 'failed'],
  ] as const)(
    'reports a refusal and keeps the saved policy (%#)',
    async (error: HttpErrorResponse, expected: AuthenticationPolicySaveOutcome) => {
      api.update.mockRejectedValue(error);
      const instance: InstanceType<typeof AuthenticationPolicyStore> = await store();

      expect(await instance.save({ twoStepRequiredFor: 'everyone' })).toBe(expected);
      expect(instance.current()).toEqual(ATELIER_NORD);
      expect(instance.saving()).toBe(false);
    },
  );

  it('exposes a failed read as the resource error', async () => {
    api.policy.mockRejectedValue(problem(503, 'service.unavailable'));
    const instance: InstanceType<typeof AuthenticationPolicyStore> = await store();

    expect(instance.policy.error()).toBeDefined();
    expect(instance.current()).toBeNull();
    expect(await instance.save({ sessionTimeoutMinutes: 60 })).toBe('skipped');
  });
});
