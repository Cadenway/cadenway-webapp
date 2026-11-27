import type {
  BackupCodes as BackupCodesDto,
  SecurityKey as SecurityKeyDto,
  TwoStepRequirement as TwoStepRequirementDto,
  TwoStepVerification as TwoStepVerificationDto,
} from '@cadenway/api-client';

import type {
  BackupCodeSet,
  SecurityKey,
  TwoStepOverview,
  TwoStepRequirement,
  TwoStepRequirementScope,
} from '../../../models/two-step/two-step.interface';

/**
 * Function toSecurityKey
 *
 * @description
 * Maps a registered key to the display model.
 *
 * @param {SecurityKeyDto} dto - The key the gateway answered.
 * @returns {SecurityKey} The display model.
 */
export function toSecurityKey(dto: SecurityKeyDto): SecurityKey {
  return { id: dto.id, name: dto.name, createdAt: dto.createdAt, lastUsedAt: dto.lastUsedAt };
}

/**
 * Function toRequirement
 *
 * @description
 * Maps an organization's requirement; a `requiredFor` this version does not know becomes
 * `unknown`.
 *
 * @param {TwoStepRequirementDto} dto - The requirement the gateway answered.
 * @returns {TwoStepRequirement} The display model.
 */
function toRequirement(dto: TwoStepRequirementDto): TwoStepRequirement {
  const requiredFor: TwoStepRequirementScope =
    dto.requiredFor === 'admins' || dto.requiredFor === 'everyone' ? dto.requiredFor : 'unknown';
  return { organizationId: dto.organizationId, requiredFor };
}

/**
 * Function toTwoStepOverview
 *
 * @description
 * Maps the two-step verification of the account to the card's model. Methods this version does
 * not know are ignored; the authenticator app is the primary method only when the gateway says
 * so.
 *
 * @param {TwoStepVerificationDto} dto - The state the gateway answered.
 * @returns {TwoStepOverview} The display model.
 */
export function toTwoStepOverview(dto: TwoStepVerificationDto): TwoStepOverview {
  return {
    enabled: dto.enabled,
    appIsPrimary: dto.enabled && dto.primaryMethod === 'authenticator-app',
    appConfiguredAt: dto.authenticatorApp?.configuredAt ?? null,
    securityKeys: dto.securityKeys.map(toSecurityKey),
    backupCodes:
      dto.backupCodes === null
        ? null
        : {
            remaining: dto.backupCodes.remaining,
            total: dto.backupCodes.total,
            generatedAt: dto.backupCodes.generatedAt,
          },
    requiredBy: dto.requiredBy.map(toRequirement),
  };
}

/**
 * Function toBackupCodeSet
 *
 * @description
 * Maps backup codes just generated; they are shown once and never stored.
 *
 * @param {BackupCodesDto} dto - The codes the gateway answered.
 * @returns {BackupCodeSet} The display model.
 */
export function toBackupCodeSet(dto: BackupCodesDto): BackupCodeSet {
  return { codes: [...dto.codes], generatedAt: dto.generatedAt };
}
