import type { StatusKey } from '@cadenway/contracts';
import {
  Component,
  computed,
  type ElementRef,
  input,
  type InputSignal,
  output,
  type OutputEmitterRef,
  type Signal,
  viewChild,
} from '@angular/core';
import { CwAvatar, CwAvatarGroup } from '@cadenway/ui/components/avatar';
import { CwPriorityIcon } from '@cadenway/ui/components/priority-icon';
import { CwProgress } from '@cadenway/ui/components/progress';
import { CwStatusIcon } from '@cadenway/ui/components/status-icon';
import { NgIcon } from '@ng-icons/core';

import { PRIORITY_LABELS } from '../../../constants/task-copy/task-copy.constants';
import type { Person } from '../../../models/person/person.interface';
import type { TaskSummary } from '../../../models/task-summary/task-summary.interface';
import type { SubtaskLimit } from '../../../state/task-detail-sections/task-detail-sections.store';
import { TaskDueDate } from '../task-due-date/task-due-date.component';

/**
 * Interface TaskSubtaskRow
 *
 * @description
 * A subtask as the tab lists it, with the status the status changes show.
 */
export interface TaskSubtaskRow {
  // #region Properties
  /**
   * Property task
   *
   * @description
   * The subtask.
   *
   * @type {TaskSummary}
   * @readonly
   */
  readonly task: TaskSummary;

  /**
   * Property status
   *
   * @description
   * Its shown status (a pending change included).
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;

  /**
   * Property advanceLabel
   *
   * @description
   * Name of its status button: `<status> · move to “<next>”`, or the status alone at the end.
   *
   * @type {string}
   * @readonly
   */
  readonly advanceLabel: string;

  /**
   * Property canAdvance
   *
   * @description
   * Whether the status has a next one.
   *
   * @type {boolean}
   * @readonly
   */
  readonly canAdvance: boolean;

  /**
   * Property people
   *
   * @description
   * Its assignees.
   *
   * @type {readonly Person[]}
   * @readonly
   */
  readonly people: readonly Person[];
  // #endregion
}

/**
 * Component TaskSubtasks
 *
 * @description
 * The `Subtasks` tab (`App.dc.html` lines 2272-2302): `Subtasks` with `<done> / <n> done` and its
 * bar, one row per subtask (focusable; Enter, Space or a click opens it, named `Open <key> ·
 * <name>`) with its status button (advances to the next status, named `<status> · move to
 * “<next>”`), its name, its own subtask count, key, assignees, due date and priority icon; the
 * empty text; the add field (Enter creates, the field empties) and, instead of it at a limit,
 * the 3-level or 25-subtask message. Read-only without edit rights (no status button, no field).
 */
@Component({
  selector: 'cw-task-subtasks',
  imports: [CwAvatar, CwAvatarGroup, CwPriorityIcon, CwProgress, CwStatusIcon, NgIcon, TaskDueDate],
  host: { class: 'flex flex-col gap-2' },
  templateUrl: './task-subtasks.component.html',
})
export class TaskSubtasks {
  // #region Properties
  /**
   * Property rows
   *
   * @description
   * The direct subtasks.
   *
   * @type {InputSignal<readonly TaskSubtaskRow[]>}
   * @readonly
   */
  public readonly rows: InputSignal<readonly TaskSubtaskRow[]> =
    input.required<readonly TaskSubtaskRow[]>();

  /**
   * Property canEdit
   *
   * @description
   * Whether the caller may change statuses and add subtasks.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly canEdit: InputSignal<boolean> = input<boolean>(true);

  /**
   * Property limit
   *
   * @description
   * Why no subtask can be added, or null.
   *
   * @type {InputSignal<SubtaskLimit | null>}
   * @readonly
   */
  public readonly limit: InputSignal<SubtaskLimit | null> = input<SubtaskLimit | null>(null);

  /**
   * Property creating
   *
   * @description
   * Whether a subtask is being created.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly creating: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property opened
   *
   * @description
   * Emits the subtask to open.
   *
   * @type {OutputEmitterRef<TaskSummary>}
   * @readonly
   */
  public readonly opened: OutputEmitterRef<TaskSummary> = output<TaskSummary>();

  /**
   * Property advanced
   *
   * @description
   * Emits the subtask whose status button was pressed.
   *
   * @type {OutputEmitterRef<TaskSummary>}
   * @readonly
   */
  public readonly advanced: OutputEmitterRef<TaskSummary> = output<TaskSummary>();

  /**
   * Property created
   *
   * @description
   * Emits the name of a new subtask, trimmed and not blank.
   *
   * @type {OutputEmitterRef<string>}
   * @readonly
   */
  public readonly created: OutputEmitterRef<string> = output<string>();

  /**
   * Property done
   *
   * @description
   * Subtasks done or cancelled.
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly done: Signal<number> = computed(
    (): number =>
      this.rows().filter(
        (row: TaskSubtaskRow): boolean => row.status === 'done' || row.status === 'cancelled',
      ).length,
  );

  /**
   * Property progress
   *
   * @description
   * `<done> / <n> done`.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly progress: Signal<string> = computed((): string => {
    const done: number = this.done();
    const total: number = this.rows().length;
    return total > 1
      ? $localize`:@@task.subtasks.progress-many:${done}:done: / ${total}:total: done`
      : $localize`:@@task.subtasks.progress-one:${done}:done: / ${total}:total: done`;
  });

  /**
   * Property priorities
   *
   * @description
   * The word of each priority, for the icon's title.
   *
   * @type {typeof PRIORITY_LABELS}
   * @readonly
   */
  protected readonly priorities: typeof PRIORITY_LABELS = PRIORITY_LABELS;

  /**
   * Property newSubtask
   *
   * @description
   * The add field, absent without edit rights or at a limit.
   *
   * @type {Signal<ElementRef<HTMLInputElement> | undefined>}
   * @readonly
   */
  private readonly newSubtask: Signal<ElementRef<HTMLInputElement> | undefined> =
    viewChild<ElementRef<HTMLInputElement>>('newSubtask');
  // #endregion

  // #region Methods
  /**
   * Method focusNew
   *
   * @description
   * Gives the add field the focus (a row's `Add a subtask` opens the tab this way); does nothing
   * when the field is not shown.
   */
  public focusNew(): void {
    this.newSubtask()?.nativeElement.focus();
  }

  /**
   * Method openLabel
   *
   * @description
   * Accessible name of a row.
   *
   * @param {TaskSummary} task - The subtask.
   * @returns {string} The name.
   */
  protected openLabel(task: TaskSummary): string {
    return $localize`:@@task.subtasks.open:Open ${task.key}:key: · ${task.name}:name:`;
  }

  /**
   * Method countTitle
   *
   * @description
   * Title of a row's own subtask count.
   *
   * @param {number} count - Its subtasks.
   * @returns {string} The title.
   */
  protected countTitle(count: number): string {
    return $localize`:@@task.subtasks.count:${count}:count: subtasks`;
  }

  /**
   * Method rowKey
   *
   * @description
   * Enter or Space on the row itself opens the subtask.
   *
   * @param {KeyboardEvent} event - The key event.
   * @param {TaskSummary} task - The subtask.
   */
  protected rowKey(event: KeyboardEvent, task: TaskSummary): void {
    if (event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.opened.emit(task);
  }

  /**
   * Method advance
   *
   * @description
   * Emits the status advance without opening the row.
   *
   * @param {MouseEvent} event - The click.
   * @param {TaskSummary} task - The subtask.
   */
  protected advance(event: MouseEvent, task: TaskSummary): void {
    event.stopPropagation();
    this.advanced.emit(task);
  }

  /**
   * Method key
   *
   * @description
   * Enter in the add field emits the typed name and empties the field.
   *
   * @param {KeyboardEvent} event - The key event of the field.
   */
  protected key(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    const field: HTMLInputElement = event.target as HTMLInputElement;
    const name: string = field.value.trim();
    if (name === '' || this.creating()) return;
    this.created.emit(name);
    field.value = '';
  }
  // #endregion
}
