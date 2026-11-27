import {
  type InvitationBatchResult,
  LookColor as LookColors,
  type OnboardingChecklistPatch,
  type OnboardingDraftPatch,
  type OnboardingFinish,
  type OnboardingState,
} from '@cadenway/api-client';

import type { LookColor } from '@features/spaces/utils/space-look';

import type {
  OnboardingChecklistChange,
  OnboardingDraft,
  OnboardingInvitationOutcome,
  OnboardingProgress,
  OnboardingSpace,
} from '../../../models/onboarding/onboarding.interface';
import type { OnboardingWizardStatus } from '../../../models/onboarding/onboarding.type';

/**
 * Constant DEFAULT_COLOR
 *
 * @description
 * Color the contract gives an onboarding space when none is chosen, used for an unknown value.
 *
 * @type {LookColor}
 */
const DEFAULT_COLOR: LookColor = 'violet';

/**
 * Constant LOOK_COLORS
 *
 * @description
 * Colors the contract declares.
 *
 * @type {ReadonlySet<string>}
 */
const LOOK_COLORS: ReadonlySet<string> = new Set<string>(Object.values(LookColors));

/**
 * Constant WIZARD_STATUSES
 *
 * @description
 * Assistant statuses this delivery knows (`x-extensible-enum` in the contract).
 *
 * @type {ReadonlySet<string>}
 */
const WIZARD_STATUSES: ReadonlySet<string> = new Set<string>([
  'in-progress',
  'finished',
  'dismissed',
]);

/**
 * Function toWizardStatus
 *
 * @description
 * Reads the assistant's status. A status a later contract adds reads as `dismissed`: only an
 * `in-progress` assistant accepts changes, so an unknown one must not open.
 *
 * @param {string} value - Gateway status.
 * @returns {OnboardingWizardStatus} The status.
 */
function toWizardStatus(value: string): OnboardingWizardStatus {
  return WIZARD_STATUSES.has(value) ? (value as OnboardingWizardStatus) : 'dismissed';
}

/**
 * Function toLookColor
 *
 * @description
 * Reads the draft color, `violet` for an unknown value.
 *
 * @param {string} value - Gateway color.
 * @returns {LookColor} The color.
 */
function toLookColor(value: string): LookColor {
  return LOOK_COLORS.has(value) ? (value as LookColor) : DEFAULT_COLOR;
}

/**
 * Function toOnboardingProgress
 *
 * @description
 * Maps the onboarding state of the gateway to the display model.
 *
 * @param {OnboardingState} dto - Gateway state.
 * @returns {OnboardingProgress} The progress.
 */
export function toOnboardingProgress(dto: OnboardingState): OnboardingProgress {
  return {
    version: dto.version,
    wizard: {
      status: toWizardStatus(dto.wizard.status),
      step: dto.wizard.step,
      preset: dto.wizard.preset,
      name: dto.wizard.name,
      prefix: dto.wizard.prefix,
      color: toLookColor(dto.wizard.color),
    },
    provisioning:
      dto.provisioning === null
        ? null
        : { spaceId: dto.provisioning.spaceId, firstListId: dto.provisioning.firstListId },
    checklist: {
      presentation: dto.checklist.presentation,
      firstTaskCreated: dto.checklist.firstTaskCreated,
      invitationSent: dto.checklist.invitationSent,
      boardTried: dto.checklist.boardTried,
    },
  };
}

/**
 * Function toDraftPatch
 *
 * @description
 * Maps a draft change to the gateway patch, leaving out the members not given.
 *
 * @param {OnboardingDraft} draft - The change.
 * @returns {OnboardingDraftPatch} The patch.
 */
export function toDraftPatch(draft: OnboardingDraft): OnboardingDraftPatch {
  return {
    ...(draft.step === undefined ? {} : { step: draft.step }),
    ...(draft.preset === undefined ? {} : { preset: draft.preset }),
    ...(draft.name === undefined ? {} : { name: draft.name }),
    ...(draft.prefix === undefined ? {} : { prefix: draft.prefix }),
    ...(draft.color === undefined ? {} : { color: draft.color }),
  };
}

/**
 * Function toChecklistPatch
 *
 * @description
 * Maps a checklist change to the gateway patch, leaving out the members not given.
 *
 * @param {OnboardingChecklistChange} change - The change.
 * @returns {OnboardingChecklistPatch} The patch.
 */
export function toChecklistPatch(change: OnboardingChecklistChange): OnboardingChecklistPatch {
  return {
    ...(change.presentation === undefined ? {} : { presentation: change.presentation }),
    ...(change.invitationSent === undefined ? {} : { invitationSent: change.invitationSent }),
    ...(change.boardTried === undefined ? {} : { boardTried: change.boardTried }),
  };
}

/**
 * Function toFinish
 *
 * @description
 * Maps the space to provision to the gateway body.
 *
 * @param {OnboardingSpace} space - The space.
 * @returns {OnboardingFinish} The body.
 */
export function toFinish(space: OnboardingSpace): OnboardingFinish {
  return { name: space.name, prefix: space.prefix, preset: space.preset, color: space.color };
}

/**
 * Function toInvitationOutcome
 *
 * @description
 * Counts the addresses an invitation batch invited; any other outcome, an unknown one included,
 * counts as not sent, as the contract asks.
 *
 * @param {InvitationBatchResult} dto - Gateway result.
 * @returns {OnboardingInvitationOutcome} The counts.
 */
export function toInvitationOutcome(dto: InvitationBatchResult): OnboardingInvitationOutcome {
  const invited: number = dto.invitations.filter(
    (entry: InvitationBatchResult['invitations'][number]): boolean => entry.outcome === 'invited',
  ).length;
  return { invited, skipped: dto.invitations.length - invited };
}

/**
 * Function ifMatch
 *
 * @description
 * The precondition header of a write from a version (`ETag` `"<version>"`).
 *
 * @param {number} version - The version shown.
 * @returns {Record<string, string>} The header.
 */
export function ifMatch(version: number): Record<string, string> {
  return { 'If-Match': `"${String(version)}"` };
}
