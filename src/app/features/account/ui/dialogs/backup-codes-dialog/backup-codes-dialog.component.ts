import { Component, input, type InputSignal, output, type OutputEmitterRef } from '@angular/core';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwDialog,
  CwDialogDescription,
  CwDialogFooter,
  CwDialogHeader,
  CwDialogTitle,
} from '@cadenway/ui/components/dialog';
import { NgIcon } from '@ng-icons/core';

import type { BackupCodeSet } from '../../../models/two-step/two-step.interface';

/**
 * Component BackupCodesDialog
 *
 * @description
 * The `New backup codes` dialog (`Compte.dc.html` lines 684-693): it says how many previous
 * unused codes stopped working (`replaced`), lists the 10 new codes, and offers `Copy`
 * (`copyRequested`) and `Download and close` (`downloadRequested`; the page closes it once the
 * file is saved). A backdrop click does not close it, so the codes are not lost by accident;
 * Escape still does. Every close request emits `dismissed`, and `detached` follows once the exit
 * animation ended, so the page keeps the codes on screen while the dialog leaves and forgets
 * them then. It never stores the codes.
 */
@Component({
  selector: 'cw-backup-codes-dialog',
  imports: [
    CwButton,
    CwDialog,
    CwDialogDescription,
    CwDialogFooter,
    CwDialogHeader,
    CwDialogTitle,
    NgIcon,
  ],
  template: `
    @let previous = replaced();
    <cw-dialog
      [open]="open()"
      [showClose]="false"
      [closeOnOverlayClick]="false"
      data-testid="backup-dialog"
      (openChange)="openChanged($event)"
      (closed)="detached.emit()"
    >
      <cw-dialog-header>
        <h2 cwDialogTitle i18n="@@account.security.backup-dialog-title">New backup codes</h2>
        <p cwDialogDescription>
          <ng-container i18n="@@account.security.backup-dialog-description">{previous, plural,
            =0 {The previous codes no longer work.}
            =1 {The previous code no longer works.}
            other {The {{ previous }} previous codes no longer work.}
          }</ng-container>
        </p>
      </cw-dialog-header>
      <ul
        class="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg border border-border p-3 font-mono text-sm tabular-nums"
        aria-label="Backup codes"
        i18n-aria-label="@@account.security.backup-list"
        data-testid="backup-codes"
      >
        @for (code of codes()?.codes ?? []; track code) {
          <li>{{ code }}</li>
        }
      </ul>
      <cw-dialog-footer>
        <button
          cwButton
          type="button"
          variant="outline"
          data-testid="backup-copy"
          (click)="copyRequested.emit()"
        >
          <ng-icon name="phosphorCopyBold" aria-hidden="true" />
          <ng-container i18n="@@account.security.backup-copy">Copy</ng-container>
        </button>
        <button
          cwButton
          type="button"
          data-testid="backup-download"
          (click)="downloadRequested.emit()"
        >
          <ng-icon name="phosphorDownloadSimpleBold" aria-hidden="true" />
          <ng-container i18n="@@account.security.backup-download-close"
            >Download and close</ng-container
          >
        </button>
      </cw-dialog-footer>
    </cw-dialog>
  `,
})
export class BackupCodesDialog {
  // #region Properties
  /**
   * Property open
   *
   * @description
   * Whether the dialog is open.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly open: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property codes
   *
   * @description
   * The new codes, or null once forgotten.
   *
   * @type {InputSignal<BackupCodeSet | null>}
   * @readonly
   */
  public readonly codes: InputSignal<BackupCodeSet | null> = input<BackupCodeSet | null>(null);

  /**
   * Property replaced
   *
   * @description
   * How many unused codes the new ones replaced.
   *
   * @type {InputSignal<number>}
   * @readonly
   */
  public readonly replaced: InputSignal<number> = input<number>(0);

  /**
   * Property copyRequested
   *
   * @description
   * Emits on `Copy`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly copyRequested: OutputEmitterRef<void> = output();

  /**
   * Property downloadRequested
   *
   * @description
   * Emits on `Download and close`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly downloadRequested: OutputEmitterRef<void> = output();

  /**
   * Property dismissed
   *
   * @description
   * Emits when the dialog closes itself (Escape).
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly dismissed: OutputEmitterRef<void> = output();

  /**
   * Property detached
   *
   * @description
   * Emits once the closed dialog left the screen.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly detached: OutputEmitterRef<void> = output();
  // #endregion

  // #region Methods
  /**
   * Method openChanged
   *
   * @description
   * Reports a close of the dialog itself.
   *
   * @param {boolean} open - The dialog's new open state.
   */
  protected openChanged(open: boolean): void {
    if (!open) this.dismissed.emit();
  }
  // #endregion
}
