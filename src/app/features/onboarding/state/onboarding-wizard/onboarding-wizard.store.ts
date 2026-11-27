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

import { type ApiProblem, readProblem } from '@core/api';
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
import {
  isUncertainOnboardingWrite,
  OnboardingApi,
} from '../../data-access/services/onboarding-api/onboarding-api.service';
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
 * @type {string}
 */
const PREFIX_LETTERS: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

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
 * Function prefixCandidate
 *
 * @description
 * The key prefix tried at a rank: the name's own prefix (Spaces' `prefixFromName`) at rank 0, then
 * its first two letters followed by `A` to `Z`.
 *
 * @param {string} name - The trimmed space name.
 * @param {number} rank - 0 to 26.
 * @returns {string} The prefix.
 */
function prefixCandidate(name: string, rank: number): string {
  const base: string = prefixFromName(name);
  return rank === 0 ? base : `${base.slice(0, 2)}${PREFIX_LETTERS.charAt(rank - 1)}`;
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
   * Rank of its prefix candidate.
   *
   * @type {number}
   * @readonly
   */
  readonly rank: number;
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
   * The addresses to invite once the space exists; kept in memory only (contract gap G6).
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly emails: readonly string[];

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
  seeded: false,
  finishing: false,
  failure: null,
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
   * Method next
   *
   * @description
   * Moves to the next screen and saves the draft without waiting, or creates the space on the last
   * screen. Does nothing on the `Space` screen while the name is blank, nor while finishing.
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
   * `Set up later`: closes the assistant at once and closes it for good on the gateway. When the
   * progress could not be read, it only closes, and writes nothing.
   */
  skip(): void;

  /**
   * Method finish
   *
   * @description
   * `Create the space`: provisions the space with the template (`finishOnboarding`), tries the next
   * prefix after `409 space.prefix-taken` with a new key (26 at most), retries once with a new key
   * after a stale version, sends the same key again after an unknown outcome, invites the
   * addresses, refreshes the navigation, opens the first list, shows the toast and closes. After
   * `409 onboarding.wizard-closed` (another tab finished or dismissed), it opens the first list
   * when a space exists and closes. A dropped write (another organization) shows nothing.
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
    withProps(() => ({
      _onboarding: inject(OnboardingStore),
      _api: inject(OnboardingApi),
      _workspace: inject<WorkspaceContextPort>(WORKSPACE_CONTEXT),
      _navigation: inject<NavigationRefreshPort>(NAVIGATION_REFRESH),
      _router: inject(Router),
      _toasts: inject(CwToastService),
    })),
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
      const defaultName: () => string = (): string =>
        $localize`:@@onboarding.wizard.space.default-name:Product`;

      const live: (organizationId: string) => boolean = (organizationId: string): boolean =>
        store._organizationId() === organizationId &&
        store._workspace.organization().id === organizationId;

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
            if (problemCode(error) === 'onboarding.wizard-closed' && live(organizationId)) {
              openProvisioned(organizationId);
            }
          });
      };

      const openProvisioned: (organizationId: string) => void = (organizationId: string): void => {
        const provisioned: OnboardingProgress | null = store._onboarding.progress();
        patchState(store, { finishing: false, closed: true });
        if (!provisioned?.provisioning || !live(organizationId)) return;
        store._navigation.refresh();
        void store._router.navigate([
          '/',
          store._workspace.organization().slug,
          'l',
          provisioned.provisioning.firstListId,
        ]);
      };

      const invite: (organizationId: string) => Promise<number | null> = async (
        organizationId: string,
      ): Promise<number | null> => {
        const emails: readonly string[] = store.emails();
        if (emails.length === 0 || !store._workspace.can('admin')) return 0;
        try {
          const outcome: OnboardingInvitationOutcome = await store._api.invite(emails);
          if (outcome.invited > 0 && live(organizationId)) {
            await store._onboarding.recordInvitation().catch((): undefined => undefined);
          }
          return outcome.invited;
        } catch {
          return null;
        }
      };

      const announce: (space: OnboardingSpace, invited: number | null) => void = (
        space: OnboardingSpace,
        invited: number | null,
      ): void => {
        const choice: OnboardingPresetChoice | undefined = onboardingPresets().find(
          (preset: OnboardingPresetChoice): boolean => preset.value === space.preset,
        );
        const lists: number = choice?.listCount ?? 1;
        const parts: string[] = [
          lists === 1
            ? $localize`:@@onboarding.wizard.toast.lists-one:${lists}:count: list`
            : $localize`:@@onboarding.wizard.toast.lists-other:${lists}:count: lists`,
        ];
        if (invited !== null && invited > 0) {
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
        if (invited === null) {
          store._toasts.error(
            $localize`:@@onboarding.wizard.toast.invitations-failed:The invitations could not be sent`,
            {
              description: $localize`:@@onboarding.wizard.toast.invitations-failed-text:You can invite your team later.`,
            },
          );
        }
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
        const invited: number | null = await invite(organization.id);
        if (!live(organization.id)) return;
        store._navigation.refresh();
        if (progress.provisioning) {
          await store._router
            .navigate(['/', organization.slug, 'l', progress.provisioning.firstListId])
            .catch((): boolean => false);
        }
        if (!live(organization.id)) return;
        announce(space, invited);
        patchState(store, { finishing: false, closed: true, _attempt: null });
      };

      const finish: () => Promise<void> = async (): Promise<void> => {
        if (store.finishing() || store.nameBlank()) return;
        const organization: WorkspaceOrganization = store._workspace.organization();
        if (!live(organization.id)) return;
        const name: string = store.name().trim();
        const preset: OnboardingPreset = store.preset();
        const color: LookColor = store.color();
        const body: (rank: number) => OnboardingSpace = (rank: number): OnboardingSpace => ({
          name,
          prefix: prefixCandidate(name, rank),
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
            if (error instanceof OnboardingWriteDroppedError) {
              patchState(store, { finishing: false, _attempt: null });
              return;
            }
            if (!live(organization.id)) return;
            if (isUncertainOnboardingWrite(error)) {
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
              patchState(store, { _attempt: null });
              openProvisioned(organization.id);
              return;
            }
            if (code === 'space.prefix-taken' && rank < PREFIX_LETTERS.length) {
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
        async next(): Promise<void> {
          if (store.finishing()) return;
          const index: number = store.stepIndex();
          if (store.step() === 'space' && store.nameBlank()) return;
          const following: OnboardingStep | undefined = ONBOARDING_STEPS.at(index + 1);
          if (following === undefined) {
            await finish();
            return;
          }
          patchState(store, { step: following });
          saveDraft();
        },
        back(): void {
          if (store.finishing()) return;
          const index: number = store.stepIndex();
          const previous: OnboardingStep | undefined =
            index > 0 ? ONBOARDING_STEPS.at(index - 1) : undefined;
          if (previous === undefined) return;
          patchState(store, { step: previous, failure: null });
          saveDraft();
        },
        skip(): void {
          if (store.finishing() || store.closed()) return;
          const read: boolean = store._onboarding.progress() !== null;
          patchState(store, { closed: true });
          if (read) void store._onboarding.dismiss().catch((): undefined => undefined);
        },
        finish,
      };
    }),
    withHooks({
      onInit(store): void {
        store._followOrganization(computed((): string => store._workspace.organization().id));
        store._seed(store._onboarding.progress);
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
 * (a failed save is sent again in full by the next one). `Create the space` provisions the space
 * through `OnboardingStore.finish`, which never retries by itself: an unknown outcome keeps the
 * body and its idempotency key for the retry, and any definite refusal takes a new key. An
 * organization switch starts over.
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
