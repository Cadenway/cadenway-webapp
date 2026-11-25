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
import type { StatusOption } from '../../../models/status-option/status-option.interface';
import type { TaskSummary } from '../../../models/task-summary/task-summary.interface';
import { nextStatus, statusLabel } from '../../../utils/task-status/task-status.util';

/**
 * Component TaskTitleCell
 *
 * @description
 * The name cell of a task row (`App.dc.html` lines 667-675): a status icon button, then a button
 * with the name (struck through when cancelled, muted when done), the key, the repeat icon of a
 * recurring task, the « Sous-tâche de CAD-… » hint, the subtasks done (« 1/3 », tree icon) or,
 * without subtasks, the checklist entries checked (list icon), and the comment count when the
 * gateway gives it. The status button emits `statusClicked` with the next status (null when the
 * task has none, so the owner opens a menu); the name button emits `opened`. The Git chip is not
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
   * Property options
   *
   * @description
   * Statuses of the task's space, for the status word in the button's name.
   *
   * @type {InputSignal<readonly StatusOption[]>}
   * @readonly
   */
  public readonly options: InputSignal<readonly StatusOption[]> = input<readonly StatusOption[]>(
    [],
  );

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
   * Property statusClicked
   *
   * @description
   * Emits the next status when the status button is clicked, or null when there is none.
   *
   * @type {OutputEmitterRef<StatusKey | null>}
   * @readonly
   */
  public readonly statusClicked: OutputEmitterRef<StatusKey | null> = output<StatusKey | null>();

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
   * Property statusName
   *
   * @description
   * Accessible name of the status button (« Statut : À faire · passer à « En cours » »).
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly statusName: Signal<string> = computed((): string => {
    const task: TaskSummary = this.task();
    const label: string = statusLabel(this.shown(), this.options(), task.milestone);
    const next: StatusKey | null = nextStatus(this.shown(), task.milestone);
    return next
      ? $localize`:@@task.title-cell.advance:${label}:status: · move to “${statusLabel(next, this.options(), task.milestone)}:next:”`
      : label;
  });

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

  // #region Methods
  /**
   * Method clickStatus
   *
   * @description
   * Emits the next status without opening the task.
   *
   * @param {Event} event - The click.
   */
  protected clickStatus(event: Event): void {
    event.stopPropagation();
    this.statusClicked.emit(nextStatus(this.shown(), this.task().milestone));
  }
  // #endregion
}
