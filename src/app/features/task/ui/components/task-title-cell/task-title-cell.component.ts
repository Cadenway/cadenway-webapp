import {
  booleanAttribute,
  Component,
  computed,
  input,
  type InputSignal,
  type InputSignalWithTransform,
  output,
  type OutputEmitterRef,
  type Signal,
} from '@angular/core';
import type { StatusKey } from '@cadenway/contracts';
import { CwStatusIcon } from '@cadenway/ui/components/status-icon';
import { NgIcon } from '@ng-icons/core';

import { RECURRENCE_TITLES } from '../../../constants/task-copy/task-copy.constants';
import type { TaskSummary } from '../../../models/task-summary/task-summary.interface';

/**
 * Component TaskTitleCell
 *
 * @description
 * The name cell of a task row (`App.dc.html` lines 667-675): a button with the status icon and name (struck through when cancelled, muted when done), the key, the repeat icon of a
 * recurring task, the « Sous-tâche de CAD-… » hint, the subtasks done (« 1/3 », tree icon) or,
 * without subtasks, the checklist entries checked (list icon), and the comment count when the
 * gateway gives it. The button emits `opened`. The Git chip is not
 * drawn: no API exists for it yet (B4).
 */
@Component({
  selector: 'cw-task-title-cell',
  imports: [CwStatusIcon, NgIcon],
  host: { class: 'flex min-w-0 items-center gap-0.5' },
  templateUrl: './task-title-cell.component.html',
})
export class TaskTitleCell {
  // #region Properties
  /**
   * Property task
   *
   * @description
   * The task.
   *
   * @type {InputSignal<TaskSummary>}
   * @readonly
   */
  public readonly task: InputSignal<TaskSummary> = input.required<TaskSummary>();

  /**
   * Property status
   *
   * @description
   * Status to show, pending clicks included; the task's own status by default.
   *
   * @type {InputSignal<StatusKey | null>}
   * @readonly
   */
  public readonly status: InputSignal<StatusKey | null> = input<StatusKey | null>(null);

  /**
   * Property from
   *
   * @description
   * Previous status the icon animates from.
   *
   * @type {InputSignal<StatusKey | null>}
   * @readonly
   */
  public readonly from: InputSignal<StatusKey | null> = input<StatusKey | null>(null);

  /**
   * Property showParent
   *
   * @description
   * Whether to show the parent hint, when subtasks are listed apart from their parent.
   *
   * @type {InputSignalWithTransform<boolean, unknown>}
   * @readonly
   */
  public readonly showParent: InputSignalWithTransform<boolean, unknown> = input(false, {
    transform: booleanAttribute,
  });

  /**
   * Property opened
   *
   * @description
   * Emits when the name is clicked, to open the task.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly opened: OutputEmitterRef<void> = output();

  /**
   * Property shown
   *
   * @description
   * Status drawn.
   *
   * @type {Signal<StatusKey>}
   * @readonly
   */
  protected readonly shown: Signal<StatusKey> = computed(
    (): StatusKey => this.status() ?? this.task().status,
  );

  /**
   * Property recurrenceTitle
   *
   * @description
   * Tooltip of the repeat icon, empty for a task that does not repeat.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly recurrenceTitle: Signal<string> = computed(
    (): string => RECURRENCE_TITLES[this.task().recurrence],
  );
  // #endregion
}
