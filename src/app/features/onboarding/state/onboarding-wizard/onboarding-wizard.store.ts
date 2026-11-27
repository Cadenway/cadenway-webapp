import { computed, inject, type Signal, type Type } from '@angular/core';
import { Router } from '@angular/router';
import { CwToastService } from '@cadenway/ui/components/toast';
import {
  patchState,
  signalMethod,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';

import { type ApiProblem, isUnknownWriteOutcome, OrganizationPin, readProblem } from '@core/api';
import {
  NAVIGATION_REFRESH,
  type NavigationRefreshPort,
} from '@features/spaces/ports/navigation-refresh';
import { type LookColor, prefixFromName } from '@features/spaces/utils/space-look';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
  type WorkspaceOrganization,
} from '@features/workspace/ports/workspace-context';

import {
  type OnboardingPresetChoice,
  onboardingPresets,
} from '../../constants/presets/onboarding-presets.constants';
import { OnboardingApi } from '../../data-access/services/onboarding-api/onboarding-api.service';
import type {
  OnboardingInvitationOutcome,
  OnboardingProgress,
  OnboardingSpace,
} from '../../models/onboarding/onboarding.interface';
import type { OnboardingPreset, OnboardingStep } from '../../models/onboarding/onboarding.type';
import { OnboardingWriteDroppedError } from '../onboarding/onboarding-write-dropped.error';
import { OnboardingStore } from '../onboarding/onboarding.store';

/**
 * Constant ONBOARDING_STEPS
 *
 * @description
 * The assistant's screens in order (`Space`, `Template`, `Team`, `Import`).
 *
 * @type {readonly OnboardingStep[]}
 */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = ['space', 'preset', 'team', 'import'];

/**
 * Constant DEFAULT_COLOR
 *
 * @description
 * The color shown and sent when the draft has none the assistant offers: the contract's default
 * and the first swatch. A draft color of `gris` (a color a later contract adds reads as `gris`)
 * has no swatch, so it shows and finishes as this one.
 *
 * @type {LookColor}
 */
const DEFAULT_COLOR: LookColor = 'violet';

/**
 * Constant PREFIX_LETTERS
 *
 * @description
 * Third letters tried, in order, after `409 space.prefix-taken` (`App.dc.html` lines 5285-5286).
 *
 * @type {readonly string[]}
 */
const PREFIX_LETTERS: readonly string[] = Array.from(
  { length: 26 },
  (_letter: unknown, index: number) => String.fromCharCode(65 + index),
);

/**
 * Constant INVITE_BATCH_SIZE
 *
 * @description
 * Most addresses one `inviteMembers` call accepts; longer lists are sent in batches of this size.
 *
 * @type {number}
 */
const INVITE_BATCH_SIZE: number = 50;

/**
 * Type OnboardingNextAction
 *
 * @description
 * What the primary button does: `continue` to the next screen, `skip` the `Team` screen without
 * invitations, or `create` the space on the last screen.
 *
 * @type {'continue' | 'skip' | 'create'}
 */
export type OnboardingNextAction = 'continue' | 'skip' | 'create';

/**
 * Type OnboardingFinishFailure
 *
 * @description
 * Why `Create the space` did not finish: `unknown` (no answer, a `5xx`: the retry sends the same
 * idempotency key), `forbidden` (`403 organization.role-forbidden`), `prefix` (every prefix
 * candidate is taken) or `refused` (another definite refusal).
 *
 * @type {'unknown' | 'forbidden' | 'prefix' | 'refused'}
 */
export type OnboardingFinishFailure = 'unknown' | 'forbidden' | 'prefix' | 'refused';

/**
 * Function prefixCandidates
 *
 * @description
 * The key prefixes tried in order: the name's own prefix (Spaces' `prefixFromName`), then its
 * first two letters followed by `A` to `Z` (`App.dc.html` lines 5285-5286), each prefix once, so a
 * fallback equal to the base is not tried twice.
 *
 * @param {string} name - The trimmed space name.
 * @returns {readonly string[]} The prefixes, the base first.
 */
function prefixCandidates(name: string): readonly string[] {
  const base: string = prefixFromName(name);
  const stem: string = base.slice(0, 2);
  return [
    ...new Set([base, ...PREFIX_LETTERS.map((letter: string): string => `${stem}${letter}`)]),
  ];
}

/**
 * Function sameDraft
 *
 * @description
 * Whether two finish bodies are equal, so the idempotency key of the first may be sent again.
 *
 * @param {OnboardingSpace} left - A body.
 * @param {OnboardingSpace} right - Another body.
 * @returns {boolean} Whether they are equal.
 */
function sameDraft(left: OnboardingSpace, right: OnboardingSpace): boolean {
  return (
    left.name === right.name &&
    left.prefix === right.prefix &&
    left.preset === right.preset &&
    left.color === right.color
  );
}

/**
 * Function problemCode
 *
 * @description
 * The problem code of a failure, or null.
 *
 * @param {unknown} error - The failure.
 * @returns {string | null} The code.
 */
function problemCode(error: unknown): string | null {
  const problem: ApiProblem | null = readProblem(error);
  return problem?.code ?? null;
}

/**
 * Interface FinishAttempt
 *
 * @description
 * A finish whose outcome is unknown: its body and the idempotency key to send it again with.
 */
interface FinishAttempt {
  // #region Properties
  /**
   * Property space
   *
   * @description
   * The body sent.
   *
   * @type {OnboardingSpace}
   * @readonly
   */
  readonly space: OnboardingSpace;

  /**
   * Property key
   *
   * @description
   * The idempotency key it was sent with.
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;

  /**
   * Property rank
   *
   * @description
   * Position of its prefix among `prefixCandidates`.
   *
   * @type {number}
   * @readonly
   */
  readonly rank: number;
  // #endregion
}

/**
 * Interface OnboardingWizardRuns
 *
 * @description
 * Bookkeeping outside the state, since no view reads it.
 */
interface OnboardingWizardRuns {
  // #region Properties
  /**
   * Property destroyed
   *
   * @description
   * Whether the store was destroyed (the host left the shell): a finish in flight then refreshes,
   * navigates and toasts nothing.
   *
   * @type {boolean}
   */
  destroyed: boolean;
  // #endregion
}

/**
 * Interface OnboardingWizardState
 *
 * @description
 * State of the assistant for the current organization.
 */
interface OnboardingWizardState {
  // #region Properties
  /**
   * Property step
   *
   * @description
   * The screen shown.
   *
   * @type {OnboardingStep}
   * @readonly
   */
  readonly step: OnboardingStep;

  /**
   * Property name
   *
   * @description
   * The space name as typed.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property color
   *
   * @description
   * The space color, never `gris`.
   *
   * @type {LookColor}
   * @readonly
   */
  readonly color: LookColor;

  /**
   * Property preset
   *
   * @description
   * The template.
   *
   * @type {OnboardingPreset}
   * @readonly
   */
  readonly preset: OnboardingPreset;

  /**
   * Property emails
   *
   * @description
   * The addresses to invite, sent when the person leaves the `Team` screen; kept in memory only
   * (contract gap G6), which is why they are sent then rather than with the finish.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly emails: readonly string[];

  /**
   * Property _sent
   *
   * @description
   * Addresses a batch settled (`invited`, `already-invited` or `already-member`), in lower case;
   * `Continue` on the `Team` screen does not send them again. An address with another outcome, or
   * in a batch that failed, stays out of it and is sent again.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly _sent: readonly string[];

  /**
   * Property _invited
   *
   * @description
   * Number of `invited` outcomes of this session's batches, counted by the creation toast.
   *
   * @type {number}
   * @readonly
   */
  readonly _invited: number;

  /**
   * Property seeded
   *
   * @description
   * Whether the draft was taken from the saved progress; later reads never overwrite the edits.
   *
   * @type {boolean}
   * @readonly
   */
  readonly seeded: boolean;

  /**
   * Property finishing
   *
   * @description
   * Whether `Create the space` is running (provisioning, invitations and navigation).
   *
   * @type {boolean}
   * @readonly
   */
  readonly finishing: boolean;

  /**
   * Property failure
   *
   * @description
   * Why the last `Create the space` did not finish, or null.
   *
   * @type {OnboardingFinishFailure | null}
   * @readonly
   */
  readonly failure: OnboardingFinishFailure | null;

  /**
   * Property inviting
   *
   * @description
   * Whether `Continue` on the `Team` screen is sending the invitations.
   *
   * @type {boolean}
   * @readonly
   */
  readonly inviting: boolean;

  /**
   * Property closed
   *
   * @description
   * Whether the assistant was closed in this organization (`Set up later` or a finish).
   *
   * @type {boolean}
   * @readonly
   */
  readonly closed: boolean;

  /**
   * Property _attempt
   *
   * @description
   * The finish whose outcome is unknown, sent again with its key while the body is unchanged.
   *
   * @type {FinishAttempt | null}
   * @readonly
   */
  readonly _attempt: FinishAttempt | null;

  /**
   * Property _organizationId
   *
   * @description
   * Organization the state belongs to; a switch starts over.
   *
   * @type {string | null}
   * @readonly
   */
  readonly _organizationId: string | null;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * The assistant before the progress is read; `name` is filled with the default name on seeding.
 *
 * @type {OnboardingWizardState}
 */
const initialState: OnboardingWizardState = {
  step: 'space',
  name: '',
  color: DEFAULT_COLOR,
  preset: 'dev',
  emails: [],
  _sent: [],
  _invited: 0,
  seeded: false,
  finishing: false,
  failure: null,
  inviting: false,
  closed: false,
  _attempt: null,
  _organizationId: null,
};

/**
 * Interface OnboardingWizardStoreInstance
 *
 * @description
 * Public API of the assistant's store.
 */
interface OnboardingWizardStoreInstance {
  // #region Properties
  /**
   * Property step
   *
   * @description
   * The screen shown.
   *
   * @type {Signal<OnboardingStep>}
   * @readonly
   */
  readonly step: Signal<OnboardingStep>;

  /**
   * Property stepIndex
   *
   * @description
   * Zero-based position of the screen shown.
   *
   * @type {Signal<number>}
   * @readonly
   */
  readonly stepIndex: Signal<number>;

  /**
   * Property name
   *
   * @description
   * The space name as typed.
   *
   * @type {Signal<string>}
   * @readonly
   */
  readonly name: Signal<string>;

  /**
   * Property nameBlank
   *
   * @description
   * Whether the name is blank: the field is invalid and the `Space` screen cannot continue.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly nameBlank: Signal<boolean>;

  /**
   * Property color
   *
   * @description
   * The space color.
   *
   * @type {Signal<LookColor>}
   * @readonly
   */
  readonly color: Signal<LookColor>;

  /**
   * Property preset
   *
   * @description
   * The template.
   *
   * @type {Signal<OnboardingPreset>}
   * @readonly
   */
  readonly preset: Signal<OnboardingPreset>;

  /**
   * Property emails
   *
   * @description
   * The addresses to invite.
   *
   * @type {Signal<readonly string[]>}
   * @readonly
   */
  readonly emails: Signal<readonly string[]>;

  /**
   * Property canInvite
   *
   * @description
   * Whether the person may invite (owner or administrator); otherwise the `Team` screen shows no
   * form and nothing is sent.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly canInvite: Signal<boolean>;

  /**
   * Property nextAction
   *
   * @description
   * What the primary button does on the screen shown.
   *
   * @type {Signal<OnboardingNextAction>}
   * @readonly
   */
  readonly nextAction: Signal<OnboardingNextAction>;

  /**
   * Property finishing
   *
   * @description
   * Whether `Create the space` is running.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly finishing: Signal<boolean>;

  /**
   * Property failure
   *
   * @description
   * Why the last `Create the space` did not finish, or null.
   *
   * @type {Signal<OnboardingFinishFailure | null>}
   * @readonly
   */
  readonly failure: Signal<OnboardingFinishFailure | null>;

  /**
   * Property inviting
   *
   * @description
   * Whether `Continue` on the `Team` screen is sending the invitations; the screens wait meanwhile.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly inviting: Signal<boolean>;

  /**
   * Property closed
   *
   * @description
   * Whether the assistant was closed in this organization.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly closed: Signal<boolean>;

  /**
   * Property seeded
   *
   * @description
   * Whether the draft was taken from the progress: the screens show once it is.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly seeded: Signal<boolean>;
  // #endregion

  // #region Methods
  /**
   * Method rename
   *
   * @description
   * Changes the space name.
   *
   * @param {string} name - The name as typed.
   */
  rename(name: string): void;

  /**
   * Method pickColor
   *
   * @description
   * Changes the space color; `gris` is ignored, since no swatch offers it.
   *
   * @param {LookColor} color - The color.
   */
  pickColor(color: LookColor): void;

  /**
   * Method pickPreset
   *
   * @description
   * Changes the template.
   *
   * @param {OnboardingPreset} preset - The template.
   */
  pickPreset(preset: OnboardingPreset): void;

  /**
   * Method changeEmails
   *
   * @description
   * Replaces the addresses to invite.
   *
   * @param {readonly string[]} emails - The addresses.
   */
  changeEmails(emails: readonly string[]): void;

  /**
   * Method saveStart
   *
   * @description
   * Makes a launch from `?onboarding=start` durable: while the progress reads `in-progress` at
   * version 1 (nothing saved yet, which the resume rule cannot tell from a member never offered
   * the assistant), it saves the initial draft (the screen, the name or the default name, its
   * prefix, the color and the template) so the progress moves past version 1. Sends nothing
   * otherwise. A failed or dropped save is swallowed: the host keeps the parameter, and the next
   * draft save makes the launch durable instead.
   *
   * @returns {Promise<void>} Resolves once settled; never rejects.
   */
  saveStart(): Promise<void>;

  /**
   * Method next
   *
   * @description
   * Moves to the next screen and saves the draft without waiting, or creates the space on the last
   * screen. Does nothing on the `Space` screen while the name is blank, nor while finishing or
   * inviting. Leaving the `Team` screen first invites the addresses not sent yet as members, in
   * batches of 50, when the person may invite: organization invitations hold on their own, so a
   * reload afterwards loses none (the addresses are not part of the draft, gap G6). An address
   * sent is never sent again. A batch whose outcome is unknown keeps its addresses unsent, shows a
   * toast and keeps the screen, so `Continue` sends them again safely; a refused batch (a `429`
   * daily limit included) shows the failure toast and the screen still changes. Within a batch,
   * an address answered `invited`, `already-invited` or `already-member` is done; any other
   * outcome leaves it unsent (sent again by a later `Continue`) and shows a toast with their
   * count, and the screen still changes. Once a batch invited an address or found one
   * `already-invited`, the checklist's invitation marker is recorded at once, which the contract
   * allows during the assistant; a failed marker write stays owed in `OnboardingStore`.
   *
   * @returns {Promise<void>} Resolves once the screen changed, or the finish settled.
   */
  next(): Promise<void>;

  /**
   * Method back
   *
   * @description
   * Moves to the previous screen and saves the draft without waiting.
   */
  back(): void;

  /**
   * Method skip
   *
   * @description
   * `Set up later`: closes the assistant at once, then closes it for good on the gateway; a read in
   * flight is awaited first (the shared store reads before it writes). Only a failed read, failed
   * at the click or the read in flight failing then, closes without a write, with the toast saying
   * the choice was not saved; `?onboarding=start` stays, so a reload reopens the assistant, as the
   * toast says. A definite refusal, or an
   * unknown outcome after which the progress still shows
   * the assistant `in-progress`, shows a toast saying the choice was not saved and the assistant
   * may come back; a dropped write shows nothing. Once settled, when a space exists (a finish whose
   * outcome was unknown did create it), it opens the first list.
   *
   * @returns {Promise<void>} Resolves once settled; never rejects.
   */
  skip(): Promise<void>;

  /**
   * Method finish
   *
   * @description
   * `Create the space`: provisions the space with the template (`finishOnboarding`); it invites
   * no one, since the `Team` screen did. It tries each other prefix after
   * `409 space.prefix-taken` with a new key, retries once with a new key after a stale version, and
   * sends the same key again after an unknown outcome. Once provisioned it sends the invitation
   * marker again when `OnboardingStore` still owes it (`retryOwedInvitation`), refreshes the
   * navigation, opens the first list, shows the toast (with this session's invitation count) and
   * closes. After `409 onboarding.wizard-closed` (another tab finished or
   * dismissed), it opens the first list when a space exists and closes. Nothing more is applied once the organization
   * changed, the store was destroyed or the write was dropped. A second call while one runs does
   * nothing.
   *
   * @returns {Promise<void>} Resolves once settled; never rejects.
   */
  finish(): Promise<void>;
  // #endregion
}

/**
 * Function createOnboardingWizardStore
 *
 * @description
 * Creates the assistant's store.
 *
 * @returns {Type<OnboardingWizardStoreInstance>} Injectable store constructor.
 */
function createOnboardingWizardStore(): Type<OnboardingWizardStoreInstance> {
  return signalStore(
    withState<OnboardingWizardState>(initialState),
    withProps(() => {
      const runs: OnboardingWizardRuns = { destroyed: false };
      return {
        _onboarding: inject(OnboardingStore),
        _api: inject(OnboardingApi),
        _workspace: inject<WorkspaceContextPort>(WORKSPACE_CONTEXT),
        _pin: inject(OrganizationPin),
        _navigation: inject<NavigationRefreshPort>(NAVIGATION_REFRESH),
        _router: inject(Router),
        _toasts: inject(CwToastService),
        _runs: runs,
      };
    }),
    withComputed((store) => ({
      stepIndex: (): number => ONBOARDING_STEPS.indexOf(store.step()),
      nameBlank: (): boolean => store.name().trim() === '',
      canInvite: (): boolean => store._workspace.can('admin'),
      nextAction: (): OnboardingNextAction => {
        const step: OnboardingStep = store.step();
        if (step === 'import') return 'create';
        if (step === 'team' && (store.emails().length === 0 || !store._workspace.can('admin'))) {
          return 'skip';
        }
        return 'continue';
      },
    })),
    withMethods((store) => {
      const runs: OnboardingWizardRuns = store._runs;

      const defaultName: () => string = (): string =>
        $localize`:@@onboarding.wizard.space.default-name:Product`;

      // As in `OnboardingStore`: the resolver commits another organization (workspace context and
      // pin) before the `_followOrganization` effect resets the state, so check all of them.
      const live: (organizationId: string) => boolean = (organizationId: string): boolean =>
        !runs.destroyed &&
        store._organizationId() === organizationId &&
        store._workspace.organization().id === organizationId &&
        store._pin.current() === organizationId;

      const openProvisioned: (organizationId: string) => void = (organizationId: string): void => {
        if (!live(organizationId)) return;
        const provisioned: OnboardingProgress | null = store._onboarding.progress();
        patchState(store, { finishing: false, closed: true, _attempt: null });
        if (!provisioned?.provisioning) return;
        store._navigation.refresh();
        void store._router.navigate([
          '/',
          store._workspace.organization().slug,
          'l',
          provisioned.provisioning.firstListId,
        ]);
      };

      const saveDraft: () => void = (): void => {
        const organizationId: string | null = store._organizationId();
        if (organizationId === null || !store._onboarding.progress()) return;
        const name: string = store.name().trim();
        void store._onboarding
          .saveDraft({
            step: store.step(),
            name: name === '' ? null : name,
            prefix: name === '' ? null : prefixFromName(name),
            color: store.color(),
            preset: store.preset(),
          })
          .catch((error: unknown): void => {
            if (problemCode(error) === 'onboarding.wizard-closed') openProvisioned(organizationId);
          });
      };

      // Returns whether the person may move on: false only when a batch's outcome is unknown, so
      // its addresses stay unsent and a second Continue sends them again (an address the lost
      // batch reached then answers `already-invited`, so nothing is invited twice).
      const invite: (organizationId: string) => Promise<boolean> = async (
        organizationId: string,
      ): Promise<boolean> => {
        if (!store._workspace.can('admin')) return true;
        const sent: ReadonlySet<string> = new Set(store._sent());
        const pending: readonly string[] = store
          .emails()
          .filter((email: string): boolean => !sent.has(email.toLowerCase()));
        let failed: boolean = false;
        let uncertain: boolean = false;
        let unsent: number = 0;
        let reached: boolean = false;
        for (let start: number = 0; start < pending.length; start += INVITE_BATCH_SIZE) {
          if (!live(organizationId)) return false;
          const batch: readonly string[] = pending.slice(start, start + INVITE_BATCH_SIZE);
          try {
            const outcome: OnboardingInvitationOutcome = await store._api.invite(batch);
            if (!live(organizationId)) return false;
            const notSent: ReadonlySet<string> = new Set(
              (outcome.notSent ?? []).map((email: string): string => email.toLowerCase()),
            );
            const done: readonly string[] = batch
              .map((email: string): string => email.toLowerCase())
              .filter((email: string): boolean => !notSent.has(email));
            unsent += batch.length - done.length;
            reached ||= outcome.invited + outcome.alreadyInvited > 0;
            patchState(store, (state: OnboardingWizardState) => ({
              _sent: [...state._sent, ...done],
              _invited: state._invited + outcome.invited,
            }));
          } catch (error: unknown) {
            if (!live(organizationId)) return false;
            if (isUnknownWriteOutcome(error)) uncertain = true;
            else failed = true;
          }
        }
        // The contract lets the marker be recorded during the assistant (`updateOnboardingChecklist`
        // in tasks.yaml); a failed write stays owed in `OnboardingStore`, which the finish and the
        // checklist send again.
        if (reached) void store._onboarding.recordInvitation().catch((): undefined => undefined);
        if (unsent > 0) {
          store._toasts.error(
            unsent === 1
              ? $localize`:@@onboarding.wizard.toast.not-invited-one:${unsent}:count: address could not be invited`
              : $localize`:@@onboarding.wizard.toast.not-invited-other:${unsent}:count: addresses could not be invited`,
            {
              description: $localize`:@@onboarding.wizard.toast.invitations-failed-text:You can invite your team later.`,
            },
          );
        }
        if (uncertain) {
          store._toasts.error(
            $localize`:@@onboarding.wizard.toast.invitations-unknown:The invitations may not have been sent`,
            {
              description: $localize`:@@onboarding.wizard.toast.invitations-unknown-text:Press Continue to send them again: it is safe.`,
            },
          );
          return false;
        }
        if (failed) {
          store._toasts.error(
            $localize`:@@onboarding.wizard.toast.invitations-failed:The invitations could not be sent`,
            {
              description: $localize`:@@onboarding.wizard.toast.invitations-failed-text:You can invite your team later.`,
            },
          );
        }
        return true;
      };

      const announce: (space: OnboardingSpace) => void = (space: OnboardingSpace): void => {
        const choice: OnboardingPresetChoice | undefined = onboardingPresets().find(
          (preset: OnboardingPresetChoice): boolean => preset.value === space.preset,
        );
        const lists: number = choice?.listCount ?? 1;
        const invited: number = store._invited();
        const parts: string[] = [
          lists === 1
            ? $localize`:@@onboarding.wizard.toast.lists-one:${lists}:count: list`
            : $localize`:@@onboarding.wizard.toast.lists-other:${lists}:count: lists`,
        ];
        if (invited > 0) {
          parts.push(
            invited === 1
              ? $localize`:@@onboarding.wizard.toast.invitations-one:${invited}:count: invitation sent`
              : $localize`:@@onboarding.wizard.toast.invitations-other:${invited}:count: invitations sent`,
          );
        }
        store._toasts.show(
          $localize`:@@onboarding.wizard.toast.created:Space “${space.name}:name:” created`,
          { description: parts.join(' · ') },
        );
      };

      const complete: (
        organization: WorkspaceOrganization,
        space: OnboardingSpace,
        progress: OnboardingProgress,
      ) => Promise<void> = async (
        organization: WorkspaceOrganization,
        space: OnboardingSpace,
        progress: OnboardingProgress,
      ): Promise<void> => {
        await store._onboarding.retryOwedInvitation();
        if (!live(organization.id)) return;
        store._navigation.refresh();
        if (progress.provisioning) {
          await store._router
            .navigate(['/', organization.slug, 'l', progress.provisioning.firstListId])
            .catch((): boolean => false);
        }
        if (!live(organization.id)) return;
        announce(space);
        patchState(store, { finishing: false, closed: true, _attempt: null });
      };

      const finish: () => Promise<void> = async (): Promise<void> => {
        if (store.finishing() || store.nameBlank()) return;
        const organization: WorkspaceOrganization = store._workspace.organization();
        if (!live(organization.id)) return;
        const name: string = store.name().trim();
        const preset: OnboardingPreset = store.preset();
        const color: LookColor = store.color();
        const prefixes: readonly string[] = prefixCandidates(name);
        const body: (rank: number) => OnboardingSpace = (rank: number): OnboardingSpace => ({
          name,
          prefix: prefixes.at(rank) ?? '',
          preset,
          color,
        });
        const pending: FinishAttempt | null = store._attempt();
        const resumed: FinishAttempt | null =
          pending !== null && sameDraft(pending.space, body(pending.rank)) ? pending : null;
        let rank: number = resumed?.rank ?? 0;
        let space: OnboardingSpace = resumed?.space ?? body(rank);
        let key: string = resumed?.key ?? crypto.randomUUID();
        let staleRetried: boolean = false;
        patchState(store, { finishing: true, failure: null });
        for (;;) {
          try {
            const progress: OnboardingProgress = await store._onboarding.finish(space, key);
            if (!live(organization.id)) return;
            patchState(store, { _attempt: null });
            await complete(organization, space, progress);
            return;
          } catch (error: unknown) {
            if (!live(organization.id)) return;
            if (error instanceof OnboardingWriteDroppedError) {
              patchState(store, { finishing: false, _attempt: null });
              return;
            }
            if (isUnknownWriteOutcome(error)) {
              patchState(store, {
                finishing: false,
                failure: 'unknown',
                _attempt: { space, key, rank },
              });
              return;
            }
            const problem: ApiProblem | null = readProblem(error);
            const code: string | null = problem?.code ?? null;
            if (code === 'onboarding.wizard-closed') {
              openProvisioned(organization.id);
              return;
            }
            if (code === 'space.prefix-taken' && rank < prefixes.length - 1) {
              rank += 1;
              space = body(rank);
              key = crypto.randomUUID();
              continue;
            }
            if (problem?.status === 412 && code === 'request.version-mismatch' && !staleRetried) {
              staleRetried = true;
              key = crypto.randomUUID();
              continue;
            }
            patchState(store, {
              finishing: false,
              _attempt: null,
              failure:
                code === 'space.prefix-taken'
                  ? 'prefix'
                  : code === 'organization.role-forbidden'
                    ? 'forbidden'
                    : 'refused',
            });
            return;
          }
        }
      };

      const showSkipFailed: () => void = (): void => {
        store._toasts.error(
          $localize`:@@onboarding.wizard.toast.skip-failed:Your choice could not be saved`,
          {
            description: $localize`:@@onboarding.wizard.toast.skip-failed-text:The setup assistant may come back on your next visit.`,
          },
        );
      };

      const dismiss: (organizationId: string) => Promise<void> = async (
        organizationId: string,
      ): Promise<void> => {
        try {
          await store._onboarding.dismiss();
        } catch (error: unknown) {
          if (error instanceof OnboardingWriteDroppedError || !live(organizationId)) return;
          const shown: OnboardingProgress | null = store._onboarding.progress();
          // No progress: the read the dismissal waited for failed, and nothing was written, so the
          // choice is not saved.
          if (shown === null) {
            showSkipFailed();
            return;
          }
          const unsaved: boolean = isUnknownWriteOutcome(error)
            ? shown.wizard.status === 'in-progress'
            : problemCode(error) !== 'onboarding.wizard-closed';
          if (unsaved) showSkipFailed();
        }
        if (store._onboarding.progress()?.provisioning) openProvisioned(organizationId);
      };

      return {
        _seed: signalMethod<OnboardingProgress | null>(
          (progress: OnboardingProgress | null): void => {
            if (progress === null || store.seeded()) return;
            const wizard: OnboardingProgress['wizard'] = progress.wizard;
            patchState(store, {
              seeded: true,
              step: wizard.step,
              name: wizard.name ?? defaultName(),
              color: wizard.color === 'gris' ? DEFAULT_COLOR : wizard.color,
              preset: wizard.preset,
            });
          },
        ),
        _followOrganization: signalMethod<string>((organizationId: string): void => {
          if (organizationId === store._organizationId()) return;
          patchState(store, { ...initialState, _organizationId: organizationId });
        }),
        rename(name: string): void {
          patchState(store, { name });
        },
        pickColor(color: LookColor): void {
          if (color !== 'gris') patchState(store, { color });
        },
        pickPreset(preset: OnboardingPreset): void {
          patchState(store, { preset });
        },
        changeEmails(emails: readonly string[]): void {
          patchState(store, { emails });
        },
        async saveStart(): Promise<void> {
          const progress: OnboardingProgress | null = store._onboarding.progress();
          if (progress?.wizard.status !== 'in-progress' || progress.version > 1) return;
          const wizard: OnboardingProgress['wizard'] = progress.wizard;
          const name: string = (wizard.name ?? defaultName()).trim();
          await store._onboarding
            .saveDraft({
              step: wizard.step,
              name: name === '' ? null : name,
              prefix: name === '' ? null : prefixFromName(name),
              color: wizard.color === 'gris' ? DEFAULT_COLOR : wizard.color,
              preset: wizard.preset,
            })
            .catch((): undefined => undefined);
        },
        async next(): Promise<void> {
          if (store.finishing() || store.inviting()) return;
          const index: number = store.stepIndex();
          if (store.step() === 'space' && store.nameBlank()) return;
          const following: OnboardingStep | undefined = ONBOARDING_STEPS.at(index + 1);
          if (following === undefined) {
            await finish();
            return;
          }
          const organizationId: string | null = store._organizationId();
          if (store.step() === 'team' && organizationId !== null) {
            patchState(store, { inviting: true });
            const proceed: boolean = await invite(organizationId);
            if (!live(organizationId)) return;
            patchState(store, { inviting: false });
            if (!proceed) return;
          }
          patchState(store, { step: following });
          saveDraft();
        },
        back(): void {
          if (store.finishing() || store.inviting()) return;
          const index: number = store.stepIndex();
          const previous: OnboardingStep | undefined =
            index > 0 ? ONBOARDING_STEPS.at(index - 1) : undefined;
          if (previous === undefined) return;
          patchState(store, { step: previous, failure: null });
          saveDraft();
        },
        async skip(): Promise<void> {
          if (store.finishing() || store.inviting() || store.closed()) return;
          const organizationId: string | null = store._organizationId();
          const readFailed: boolean =
            store._onboarding.progress() === null && store._onboarding.failed();
          patchState(store, { closed: true });
          if (organizationId === null) return;
          if (readFailed) {
            // Nothing can be written without a version: the choice is not saved, and the host keeps
            // `?onboarding=start`, so a reload reopens the assistant.
            showSkipFailed();
            return;
          }
          await dismiss(organizationId);
        },
        finish,
      };
    }),
    withHooks({
      onInit(store): void {
        store._followOrganization(computed((): string => store._workspace.organization().id));
        store._seed(store._onboarding.progress);
      },
      onDestroy(store): void {
        store._runs.destroyed = true;
      },
    }),
  );
}

/**
 * Constant OnboardingWizardStore
 *
 * @description
 * The first-launch assistant (`App.dc.html` lines 2675-2710, behavior 5235-5298), provided by
 * `OnboardingWizardHost` so a finish keeps running while the assistant shows its result. It takes
 * the draft from `OnboardingStore`'s progress once (a null name reads as the default name, a `gris`
 * color as `violet`), changes screens locally and saves the draft after each move without blocking
 * (a failed save is sent again in full by the next one). Leaving the `Team` screen sends the
 * invitations (they hold on their own, survive a reload and are not sent twice); `Create the
 * space` then provisions the space through `OnboardingStore.finish`, which never retries by
 * itself: an unknown outcome keeps the
 * body and its idempotency key for the retry, and any definite refusal takes a new key. Every
 * step is fenced like `OnboardingStore`'s writes: once the workspace or `OrganizationPin` shows
 * another organization, or the store is destroyed, nothing more is applied, refreshed, navigated
 * or toasted. An organization switch starts over.
 *
 * @type {Type<OnboardingWizardStoreInstance>}
 */
export const OnboardingWizardStore: Type<OnboardingWizardStoreInstance> =
  createOnboardingWizardStore();

/**
 * Type OnboardingWizardStore
 *
 * @description
 * Instance type of the assistant's store.
 *
 * @type {OnboardingWizardStoreInstance}
 */
export type OnboardingWizardStore = OnboardingWizardStoreInstance;
