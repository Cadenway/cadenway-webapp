import {
  Component,
  computed,
  DestroyRef,
  inject,
  type OnInit,
  type Signal,
  signal,
  type WritableSignal,
} from '@angular/core';
import { type FieldTree, form, FormField, pattern, required, submit } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { CwAlert, CwAlertDescription } from '@cadenway/ui/components/alert';
import { CwAvatar } from '@cadenway/ui/components/avatar';
import { CwButton } from '@cadenway/ui/components/button';
import { CwCard } from '@cadenway/ui/components/card';
import { CwCheckbox } from '@cadenway/ui/components/checkbox';
import { CwInput } from '@cadenway/ui/components/input';
import {
  CwInputOtp,
  CwInputOtpGroup,
  CwInputOtpSeparator,
  CwInputOtpSlot,
} from '@cadenway/ui/components/input-otp';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { CwTab, CwTabPanel, CwTabs, CwTabsList } from '@cadenway/ui/components/tabs';
import { NgIcon } from '@ng-icons/core';

import type { AuthProblem } from '../../../models/auth-problem/auth-problem.interface';
import type { TwoStepChallenge, TwoStepMethod } from '../../../models/session/session.interface';
import {
  AuthFlowStore,
  type ChallengeAnswer,
  type SessionResult,
} from '../../../state/auth-flow/auth-flow.store';
import { focusFirstError } from '../../../utils/form-focus/form-focus.util';

/**
 * Interface TwoStepModel
 *
 * @description
 * Values of the two code tabs and the device trust.
 */
interface TwoStepModel {
  // #region Properties
  /**
   * Property appCode
   *
   * @description
   * The 6 digits of the authenticator app.
   *
   * @type {string}
   */
  appCode: string;

  /**
   * Property backupCode
   *
   * @description
   * A backup code, `XXXX-XXXX`.
   *
   * @type {string}
   */
  backupCode: string;

  /**
   * Property trustDevice
   *
   * @description
   * "Faire confiance à cet appareil pendant 30 jours".
   *
   * @type {boolean}
   */
  trustDevice: boolean;
  // #endregion
}

/**
 * Component TwoStepPage
 *
 * @description
 * Two-step verification of `Mfa.dc.html` (`/login/two-step`), with one tab per method the account
 * has: the application code (`cw-input-otp`, « Vérifier (n / 6) »), the security key (WebAuthn
 * through `@simplewebauthn/browser`) and a backup code (`XXXX-XXXX`). After a reload the challenge
 * is read again from the tab's token; without one, it returns to `/login`.
 */
@Component({
  selector: 'cw-two-step-page',
  imports: [
    CwAlert,
    CwAlertDescription,
    CwAvatar,
    CwButton,
    CwCard,
    CwCheckbox,
    CwInput,
    CwInputOtp,
    CwInputOtpGroup,
    CwInputOtpSeparator,
    CwInputOtpSlot,
    CwTab,
    CwTabPanel,
    CwTabs,
    CwTabsList,
    FormField,
    CwSkeleton,
    NgIcon,
    RouterLink,
  ],
  templateUrl: './two-step-page.component.html',
})
export class TwoStepPage implements OnInit {
  // #region Properties
  /**
   * Property flow
   *
   * @description
   * Flow state holding the challenge.
   *
   * @type {AuthFlowStore}
   * @readonly
   */
  protected readonly flow: AuthFlowStore = inject(AuthFlowStore);

  /**
   * Property router
   *
   * @description
   * Opens the next screen.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property destroyRef
   *
   * @description
   * Keeps a late answer from navigating after the page closed.
   *
   * @type {DestroyRef}
   * @readonly
   */
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /**
   * Property selected
   *
   * @description
   * Method chosen by the person, or empty for the account's first method.
   *
   * @type {WritableSignal<string>}
   * @readonly
   */
  protected readonly selected: WritableSignal<string> = signal('');

  /**
   * Property shown
   *
   * @description
   * The challenge the screen shows. It stays once the flow drops an expired challenge, so the
   * screen keeps its frame and explains the expiry instead of falling back to its skeleton.
   *
   * @type {WritableSignal<TwoStepChallenge | null>}
   * @readonly
   */
  protected readonly shown: WritableSignal<TwoStepChallenge | null> = signal(null);

  /**
   * Property method
   *
   * @description
   * The method of the active tab.
   *
   * @type {Signal<TwoStepMethod>}
   * @readonly
   */
  protected readonly method: Signal<TwoStepMethod> = computed(() => {
    const methods: readonly TwoStepMethod[] = this.shown()?.methods ?? [];
    const chosen: TwoStepMethod | undefined = methods.find(
      (item: TwoStepMethod) => item === this.selected(),
    );
    return chosen ?? methods.at(0) ?? 'authenticator-app';
  });

  /**
   * Property model
   *
   * @description
   * Values of the code tabs.
   *
   * @type {WritableSignal<TwoStepModel>}
   * @readonly
   */
  private readonly model: WritableSignal<TwoStepModel> = signal({
    appCode: '',
    backupCode: '',
    trustDevice: false,
  });

  /**
   * Property twoStepForm
   *
   * @description
   * The code tabs: six digits, or eight letters and digits with an optional dash.
   *
   * @type {FieldTree<TwoStepModel>}
   * @readonly
   */
  protected readonly twoStepForm: FieldTree<TwoStepModel> = form(this.model, (path) => {
    required(path.appCode);
    pattern(path.appCode, /^\d{6}$/u);
    required(path.backupCode);
    pattern(path.backupCode, /^[A-Z0-9]{4}-?[A-Z0-9]{4}$/u);
  });

  /**
   * Property filled
   *
   * @description
   * Digits typed in the application tab, for « Vérifier (n / 6) ».
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly filled: Signal<number> = computed(() => this.model().appCode.length);

  /**
   * Property busy
   *
   * @description
   * Whether an answer is being checked.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly busy: WritableSignal<boolean> = signal(false);

  /**
   * Property problem
   *
   * @description
   * Refusal of the last answer.
   *
   * @type {WritableSignal<AuthProblem | null>}
   * @readonly
   */
  protected readonly problem: WritableSignal<AuthProblem | null> = signal(null);

  /**
   * Property expired
   *
   * @description
   * Whether the challenge expired: the answers give way to « Se reconnecter » (`/login`).
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly expired: Signal<boolean> = computed(
    () => this.problem()?.code === 'auth.challenge-expired',
  );

  /**
   * Property message
   *
   * @description
   * The alert of the refusal.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  protected readonly message: Signal<string | null> = computed(() => {
    const problem: AuthProblem | null = this.problem();
    if (problem === null) return null;
    switch (problem.code) {
      case 'auth.two-step-code-invalid':
        return $localize`:@@auth.two-step.code-invalid:Wrong code. Check the code of your app.`;
      case 'auth.security-key-refused':
        return $localize`:@@auth.two-step.key-refused:This key was not recognized.`;
      case 'auth.two-step-locked':
        return $localize`:@@auth.two-step.locked:Too many attempts. Try again later.`;
      case 'auth.challenge-expired':
        return $localize`:@@auth.two-step.expired:The verification expired. Sign in again.`;
      default:
        return problem.status === 0 && this.method() === 'security-key'
          ? $localize`:@@auth.two-step.key-refused:This key was not recognized.`
          : $localize`:@@auth.login.unavailable:Sign-in is unavailable. Try again in a moment.`;
    }
  });

  /**
   * Property descriptions
   *
   * @description
   * Lead of each tab.
   *
   * @type {Readonly<Record<TwoStepMethod, string>>}
   * @readonly
   */
  protected readonly descriptions: Readonly<Record<TwoStepMethod, string>> = {
    'authenticator-app': $localize`:@@auth.two-step.lead-app:Enter the 6-digit code shown by your authenticator app.`,
    'security-key': $localize`:@@auth.two-step.lead-key:Use a security key or the biometrics registered on this account (WebAuthn).`,
    'backup-code': $localize`:@@auth.two-step.lead-backup:Enter one of your backup codes. Each code works only once.`,
  };

  /**
   * Property labels
   *
   * @description
   * Tab labels.
   *
   * @type {Readonly<Record<TwoStepMethod, string>>}
   * @readonly
   */
  protected readonly labels: Readonly<Record<TwoStepMethod, string>> = {
    'authenticator-app': $localize`:@@auth.two-step.tab-app:App`,
    'security-key': $localize`:@@auth.two-step.tab-key:Security key`,
    'backup-code': $localize`:@@auth.two-step.tab-backup:Backup code`,
  };

  /**
   * Property icons
   *
   * @description
   * Tab icons.
   *
   * @type {Readonly<Record<TwoStepMethod, string>>}
   * @readonly
   */
  protected readonly icons: Readonly<Record<TwoStepMethod, string>> = {
    'authenticator-app': 'phosphorDeviceMobileBold',
    'security-key': 'phosphorKeyBold',
    'backup-code': 'phosphorLifebuoyBold',
  };
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Drops the challenge when the person leaves the screen without answering it, so a stale
   * challenge never comes back on a later visit.
   *
   * @constructor
   */
  public constructor() {
    this.destroyRef.onDestroy(() => {
      this.flow.cancelChallenge();
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method ngOnInit
   *
   * @description
   * Makes the challenge available, or returns to `/login` when none is pending.
   */
  public ngOnInit(): void {
    void this.start();
  }

  /**
   * Method start
   *
   * @description
   * Runs the asynchronous part of the page's start.
   *
   * @returns {Promise<void>} Resolves once handled.
   */
  private async start(): Promise<void> {
    const pending: boolean = await this.flow.loadChallenge();
    if (this.destroyRef.destroyed) return;
    if (pending) {
      this.shown.set(this.flow.challenge());
    } else {
      await this.router.navigateByUrl('/login', { replaceUrl: true });
    }
  }

  /**
   * Method keys
   *
   * @description
   * The registered keys as one list.
   *
   * @param {TwoStepChallenge} challenge - The challenge.
   * @returns {string} The names, comma separated.
   */
  protected keys(challenge: TwoStepChallenge): string {
    return challenge.securityKeys.join(', ');
  }

  /**
   * Method formatBackup
   *
   * @description
   * Keeps letters and digits in capitals and inserts the dash after four, as the mockup does.
   */
  protected formatBackup(): void {
    const raw: string = this.model()
      .backupCode.toUpperCase()
      .replace(/[^A-Z0-9]/gu, '')
      .slice(0, 8);
    const formatted: string = raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
    if (formatted !== this.model().backupCode) {
      this.model.update((value: TwoStepModel) => ({ ...value, backupCode: formatted }));
    }
  }

  /**
   * Method verifyApp
   *
   * @description
   * Answers with the application code.
   *
   * @param {Event} event - The submit event.
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async verifyApp(event: Event): Promise<void> {
    event.preventDefault();
    await this.submitCode(this.twoStepForm.appCode, () => ({
      method: 'authenticator-app',
      code: this.model().appCode,
    }));
  }

  /**
   * Method verifyBackup
   *
   * @description
   * Answers with a backup code.
   *
   * @param {Event} event - The submit event.
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async verifyBackup(event: Event): Promise<void> {
    event.preventDefault();
    await this.submitCode(this.twoStepForm.backupCode, () => ({
      method: 'backup-code',
      code: this.model().backupCode,
    }));
  }

  /**
   * Method useKey
   *
   * @description
   * Answers with a security key.
   *
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async useKey(): Promise<void> {
    await this.answer({ method: 'security-key' });
  }

  /**
   * Method useAnotherAccount
   *
   * @description
   * Drops the challenge and returns to `/login`.
   *
   * @returns {Promise<void>} Resolves once navigated.
   */
  protected async useAnotherAccount(): Promise<void> {
    this.flow.cancelChallenge();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  /**
   * Method submitCode
   *
   * @description
   * Submits one code field: an invalid field gets focus, a refused code is cleared and focused.
   *
   * @param {FieldTree<string>} field - The code field.
   * @param {() => ChallengeAnswer} answer - Builds the answer from the model.
   * @returns {Promise<void>} Resolves once handled.
   */
  private async submitCode(field: FieldTree<string>, answer: () => ChallengeAnswer): Promise<void> {
    await submit(field, {
      action: async () => {
        await this.answer(answer());
        return undefined;
      },
      onInvalid: () => {
        focusFirstError(field);
      },
    });
    if (this.problem() !== null && !this.destroyRef.destroyed) {
      field().value.set('');
      field().focusBoundControl();
    }
  }

  /**
   * Method answer
   *
   * @description
   * Sends the answer; a session opens its destination.
   *
   * @param {ChallengeAnswer} answer - The method and its code.
   * @returns {Promise<void>} Resolves once handled.
   */
  private async answer(answer: ChallengeAnswer): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.problem.set(null);
    const result: SessionResult = await this.flow.answerChallenge(answer, this.model().trustDevice);
    this.busy.set(false);
    if (result.kind === 'failed') {
      this.problem.set(result.problem);
      return;
    }
    if (result.kind === 'signed-in' && !this.destroyRef.destroyed) {
      await this.router.navigateByUrl(result.destination, { replaceUrl: true });
    }
  }
  // #endregion
}
