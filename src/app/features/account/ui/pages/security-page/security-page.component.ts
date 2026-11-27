import { Dialog, type DialogRef } from '@angular/cdk/dialog';
import { DatePipe, DOCUMENT, formatDate } from '@angular/common';
import {
  Component,
  computed,
  ElementRef,
  inject,
  LOCALE_ID,
  type Signal,
  signal,
  type WritableSignal,
} from '@angular/core';
import {
  CwAlertDialog,
  CwAlertDialogAction,
  CwAlertDialogCancel,
  CwAlertDialogDescription,
  CwAlertDialogMedia,
  CwAlertDialogTitle,
} from '@cadenway/ui/components/alert-dialog';
import { CwButton } from '@cadenway/ui/components/button';
import { CwCard, CwCardContent } from '@cadenway/ui/components/card';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { type CwToastAction, CwToastService } from '@cadenway/ui/components/toast';
import { NgIcon } from '@ng-icons/core';
import { take } from 'rxjs';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';
import { type UnsavedChanges, warnBeforeUnload } from '@shared/unsaved-changes';

import type { AccountSession } from '../../../models/session/session.interface';
import type {
  BackupCodesOutcome,
  DisableOutcome,
  PasswordChangeOutcome,
  RemovalOutcome,
  RevokeOthersOutcome,
  SecurityAction,
  SecurityKeyAddOutcome,
  SecurityOverview,
  SetupConfirmOutcome,
  SetupStartOutcome,
} from '../../../models/two-step/security-overview.interface';
import type { BackupCodeSet, SecurityKey } from '../../../models/two-step/two-step.interface';
import { SecurityStore } from '../../../state/security/security.store';
import { SessionsList } from '../../components/sessions-list/sessions-list.component';
import {
  type CardOrganization,
  TwoStepCard,
} from '../../components/two-step-card/two-step-card.component';
import { AuthenticatorSetupDialog } from '../../dialogs/authenticator-setup-dialog/authenticator-setup-dialog.component';
import { BackupCodesDialog } from '../../dialogs/backup-codes-dialog/backup-codes-dialog.component';
import {
  type PasswordChangeDraft,
  PasswordChangeDialog,
  type PasswordRefusal,
} from '../../dialogs/password-change-dialog/password-change-dialog.component';
import { SecurityKeyNameDialog } from '../../dialogs/security-key-name-dialog/security-key-name-dialog.component';

/**
 * Type Confirmation
 *
 * @description
 * What the confirmation dialog asks about: turning two-step verification off, removing a key,
 * revoking a session or closing the other sessions.
 *
 * @type {{ readonly kind: 'disable' | 'revoke-others' } | { readonly kind: 'remove-key'; readonly key: SecurityKey } | { readonly kind: 'revoke'; readonly session: AccountSession }}
 */
type Confirmation =
  | { readonly kind: 'disable' | 'revoke-others' }
  | { readonly kind: 'remove-key'; readonly key: SecurityKey }
  | { readonly kind: 'revoke'; readonly session: AccountSession };

/**
 * Constant CONFIRMED_ACTIONS
 *
 * @description
 * The writes the confirmation dialog starts, whose spinner it shows.
 *
 * @type {ReadonlySet<SecurityAction>}
 */
const CONFIRMED_ACTIONS: ReadonlySet<SecurityAction> = new Set<SecurityAction>([
  'disable',
  'remove-key',
  'revoke',
  'revoke-others',
]);

/**
 * Component SecurityPage
 *
 * @description
 * The account settings section `Security and sign-in` (`Compte.dc.html` lines 267-353). It
 * provides `SecurityStore`, whose read is the page's primary read: the section skeleton shows
 * while it loads, and a failed read reaches the route's error boundary (with `Retry`) through the
 * template's read of `overview()`. Three cards follow the header:
 * - `Password`, with the date it was set and `Change password`, which opens
 *   `PasswordChangeDialog`; the refusals of the gateway show on their field, and a change toasts
 *   `Password changed` with the account's address.
 * - `TwoStepCard`: `Turn on` and `Reconfigure` start the authenticator setup (through the
 *   reauthentication) and open `AuthenticatorSetupDialog` on its key; the first backup codes show
 *   once at its step 3. `Generate new codes` opens `BackupCodesDialog`. `Add a key` (hidden
 *   without WebAuthn) opens `SecurityKeyNameDialog`, then the browser's prompt. `Turn off`,
 *   `Remove` and the sessions' `Revoke` and `Sign out the others` ask through one
 *   `cw-alert-dialog`.
 * - `SessionsList`.
 * The mockup's `Sign-in providers` card is not rendered: the contract has no linked providers yet
 * (gap B8). Copying writes to the clipboard and toasts (`Copy failed` when it refuses);
 * downloading saves `cadenway-backup-codes.txt` with a header naming the account. The key and the
 * codes live in page signals only while their dialog shows, and are forgotten once it has left;
 * they never reach a toast, the store or a log. Leaving the page waits for a write on its way
 * (`unsavedChangesGuard`), then stays while backup codes show, so they are not lost; the browser
 * asks before closing the tab meanwhile.
 */
@Component({
  selector: 'cw-account-security-page',
  imports: [
    AuthenticatorSetupDialog,
    BackupCodesDialog,
    CwAlertDialog,
    CwAlertDialogAction,
    CwAlertDialogCancel,
    CwAlertDialogDescription,
    CwAlertDialogMedia,
    CwAlertDialogTitle,
    CwButton,
    CwCard,
    CwCardContent,
    CwSkeleton,
    DatePipe,
    NgIcon,
    PasswordChangeDialog,
    SecurityKeyNameDialog,
    SessionsList,
    TwoStepCard,
  ],
  providers: [SecurityStore],
  templateUrl: './security-page.component.html',
})
export class SecurityPage implements UnsavedChanges {
  // #region Properties
  /**
   * Property store
   *
   * @description
   * The section's read and writes.
   *
   * @type {InstanceType<typeof SecurityStore>}
   * @readonly
   */
  protected readonly store: InstanceType<typeof SecurityStore> = inject(SecurityStore);

  /**
   * Property workspace
   *
   * @description
   * The workspace, for the organization the two-step card names.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  private readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property toasts
   *
   * @description
   * The settings shell's toaster.
   *
   * @type {CwToastService}
   * @readonly
   */
  private readonly toasts: CwToastService = inject(CwToastService);

  /**
   * Property document
   *
   * @description
   * Document whose window holds the clipboard and the download link.
   *
   * @type {Document}
   * @readonly
   */
  private readonly document: Document = inject(DOCUMENT);

  /**
   * Property locale
   *
   * @description
   * Application locale of the dates.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);

  /**
   * Property organization
   *
   * @description
   * The workspace organization.
   *
   * @type {Signal<CardOrganization>}
   * @readonly
   */
  protected readonly organization: Signal<CardOrganization> = computed((): CardOrganization => ({
    id: this.workspace.organization().id,
    name: this.workspace.organization().name,
  }));

  /**
   * Property busy
   *
   * @description
   * Whether a write of the section runs.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly busy: Signal<boolean> = computed((): boolean => this.store.busy() !== null);

  /**
   * Property passwordOpen
   *
   * @description
   * Whether the password dialog is open.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly passwordOpen: WritableSignal<boolean> = signal(false);

  /**
   * Property passwordFailure
   *
   * @description
   * The gateway's refusal of the last password change, or null.
   *
   * @type {WritableSignal<PasswordRefusal | null>}
   * @readonly
   */
  protected readonly passwordFailure: WritableSignal<PasswordRefusal | null> = signal(null);

  /**
   * Property setupOpen
   *
   * @description
   * Whether the authenticator setup dialog is open.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly setupOpen: WritableSignal<boolean> = signal(false);

  /**
   * Property setupSecret
   *
   * @description
   * The key of the pending setup, held while its dialog shows.
   *
   * @type {WritableSignal<string | null>}
   * @readonly
   */
  protected readonly setupSecret: WritableSignal<string | null> = signal(null);

  /**
   * Property setupCodes
   *
   * @description
   * The first backup codes, held while the setup dialog shows them.
   *
   * @type {WritableSignal<BackupCodeSet | null>}
   * @readonly
   */
  protected readonly setupCodes: WritableSignal<BackupCodeSet | null> = signal(null);

  /**
   * Property setupCodeFailure
   *
   * @description
   * Whether the gateway refused the last code of the setup.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly setupCodeFailure: WritableSignal<boolean> = signal(false);

  /**
   * Property backupOpen
   *
   * @description
   * Whether the new backup codes dialog is open.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly backupOpen: WritableSignal<boolean> = signal(false);

  /**
   * Property backupCodes
   *
   * @description
   * The new backup codes, held while their dialog shows.
   *
   * @type {WritableSignal<BackupCodeSet | null>}
   * @readonly
   */
  protected readonly backupCodes: WritableSignal<BackupCodeSet | null> = signal(null);

  /**
   * Property backupReplaced
   *
   * @description
   * How many unused codes the new ones replaced.
   *
   * @type {WritableSignal<number>}
   * @readonly
   */
  protected readonly backupReplaced: WritableSignal<number> = signal(0);

  /**
   * Property keyNameOpen
   *
   * @description
   * Whether the key name dialog is open.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly keyNameOpen: WritableSignal<boolean> = signal(false);

  /**
   * Property confirmOpen
   *
   * @description
   * Whether the confirmation dialog is open.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly confirmOpen: WritableSignal<boolean> = signal(false);

  /**
   * Property confirmation
   *
   * @description
   * What the confirmation asks about; kept after it closes so its exit animation keeps the text.
   *
   * @type {WritableSignal<Confirmation | null>}
   * @readonly
   */
  protected readonly confirmation: WritableSignal<Confirmation | null> = signal(null);

  /**
   * Property confirming
   *
   * @description
   * Whether the confirmed write is under way.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly confirming: Signal<boolean> = computed((): boolean => {
    const action: SecurityAction | null = this.store.busy();
    return action !== null && CONFIRMED_ACTIONS.has(action);
  });

  /**
   * Property dialogs
   *
   * @description
   * The CDK dialogs under `cw-alert-dialog`, watched to learn when the confirmation has closed and
   * given focus back, since the brick reports no such moment.
   *
   * @type {Dialog}
   * @readonly
   */
  private readonly dialogs: Dialog = inject(Dialog);

  /**
   * Property host
   *
   * @description
   * The page's element, where focus moves after a removal.
   *
   * @type {ElementRef<HTMLElement>}
   * @readonly
   */
  private readonly host: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * Property confirmRef
   *
   * @description
   * The open confirmation, or null.
   *
   * @type {DialogRef | null}
   */
  private confirmRef: DialogRef | null = null;

  /**
   * Property codesDelivery
   *
   * @description
   * The page's own generation or confirmation in progress, which may bring backup codes to show
   * once; leaving waits for it once its write is settled.
   *
   * @type {Promise<void> | null}
   */
  private codesDelivery: Promise<void> | null = null;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Asks the browser to confirm closing the tab while a write is on its way or codes show.
   *
   * @constructor
   */
  public constructor() {
    warnBeforeUnload((): boolean => this.hasUnsavedChanges());
  }
  // #endregion

  // #region Methods
  /**
   * Method hasUnsavedChanges
   *
   * @description
   * Whether leaving now could lose something: a write on its way, a generation or confirmation
   * that may bring backup codes, or backup codes shown once.
   *
   * @returns {boolean} Whether to hold the navigation.
   */
  public hasUnsavedChanges(): boolean {
    return (
      this.store.sending() ||
      this.codesDelivery !== null ||
      this.setupCodes() !== null ||
      this.backupCodes() !== null
    );
  }

  /**
   * Method confirmDiscard
   *
   * @description
   * Waits for the write on its way, then for the page to receive what it brought: backup codes
   * reach the page only after the store settled the write. It then lets the person leave unless
   * backup codes show. A write that waits only for the reauthentication dialog sent nothing; it
   * is not waited for, and leaving abandons it.
   *
   * @returns {Promise<boolean>} Whether to leave.
   */
  public async confirmDiscard(): Promise<boolean> {
    if (this.store.sending()) await this.store.sent();
    const delivery: Promise<void> | null = this.codesDelivery;
    if (delivery !== null && this.store.busy() === null) await delivery;
    return this.setupCodes() === null && this.backupCodes() === null;
  }

  /**
   * Method changedToday
   *
   * @description
   * Whether a moment falls on today's local date.
   *
   * @param {string} moment - The moment (ISO 8601).
   * @returns {boolean} Whether it is today.
   */
  protected changedToday(moment: string): boolean {
    return new Date(moment).toDateString() === new Date().toDateString();
  }

  /**
   * Method openPassword
   *
   * @description
   * `Change password`.
   */
  protected openPassword(): void {
    this.passwordFailure.set(null);
    this.passwordOpen.set(true);
  }

  /**
   * Method changePassword
   *
   * @description
   * Sends the dialog's passwords; a change closes it and toasts, a refusal of the contract shows
   * on its field, another failure toasts and keeps the dialog.
   *
   * @param {PasswordChangeDraft} draft - The passwords.
   * @returns {Promise<void>} Resolves once settled.
   */
  protected async changePassword(draft: PasswordChangeDraft): Promise<void> {
    this.passwordFailure.set(null);
    const outcome: PasswordChangeOutcome = await this.store.changePassword(
      draft.currentPassword,
      draft.newPassword,
    );
    switch (outcome.kind) {
      case 'saved': {
        this.passwordOpen.set(false);
        const email: string = this.store.overview()?.email ?? '';
        this.toasts.success($localize`:@@account.security.password-changed:Password changed`, {
          description: $localize`:@@account.security.password-changed-text:A confirmation email was just sent to ${email}:email:.`,
        });
        return;
      }
      case 'password-incorrect':
      case 'password-too-short':
      case 'password-compromised':
      case 'locked':
        this.passwordFailure.set(outcome);
        return;
      case 'unconfirmed':
        this.passwordOpen.set(false);
        this.warnUntilClosed(
          $localize`:@@account.security.password-unconfirmed:The password change could not be confirmed`,
          {
            description: $localize`:@@account.security.password-unconfirmed-text:Reload the page to see whether your password changed before you try again.`,
          },
        );
        return;
      case 'failed':
        this.toasts.error(
          $localize`:@@account.security.password-failed:Could not change the password`,
          { description: this.tryAgain() },
        );
        return;
      default:
        return;
    }
  }

  /**
   * Method startSetup
   *
   * @description
   * `Turn on` or `Reconfigure`: starts the setup, then opens its dialog on the key.
   *
   * @returns {Promise<void>} Resolves once settled.
   */
  protected async startSetup(): Promise<void> {
    const outcome: SetupStartOutcome = await this.store.startSetup();
    if (outcome.kind === 'started') {
      this.setupSecret.set(outcome.setup.secret);
      this.setupCodes.set(null);
      this.setupCodeFailure.set(false);
      this.setupOpen.set(true);
    } else if (outcome.kind === 'failed') {
      this.toasts.error($localize`:@@account.security.setup-failed:Could not start the setup`, {
        description: this.tryAgain(),
      });
    }
  }

  /**
   * Method confirmCode
   *
   * @description
   * Sends the setup's code. Turning two-step verification on moves the dialog to its codes; a
   * reconfiguration closes it and toasts; an expired setup closes it and says to start again.
   *
   * @param {string} code - The 6 digits.
   * @returns {Promise<void>} Resolves once settled.
   */
  protected confirmCode(code: string): Promise<void> {
    return this.deliverCodes(async (): Promise<void> => {
      this.setupCodeFailure.set(false);
      this.confirmed(await this.store.confirmSetup(code));
    });
  }

  /**
   * Method confirmed
   *
   * @description
   * Shows how the setup's code ended. A lost answer that turned two-step verification on brought
   * codes that were never shown: the dialog closes and a warning offers `Generate new codes`.
   *
   * @param {SetupConfirmOutcome} outcome - The outcome.
   */
  private confirmed(outcome: SetupConfirmOutcome): void {
    switch (outcome.kind) {
      case 'confirmed':
        if (outcome.backupCodes !== null) {
          this.setupCodes.set(outcome.backupCodes);
          return;
        }
        this.setupOpen.set(false);
        this.toasts.success(
          $localize`:@@account.security.app-replaced:Authenticator app replaced`,
          {
            description: $localize`:@@account.security.app-replaced-text:Codes from the previous app no longer work.`,
          },
        );
        return;
      case 'code-invalid':
        this.setupCodeFailure.set(true);
        return;
      case 'expired':
        this.setupOpen.set(false);
        this.toasts.error($localize`:@@account.security.setup-expired:The setup expired`, {
          description: $localize`:@@account.security.setup-expired-text:Start the setup again.`,
        });
        return;
      case 'enabled-without-codes':
        this.setupOpen.set(false);
        this.warnUntilClosed(
          $localize`:@@account.security.two-step-enabled-unseen:Two-step verification is on`,
          {
            description: $localize`:@@account.security.two-step-enabled-unseen-text:Its backup codes could not be shown: generate new ones to keep a set offline.`,
            action: this.generateAction(),
          },
        );
        return;
      case 'unconfirmed':
        this.setupOpen.set(false);
        this.warnUntilClosed(
          $localize`:@@account.security.setup-unconfirmed:The setup could not be confirmed`,
          {
            description: $localize`:@@account.security.setup-unconfirmed-text:Reload the page to check it. If two-step verification is on, generate new backup codes.`,
          },
        );
        return;
      case 'failed':
        this.toasts.error(
          $localize`:@@account.security.setup-confirm-failed:Could not check the code`,
          {
            description: this.tryAgain(),
          },
        );
        return;
      default:
        return;
    }
  }

  /**
   * Method closeSetup
   *
   * @description
   * Closes the setup dialog; once its codes showed, two-step verification is on and a toast says
   * so.
   */
  protected closeSetup(): void {
    if (!this.setupOpen()) return;
    this.setupOpen.set(false);
    if (this.setupCodes() !== null) {
      this.toasts.success(
        $localize`:@@account.security.two-step-enabled:Two-step verification enabled`,
        {
          description: $localize`:@@account.security.two-step-enabled-text:You will be asked for it at your next sign-in.`,
        },
      );
    }
  }

  /**
   * Method forgetSetup
   *
   * @description
   * Forgets the key and the codes once the setup dialog has left the screen.
   */
  protected forgetSetup(): void {
    this.setupSecret.set(null);
    this.setupCodes.set(null);
    this.setupCodeFailure.set(false);
  }

  /**
   * Method copyKey
   *
   * @description
   * `Copy the key`, without spaces.
   *
   * @returns {Promise<void>} Resolves once the clipboard answered.
   */
  protected async copyKey(): Promise<void> {
    const secret: string | null = this.setupSecret();
    if (secret === null) return;
    await this.copy(
      secret,
      $localize`:@@account.security.key-copied:Key copied`,
      $localize`:@@account.security.key-copied-text:Paste it into your authenticator app.`,
    );
  }

  /**
   * Method copyCodes
   *
   * @description
   * `Copy`: the codes, one per line.
   *
   * @param {BackupCodeSet | null} codes - The codes shown.
   * @returns {Promise<void>} Resolves once the clipboard answered.
   */
  protected async copyCodes(codes: BackupCodeSet | null): Promise<void> {
    if (codes === null) return;
    await this.copy(
      codes.codes.join('\n'),
      $localize`:@@account.security.codes-copied:Codes copied`,
      $localize`:@@account.security.codes-copied-text:Paste them into your password manager.`,
    );
  }

  /**
   * Method downloadCodes
   *
   * @description
   * Saves the codes as a text file and toasts whether it worked.
   *
   * @param {BackupCodeSet | null} codes - The codes shown.
   * @returns {boolean} Whether the file was saved.
   */
  protected downloadCodes(codes: BackupCodeSet | null): boolean {
    if (codes === null) return false;
    const file: string = $localize`:@@account.security.codes-file:cadenway-backup-codes.txt`;
    const email: string = this.store.overview()?.email ?? '';
    const date: string = formatDate(codes.generatedAt, 'longDate', this.locale);
    const text: string = [
      $localize`:@@account.security.codes-file-title:Cadenway · backup codes`,
      $localize`:@@account.security.codes-file-account:Account: ${email}:email:`,
      $localize`:@@account.security.codes-file-generated:Generated on ${date}:date:. Each code works only once.`,
      '',
      ...codes.codes,
      '',
    ].join('\r\n');
    if (this.download(file, text)) {
      this.toasts.success($localize`:@@account.security.codes-saved:Backup codes saved`, {
        description: $localize`:@@account.security.codes-saved-text:File ${file}:file: downloaded.`,
      });
      return true;
    }
    this.toasts.error($localize`:@@account.security.codes-download-failed:Download failed`, {
      description: $localize`:@@account.security.codes-download-failed-text:Copy the codes and keep them offline.`,
    });
    return false;
  }

  /**
   * Method generateCodes
   *
   * @description
   * `Generate new codes`: replaces the codes, then opens their dialog.
   *
   * @returns {Promise<void>} Resolves once settled.
   */
  protected generateCodes(): Promise<void> {
    return this.deliverCodes(async (): Promise<void> => {
      const outcome: BackupCodesOutcome = await this.store.regenerateBackupCodes();
      switch (outcome.kind) {
        case 'generated':
          this.backupCodes.set(outcome.codes);
          this.backupReplaced.set(outcome.replaced);
          this.backupOpen.set(true);
          return;
        case 'codes-unseen':
          this.warnUntilClosed(
            $localize`:@@account.security.codes-unseen:New backup codes were not shown`,
            {
              description: $localize`:@@account.security.codes-unseen-text:Your previous codes no longer work: generate new ones to keep a set offline.`,
              action: this.generateAction(),
            },
          );
          return;
        case 'unconfirmed':
          this.warnUntilClosed(
            $localize`:@@account.security.codes-unconfirmed:Your backup codes may have changed`,
            {
              description: $localize`:@@account.security.codes-unconfirmed-text:Generate new codes to be sure you keep a set that works.`,
              action: this.generateAction(),
            },
          );
          return;
        case 'failed':
        case 'not-enabled':
          this.toasts.error(
            $localize`:@@account.security.codes-failed:Could not generate new codes`,
            { description: this.tryAgain() },
          );
          return;
        default:
          return;
      }
    });
  }

  /**
   * Method generateAction
   *
   * @description
   * The `Generate new codes` action of a warning about backup codes that were not shown.
   *
   * @returns {{ readonly label: string; readonly run: () => void }} The action.
   */
  private generateAction(): { readonly label: string; readonly run: () => void } {
    return {
      label: $localize`:@@account.security.backup-generate:Generate new codes`,
      run: (): void => {
        void this.generateCodes();
      },
    };
  }

  /**
   * Method deliverCodes
   *
   * @description
   * Runs a write that may bring backup codes and remembers it until it settled, so leaving the
   * page waits for its codes to show.
   *
   * @param {() => Promise<void>} work - The write and what the page does with its outcome.
   * @returns {Promise<void>} Resolves once settled.
   */
  private deliverCodes(work: () => Promise<void>): Promise<void> {
    const delivery: Promise<void> = work().finally((): void => {
      if (this.codesDelivery === delivery) this.codesDelivery = null;
    });
    this.codesDelivery = delivery;
    return delivery;
  }

  /**
   * Method downloadAndClose
   *
   * @description
   * `Download and close`: closes the dialog once the file is saved.
   */
  protected downloadAndClose(): void {
    if (this.downloadCodes(this.backupCodes())) this.backupOpen.set(false);
  }

  /**
   * Method closeBackup
   *
   * @description
   * Closes the new codes dialog.
   */
  protected closeBackup(): void {
    this.backupOpen.set(false);
  }

  /**
   * Method forgetBackup
   *
   * @description
   * Forgets the codes once their dialog has left the screen.
   */
  protected forgetBackup(): void {
    this.backupCodes.set(null);
  }

  /**
   * Method registerKey
   *
   * @description
   * Registers a key under the name typed; an added key closes the dialog and toasts, a closed
   * prompt or reauthentication keeps it open silently, a refusal toasts why.
   *
   * @param {string} name - The trimmed name.
   * @returns {Promise<void>} Resolves once settled.
   */
  protected async registerKey(name: string): Promise<void> {
    const outcome: SecurityKeyAddOutcome = await this.store.addSecurityKey(name);
    const title: string = $localize`:@@account.security.key-failed:Key not registered`;
    switch (outcome.kind) {
      case 'added':
        this.keyNameOpen.set(false);
        this.toasts.success($localize`:@@account.security.key-added:Security key added`, {
          description: $localize`:@@account.security.key-added-text:It can be used from your next sign-in.`,
        });
        return;
      case 'refused':
        this.toasts.error(title, {
          description: $localize`:@@account.security.key-refused:This key is already registered or did not answer correctly.`,
        });
        return;
      case 'expired':
        this.toasts.error(title, {
          description: $localize`:@@account.security.key-expired:The registration took too long: try again.`,
        });
        return;
      case 'limit-reached':
        this.keyNameOpen.set(false);
        this.toasts.error(title, {
          description: $localize`:@@account.security.key-limit:You already have 10 keys: remove one first.`,
        });
        return;
      case 'unconfirmed':
        this.keyNameOpen.set(false);
        this.warnUntilClosed(
          $localize`:@@account.security.key-unconfirmed:The new key could not be confirmed`,
          {
            description: $localize`:@@account.security.key-unconfirmed-text:Reload the page to see whether it was added.`,
          },
        );
        return;
      case 'not-enabled':
      case 'failed':
        this.toasts.error(title, { description: this.tryAgain() });
        return;
      default:
        return;
    }
  }

  /**
   * Method ask
   *
   * @description
   * Opens the confirmation for a write.
   *
   * @param {Confirmation} confirmation - What it asks about.
   */
  protected ask(confirmation: Confirmation): void {
    this.confirmation.set(confirmation);
    this.confirmRef = null;
    this.dialogs.afterOpened.pipe(take(1)).subscribe((ref: DialogRef): void => {
      this.confirmRef = ref;
    });
    this.confirmOpen.set(true);
  }

  /**
   * Method confirm
   *
   * @description
   * Runs the confirmed write, then closes the confirmation whatever the gateway answered, and
   * toasts the result. A closed reauthentication dialog closes it silently. Once a removed key or
   * a revoked session left and the confirmation closed, focus moves to the action now at its
   * place (or the one before it), otherwise to its card's header action (`Add a key`, or the
   * card's own button; the sessions card's title when `Sign out the others` is disabled).
   *
   * @returns {Promise<void>} Resolves once settled.
   */
  protected async confirm(): Promise<void> {
    const confirmation: Confirmation | null = this.confirmation();
    if (confirmation === null) return;
    const overview: SecurityOverview | undefined = this.store.overview();
    let focus: (() => void) | null = null;
    switch (confirmation.kind) {
      case 'disable':
        this.disabled(await this.store.disable());
        break;
      case 'remove-key': {
        const index: number = (overview?.twoStep.securityKeys ?? []).findIndex(
          (key: SecurityKey): boolean => key.id === confirmation.key.id,
        );
        const outcome: RemovalOutcome = await this.store.removeSecurityKey(confirmation.key);
        this.removed(confirmation.key, outcome);
        if (outcome.kind === 'done') {
          focus = (): void => {
            this.focusAfter('remove-key', index, ['add-key', 'two-step-action']);
          };
        }
        break;
      }
      case 'revoke': {
        const index: number = (overview?.sessions ?? [])
          .filter((session: AccountSession): boolean => !session.current)
          .findIndex((session: AccountSession): boolean => session.id === confirmation.session.id);
        const outcome: RemovalOutcome = await this.store.revokeSession(confirmation.session);
        this.revoked(confirmation.session, outcome);
        if (outcome.kind === 'done') {
          focus = (): void => {
            this.focusAfter('revoke-session', index, ['sessions-revoke-others', 'sessions-title']);
          };
        }
        break;
      }
      case 'revoke-others': {
        const outcome: RevokeOthersOutcome = await this.store.revokeOtherSessions();
        this.revokedOthers(outcome);
        if (outcome.kind === 'done') {
          focus = (): void => {
            this.focusAfter('revoke-session', 0, ['sessions-revoke-others', 'sessions-title']);
          };
        }
        break;
      }
    }
    const ref: DialogRef | null = this.confirmRef;
    if (focus !== null && ref !== null) ref.closed.pipe(take(1)).subscribe(focus);
    this.confirmOpen.set(false);
  }

  /**
   * Method focusAfter
   *
   * @description
   * Gives focus to the enabled action of a list at a place (or the last one before it), else to
   * the first enabled fallback, in the page's own markup (`data-focus`).
   *
   * @param {string} action - The `data-focus` of the list's actions.
   * @param {number} index - Where the removed row was.
   * @param {readonly string[]} fallbacks - The `data-focus` of the fallbacks, in order.
   */
  private focusAfter(action: string, index: number, fallbacks: readonly string[]): void {
    const root: HTMLElement = this.host.nativeElement;
    const usable: (element: HTMLElement) => boolean = (element: HTMLElement): boolean =>
      !(element instanceof HTMLButtonElement && element.disabled);
    const actions: HTMLElement[] = [
      ...root.querySelectorAll<HTMLElement>(`[data-focus="${action}"]`),
    ].filter(usable);
    const target: HTMLElement | undefined =
      actions.length > 0
        ? actions[Math.min(Math.max(index, 0), actions.length - 1)]
        : fallbacks
            .map((name: string): HTMLElement | null =>
              root.querySelector<HTMLElement>(`[data-focus="${name}"]`),
            )
            .find(
              (element: HTMLElement | null): element is HTMLElement =>
                element !== null && usable(element),
            );
    target?.focus();
  }

  /**
   * Method deviceOf
   *
   * @description
   * The label of a session's device.
   *
   * @param {AccountSession} session - The session.
   * @returns {string} The label.
   */
  protected deviceOf(session: AccountSession): string {
    return session.device ?? $localize`:@@account.security.session-unknown-device:Unknown device`;
  }

  /**
   * Method confirmIcon
   *
   * @description
   * The icon of the confirmation.
   *
   * @param {Confirmation | null} asked - What it asks about.
   * @returns {string} The icon name.
   */
  protected confirmIcon(asked: Confirmation | null): string {
    switch (asked?.kind) {
      case 'disable':
        return 'phosphorShieldCheckBold';
      case 'remove-key':
        return 'phosphorKeyBold';
      default:
        return 'phosphorSignOutBold';
    }
  }

  /**
   * Method confirmTitle
   *
   * @description
   * The title of the confirmation, naming the key or the device it acts on.
   *
   * @param {Confirmation | null} asked - What it asks about.
   * @returns {string} The title.
   */
  protected confirmTitle(asked: Confirmation | null): string {
    switch (asked?.kind) {
      case 'disable':
        return $localize`:@@account.security.disable-title:Turn off two-step verification?`;
      case 'remove-key': {
        const name: string = asked.key.name;
        return $localize`:@@account.security.remove-key-title:Remove the key “${name}:name:”?`;
      }
      case 'revoke': {
        const device: string = this.deviceOf(asked.session);
        return $localize`:@@account.security.revoke-title:Sign out ${device}:device:?`;
      }
      default:
        return $localize`:@@account.security.revoke-others-title:Close the other sessions?`;
    }
  }

  /**
   * Method confirmDescription
   *
   * @description
   * The text of the confirmation.
   *
   * @param {Confirmation | null} asked - What it asks about.
   * @returns {string} The text.
   */
  protected confirmDescription(asked: Confirmation | null): string {
    switch (asked?.kind) {
      case 'disable':
        return $localize`:@@account.security.disable-description:Your authenticator app, security keys and backup codes will be deleted.`;
      case 'remove-key':
        return $localize`:@@account.security.remove-key-description:It will no longer be able to confirm your sign-ins.`;
      case 'revoke':
        return $localize`:@@account.security.revoke-description:This device will have to sign in again to access Cadenway.`;
      default:
        return $localize`:@@account.security.revoke-others-description:All your devices except this one will be signed out.`;
    }
  }

  /**
   * Method disabled
   *
   * @description
   * Toasts how turning two-step verification off ended.
   *
   * @param {DisableOutcome} outcome - The outcome.
   */
  private disabled(outcome: DisableOutcome): void {
    switch (outcome.kind) {
      case 'unconfirmed':
        this.warnUntilClosed(
          $localize`:@@account.security.two-step-disable-unconfirmed:Turning off could not be confirmed`,
          {
            description: $localize`:@@account.security.two-step-disable-unconfirmed-text:Reload the page to see whether two-step verification is still on.`,
          },
        );
        return;
      case 'disabled':
        this.toasts.success(
          $localize`:@@account.security.two-step-disabled:Two-step verification turned off`,
          {
            description: $localize`:@@account.security.two-step-disabled-text:Your account is now protected only by a password.`,
          },
        );
        return;
      case 'required':
        this.toasts.error(
          $localize`:@@account.security.two-step-still-required:Two-step verification is required`,
          {
            description: $localize`:@@account.security.two-step-still-required-text:An organization you belong to requires it, so it cannot be turned off.`,
          },
        );
        return;
      case 'failed':
        this.toasts.error(
          $localize`:@@account.security.two-step-disable-failed:Could not turn off two-step verification`,
          { description: this.tryAgain() },
        );
        return;
      default:
        return;
    }
  }

  /**
   * Method removed
   *
   * @description
   * Toasts how the removal of a key ended.
   *
   * @param {SecurityKey} key - The key.
   * @param {RemovalOutcome} outcome - The outcome.
   */
  private removed(key: SecurityKey, outcome: RemovalOutcome): void {
    if (outcome.kind === 'done') {
      const name: string = key.name;
      this.toasts.success($localize`:@@account.security.key-removed:Security key removed`, {
        description: $localize`:@@account.security.key-removed-text:${name}:name: can no longer confirm your sign-ins.`,
      });
    } else if (outcome.kind === 'unconfirmed') {
      this.warnUntilClosed(
        $localize`:@@account.security.key-remove-unconfirmed:The removal could not be confirmed`,
        {
          description: $localize`:@@account.security.key-remove-unconfirmed-text:Reload the page to see whether the key is still listed.`,
        },
      );
    } else if (outcome.kind === 'failed') {
      this.toasts.error($localize`:@@account.security.key-remove-failed:Could not remove the key`, {
        description: this.tryAgain(),
      });
    }
  }

  /**
   * Method revoked
   *
   * @description
   * Toasts how the revocation of a session ended.
   *
   * @param {AccountSession} session - The session.
   * @param {RemovalOutcome} outcome - The outcome.
   */
  private revoked(session: AccountSession, outcome: RemovalOutcome): void {
    if (outcome.kind === 'done') {
      const device: string = this.deviceOf(session);
      this.toasts.success($localize`:@@account.security.session-revoked:Session revoked`, {
        description: $localize`:@@account.security.session-revoked-text:${device}:device: is signed out.`,
      });
    } else if (outcome.kind === 'unconfirmed') {
      this.warnUntilClosed(
        $localize`:@@account.security.session-revoke-unconfirmed:The sign-out could not be confirmed`,
        {
          description: $localize`:@@account.security.session-revoke-unconfirmed-text:Reload the page to see whether the session is still open.`,
        },
      );
    } else if (outcome.kind === 'failed') {
      this.toasts.error(
        $localize`:@@account.security.session-revoke-failed:Could not revoke the session`,
        { description: this.tryAgain() },
      );
    }
  }

  /**
   * Method revokedOthers
   *
   * @description
   * Toasts how closing the other sessions ended.
   *
   * @param {RevokeOthersOutcome} outcome - The outcome.
   */
  private revokedOthers(outcome: RevokeOthersOutcome): void {
    if (outcome.kind === 'done') {
      const count: number = outcome.count;
      this.toasts.success(
        count === 1
          ? $localize`:@@account.security.sessions-closed-one:1 session closed`
          : $localize`:@@account.security.sessions-closed:${count}:count: sessions closed`,
        {
          description: $localize`:@@account.security.sessions-closed-text:Only this device stays signed in.`,
        },
      );
    } else if (outcome.kind === 'unconfirmed') {
      this.warnUntilClosed(
        $localize`:@@account.security.sessions-close-unconfirmed:Closing the sessions could not be confirmed`,
        {
          description: $localize`:@@account.security.sessions-close-unconfirmed-text:Reload the page to see which sessions are still open.`,
        },
      );
    } else if (outcome.kind === 'failed') {
      this.toasts.error(
        $localize`:@@account.security.sessions-close-failed:Could not close the other sessions`,
        { description: this.tryAgain() },
      );
    }
  }

  /**
   * Method warnUntilClosed
   *
   * @description
   * A warning about a write whose outcome stays unknown or whose codes were not shown. It stays
   * until the person closes it, so its recovery action (`Generate new codes`) is not lost.
   *
   * @param {string} title - The title.
   * @param {{ readonly description: string; readonly action?: CwToastAction }} options - Its text
   * and its action.
   */
  private warnUntilClosed(
    title: string,
    options: { readonly description: string; readonly action?: CwToastAction },
  ): void {
    this.toasts.warning(title, { ...options, duration: Infinity, closable: true });
  }

  /**
   * Method tryAgain
   *
   * @description
   * The description of a failure toast.
   *
   * @returns {string} The text.
   */
  private tryAgain(): string {
    return $localize`:@@account.security.try-again:Try again in a moment.`;
  }

  /**
   * Method copy
   *
   * @description
   * Writes a text to the clipboard and confirms it, or says the copy failed so the person
   * selects it by hand. The toasts never contain the text.
   *
   * @param {string} text - What to copy.
   * @param {string} title - The success toast's title.
   * @param {string} description - The success toast's text.
   * @returns {Promise<void>} Resolves once the clipboard answered.
   */
  private async copy(text: string, title: string, description: string): Promise<void> {
    try {
      const clipboard: Clipboard | undefined = this.document.defaultView?.navigator.clipboard;
      if (clipboard === undefined) throw new Error('The clipboard is unavailable.');
      await clipboard.writeText(text);
      this.toasts.success(title, { description });
    } catch {
      this.toasts.error($localize`:@@account.security.copy-failed:Copy failed`, {
        description: $localize`:@@account.security.copy-failed-text:Select the text, then copy it with Ctrl C.`,
      });
    }
  }

  /**
   * Method download
   *
   * @description
   * Saves a text file through a temporary object URL, revoked a second later.
   *
   * @param {string} name - The file name.
   * @param {string} text - Its content.
   * @returns {boolean} Whether the browser took the file.
   */
  private download(name: string, text: string): boolean {
    try {
      const view: (Window & typeof globalThis) | null = this.document.defaultView;
      if (view === null) return false;
      const url: string = view.URL.createObjectURL(
        new Blob([text], { type: 'text/plain;charset=utf-8' }),
      );
      const link: HTMLAnchorElement = this.document.createElement('a');
      link.href = url;
      link.download = name;
      this.document.body.append(link);
      link.click();
      link.remove();
      view.setTimeout((): void => {
        view.URL.revokeObjectURL(url);
      }, 1000);
      return true;
    } catch {
      return false;
    }
  }
  // #endregion
}
