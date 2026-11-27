import { inject, Service } from '@angular/core';
import {
  type AuthenticationPolicy as AuthenticationPolicyDto,
  type AuthenticationPolicyPatch,
  AuthenticationPolicyService,
} from '@cadenway/api-client';
import { firstValueFrom } from 'rxjs';

import type {
  AuthenticationPolicy,
  AuthenticationPolicyChange,
  SessionTimeout,
  TwoStepRequirement,
} from '../../../models/authentication-policy/authentication-policy.interface';

/**
 * Constant TWO_STEP_REQUIREMENTS
 *
 * @description
 * The two-step requirements this version knows (`twoStepVerificationRequiredFor` is an
 * extensible enum).
 *
 * @type {ReadonlySet<string>}
 */
const TWO_STEP_REQUIREMENTS: ReadonlySet<string> = new Set<TwoStepRequirement>([
  'nobody',
  'admins',
  'everyone',
]);

/**
 * Constant SESSION_TIMEOUTS
 *
 * @description
 * The inactivity timeouts this version knows, in minutes (`sessionInactivityTimeoutMinutes` is
 * an extensible enum).
 *
 * @type {ReadonlySet<number>}
 */
const SESSION_TIMEOUTS: ReadonlySet<number> = new Set<SessionTimeout>([60, 720, 10080, 43200]);

/**
 * Function toAuthenticationPolicy
 *
 * @description
 * Maps the gateway's policy to the display model; a value this version does not know becomes
 * null.
 *
 * @param {AuthenticationPolicyDto} dto - The policy the gateway answered.
 * @returns {AuthenticationPolicy} The display model.
 */
function toAuthenticationPolicy(dto: AuthenticationPolicyDto): AuthenticationPolicy {
  return {
    twoStepRequiredFor: TWO_STEP_REQUIREMENTS.has(dto.twoStepVerificationRequiredFor)
      ? (dto.twoStepVerificationRequiredFor as TwoStepRequirement)
      : null,
    sessionTimeoutMinutes: SESSION_TIMEOUTS.has(dto.sessionInactivityTimeoutMinutes)
      ? (dto.sessionInactivityTimeoutMinutes as SessionTimeout)
      : null,
    membersWithoutTwoStep: {
      admins: dto.membersWithoutTwoStepVerification.admins,
      everyone: dto.membersWithoutTwoStepVerification.everyone,
    },
    version: dto.version,
  };
}

/**
 * Function toPatch
 *
 * @description
 * The JSON Merge Patch of a change: a member left out of the change is left out of the patch.
 *
 * @param {AuthenticationPolicyChange} change - What the save changes.
 * @returns {AuthenticationPolicyPatch} The request body.
 */
function toPatch(change: AuthenticationPolicyChange): AuthenticationPolicyPatch {
  return {
    ...(change.twoStepRequiredFor === undefined
      ? {}
      : { twoStepVerificationRequiredFor: change.twoStepRequiredFor }),
    ...(change.sessionTimeoutMinutes === undefined
      ? {}
      : { sessionInactivityTimeoutMinutes: change.sessionTimeoutMinutes }),
  };
}

/**
 * Service AuthenticationPolicyApi
 *
 * @description
 * The organization feature's access to the authentication policy of the current organization
 * (`AuthenticationPolicyService`, `openapi/public/organizations.yaml`), mapped to display models.
 * Both operations answer the owner and administrators only; the update also needs a recent
 * authentication (`403 auth.reauthentication-required`), which the caller handles.
 */
@Service()
export class AuthenticationPolicyApi {
  // #region Properties
  /**
   * Property policies
   *
   * @description
   * Generated authentication policy operations.
   *
   * @type {AuthenticationPolicyService}
   * @readonly
   */
  private readonly policies: AuthenticationPolicyService = inject(AuthenticationPolicyService);
  // #endregion

  // #region Methods
  /**
   * Method policy
   *
   * @description
   * Reads the authentication policy of the current organization.
   *
   * @returns {Promise<AuthenticationPolicy>} The policy.
   */
  public async policy(): Promise<AuthenticationPolicy> {
    return toAuthenticationPolicy(await firstValueFrom(this.policies.getAuthenticationPolicy()));
  }

  /**
   * Method update
   *
   * @description
   * Changes the policy from the version it was read at (`If-Match`); a version that is no longer
   * the current one rejects with `412 request.version-mismatch`.
   *
   * @param {AuthenticationPolicyChange} change - What changes.
   * @param {number} version - Version the change was made from.
   * @returns {Promise<AuthenticationPolicy>} The policy after the change.
   */
  public async update(
    change: AuthenticationPolicyChange,
    version: number,
  ): Promise<AuthenticationPolicy> {
    return toAuthenticationPolicy(
      await firstValueFrom(
        this.policies.updateAuthenticationPolicy(toPatch(change), {
          headers: { 'If-Match': `"${String(version)}"` },
        }),
      ),
    );
  }
  // #endregion
}
