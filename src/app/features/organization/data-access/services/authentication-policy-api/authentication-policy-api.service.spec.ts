import { TestBed } from '@angular/core/testing';
import {
  type AuthenticationPolicy as AuthenticationPolicyDto,
  AuthenticationPolicyService,
} from '@cadenway/api-client';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { AuthenticationPolicy } from '../../../models/authentication-policy/authentication-policy.interface';
import { AuthenticationPolicyApi } from './authentication-policy-api.service';

/**
 * Constant ATELIER_NORD
 *
 * @description
 * The policy of Atelier Nord in the contract's example: administrators required, 12 hours, 7
 * people without two-step verification, version 2.
 *
 * @type {AuthenticationPolicyDto}
 */
const ATELIER_NORD: AuthenticationPolicyDto = {
  twoStepVerificationRequiredFor: 'admins',
  sessionInactivityTimeoutMinutes: 720,
  membersWithoutTwoStepVerification: { admins: 0, everyone: 7 },
  version: 2,
};

describe('AuthenticationPolicyApi', () => {
  let client: Record<string, Mock>;
  let api: AuthenticationPolicyApi;

  beforeEach(() => {
    client = {
      getAuthenticationPolicy: vi.fn(() => of(ATELIER_NORD)),
      updateAuthenticationPolicy: vi.fn(() =>
        of({ ...ATELIER_NORD, sessionInactivityTimeoutMinutes: 60, version: 3 }),
      ),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: AuthenticationPolicyService, useValue: client }],
    });
    api = TestBed.inject(AuthenticationPolicyApi);
  });

  it('maps the policy to the display model', async () => {
    const policy: AuthenticationPolicy = await api.policy();

    expect(policy).toEqual({
      twoStepRequiredFor: 'admins',
      sessionTimeoutMinutes: 720,
      membersWithoutTwoStep: { admins: 0, everyone: 7 },
      version: 2,
    });
  });

  it('keeps a value a later contract adds as unknown', async () => {
    client['getAuthenticationPolicy'].mockReturnValue(
      of({
        ...ATELIER_NORD,
        twoStepVerificationRequiredFor: 'guests',
        sessionInactivityTimeoutMinutes: 240,
      }),
    );

    const policy: AuthenticationPolicy = await api.policy();

    expect(policy.twoStepRequiredFor).toBeNull();
    expect(policy.sessionTimeoutMinutes).toBeNull();
  });

  it('sends only the changed members, from the version read', async () => {
    const policy: AuthenticationPolicy = await api.update({ sessionTimeoutMinutes: 60 }, 2);

    expect(client['updateAuthenticationPolicy']).toHaveBeenCalledWith(
      { sessionInactivityTimeoutMinutes: 60 },
      { headers: { 'If-Match': '"2"' } },
    );
    expect(policy.sessionTimeoutMinutes).toBe(60);
    expect(policy.version).toBe(3);
  });

  it('sends the two-step requirement as the contract names it', async () => {
    await api.update({ twoStepRequiredFor: 'everyone' }, 2);

    expect(client['updateAuthenticationPolicy']).toHaveBeenCalledWith(
      { twoStepVerificationRequiredFor: 'everyone' },
      { headers: { 'If-Match': '"2"' } },
    );
  });
});
