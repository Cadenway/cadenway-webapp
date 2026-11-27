import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { OrganizationSwitchPendingError } from '../../organization-pin/organization-switch-pending.error';
import { isDroppedOrganizationWrite, isUnknownWriteOutcome } from './write-outcome.utils';

/**
 * Function refusal
 *
 * @description
 * A gateway answer as the generated client rejects it.
 *
 * @param {number} status - HTTP status.
 * @param {string} [code] - Problem code.
 * @returns {HttpErrorResponse} The answer.
 */
function refusal(status: number, code?: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: code === undefined ? null : { code } });
}

describe('write outcomes', () => {
  it('drops a write blocked by a switch or refused for another session organization', () => {
    expect(isDroppedOrganizationWrite(new OrganizationSwitchPendingError())).toBe(true);
    expect(isDroppedOrganizationWrite(refusal(412, 'organization.context-changed'))).toBe(true);
    expect(isDroppedOrganizationWrite(refusal(412, 'request.version-mismatch'))).toBe(false);
    expect(isUnknownWriteOutcome(new OrganizationSwitchPendingError())).toBe(false);
    expect(isUnknownWriteOutcome(refusal(412, 'organization.context-changed'))).toBe(false);
  });

  it('calls a lost answer, a server failure or a key still in progress uncertain', () => {
    for (const error of [
      new Error('timeout'),
      refusal(0),
      refusal(408),
      refusal(503),
      refusal(409, 'idempotency.request-in-progress'),
    ]) {
      expect(isUnknownWriteOutcome(error)).toBe(true);
    }
    for (const error of [
      refusal(409, 'space.prefix-taken'),
      refusal(409, 'onboarding.wizard-closed'),
      refusal(403, 'organization.role-forbidden'),
      refusal(422, 'idempotency.key-reused'),
      refusal(429, 'invitation.daily-limit-reached'),
    ]) {
      expect(isUnknownWriteOutcome(error)).toBe(false);
    }
  });
});
