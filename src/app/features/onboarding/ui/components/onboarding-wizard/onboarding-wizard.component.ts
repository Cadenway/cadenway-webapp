import { LiveAnnouncer } from '@angular/cdk/a11y';
import {
  afterNextRender,
  Component,
  computed,
  type ElementRef,
  inject,
  Injector,
  type Signal,
  viewChild,
} from '@angular/core';
import { CwButton } from '@cadenway/ui/components/button';
import { CwDialog } from '@cadenway/ui/components/dialog';
import { CwLogo } from '@cadenway/ui/components/logo';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { CwStep, CwStepper, provideCwStepperLabels } from '@cadenway/ui/components/stepper';
import { NgIcon } from '@ng-icons/core';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import type { OnboardingStep } from '../../../models/onboarding/onboarding.type';
import { OnboardingStore } from '../../../state/onboarding/onboarding.store';
import {
  type OnboardingFinishFailure,
  type OnboardingNextAction,
  OnboardingWizardStore,
} from '../../../state/onboarding-wizard/onboarding-wizard.store';
import { OnboardingImportStep } from '../onboarding-import-step/onboarding-import-step.component';
import { OnboardingPresetStep } from '../onboarding-preset-step/onboarding-preset-step.component';
import { OnboardingSpaceStep } from '../onboarding-space-step/onboarding-space-step.component';
import { OnboardingTeamStep } from '../onboarding-team-step/onboarding-team-step.component';

/**
 * Interface WizardStepLabel
 *
 * @description
 * A screen of the assistant and its name in the step bar.
 */
interface WizardStepLabel {
  // #region Properties
  /**
   * Property value
   *
   * @description
   * The screen.
   *
   * @type {OnboardingStep}
   * @readonly
   */
  readonly value: OnboardingStep;

  /**
   * Property label
   *
   * @description
   * Its name.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;
  // #endregion
}

/**
 * Component OnboardingWizard
 *
 * @description
 * The first-launch assistant's window (`App.dc.html` lines 2675-2710), an overlay acting as a
 * page: an edge-to-edge `cw-dialog` (`size="screen"`) that neither Escape nor a click outside
 * closes and that has no close button, since only `Set up later` dismisses it, for good. The
 * window is named by the card's `h1` (`cwDialogTitle` imposes an `h2`), which takes the focus on
 * open and after each screen change, announced as `Step n of 4: <name>`. The segmented step bar
 * (`cw-stepper variant="segments"`, not clickable) and the `Step n of 4` line follow the screen
 * shown. Until the progress is read the card shows a skeleton; a failed read shows an inline error
 * whose Retry reads it again. After a Retry removes its alert the focus goes to the title. A
 * history move (Back, Forward) or a router navigation does not close it (`closeOnNavigation` is
 * false), since only `Set up later` dismisses it. It reads `OnboardingWizardStore`, provided by
 * `OnboardingWizardHost`, and `OnboardingStore` for the read state.
 */
@Component({
  selector: 'cw-onboarding-wizard',
  imports: [
    CwButton,
    CwDialog,
    CwLogo,
    CwSkeleton,
    CwStep,
    CwStepper,
    NgIcon,
    OnboardingImportStep,
    OnboardingPresetStep,
    OnboardingSpaceStep,
    OnboardingTeamStep,
  ],
  providers: [
    provideCwStepperLabels(() => ({
      step: $localize`:@@onboarding.wizard.stepper.step:step`,
      done: $localize`:@@onboarding.wizard.stepper.done:done`,
      current: $localize`:@@onboarding.wizard.stepper.current:current`,
      todo: $localize`:@@onboarding.wizard.stepper.todo:to come`,
      error: $localize`:@@onboarding.wizard.stepper.error:failed`,
      optional: $localize`:@@onboarding.wizard.stepper.optional:(optional)`,
      position: $localize`:@@onboarding.wizard.stepper.position:Step`,
      of: $localize`:@@onboarding.wizard.stepper.of:of`,
      ariaLabel: $localize`:@@onboarding.wizard.steps:Steps`,
    })),
  ],
  templateUrl: './onboarding-wizard.component.html',
})
export class OnboardingWizard {
  // #region Properties
  /**
   * Property store
   *
   * @description
   * The assistant's state, provided by the host.
   *
   * @type {OnboardingWizardStore}
   * @readonly
   */
  protected readonly store: OnboardingWizardStore = inject(OnboardingWizardStore);

  /**
   * Property onboarding
   *
   * @description
   * The person's onboarding progress, for its read state.
   *
   * @type {OnboardingStore}
   * @readonly
   */
  protected readonly onboarding: OnboardingStore = inject(OnboardingStore);

  /**
   * Property defaultName
   *
   * @description
   * The name field's placeholder, also the name a new draft starts with.
   *
   * @type {string}
   * @readonly
   */
  protected readonly defaultName: string = $localize`:@@onboarding.wizard.space.default-name:Product`;

  /**
   * Property steps
   *
   * @description
   * The screens and their names in the step bar.
   *
   * @type {readonly WizardStepLabel[]}
   * @readonly
   */
  protected readonly steps: readonly WizardStepLabel[] = [
    { value: 'space', label: $localize`:@@onboarding.wizard.step.space:Space` },
    { value: 'preset', label: $localize`:@@onboarding.wizard.step.preset:Template` },
    { value: 'team', label: $localize`:@@onboarding.wizard.step.team:Team` },
    { value: 'import', label: $localize`:@@onboarding.wizard.step.import:Import` },
  ];

  /**
   * Property position
   *
   * @description
   * The `Step n of 4` line above the title.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly position: Signal<string> = computed((): string => {
    const step: number = this.store.stepIndex() + 1;
    return $localize`:@@onboarding.wizard.position:Step ${step}:step: of 4`;
  });

  /**
   * Property heading
   *
   * @description
   * The title of the screen shown; the `Space` screen's welcome while the progress is read.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly heading: Signal<string> = computed((): string => {
    switch (this.store.seeded() ? this.store.step() : 'space') {
      case 'preset':
        return $localize`:@@onboarding.wizard.preset.title:Choose a starting point`;
      case 'team':
        return $localize`:@@onboarding.wizard.team.title:Invite your team`;
      case 'import':
        return $localize`:@@onboarding.wizard.import.title:Import your existing projects`;
      default: {
        const organization: string = this.workspace.organization().name;
        return $localize`:@@onboarding.wizard.space.title:Welcome to ${organization}:organization:`;
      }
    }
  });

  /**
   * Property text
   *
   * @description
   * The line under the title of the screen shown.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly text: Signal<string> = computed((): string => {
    switch (this.store.step()) {
      case 'preset':
        return $localize`:@@onboarding.wizard.preset.text:The template creates the lists and a few example tasks. Everything stays editable.`;
      case 'team':
        return $localize`:@@onboarding.wizard.team.text:They will receive an email to join the space. You can invite others later.`;
      case 'import':
        return $localize`:@@onboarding.wizard.import.text:Your tasks, comments and attachments arrive in the new space.`;
      default:
        return $localize`:@@onboarding.wizard.space.text:Let's start with your first space: it groups a team's lists and tasks.`;
    }
  });

  /**
   * Property failure
   *
   * @description
   * The message of the last `Create the space` that did not finish, or null.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  protected readonly failure: Signal<string | null> = computed((): string | null => {
    const failure: OnboardingFinishFailure | null = this.store.failure();
    switch (failure) {
      case 'unknown':
        return $localize`:@@onboarding.wizard.finish-unknown:The space may not have been created. Retry: it will be created only once.`;
      case 'forbidden':
        return $localize`:@@onboarding.wizard.finish-forbidden:Your role does not allow creating a space.`;
      case 'prefix':
        return $localize`:@@onboarding.wizard.finish-prefix:No key prefix is free for this name. Choose another name.`;
      case 'refused':
        return $localize`:@@onboarding.wizard.finish-failed:The space could not be created. Try again in a moment.`;
      default:
        return null;
    }
  });

  /**
   * Property title
   *
   * @description
   * The card's title, which names the window and takes the focus.
   *
   * @type {Signal<ElementRef<HTMLHeadingElement> | undefined>}
   * @readonly
   */
  private readonly title: Signal<ElementRef<HTMLHeadingElement> | undefined> =
    viewChild<ElementRef<HTMLHeadingElement>>('title');

  /**
   * Property teamStep
   *
   * @description
   * The `Team` screen, while it shows.
   *
   * @type {Signal<OnboardingTeamStep | undefined>}
   * @readonly
   */
  private readonly teamStep: Signal<OnboardingTeamStep | undefined> = viewChild(OnboardingTeamStep);

  /**
   * Property nextAction
   *
   * @description
   * What the primary button does: the store's choice, except that an address typed on the `Team`
   * screen without `Add` makes it `Continue`, since moving on adds it.
   *
   * @type {Signal<OnboardingNextAction>}
   * @readonly
   */
  protected readonly nextAction: Signal<OnboardingNextAction> = computed(
    (): OnboardingNextAction => {
      const action: OnboardingNextAction = this.store.nextAction();
      return action === 'skip' && this.teamStep()?.hasText() === true ? 'continue' : action;
    },
  );

  /**
   * Property workspace
   *
   * @description
   * The current organization, whose name the welcome shows.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  private readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property announcer
   *
   * @description
   * Announces the screen changes.
   *
   * @type {LiveAnnouncer}
   * @readonly
   */
  private readonly announcer: LiveAnnouncer = inject(LiveAnnouncer);

  /**
   * Property injector
   *
   * @description
   * Injector of the post-render focus moves.
   *
   * @type {Injector}
   * @readonly
   */
  private readonly injector: Injector = inject(Injector);
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Moves the focus to the title once the window is shown. The title also carries
   * `cdkFocusInitial`, so the dialog's own first focus lands there too.
   *
   * @constructor
   */
  public constructor() {
    afterNextRender((): void => {
      this.focusTitle();
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method next
   *
   * @description
   * Moves to the next screen, or creates the space on the last one. On the `Team` screen it first
   * adds the address still typed in the field; an invalid one keeps the screen and shows the
   * field's error.
   *
   * @returns {Promise<void>} Resolves once the store settled.
   */
  protected async next(): Promise<void> {
    const before: OnboardingStep = this.store.step();
    if (before === 'team' && this.teamStep()?.commitPending() === false) return;
    await this.store.next();
    if (this.store.step() !== before) this.showStep();
  }

  /**
   * Method back
   *
   * @description
   * Moves to the previous screen.
   */
  protected back(): void {
    const before: OnboardingStep = this.store.step();
    this.store.back();
    if (this.store.step() !== before) this.showStep();
  }

  /**
   * Method retryFinish
   *
   * @description
   * Sends `Create the space` again and moves the focus to the title, since the alert holding the
   * Retry button goes away.
   *
   * @returns {Promise<void>} Resolves once the finish settled.
   */
  protected async retryFinish(): Promise<void> {
    const settled: Promise<void> = this.store.finish();
    this.focusTitleAfterRender();
    await settled;
  }

  /**
   * Method retryRead
   *
   * @description
   * Reads the progress again and moves the focus to the title, since the alert holding the Retry
   * button goes away.
   *
   * @returns {Promise<void>} Resolves once the read settled.
   */
  protected async retryRead(): Promise<void> {
    const settled: Promise<void> = this.onboarding.reload();
    this.focusTitleAfterRender();
    await settled;
  }

  /**
   * Method focusTitleAfterRender
   *
   * @description
   * Moves the focus to the title once the view is rendered.
   */
  private focusTitleAfterRender(): void {
    afterNextRender(
      (): void => {
        this.focusTitle();
      },
      { injector: this.injector },
    );
  }

  /**
   * Method focusTitle
   *
   * @description
   * Moves the focus to the title.
   */
  private focusTitle(): void {
    this.title()?.nativeElement.focus();
  }

  /**
   * Method showStep
   *
   * @description
   * Announces the screen now shown and moves the focus to its title once rendered.
   */
  private showStep(): void {
    const index: number = this.store.stepIndex();
    const step: number = index + 1;
    const label: string = this.steps[index]?.label ?? '';
    void this.announcer.announce(
      $localize`:@@onboarding.wizard.announcement:Step ${step}:step: of 4: ${label}:label:`,
      'polite',
    );
    this.focusTitleAfterRender();
  }
  // #endregion
}
