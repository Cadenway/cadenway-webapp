import {
  Component,
  input,
  type InputSignal,
  model,
  type ModelSignal,
  output,
  type OutputEmitterRef,
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
import { NgIcon } from '@ng-icons/core';

/**
 * Component DocumentDeleteDialog
 *
 * @description
 * The confirmation of a document's deletion (`App.dc.html` line 9191): `Delete “<title>”?`, the
 * mockup's warning and `Delete the document`, destructive. Both the document page's `Delete` and
 * the catalog's context menu ask it, since nothing restores a document (gap G-C1). `open` is
 * two-way; `pending` spins the confirmation while the gateway answers, and the dialog stays open
 * until the page closes it. `confirmed` fires on the confirmation.
 */
@Component({
  selector: 'cw-document-delete-dialog',
  imports: [
    CwAlertDialog,
    CwAlertDialogAction,
    CwAlertDialogCancel,
    CwAlertDialogDescription,
    CwAlertDialogMedia,
    CwAlertDialogTitle,
    CwButton,
    NgIcon,
  ],
  template: `
    <cw-alert-dialog
      variant="destructive"
      [(open)]="open"
      [pending]="pending()"
      data-testid="document-delete-dialog"
      (confirm)="confirmed.emit()"
    >
      <cw-alert-dialog-media>
        <ng-icon name="phosphorTrashBold" aria-hidden="true" />
      </cw-alert-dialog-media>
      <h2 cwAlertDialogTitle i18n="@@docs.delete.title">Delete “{{ title() }}”?</h2>
      <p cwAlertDialogDescription i18n="@@docs.delete.description">
        The document and its comments are deleted for the whole team.
      </p>
      <button cwButton cwAlertDialogCancel variant="outline" i18n="@@docs.delete.cancel">
        Cancel
      </button>
      <button
        cwButton
        cwAlertDialogAction
        variant="destructive"
        [loading]="pending()"
        data-testid="document-delete-confirm"
      >
        <ng-container i18n="@@docs.delete.confirm">Delete the document</ng-container>
      </button>
    </cw-alert-dialog>
  `,
})
export class DocumentDeleteDialog {
  // #region Properties
  /**
   * Property open
   *
   * @description
   * Whether the confirmation shows.
   *
   * @type {ModelSignal<boolean>}
   * @readonly
   */
  public readonly open: ModelSignal<boolean> = model<boolean>(false);

  /**
   * Property title
   *
   * @description
   * Title of the document to delete; kept by the page after it closes so the exit animation
   * keeps the text.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly title: InputSignal<string> = input<string>('');

  /**
   * Property pending
   *
   * @description
   * Whether the deletion waits for the gateway.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly pending: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property confirmed
   *
   * @description
   * Fires when the person confirms the deletion.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly confirmed: OutputEmitterRef<void> = output();
  // #endregion
}
