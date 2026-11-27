import {
  Component,
  computed,
  input,
  type InputSignal,
  output,
  type OutputEmitterRef,
  type Signal,
} from '@angular/core';
import type { StatusKey } from '@cadenway/contracts';
import { CwPriorityIcon } from '@cadenway/ui/components/priority-icon';
import { CwStatusIcon } from '@cadenway/ui/components/status-icon';

import { PRIORITY_LABELS } from '../../../constants/task-copy/task-copy.constants';
import type { Person } from '../../../models/person/person.interface';
import type { TaskSummary } from '../../../models/task-summary/task-summary.interface';
import { defaultStatusOptions, statusLabel } from '../../../utils/task-status/task-status.util';
import { TaskDueDate } from '../task-due-date/task-due-date.component';

/**
 * Type TaskLineVariant
 *
 * @description
 * The cells of a task line, after the mockup's three rows outside a list: `mine` (`My tasks`,
 * `App.dc.html` lines 1767-1773: name, key from 768 px, list from 640 px, due date, priority from
 * 640 px), `priority` (Home's `My priorities`, lines 1705-1709: name over `KEY · List`, due date,
 * priority from 640 px) and `late` (the dashboard's late tasks, lines 1878-1883: name, list from
 * 640 px, assignees' initials, due date).
 *
 * @type {'mine' | 'priority' | 'late'}
 */
export type TaskLineVariant = 'mine' | 'priority' | 'late';

/**
 * Component TaskLine
 *
 * @description
 * One task of a page whose rows belong to no list (Home, My tasks, Dashboards): a single button
 * holding the status icon (morphing from `from`), the name (muted once done, struck through once
 * cancelled), then the cells of its `variant`. The status icon sits inside the button, so a click
 * opens the task (`opened`) and never changes its status; the status word is read by screen
 * readers with the default words, since the space's own names are not known outside a list. The
 * line has no menu of its own: the page puts `[cwContextMenuTriggerFor]` on `cw-task-line` with
 * Task's `cw-task-menu` (right click, Shift F10, the Menu key), whose events reach the host from
 * the button. Presentational: inputs and one output.
 */
@Component({
  selector: 'cw-task-line',
  imports: [CwPriorityIcon, CwStatusIcon, TaskDueDate],
  host: { class: 'block', '[attr.data-variant]': 'variant()' },
  templateUrl: './task-line.component.html',
})
export class TaskLine {
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
   * Status to show, a pending change included (`TaskStatusChangesStore.displayedStatus`); the
   * task's own status by default.
   *
   * @type {InputSignal<StatusKey | null>}
   * @readonly
   */
  public readonly status: InputSignal<StatusKey | null> = input<StatusKey | null>(null);

  /**
   * Property from
   *
   * @description
   * Previous status the icon morphs from, null for none.
   *
   * @type {InputSignal<StatusKey | null>}
   * @readonly
   */
  public readonly from: InputSignal<StatusKey | null> = input<StatusKey | null>(null);

  /**
   * Property listName
   *
   * @description
   * Name of the task's list, resolved by the page; empty to leave the cell blank.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly listName: InputSignal<string> = input<string>('');

  /**
   * Property people
   *
   * @description
   * The assignees the `late` variant draws as initials, in order.
   *
   * @type {InputSignal<readonly Person[]>}
   * @readonly
   */
  public readonly people: InputSignal<readonly Person[]> = input<readonly Person[]>([]);

  /**
   * Property variant
   *
   * @description
   * Which cells follow the name; `mine` by default.
   *
   * @type {InputSignal<TaskLineVariant>}
   * @readonly
   */
  public readonly variant: InputSignal<TaskLineVariant> = input<TaskLineVariant>('mine');

  /**
   * Property opened
   *
   * @description
   * Emits the task when the line is clicked or activated with the keyboard.
   *
   * @type {OutputEmitterRef<TaskSummary>}
   * @readonly
   */
  public readonly opened: OutputEmitterRef<TaskSummary> = output<TaskSummary>();

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
   * Property statusWord
   *
   * @description
   * The status word screen readers read before the name.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly statusWord: Signal<string> = computed((): string =>
    statusLabel(this.shown(), defaultStatusOptions(), this.task().milestone),
  );

  /**
   * Property priorityWord
   *
   * @description
   * The priority word next to its icon.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly priorityWord: Signal<string> = computed(
    (): string => PRIORITY_LABELS[this.task().priority],
  );

  /**
   * Property peopleNames
   *
   * @description
   * The assignees' names, read by screen readers in place of the initials.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly peopleNames: Signal<string> = computed((): string =>
    this.people()
      .map((person: Person): string => person.name)
      .join(', '),
  );
  // #endregion
}
