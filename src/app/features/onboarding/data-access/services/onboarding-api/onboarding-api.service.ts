import { inject, Service } from '@angular/core';
import {
  type InvitationBatchResult,
  InvitationsService,
  MyTasksService,
  type OnboardingState,
} from '@cadenway/api-client';
import { firstValueFrom, fromEvent, map, type Observable, takeUntil } from 'rxjs';

import type {
  OnboardingChecklistChange,
  OnboardingDraft,
  OnboardingInvitationOutcome,
  OnboardingProgress,
  OnboardingSpace,
} from '../../../models/onboarding/onboarding.interface';
import {
  ifMatch,
  toChecklistPatch,
  toDraftPatch,
  toFinish,
  toInvitationOutcome,
  toOnboardingProgress,
} from '../../adapters/onboarding/onboarding.adapter';

/**
 * Function abortable
 *
 * @description
 * Reads the first value of a request, given up when the signal aborts.
 *
 * @template T
 * @param {Observable<T>} source - Request of the generated client.
 * @param {AbortSignal} [signal] - Abort signal of the caller.
 * @returns {Promise<T>} The answer.
 */
function abortable<T>(source: Observable<T>, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  return firstValueFrom(signal ? source.pipe(takeUntil(fromEvent(signal, 'abort'))) : source);
}

/**
 * Function progressOf
 *
 * @description
 * Maps an onboarding answer of the generated client to the display model.
 *
 * @param {Observable<OnboardingState>} source - Request of the generated client.
 * @returns {Promise<OnboardingProgress>} The progress the gateway answered.
 */
function progressOf(source: Observable<OnboardingState>): Promise<OnboardingProgress> {
  return firstValueFrom(source.pipe(map(toOnboardingProgress)));
}

/**
 * Service OnboardingApi
 *
 * @description
 * The onboarding feature's access to the person's first-launch state in the current organization
 * (`MyTasksService`: `getOnboarding`, `updateOnboarding`, `updateOnboardingChecklist`,
 * `finishOnboarding`) and to the organization invitations (`InvitationsService.inviteMembers`),
 * mapped to display models. Every write sends `If-Match: "<version>"` from the version shown; Core's
 * `OrganizationPin` adds `If-Organization-Match` to the onboarding operations. A failure rejects
 * with the client's error, which `readProblem` reads (`409 onboarding.wizard-closed`,
 * `409 onboarding.checklist-unavailable`, `409 space.prefix-taken`, `412 request.version-mismatch`,
 * `422 idempotency.key-reused`, `429 invitation.daily-limit-reached`...).
 */
@Service()
export class OnboardingApi {
  // #region Properties
  /**
   * Property myTasks
   *
   * @description
   * Generated operations of the caller's own task-service state, onboarding included.
   *
   * @type {MyTasksService}
   * @readonly
   */
  private readonly myTasks: MyTasksService = inject(MyTasksService);

  /**
   * Property invitations
   *
   * @description
   * Generated invitation operations.
   *
   * @type {InvitationsService}
   * @readonly
   */
  private readonly invitations: InvitationsService = inject(InvitationsService);
  // #endregion

  // #region Methods
  /**
   * Method get
   *
   * @description
   * Reads the person's onboarding in the current organization: the initial state at version 1
   * before the first write. Aborting the signal gives the read up and rejects.
   *
   * @param {AbortSignal} [signal] - Abort signal of the caller (an organization switch).
   * @returns {Promise<OnboardingProgress>} The progress.
   */
  public async get(signal?: AbortSignal): Promise<OnboardingProgress> {
    return toOnboardingProgress(await abortable(this.myTasks.getOnboarding(), signal));
  }

  /**
   * Method saveDraft
   *
   * @description
   * Saves a draft change of the assistant for resumption. Refused with
   * `409 onboarding.wizard-closed` once the assistant was finished or dismissed.
   *
   * @param {OnboardingDraft} draft - The change.
   * @param {number} version - The version shown.
   * @returns {Promise<OnboardingProgress>} The progress saved.
   */
  public saveDraft(draft: OnboardingDraft, version: number): Promise<OnboardingProgress> {
    return progressOf(
      this.myTasks.updateOnboarding(toDraftPatch(draft), { headers: ifMatch(version) }),
    );
  }

  /**
   * Method dismiss
   *
   * @description
   * Closes the assistant for good (`Set up later`); a repeated dismissal keeps the version.
   *
   * @param {number} version - The version shown.
   * @returns {Promise<OnboardingProgress>} The progress saved.
   */
  public dismiss(version: number): Promise<OnboardingProgress> {
    return progressOf(
      this.myTasks.updateOnboarding({ dismissed: true }, { headers: ifMatch(version) }),
    );
  }

  /**
   * Method updateChecklist
   *
   * @description
   * Saves the checklist's presentation or records a marker; a repeated, identical marker keeps the
   * version. A presentation or `boardTried` before provisioning is refused with
   * `409 onboarding.checklist-unavailable`.
   *
   * @param {OnboardingChecklistChange} change - The change.
   * @param {number} version - The version shown.
   * @returns {Promise<OnboardingProgress>} The progress saved.
   */
  public updateChecklist(
    change: OnboardingChecklistChange,
    version: number,
  ): Promise<OnboardingProgress> {
    return progressOf(
      this.myTasks.updateOnboardingChecklist(toChecklistPatch(change), {
        headers: ifMatch(version),
      }),
    );
  }

  /**
   * Method finish
   *
   * @description
   * Provisions the first space with its template's lists and example tasks and finishes the
   * assistant, in one transaction. The idempotency key replays the original answer for 24 hours:
   * send the same key again after an unknown outcome, and a new key with any other body (a reused
   * key with another body is refused with `422 idempotency.key-reused`).
   *
   * @param {OnboardingSpace} space - The space to provision.
   * @param {number} version - The version shown.
   * @param {string} idempotencyKey - Key of this body.
   * @returns {Promise<OnboardingProgress>} The finished progress, with its provisioning.
   */
  public finish(
    space: OnboardingSpace,
    version: number,
    idempotencyKey: string,
  ): Promise<OnboardingProgress> {
    return progressOf(
      this.myTasks.finishOnboarding(toFinish(space), {
        headers: { ...ifMatch(version), 'Idempotency-Key': idempotencyKey },
      }),
    );
  }

  /**
   * Method invite
   *
   * @description
   * Invites addresses to the organization as members (owners and administrators only). Recording
   * the checklist marker afterwards is the caller's choice, when at least one address was invited.
   *
   * @param {readonly string[]} emails - Distinct addresses, 1 to 50.
   * @returns {Promise<OnboardingInvitationOutcome>} How many were invited and skipped.
   */
  public async invite(emails: readonly string[]): Promise<OnboardingInvitationOutcome> {
    const result: InvitationBatchResult = await firstValueFrom(
      this.invitations.inviteMembers({ emails: [...emails], role: 'member' }),
    );
    return toInvitationOutcome(result);
  }
  // #endregion
}
