import type { TwoStepVerification } from '@cadenway/api-client';
import { describe, expect, it } from 'vitest';

import type { TwoStepOverview } from '../../../models/two-step/two-step.interface';
import { toBackupCodeSet, toTwoStepOverview } from './two-step.adapter';

/**
 * Constant ENABLED
 *
 * @description
 * Camille's two-step verification in the mockup (`Compte.dc.html` lines 279-306): the app
 * configured on 3 March 2026, two keys, 7 codes out of 10, required by Atelier Nord for the
 * administrators, plus a method and a requirement a later contract adds.
 *
 * @type {TwoStepVerification}
 */
const ENABLED: TwoStepVerification = {
  enabled: true,
  primaryMethod: 'authenticator-app',
  methods: ['authenticator-app', 'security-key', 'passkey'],
  authenticatorApp: { configuredAt: '2026-03-03T09:00:00Z' },
  securityKeys: [
    { id: 'k1', name: 'YubiKey 5C NFC', createdAt: '2026-03-04T09:00:00Z', lastUsedAt: null },
    {
      id: 'k2',
      name: 'Touch ID (MacBook Air)',
      createdAt: '2026-04-01T09:00:00Z',
      lastUsedAt: '2026-11-07T09:00:00Z',
    },
  ],
  backupCodes: { remaining: 7, total: 10, generatedAt: '2026-03-03T09:00:00Z' },
  requiredBy: [
    { organizationId: 'org-nord', requiredFor: 'admins' },
    { organizationId: 'org-sud', requiredFor: 'contractors' },
  ],
};

describe('two-step adapter', () => {
  it('maps the card without any secret, reading unknown requirements as unknown', () => {
    const overview: TwoStepOverview = toTwoStepOverview(ENABLED);
    expect(overview).toEqual({
      enabled: true,
      appIsPrimary: true,
      appConfiguredAt: '2026-03-03T09:00:00Z',
      securityKeys: ENABLED.securityKeys,
      backupCodes: { remaining: 7, total: 10, generatedAt: '2026-03-03T09:00:00Z' },
      requiredBy: [
        { organizationId: 'org-nord', requiredFor: 'admins' },
        { organizationId: 'org-sud', requiredFor: 'unknown' },
      ],
    });
  });

  it('maps new backup codes without keeping more than the codes and their date', () => {
    expect(
      toBackupCodeSet({ codes: ['4F7K-2M9Q', 'H3XP-8D2L'], generatedAt: '2026-11-08T09:00:00Z' }),
    ).toEqual({ codes: ['4F7K-2M9Q', 'H3XP-8D2L'], generatedAt: '2026-11-08T09:00:00Z' });
  });

  it('does not call an unknown primary method the app', () => {
    expect(toTwoStepOverview({ ...ENABLED, primaryMethod: 'passkey' }).appIsPrimary).toBe(false);
  });
});
