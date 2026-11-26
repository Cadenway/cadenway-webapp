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
  CwAlertDialogTitle,
} from '@cadenway/ui/components/alert-dialog';
import { CwAttachment } from '@cadenway/ui/components/attachment';
import { CwButton } from '@cadenway/ui/components/button';
import { CwDropzone } from '@cadenway/ui/components/dropzone';
import { NgIcon } from '@ng-icons/core';

import type { TaskAttachment } from '../../../models/task-detail-sections/task-detail-sections.interface';
import type { TaskAttachmentUpload } from '../../../state/task-attachments/task-attachments.store';

/**
 * Component TaskAttachments
 *
 * @description
 * The `Attachments` of `Details` (`App.dc.html` lines 2169-2191): the title, the count and `Add`
 * (several files), the attachments as `cw-attachment` tiles (the name opens the preview,
 * `Remove <name>` asks `Remove “<name>”?` first), the files being sent with their progress, and
 * the drop zone (`Drop files here`, `or click to browse · 25 MB per file`). The list's loading
 * skeleton, inline error with `Retry`, and nothing more when it is empty (the drop zone is the
 * empty state, as in the mockup). Without edit rights it lists and previews only. It only emits:
 * the tabs upload, remove and preview.
 */
@Component({
  selector: 'cw-task-attachments',
  imports: [
    CwAlertDialog,
    CwAlertDialogAction,
    CwAlertDialogCancel,
    CwAlertDialogDescription,
    CwAlertDialogTitle,
    CwAttachment,
    CwButton,
    CwDropzone,
    NgIcon,
  ],
  host: { class: 'flex flex-col gap-2 px-2' },
  templateUrl: './task-attachments.component.html',
})
export class TaskAttachments {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * The ready attachments.
   *
   * @type {InputSignal<readonly TaskAttachment[]>}
   * @readonly
   */
  public readonly items: InputSignal<readonly TaskAttachment[]> =
    input.required<readonly TaskAttachment[]>();

  /**
   * Property uploads
   *
   * @description
   * Files being sent.
   *
   * @type {InputSignal<readonly TaskAttachmentUpload[]>}
   * @readonly
   */
  public readonly uploads: InputSignal<readonly TaskAttachmentUpload[]> = input<
    readonly TaskAttachmentUpload[]
  >([]);

  /**
   * Property loading
   *
   * @description
   * Whether the list is being read.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly loading: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property failed
   *
   * @description
   * Whether the list could not be read.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly failed: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property canEdit
   *
   * @description
   * Whether the caller may add and remove files.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly canEdit: InputSignal<boolean> = input<boolean>(true);

  /**
   * Property removing
   *
   * @description
   * The attachment being removed, or null.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly removing: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property confirming
   *
   * @description
   * The attachment whose removal is being confirmed, or null; the tabs close it once removed.
   *
   * @type {ModelSignal<TaskAttachment | null>}
   * @readonly
   */
  public readonly confirming: ModelSignal<TaskAttachment | null> = model<TaskAttachment | null>(
    null,
  );

  /**
   * Property filesAdded
   *
   * @description
   * Emits the files chosen or dropped.
   *
   * @type {OutputEmitterRef<File[]>}
   * @readonly
   */
  public readonly filesAdded: OutputEmitterRef<File[]> = output<File[]>();

  /**
   * Property previewed
   *
   * @description
   * Emits the index of the attachment to preview.
   *
   * @type {OutputEmitterRef<number>}
   * @readonly
   */
  public readonly previewed: OutputEmitterRef<number> = output<number>();

  /**
   * Property removed
   *
   * @description
   * Emits the attachment whose removal was confirmed.
   *
   * @type {OutputEmitterRef<TaskAttachment>}
   * @readonly
   */
  public readonly removed: OutputEmitterRef<TaskAttachment> = output<TaskAttachment>();

  /**
   * Property retried
   *
   * @description
   * Emits when `Retry` is pressed after a failed read.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly retried: OutputEmitterRef<void> = output();
  // #endregion

  // #region Methods
  /**
   * Method picked
   *
   * @description
   * Emits the files of the `Add` picker, then empties it so the same file can be chosen again.
   *
   * @param {Event} event - The change event of the picker.
   */
  protected picked(event: Event): void {
    const picker: HTMLInputElement = event.target as HTMLInputElement;
    const files: File[] = Array.from(picker.files ?? []);
    picker.value = '';
    if (files.length > 0) this.filesAdded.emit(files);
  }

  /**
   * Method open
   *
   * @description
   * Shows the preview instead of following the tile's link.
   *
   * @param {MouseEvent} event - The click on the name.
   * @param {number} index - The attachment's position.
   */
  protected open(event: MouseEvent, index: number): void {
    event.preventDefault();
    this.previewed.emit(index);
  }

  /**
   * Method ask
   *
   * @description
   * Asks to confirm the removal of an attachment.
   *
   * @param {TaskAttachment} attachment - The attachment.
   */
  protected ask(attachment: TaskAttachment): void {
    this.confirming.set(attachment);
  }

  /**
   * Method confirmChanged
   *
   * @description
   * Forgets the attachment when the confirmation closes.
   *
   * @param {boolean} open - Whether the confirmation is open.
   */
  protected confirmChanged(open: boolean): void {
    if (!open) this.confirming.set(null);
  }

  /**
   * Method confirm
   *
   * @description
   * Emits the confirmed removal; the confirmation stays open, pending, until the tabs close it.
   */
  protected confirm(): void {
    const attachment: TaskAttachment | null = this.confirming();
    if (attachment) this.removed.emit(attachment);
  }

  /**
   * Method removeTitle
   *
   * @description
   * Title of the confirmation.
   *
   * @param {TaskAttachment} attachment - The attachment.
   * @returns {string} The title.
   */
  protected removeTitle(attachment: TaskAttachment): string {
    return $localize`:@@task.attachments.confirm-title:Remove “${attachment.name}:name:”?`;
  }
  // #endregion
}
