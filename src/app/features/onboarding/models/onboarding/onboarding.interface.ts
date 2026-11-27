import type { LookColor } from '@features/spaces/utils/space-look';

import type {
  OnboardingChecklistPresentation,
  OnboardingPreset,
  OnboardingStep,
  OnboardingWizardStatus,
} from './onboarding.type';

/**
 * Interface OnboardingWizard
 *
 * @description
 * The assistant's status and the draft saved for resumption.
 */
export interface OnboardingWizard {
  // #region Properties
  /**
   * Property status
   *
   * @description
   * Where the assistant stands; a status a later contract adds reads as `dismissed`, so the
   * assistant does not open.
   *
   * @type {OnboardingWizardStatus}
   * @readonly
   */
  readonly status: OnboardingWizardStatus;

  /**
   * Property step
   *
   * @description
   * The screen saved last.
   *
   * @type {OnboardingStep}
   * @readonly
   */
  readonly step: OnboardingStep;

  /**
   * Property preset
   *
   * @description
   * The template chosen, `dev` until another is saved.
   *
   * @type {OnboardingPreset}
   * @readonly
   */
  readonly preset: OnboardingPreset;

  /**
   * Property name
   *
   * @description
   * The space name saved, or null while none is.
   *
   * @type {string | null}
   * @readonly
   */
  readonly name: string | null;

  /**
   * Property prefix
   *
   * @description
   * The key prefix saved (2 to 5 capitals), or null while none is.
   *
   * @type {string | null}
   * @readonly
   */
  readonly prefix: string | null;

  /**
   * Property color
   *
   * @description
   * The space color chosen (`violet` until another is saved); a color a later contract adds reads
   * as `gris`, which the assistant offers no swatch for.
   *
   * @type {LookColor}
   * @readonly
   */
  readonly color: LookColor;
  // #endregion
}

/**
 * Interface OnboardingProvisioning
 *
 * @description
 * The space and first list a successful finish created.
 */
export interface OnboardingProvisioning {
  // #region Properties
  /**
   * Property spaceId
   *
   * @description
   * Id of the provisioned space.
   *
   * @type {string}
   * @readonly
   */
  readonly spaceId: string;

  /**
   * Property firstListId
   *
   * @description
   * Id of the first list of the template, the list the assistant opens.
   *
   * @type {string}
   * @readonly
   */
  readonly firstListId: string;
  // #endregion
}

/**
 * Interface OnboardingChecklist
 *
 * @description
 * The getting-started checklist: its presentation and the three markers the contract records.
 */
export interface OnboardingChecklist {
  // #region Properties
  /**
   * Property presentation
   *
   * @description
   * How the checklist shows.
   *
   * @type {OnboardingChecklistPresentation}
   * @readonly
   */
  readonly presentation: OnboardingChecklistPresentation;

  /**
   * Property firstTaskCreated
   *
   * @description
   * Whether the person created a task in the provisioned space; the gateway sets it, example tasks
   * never do.
   *
   * @type {boolean}
   * @readonly
   */
  readonly firstTaskCreated: boolean;

  /**
   * Property invitationSent
   *
   * @description
   * Whether a successful invitation was recorded.
   *
   * @type {boolean}
   * @readonly
   */
  readonly invitationSent: boolean;

  /**
   * Property boardTried
   *
   * @description
   * Whether opening the `Board` view was recorded.
   *
   * @type {boolean}
   * @readonly
   */
  readonly boardTried: boolean;
  // #endregion
}

/**
 * Interface OnboardingProgress
 *
 * @description
 * The person's onboarding in the current organization, at one version of the gateway state.
 */
export interface OnboardingProgress {
  // #region Properties
  /**
   * Property version
   *
   * @description
   * Version of the state (1 before the first write), sent as `If-Match` by the next write.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;

  /**
   * Property wizard
   *
   * @description
   * The assistant.
   *
   * @type {OnboardingWizard}
   * @readonly
   */
  readonly wizard: OnboardingWizard;

  /**
   * Property provisioning
   *
   * @description
   * The space and list created by the finish, or null before it.
   *
   * @type {OnboardingProvisioning | null}
   * @readonly
   */
  readonly provisioning: OnboardingProvisioning | null;

  /**
   * Property checklist
   *
   * @description
   * The getting-started checklist.
   *
   * @type {OnboardingChecklist}
   * @readonly
   */
  readonly checklist: OnboardingChecklist;
  // #endregion
}

/**
 * Interface OnboardingDraft
 *
 * @description
 * A draft change of the assistant; an omitted member keeps its saved value, a null name or prefix
 * clears it.
 */
export interface OnboardingDraft {
  // #region Properties
  /**
   * Property step
   *
   * @description
   * The screen shown.
   *
   * @type {OnboardingStep | undefined}
   * @readonly
   */
  readonly step?: OnboardingStep;

  /**
   * Property preset
   *
   * @description
   * The template chosen.
   *
   * @type {OnboardingPreset | undefined}
   * @readonly
   */
  readonly preset?: OnboardingPreset;

  /**
   * Property name
   *
   * @description
   * The space name (1 to 80 characters), or null to clear it.
   *
   * @type {string | null | undefined}
   * @readonly
   */
  readonly name?: string | null;

  /**
   * Property prefix
   *
   * @description
   * The key prefix (2 to 5 capitals), or null to clear it.
   *
   * @type {string | null | undefined}
   * @readonly
   */
  readonly prefix?: string | null;

  /**
   * Property color
   *
   * @description
   * The space color.
   *
   * @type {LookColor | undefined}
   * @readonly
   */
  readonly color?: LookColor;
  // #endregion
}

/**
 * Interface OnboardingSpace
 *
 * @description
 * The first space `Create the space` provisions.
 */
export interface OnboardingSpace {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * The trimmed space name, 1 to 80 characters.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property prefix
   *
   * @description
   * The key prefix, 2 to 5 capitals A to Z.
   *
   * @type {string}
   * @readonly
   */
  readonly prefix: string;

  /**
   * Property preset
   *
   * @description
   * The template whose lists and example tasks are created.
   *
   * @type {OnboardingPreset}
   * @readonly
   */
  readonly preset: OnboardingPreset;

  /**
   * Property color
   *
   * @description
   * The space color.
   *
   * @type {LookColor}
   * @readonly
   */
  readonly color: LookColor;
  // #endregion
}

/**
 * Interface OnboardingChecklistChange
 *
 * @description
 * A change of the checklist: its presentation, or a marker to record.
 */
export interface OnboardingChecklistChange {
  // #region Properties
  /**
   * Property presentation
   *
   * @description
   * The presentation to save; needs a provisioned space.
   *
   * @type {OnboardingChecklistPresentation | undefined}
   * @readonly
   */
  readonly presentation?: OnboardingChecklistPresentation;

  /**
   * Property invitationSent
   *
   * @description
   * Records a successful invitation; allowed before provisioning.
   *
   * @type {true | undefined}
   * @readonly
   */
  readonly invitationSent?: true;

  /**
   * Property boardTried
   *
   * @description
   * Records that the `Board` view was opened; needs a provisioned space.
   *
   * @type {true | undefined}
   * @readonly
   */
  readonly boardTried?: true;
  // #endregion
}

/**
 * Interface OnboardingInvitationOutcome
 *
 * @description
 * What an invitation batch did, counted for the toast and the checklist marker.
 */
export interface OnboardingInvitationOutcome {
  // #region Properties
  /**
   * Property invited
   *
   * @description
   * Addresses that received an invitation; only these count as sent.
   *
   * @type {number}
   * @readonly
   */
  readonly invited: number;

  /**
   * Property skipped
   *
   * @description
   * Addresses not invited by this batch: already members, already invited, refused, and outcomes
   * a later contract adds.
   *
   * @type {number}
   * @readonly
   */
  readonly skipped: number;

  /**
   * Property alreadyInvited
   *
   * @description
   * The skipped addresses that already had a pending invitation (`already-invited`), for example
   * from an earlier batch whose answer was lost: an invitation is out for them, so they count for
   * the checklist's invitation marker, not for the `sent` toast.
   *
   * @type {number}
   * @readonly
   */
  readonly alreadyInvited: number;

  /**
   * Property notSent
   *
   * @description
   * The addresses of the batch the gateway answered with an outcome other than `invited`,
   * `already-invited` or `already-member` (an outcome a later contract adds, which counts as not
   * sent), as the gateway spelled them; a caller may send them again. Absent counts as none.
   *
   * @type {readonly string[] | undefined}
   * @readonly
   */
  readonly notSent?: readonly string[];
  // #endregion
}
