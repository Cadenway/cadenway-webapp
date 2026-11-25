import {
  Component,
  computed,
  input,
  type InputSignal,
  linkedSignal,
  output,
  type OutputEmitterRef,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { CANCEL_REASONS, type CancelReason } from '@cadenway/contracts';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwDialog,
  CwDialogDescription,
  CwDialogFooter,
  CwDialogHeader,
  CwDialogTitle,
  provideCwDialogLabels,
} from '@cadenway/ui/components/dialog';
import { CwRadioGroup, CwRadioGroupItem } from '@cadenway/ui/components/radio-group';
import { CwTextarea } from '@cadenway/ui/components/textarea';
import { NgIcon } from '@ng-icons/core';

import {
  CANCEL_REASON_HINTS,
  CANCEL_REASON_ICONS,
  CANCEL_REASON_LABELS,
} from '../../../constants/task-copy/task-copy.constants';
import type { TaskCancellation } from '../../../models/task-status-change/task-status-change.interface';

/**
 * Component TaskCancelDialog
 *
 * @description
 * The cancel reason dialog (`App.dc.html` lines 3227-3245): « Annuler CAD-482 ? » (or « Annuler
 * 3 tâches ? »), the four reasons as cards (« Doublon » chosen first), an optional « Précision »,
 * then « Garder la tâche » and « Annuler la tâche ». It is open while `taskKeys` is set and starts
 * afresh each time it opens. « Annuler la tâche » emits `confirmed` with the reason and the trimmed
 * note; « Garder la tâche », Escape and the backdrop emit `kept`.
 */
@Component({
  selector: 'cw-task-cancel-dialog',
  imports: [
    CwButton,
    CwDialog,
    CwDialogDescription,
    CwDialogFooter,
    CwDialogHeader,
    CwDialogTitle,
    CwRadioGroup,
    CwRadioGroupItem,
    CwTextarea,
    NgIcon,
  ],
  providers: [
    provideCwDialogLabels(() => ({ close: $localize`:@@task.cancel-dialog.close:Close` })),
  ],
  templateUrl: './task-cancel-dialog.component.html',
})
export class TaskCancelDialog {
  // #region Properties
  /**
   * Property taskKeys
   *
   * @description
   * Keys of the tasks to cancel; the dialog is open while it is set.
   *
   * @type {InputSignal<readonly string[] | null>}
   * @readonly
   */
  public readonly taskKeys: InputSignal<readonly string[] | null> = input<readonly string[] | null>(
    null,
  );

  /**
   * Property confirmed
   *
   * @description
   * Emits the reason and the note when « Annuler la tâche » is pressed.
   *
   * @type {OutputEmitterRef<TaskCancellation>}
   * @readonly
   */
  public readonly confirmed: OutputEmitterRef<TaskCancellation> = output<TaskCancellation>();

  /**
   * Property kept
   *
   * @description
   * Emits when the dialog closes without cancelling.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly kept: OutputEmitterRef<void> = output();

  /**
   * Property reasons
   *
   * @description
   * The four reasons, in the mockup's order.
   *
   * @type {readonly CancelReason[]}
   * @readonly
   */
  protected readonly reasons: readonly CancelReason[] = CANCEL_REASONS;

  /**
   * Property labels
   *
   * @description
   * Word of each reason.
   *
   * @type {Readonly<Record<CancelReason, string>>}
   * @readonly
   */
  protected readonly labels: Readonly<Record<CancelReason, string>> = CANCEL_REASON_LABELS;

  /**
   * Property hints
   *
   * @description
   * Meaning of each reason.
   *
   * @type {Readonly<Record<CancelReason, string>>}
   * @readonly
   */
  protected readonly hints: Readonly<Record<CancelReason, string>> = CANCEL_REASON_HINTS;

  /**
   * Property icons
   *
   * @description
   * Icon of each reason.
   *
   * @type {Readonly<Record<CancelReason, string>>}
   * @readonly
   */
  protected readonly icons: Readonly<Record<CancelReason, string>> = CANCEL_REASON_ICONS;

  /**
   * Property open
   *
   * @description
   * Whether the dialog shows.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly open: Signal<boolean> = computed((): boolean => this.taskKeys() !== null);

  /**
   * Property title
   *
   * @description
   * « Annuler CAD-482 ? » for one task, « Annuler 3 tâches ? » for several.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly title: Signal<string> = computed((): string => {
    const keys: readonly string[] = this.taskKeys() ?? [];
    return keys.length > 1
      ? $localize`:@@task.cancel-dialog.title-many:Cancel ${keys.length}:count: tasks?`
      : $localize`:@@task.cancel-dialog.title-one:Cancel ${keys[0] ?? ''}:key:?`;
  });

  /**
   * Property reason
   *
   * @description
   * Chosen reason; « Doublon » each time the dialog opens.
   *
   * @type {WritableSignal<CancelReason>}
   * @readonly
   */
  protected readonly reason: WritableSignal<CancelReason> = linkedSignal<
    readonly string[] | null,
    CancelReason
  >({
    source: this.taskKeys,
    computation: (): CancelReason => 'duplicate',
  });

  /**
   * Property note
   *
   * @description
   * Typed « Précision »; empty each time the dialog opens.
   *
   * @type {WritableSignal<string>}
   * @readonly
   */
  protected readonly note: WritableSignal<string> = linkedSignal<readonly string[] | null, string>({
    source: this.taskKeys,
    computation: (): string => '',
  });
  // #endregion

  // #region Methods
  /**
   * Method pick
   *
   * @description
   * Takes the radio group's value as the reason.
   *
   * @param {string | null} value - Chosen value.
   */
  protected pick(value: string | null): void {
    const reason: CancelReason | undefined = CANCEL_REASONS.find(
      (key: CancelReason) => key === value,
    );
    if (reason) this.reason.set(reason);
  }

  /**
   * Method type
   *
   * @description
   * Keeps the typed note.
   *
   * @param {Event} event - Input event of the note field.
   */
  protected type(event: Event): void {
    if (event.target instanceof HTMLTextAreaElement) this.note.set(event.target.value);
  }

  /**
   * Method confirm
   *
   * @description
   * « Annuler la tâche ».
   */
  protected confirm(): void {
    this.confirmed.emit({ reason: this.reason(), note: this.note().trim() });
  }

  /**
   * Method openChange
   *
   * @description
   * Reports a close by Escape, the backdrop or « Garder la tâche » as `kept`.
   *
   * @param {boolean} open - Whether the dialog stays open.
   */
  protected openChange(open: boolean): void {
    if (!open && this.open()) this.kept.emit();
  }
  // #endregion
}
