import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  type Signal,
  signal,
  untracked,
  type WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  type Event,
  NavigationEnd,
  PRIMARY_OUTLET,
  Router,
  type UrlSegmentGroup,
  type UrlTree,
} from '@angular/router';
import { filter, map } from 'rxjs';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';
import { ShellOverlay } from '@shared/layout-slot';

import { ONBOARDING_WIZARD_OVERLAY } from '../../../constants/overlays/onboarding-overlays.constants';
import type { OnboardingProgress } from '../../../models/onboarding/onboarding.interface';
import { OnboardingStore } from '../../../state/onboarding/onboarding.store';
import { OnboardingWizardStore } from '../../../state/onboarding-wizard/onboarding-wizard.store';
import { OnboardingWizard } from '../onboarding-wizard/onboarding-wizard.component';

/**
 * Constant ONBOARDING_PARAM
 *
 * @description
 * Query parameter Auth's organization creation adds (`?onboarding=start`) to open the assistant.
 *
 * @type {string}
 */
const ONBOARDING_PARAM: string = 'onboarding';

/**
 * Constant ONBOARDING_START
 *
 * @description
 * Value of `ONBOARDING_PARAM` that opens the assistant.
 *
 * @type {string}
 */
const ONBOARDING_START: string = 'start';

/**
 * Function hasStart
 *
 * @description
 * Whether an address carries `?onboarding=start`.
 *
 * @param {UrlTree} tree - The address.
 * @returns {boolean} Whether the assistant was asked to start.
 */
function hasStart(tree: UrlTree): boolean {
  return tree.queryParamMap.get(ONBOARDING_PARAM) === ONBOARDING_START;
}

/**
 * Component OnboardingWizardHost
 *
 * @description
 * The shell's host of the first-launch assistant (`withOnboardingWizard()`, `overlays` slot, order
 * 50), on every page of the application shell. It decides who sees the assistant, since
 * `getOnboarding` answers an `in-progress` state at version 1 for every member (contract gap G1):
 * - when the address carries `?onboarding=start` (Auth's creation), it reads the progress and
 *   opens at once, with a skeleton until the progress is known; it then stays open while the
 *   assistant is `in-progress`. The parameter stays in the address until the launch is durable:
 *   at version 1 the store saves the initial draft, and once the progress is past version 1 (or
 *   the assistant closed) the host removes the parameter with `replaceUrl`, keeping the path and
 *   the other parameters. A reload before that reopens the assistant; a failed first save keeps
 *   the parameter, and the next draft save makes the launch durable; `Set up later` after a failed
 *   read keeps it too, since nothing was saved and a reload is the only way back; a guest's
 *   parameter is removed at once;
 * - otherwise it opens by itself only on the workspace root (`/<slug>`, Home, without `?task=`),
 *   once the progress shows `in-progress` past version 1 (a step was saved), so it never covers a
 *   deep link;
 * - never for a guest (`can('member')`), whom `finishOnboarding` would refuse.
 * It closes once the assistant is closed in this organization (`Set up later`, a finish), or the
 * progress shows it finished or dismissed elsewhere, but stays open while a finish runs. While it
 * should show it holds `onboarding.wizard` in `ShellOverlay`, taken as soon as no other shell
 * overlay is open, and renders only while it holds it; the hold is released when the assistant
 * closes or the host is destroyed. The getting-started checklist relies on that hold to stay
 * hidden under the assistant. It provides `OnboardingWizardStore`, so a finish outlives the
 * window, and renders the assistant in its own chunk.
 */
@Component({
  selector: 'cw-onboarding-wizard-host',
  imports: [OnboardingWizard],
  providers: [OnboardingWizardStore],
  host: { class: 'contents', 'data-testid': 'onboarding-wizard-host' },
  template: `
    @if (open() && held()) {
      @defer (on immediate) {
        <cw-onboarding-wizard />
      }
    }
  `,
})
export class OnboardingWizardHost {
  // #region Properties
  /**
   * Property router
   *
   * @description
   * Reads and rewrites the address.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property workspace
   *
   * @description
   * The current organization and the person's role in it.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  private readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property onboarding
   *
   * @description
   * The person's onboarding progress.
   *
   * @type {OnboardingStore}
   * @readonly
   */
  private readonly onboarding: OnboardingStore = inject(OnboardingStore);

  /**
   * Property wizard
   *
   * @description
   * The assistant's state.
   *
   * @type {OnboardingWizardStore}
   * @readonly
   */
  private readonly wizard: OnboardingWizardStore = inject(OnboardingWizardStore);

  /**
   * Property overlay
   *
   * @description
   * The shell's open overlay, where the assistant registers as `onboarding.wizard` while it shows.
   *
   * @type {ShellOverlay}
   * @readonly
   */
  private readonly overlay: ShellOverlay = inject(ShellOverlay);

  /**
   * Property startedFor
   *
   * @description
   * Organization whose address carried `?onboarding=start`, or null.
   *
   * @type {WritableSignal<string | null>}
   * @readonly
   */
  private readonly startedFor: WritableSignal<string | null> = signal<string | null>(null);

  /**
   * Property resumedFor
   *
   * @description
   * Organization whose saved draft reopened the assistant on the workspace root, or null.
   *
   * @type {WritableSignal<string | null>}
   * @readonly
   */
  private readonly resumedFor: WritableSignal<string | null> = signal<string | null>(null);

  /**
   * Property startSavedFor
   *
   * @description
   * Organization whose initial draft was already asked for, so a failed save is not sent again in
   * a loop; the next draft save makes the launch durable instead.
   *
   * @type {string | null}
   */
  private startSavedFor: string | null = null;

  /**
   * Property removingStart
   *
   * @description
   * Whether the navigation removing `?onboarding=start` is under way.
   *
   * @type {boolean}
   */
  private removingStart: boolean = false;

  /**
   * Property address
   *
   * @description
   * The address shown, after each completed navigation.
   *
   * @type {Signal<UrlTree>}
   * @readonly
   */
  private readonly address: Signal<UrlTree> = toSignal(
    this.router.events.pipe(
      filter((event: Event): event is NavigationEnd => event instanceof NavigationEnd),
      map((): UrlTree => this.router.parseUrl(this.router.url)),
    ),
    { initialValue: this.router.parseUrl(this.router.url) },
  );

  /**
   * Property atRoot
   *
   * @description
   * Whether the address is the workspace root (`/<slug>`) with no task open over it.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  private readonly atRoot: Signal<boolean> = computed((): boolean => {
    const tree: UrlTree = this.address();
    const primary: UrlSegmentGroup | undefined = Object.hasOwn(tree.root.children, PRIMARY_OUTLET)
      ? tree.root.children[PRIMARY_OUTLET]
      : undefined;
    const segments: number = primary?.segments.length ?? 0;
    return segments === 1 && !tree.queryParamMap.has('task');
  });

  /**
   * Property open
   *
   * @description
   * Whether the assistant shows.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly open: Signal<boolean> = computed((): boolean => {
    const organizationId: string = this.workspace.organization().id;
    if (!this.workspace.can('member') || this.wizard.closed()) return false;
    const started: boolean = this.startedFor() === organizationId;
    if (!started && this.resumedFor() !== organizationId) return false;
    if (this.wizard.finishing()) return true;
    const progress: OnboardingProgress | null = this.onboarding.progress();
    return progress === null ? started : progress.wizard.status === 'in-progress';
  });

  /**
   * Property held
   *
   * @description
   * Whether the assistant holds `onboarding.wizard` in `ShellOverlay`: it renders only then, so it
   * never shows over another shell overlay; it takes the hold once that overlay closes.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly held: Signal<boolean> = computed((): boolean =>
    this.overlay.isOpen(ONBOARDING_WIZARD_OVERLAY),
  );
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes `?onboarding=start` from the address shown and from each later navigation, keeps it
   * until the launch is durable, and follows the workspace root for the resume rule.
   *
   * @constructor
   */
  public constructor() {
    effect((): void => {
      const organizationId: string = this.workspace.organization().id;
      const progress: OnboardingProgress | null = this.onboarding.progress();
      if (this.startedFor() !== organizationId || progress === null || !hasStart(this.address())) {
        return;
      }
      untracked((): void => {
        this.settleStart(organizationId, progress);
      });
    });
    if (this.router.currentNavigation() === null) this.takeStart();
    this.router.events
      .pipe(
        filter((event: Event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((): void => {
        this.takeStart();
      });
    effect((): void => {
      if (this.open()) this.overlay.open(ONBOARDING_WIZARD_OVERLAY);
      else {
        untracked((): void => {
          this.overlay.close(ONBOARDING_WIZARD_OVERLAY);
        });
      }
    });
    inject(DestroyRef).onDestroy((): void => {
      this.overlay.close(ONBOARDING_WIZARD_OVERLAY);
    });
    effect((): void => {
      const organizationId: string = this.workspace.organization().id;
      if (!this.workspace.can('member') || !this.atRoot()) return;
      untracked((): void => {
        this.onboarding.load();
      });
      const progress: OnboardingProgress | null = this.onboarding.progress();
      if (progress?.wizard.status === 'in-progress' && progress.version > 1) {
        this.resumedFor.set(organizationId);
      }
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method takeStart
   *
   * @description
   * When the address carries `?onboarding=start`, opens the assistant for a member and reads the
   * progress, then removes the parameter from the address (replacing the history entry) and keeps
   * the path and the other parameters.
   */
  private takeStart(): void {
    if (!hasStart(this.router.parseUrl(this.router.url))) return;
    if (!this.workspace.can('member')) {
      this.removeStart();
      return;
    }
    this.startedFor.set(this.workspace.organization().id);
    this.onboarding.load();
  }

  /**
   * Method settleStart
   *
   * @description
   * Once the progress of a launch from `?onboarding=start` is known: removes the parameter when the
   * launch is durable (the progress is past version 1, or the assistant is no longer
   * `in-progress`), unless a navigation is under way, whose end settles it again; at version 1
   * it asks the store, once per organization, to save the initial
   * draft, whose answer moves the version on and comes back here.
   *
   * @param {string} organizationId - The current organization.
   * @param {OnboardingProgress} progress - Its progress.
   */
  private settleStart(organizationId: string, progress: OnboardingProgress): void {
    if (progress.wizard.status !== 'in-progress' || progress.version > 1) {
      // A navigation under way (the finish opening the first list) would be cut short by the
      // removal; its end changes the address, which settles the launch again.
      if (this.router.currentNavigation() === null) this.removeStart();
      return;
    }
    if (this.startSavedFor === organizationId) return;
    this.startSavedFor = organizationId;
    void this.wizard.saveStart();
  }

  /**
   * Method removeStart
   *
   * @description
   * Removes `?onboarding=start` from the address, replacing the history entry and keeping the path
   * and the other parameters; a removal under way is not sent twice.
   */
  private removeStart(): void {
    if (this.removingStart) return;
    this.removingStart = true;
    void this.router
      .navigate([], {
        queryParams: { [ONBOARDING_PARAM]: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      })
      .finally((): void => {
        this.removingStart = false;
      });
  }
  // #endregion
}
