import { HttpErrorResponse } from '@angular/common/http';
import { ApplicationRef, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { OrganizationSwitchPendingError } from '@core/api';
import {
  ReauthenticationCancelledError,
  ReauthenticationService,
} from '@features/account/reauthentication';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceOrganization,
} from '@features/workspace/ports/workspace-context';

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

/**
 * Function organization
 *
 * @description
 * A workspace organization of the fixtures.
 *
 * @param {string} id - Organization id.
 * @param {string} slug - Organization slug.
 * @returns {WorkspaceOrganization} The organization.
 */
function organization(id: string, slug: string): WorkspaceOrganization {
  return { id, slug, name: slug, initials: 'AN', role: 'owner', plan: 'team' };
}

/**
 * Function deferred
 *
 * @description
 * A promise and the function that resolves it.
 *
 * @returns {{ promise: Promise<void>; resolve: () => void }} Both.
 */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = (): void => undefined;
  const promise: Promise<void> = new Promise<void>((done: () => void): void => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('AuthenticationPolicyStore', () => {
  let api: { policy: Mock; update: Mock };
  let run: Mock;
  let shown: WritableSignal<WorkspaceOrganization>;

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
        { provide: WORKSPACE_CONTEXT, useValue: { organization: shown } },
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
    shown = signal(organization('org-nord', 'atelier-nord'));
  });

  /**
   * Function reauthenticateAfter
   *
   * @description
   * Makes `run` behave as the reauthentication does for a refused first send: it sends once, and
   * once more after the person confirms.
   *
   * @param {Promise<void>} confirmed - Settles when the person confirms.
   */
  function reauthenticateAfter(confirmed: Promise<void>): void {
    api.update.mockRejectedValueOnce(problem(403, 'auth.reauthentication-required'));
    run.mockImplementation(async (operation: () => Promise<unknown>) => {
      try {
        return await operation();
      } catch {
        await confirmed;
        return operation();
      }
    });
  }

  it('reads the policy of the organization shown again after a switch', async () => {
    const instance: InstanceType<typeof AuthenticationPolicyStore> = await store();
    api.policy.mockResolvedValue({ ...ATELIER_NORD, twoStepRequiredFor: 'nobody', version: 9 });

    shown.set(organization('org-sud', 'atelier-sud'));
    expect(instance.current()).toBeNull();
    await TestBed.inject(ApplicationRef).whenStable();

    expect(api.policy).toHaveBeenCalledTimes(2);
    expect(instance.current()?.twoStepRequiredFor).toBe('nobody');
    expect(instance.current()?.version).toBe(9);
  });

  it('sends nothing to the new organization when it switches during the reauthentication', async () => {
    const confirmation: { promise: Promise<void>; resolve: () => void } = deferred();
    reauthenticateAfter(confirmation.promise);
    const instance: InstanceType<typeof AuthenticationPolicyStore> = await store();

    const saving: Promise<AuthenticationPolicySaveOutcome> = instance.save({
      twoStepRequiredFor: 'everyone',
    });
    await expect.poll(() => api.update.mock.calls.length).toBe(1);
    shown.set(organization('org-sud', 'atelier-sud'));
    confirmation.resolve();

    expect(await saving).toBe('cancelled');
    expect(api.update).toHaveBeenCalledTimes(1);
    expect(instance.saving()).toBe(false);
  });

  it('drops the answer of a save that ends after an organization switch', async () => {
    let answer: (policy: AuthenticationPolicy) => void = (): void => undefined;
    api.update.mockReturnValue(
      new Promise<AuthenticationPolicy>((resolve: (policy: AuthenticationPolicy) => void) => {
        answer = resolve;
      }),
    );
    const instance: InstanceType<typeof AuthenticationPolicyStore> = await store();
    const south: AuthenticationPolicy = { ...ATELIER_NORD, twoStepRequiredFor: 'nobody' };
    api.policy.mockResolvedValue(south);

    const saving: Promise<AuthenticationPolicySaveOutcome> = instance.save({
      twoStepRequiredFor: 'everyone',
    });
    shown.set(organization('org-sud', 'atelier-sud'));
    await TestBed.inject(ApplicationRef).whenStable();
    answer({ ...ATELIER_NORD, twoStepRequiredFor: 'everyone', version: 3 });

    expect(await saving).toBe('cancelled');
    expect(instance.current()).toEqual(south);
  });

  it('sends nothing more once the page is gone during the reauthentication', async () => {
    const confirmation: { promise: Promise<void>; resolve: () => void } = deferred();
    reauthenticateAfter(confirmation.promise);
    const instance: InstanceType<typeof AuthenticationPolicyStore> = await store();

    const saving: Promise<AuthenticationPolicySaveOutcome> = instance.save({
      sessionTimeoutMinutes: 60,
    });
    await expect.poll(() => api.update.mock.calls.length).toBe(1);
    TestBed.resetTestingModule();
    confirmation.resolve();

    expect(await saving).toBe('cancelled');
    expect(api.update).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a changed organization context', problem(412, 'organization.context-changed')],
    ['a switch in progress', new OrganizationSwitchPendingError()],
  ])('leaves %s to the workspace recovery', async (_case: string, error: Error) => {
    api.update.mockRejectedValue(error);
    const instance: InstanceType<typeof AuthenticationPolicyStore> = await store();

    expect(await instance.save({ sessionTimeoutMinutes: 60 })).toBe('context-changed');
    expect(api.policy).toHaveBeenCalledTimes(1);
    expect(instance.current()).toEqual(ATELIER_NORD);
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

  it('tells a change on its way from a save waiting for the reauthentication', async () => {
    const confirmation: { promise: Promise<void>; resolve: () => void } = deferred();
    let answer: (policy: AuthenticationPolicy) => void = (): void => undefined;
    api.update
      .mockRejectedValueOnce(problem(403, 'auth.reauthentication-required'))
      .mockReturnValueOnce(
        new Promise<AuthenticationPolicy>((resolve: (policy: AuthenticationPolicy) => void) => {
          answer = resolve;
        }),
      );
    run.mockImplementation(async (operation: () => Promise<unknown>) => {
      try {
        return await operation();
      } catch {
        await confirmation.promise;
        return operation();
      }
    });
    const instance: InstanceType<typeof AuthenticationPolicyStore> = await store();

    const saving: Promise<AuthenticationPolicySaveOutcome> = instance.save({
      sessionTimeoutMinutes: 60,
    });
    await expect.poll(() => api.update.mock.calls.length).toBe(1);
    await expect.poll(() => instance.sending()).toBe(false);
    expect(instance.saving()).toBe(true);
    await instance.sent();

    confirmation.resolve();
    await expect.poll(() => api.update.mock.calls.length).toBe(2);
    expect(instance.sending()).toBe(true);
    let settled: boolean = false;
    const waiting: Promise<void> = instance.sent().then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    answer({ ...ATELIER_NORD, sessionTimeoutMinutes: 60, version: 3 });
    await waiting;
    expect(instance.current()?.sessionTimeoutMinutes).toBe(60);
    expect(instance.sending()).toBe(false);
    expect(await saving).toBe('saved');
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
