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
import { NgIcon } from '@ng-icons/core';

import {
  isClosedStatus,
  type Person,
  PRIORITY_LABELS,
  TaskDueDate,
  TaskLabelChips,
  type TaskSummary,
} from '@features/task';

/**
 * Type TaskCardVariant
 *
 * @description
 * `card`: the board's card (key, priority, name, labels, due date, progress, assignees);
 * `item`: the calendar side panel's line (status, name, key).
 *
 * @type {'card' | 'item'}
 */
export type TaskCardVariant = 'card' | 'item';

/**
 * Interface CardProgress
 *
 * @description
 * The progress a card shows: its subtasks when it has some, else its checklist.
 */
interface CardProgress {
  // #region Properties
  /**
   * Property icon
   *
   * @description
   * The tree for subtasks, the checklist for checklist items.
   *
   * @type {string}
   * @readonly
   */
  readonly icon: string;

  /**
   * Property closed
   *
   * @description
   * Closed subtasks or done checklist items.
   *
   * @type {number}
   * @readonly
   */
  readonly closed: number;

  /**
   * Property total
   *
   * @description
   * All of them.
   *
   * @type {number}
   * @readonly
   */
  readonly total: number;
  // #endregion
}

/**
 * Component TaskCard
 *
 * @description
 * A task as a card, for the board and the calendar's side panel (`App.dc.html` lines 741-757
 * and 816-820). The `card` variant shows the key, the priority icon and word (`Urgent` in red),
 * the milestone's icon, the name on two lines (muted once closed, struck through when
 * cancelled), the labels (`cw-task-label-chips`), the due date (`cw-task-due-date`, late in
 * garnet), the subtasks' progress (`1/3`, else the checklist's) and the assignees' initials; a
 * closed task's card is transparent. The `item` variant shows the status, the name and the key on
 * one line. The whole card is one button: a click or Enter emits `opened`. Presentational: the
 * view attaches the task menu on the host (`[cwContextMenuTriggerFor]`) and the drag handles.
 */
@Component({
  selector: 'cw-task-card',
  imports: [CwPriorityIcon, CwStatusIcon, NgIcon, TaskDueDate, TaskLabelChips],
  host: { class: 'block' },
  templateUrl: './task-card.component.html',
})
export class TaskCard {
  // #region Properties
  /**
   * Property task
   *
   * @description
   * The task as shown (the view's writes applied).
   *
   * @type {InputSignal<TaskSummary>}
   * @readonly
   */
  public readonly task: InputSignal<TaskSummary> = input.required<TaskSummary>();

  /**
   * Property status
   *
   * @description
   * The status the task shows (a pending click or a write); null for the task's own.
   *
   * @type {InputSignal<StatusKey | null>}
   * @readonly
   */
  public readonly status: InputSignal<StatusKey | null> = input<StatusKey | null>(null);

  /**
   * Property people
   *
   * @description
   * The members of the organization; the card shows the task's assignees among them.
   *
   * @type {InputSignal<readonly Person[]>}
   * @readonly
   */
  public readonly people: InputSignal<readonly Person[]> = input<readonly Person[]>([]);

  /**
   * Property variant
   *
   * @description
   * `card` (the board, default) or `item` (the calendar's side panel).
   *
   * @type {InputSignal<TaskCardVariant>}
   * @readonly
   */
  public readonly variant: InputSignal<TaskCardVariant> = input<TaskCardVariant>('card');

  /**
   * Property opened
   *
   * @description
   * A click or Enter on the card: the view opens the task's detail.
   *
   * @type {OutputEmitterRef<TaskSummary>}
   * @readonly
   */
  public readonly opened: OutputEmitterRef<TaskSummary> = output<TaskSummary>();

  /**
   * Property shownStatus
   *
   * @description
   * The status the card shows.
   *
   * @type {Signal<StatusKey>}
   * @readonly
   */
  protected readonly shownStatus: Signal<StatusKey> = computed(
    (): StatusKey => this.status() ?? this.task().status,
  );

  /**
   * Property closed
   *
   * @description
   * Whether the task is done or cancelled.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly closed: Signal<boolean> = computed((): boolean =>
    isClosedStatus(this.shownStatus()),
  );

  /**
   * Property priorityLabel
   *
   * @description
   * The priority word.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly priorityLabel: Signal<string> = computed(
    (): string => PRIORITY_LABELS[this.task().priority],
  );

  /**
   * Property progress
   *
   * @description
   * The subtasks' progress, else the checklist's; null when the task has neither.
   *
   * @type {Signal<CardProgress | null>}
   * @readonly
   */
  protected readonly progress: Signal<CardProgress | null> = computed((): CardProgress | null => {
    const { subtasks, checklist }: TaskSummary = this.task();
    if (subtasks.total > 0) {
      return { icon: 'phosphorTreeStructureBold', closed: subtasks.closed, total: subtasks.total };
    }
    return checklist.total > 0
      ? { icon: 'phosphorListChecksBold', closed: checklist.closed, total: checklist.total }
      : null;
  });

  /**
   * Property assignees
   *
   * @description
   * The task's assignees among the members, in the task's order.
   *
   * @type {Signal<readonly Person[]>}
   * @readonly
   */
  protected readonly assignees: Signal<readonly Person[]> = computed((): readonly Person[] => {
    const people: ReadonlyMap<string, Person> = new Map(
      this.people().map((person: Person): [string, Person] => [person.id, person]),
    );
    return this.task().assigneeIds.flatMap((id: string): Person[] => {
      const person: Person | undefined = people.get(id);
      return person ? [person] : [];
    });
  });
  // #endregion
}
