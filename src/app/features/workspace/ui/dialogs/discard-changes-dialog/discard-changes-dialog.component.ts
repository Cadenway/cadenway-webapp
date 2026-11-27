import { Component, DestroyRef, inject, signal, type WritableSignal } from '@angular/core';
import {
  CwAlertDialog,
  CwAlertDialogAction,
  CwAlertDialogCancel,
  CwAlertDialogDescription,
  CwAlertDialogTitle,
  provideCwAlertDialogLabels,
} from '@cadenway/ui/components/alert-dialog';
import { CwButton } from '@cadenway/ui/components/button';

/**
 * Component DiscardChangesDialog
 *
 * @description
 * The confirmation a settings page shows before a navigation drops its unsaved edits, as
 * `unsavedChangesGuard` (`@shared/unsaved-changes`) asks: `Discard unsaved changes?`, the
 * consequence, then `Keep editing` and the destructive `Discard`. The mockup draws no such dialog,
 * so its copy is the application's own. The page renders it and returns `ask()` from its
 * `confirmDiscard()`; `Keep editing` and Escape answer false. Asking again while it is open
 * answers the previous question false, and destroying the dialog answers false too, so a guard
 * never waits forever.
 */
@Component({
  selector: 'cw-discard-changes-dialog',
  imports: [
    CwAlertDialog,
    CwAlertDialogAction,
    CwAlertDialogCancel,
    CwAlertDialogDescription,
    CwAlertDialogTitle,
    CwButton,
  ],
  providers: [
    provideCwAlertDialogLabels(() => ({
      confirm: $localize`:@@workspace.settings.discard-confirm-label:To confirm, type`,
      more: (count: number): string =>
        $localize`:@@workspace.settings.discard-more:+ ${count}:count: others`,
    })),
  ],
  templateUrl: './discard-changes-dialog.component.html',
})
export class DiscardChangesDialog {
  // #region Properties
  /**
   * Property open
   *
   * @description
   * Whether the confirmation is shown.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly open: WritableSignal<boolean> = signal(false);

  /**
   * Property settle
   *
   * @description
   * Answers the pending question, or null when none is pending.
   *
   * @type {WritableSignal<((discard: boolean) => void) | null>}
   * @readonly
   */
  private readonly settle: WritableSignal<((discard: boolean) => void) | null> = signal(null);
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Answers a pending question false when the dialog is destroyed.
   *
   * @constructor
   */
  public constructor() {
    inject(DestroyRef).onDestroy((): void => {
      this.answered(false);
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method ask
   *
   * @description
   * Opens the confirmation and waits for the answer.
   *
   * @returns {Promise<boolean>} Resolves true on `Discard`, false on `Keep editing` or Escape.
   */
  public ask(): Promise<boolean> {
    this.answered(false);
    return new Promise<boolean>((resolve: (discard: boolean) => void): void => {
      this.settle.set(resolve);
      this.open.set(true);
    });
  }

  /**
   * Method answered
   *
   * @description
   * Closes the confirmation and answers the pending question.
   *
   * @param {boolean} discard - Whether the person chose to discard the edits.
   */
  protected answered(discard: boolean): void {
    const settle: ((discard: boolean) => void) | null = this.settle();
    this.settle.set(null);
    this.open.set(false);
    settle?.(discard);
  }
  // #endregion
}
