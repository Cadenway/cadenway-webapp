import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { InvitationsService, MyTasksService, type OnboardingState } from '@cadenway/api-client';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { OrganizationSwitchPendingError } from '@core/api';

import type { OnboardingProgress } from '../../../models/onboarding/onboarding.interface';
import {
  isDroppedOnboardingWrite,
  isUncertainOnboardingWrite,
  OnboardingApi,
} from './onboarding-api.service';

/**
 * Function refusal
 *
 * @description
 * A gateway answer with a status and an optional problem code.
 *
 * @param {number} status - HTTP status.
 * @param {string} [code] - Problem code.
 * @returns {HttpErrorResponse} The answer.
 */
function refusal(status: number, code?: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: code === undefined ? null : { code } });
}

/**
 * Function state
 *
 * @description
 * An onboarding state of the gateway at a version.
 *
 * @param {number} version - Its version.
 * @returns {OnboardingState} The state.
 */
function state(version: number): OnboardingState {
  return {
    version,
    wizard: {
      status: 'in-progress',
      step: 'space',
      preset: 'dev',
      name: null,
      prefix: null,
      color: 'violet',
    },
    provisioning: null,
    checklist: {
      presentation: 'expanded',
      firstTaskCreated: false,
      invitationSent: false,
      boardTried: false,
    },
  };
}

describe('OnboardingApi', () => {
  let myTasks: Record<string, Mock>;
  let inviteMembers: Mock;
  let api: OnboardingApi;

  beforeEach(() => {
    myTasks = {
      getOnboarding: vi.fn(() => of(state(1))),
      updateOnboarding: vi.fn(() => of(state(2))),
      updateOnboardingChecklist: vi.fn(() => of(state(3))),
      finishOnboarding: vi.fn(() => of(state(4))),
    };
    inviteMembers = vi.fn(() =>
      of({
        invitations: [
          { email: 'ines.robert@ateliernord.fr', outcome: 'invited', invitationId: null },
          { email: 'hugo.martin@ateliernord.fr', outcome: 'already-invited', invitationId: null },
        ],
      }),
    );
    TestBed.configureTestingModule({
      providers: [
        OnboardingApi,
        { provide: MyTasksService, useValue: myTasks },
        { provide: InvitationsService, useValue: { inviteMembers } },
      ],
    });
    api = TestBed.inject(OnboardingApi);
  });

  it('reads the progress', async () => {
    const progress: OnboardingProgress = await api.get();

    expect(progress.version).toBe(1);
    expect(progress.wizard.status).toBe('in-progress');
  });

  it('saves a draft and dismisses from the version shown', async () => {
    await expect(api.saveDraft({ step: 'preset', name: 'Product' }, 1)).resolves.toMatchObject({
      version: 2,
    });
    await api.dismiss(2);

    expect(myTasks['updateOnboarding'].mock.calls).toEqual([
      [{ step: 'preset', name: 'Product' }, { headers: { 'If-Match': '"1"' } }],
      [{ dismissed: true }, { headers: { 'If-Match': '"2"' } }],
    ]);
  });

  it('updates the checklist from the version shown', async () => {
    await api.updateChecklist({ presentation: 'collapsed' }, 5);

    expect(myTasks['updateOnboardingChecklist']).toHaveBeenCalledWith(
      { presentation: 'collapsed' },
      { headers: { 'If-Match': '"5"' } },
    );
  });

  it('finishes with the version and the idempotency key', async () => {
    await expect(
      api.finish({ name: 'Product', prefix: 'PRO', preset: 'dev', color: 'violet' }, 2, 'key-1'),
    ).resolves.toMatchObject({ version: 4 });

    expect(myTasks['finishOnboarding']).toHaveBeenCalledWith(
      { name: 'Product', prefix: 'PRO', preset: 'dev', color: 'violet' },
      { headers: { 'If-Match': '"2"', 'Idempotency-Key': 'key-1' } },
    );
  });

  it('invites as members and counts the addresses invited', async () => {
    await expect(
      api.invite(['ines.robert@ateliernord.fr', 'hugo.martin@ateliernord.fr']),
    ).resolves.toEqual({ invited: 1, skipped: 1, alreadyInvited: 1, notSent: [] });
    expect(inviteMembers).toHaveBeenCalledWith({
      emails: ['ines.robert@ateliernord.fr', 'hugo.martin@ateliernord.fr'],
      role: 'member',
    });
  });

  it('passes the abort signal to the read', async () => {
    const controller: AbortController = new AbortController();
    controller.abort();

    await expect(api.get(controller.signal)).rejects.toBeDefined();
  });
});

describe('onboarding write outcomes', () => {
  it('drops a write blocked by a switch or refused for another session organization', () => {
    expect(isDroppedOnboardingWrite(new OrganizationSwitchPendingError())).toBe(true);
    expect(isDroppedOnboardingWrite(refusal(412, 'organization.context-changed'))).toBe(true);
    expect(isDroppedOnboardingWrite(refusal(412, 'request.version-mismatch'))).toBe(false);
    expect(isUncertainOnboardingWrite(new OrganizationSwitchPendingError())).toBe(false);
  });

  it('calls a lost answer, a server failure or a key still in progress uncertain', () => {
    for (const error of [
      new Error('timeout'),
      refusal(0),
      refusal(408),
      refusal(503),
      refusal(409, 'idempotency.request-in-progress'),
    ]) {
      expect(isUncertainOnboardingWrite(error)).toBe(true);
    }
    for (const error of [
      refusal(409, 'space.prefix-taken'),
      refusal(409, 'onboarding.wizard-closed'),
      refusal(403, 'organization.role-forbidden'),
      refusal(422, 'idempotency.key-reused'),
    ]) {
      expect(isUncertainOnboardingWrite(error)).toBe(false);
    }
  });
});
