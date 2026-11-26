import {
  Component,
  effect,
  inject,
  input,
  type InputSignal,
  model,
  type ModelSignal,
  output,
  type OutputEmitterRef,
  untracked,
} from '@angular/core';
import { CwButton } from '@cadenway/ui/components/button';
import { CwDialog, CwDialogHeader, CwDialogTitle } from '@cadenway/ui/components/dialog';
import { CwStatusIcon } from '@cadenway/ui/components/status-icon';
import { NgIcon } from '@ng-icons/core';

import type { TaskParentCandidate } from '../../../models/task-detail/task-detail.interface';
import {
  type TaskParentContext,
  TaskParentPickerStore,
  type TaskParentPickerStoreInstance,
} from '../../../state/task-parent-picker/task-parent-picker.store';

/**
 * Component TaskParentPickerDialog
 *
 * @description
 * `Attach to a task` (`App.dc.html` lines 2087-2102, 8437-8462), opened by `Convert to a subtask
 * of…` or `Move to another task…`, named `Attach to a task` over its title `Become a subtask
 * of…`: a search by name or key, and up to 12
 * candidates (status icon, name, key), the open task's list first, without those that would break
 * the three levels or the 25 subtasks; none left says the limit would be exceeded, a failed read
 * offers `Retry`. Picking emits the candidate and closes. It provides its own
 * `TaskParentPickerStore` and starts over at each opening.
 */
@Component({
  selector: 'cw-task-parent-picker-dialog',
  imports: [CwButton, CwDialog, CwDialogHeader, CwDialogTitle, CwStatusIcon, NgIcon],
  providers: [TaskParentPickerStore],
  templateUrl: './task-parent-picker-dialog.component.html',
})
export class TaskParentPickerDialog {
  // #region Properties
  /**
   * Property open
   *
   * @description
   * Whether the dialog is open.
   *
   * @type {ModelSignal<boolean>}
   * @readonly
   */
  public readonly open: ModelSignal<boolean> = model<boolean>(false);

  /**
   * Property context
   *
   * @description
   * The task that changes parent.
   *
   * @type {InputSignal<TaskParentContext | null>}
   * @readonly
   */
  public readonly context: InputSignal<TaskParentContext | null> = input<TaskParentContext | null>(
    null,
  );

  /**
   * Property picked
   *
   * @description
   * Emitted with the chosen parent.
   *
   * @type {OutputEmitterRef<TaskParentCandidate>}
   * @readonly
   */
  public readonly picked: OutputEmitterRef<TaskParentCandidate> = output<TaskParentCandidate>();

  /**
   * Property store
   *
   * @description
   * The candidates' search.
   *
   * @type {TaskParentPickerStoreInstance}
   * @readonly
   */
  protected readonly store: TaskParentPickerStoreInstance = inject(TaskParentPickerStore);
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Starts the search over each time the dialog opens.
   *
   * @constructor
   */
  public constructor() {
    effect((): void => {
      const context: TaskParentContext | null = this.context();
      if (!this.open() || !context) return;
      untracked((): void => {
        this.store.start(context);
      });
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method pick
   *
   * @description
   * Emits the candidate and closes.
   *
   * @param {TaskParentCandidate} candidate - The chosen parent.
   */
  protected pick(candidate: TaskParentCandidate): void {
    this.picked.emit(candidate);
    this.open.set(false);
  }
  // #endregion
}
