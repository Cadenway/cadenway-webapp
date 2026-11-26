import {
  Component,
  computed,
  DestroyRef,
  inject,
  linkedSignal,
  type Signal,
  signal,
  type WritableSignal,
} from '@angular/core';
import type { StatusKey } from '@cadenway/contracts';
import { CwToastService } from '@cadenway/ui/components/toast';
import { NgIcon } from '@ng-icons/core';

import {
  LIST_DIRECTORY,
  type ListDirectoryEntry,
  type ListDirectoryPort,
} from '@features/spaces/ports/list-directory';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import type { TaskDetailTask } from '../../../models/task-detail/task-detail.interface';
import type { TaskDependencyTask } from '../../../models/task-property/task-property.interface';
import { TaskDetailOpener } from '../../../services/task-detail-opener/task-detail-opener.service';
import {
  TaskDetailStore,
  type TaskDetailStoreInstance,
} from '../../../state/task-detail/task-detail.store';
import {
  TaskPropertiesStore,
  type TaskPropertiesStoreInstance,
} from '../../../state/task-properties/task-properties.store';
import {
  type TaskStatusChangesInstance,
  TaskStatusChangesStore,
} from '../../../state/task-status-changes/task-status-changes.store';
import {
  TaskTimeStore,
  type TaskTimeStoreInstance,
} from '../../../state/task-time/task-time.store';
import { localDay } from '../../../utils/task-property/task-property.util';
import { TaskCancelDialog } from '../../dialogs/task-cancel-dialog/task-cancel-dialog.component';
import type { TaskListOption } from '../../dialogs/task-list-picker-dialog/task-list-picker-dialog.component';
import { TaskPropertyApprovers } from '../task-property-approvers/task-property-approvers.component';
import { TaskPropertyAssignees } from '../task-property-assignees/task-property-assignees.component';
import { TaskPropertyDependencies } from '../task-property-dependencies/task-property-dependencies.component';
import { TaskPropertyDue } from '../task-property-due/task-property-due.component';
import { TaskPropertyEstimate } from '../task-property-estimate/task-property-estimate.component';
import { TaskPropertyLabels } from '../task-property-labels/task-property-labels.component';
import { TaskPropertyList } from '../task-property-list/task-property-list.component';
import { TaskPropertyMilestone } from '../task-property-milestone/task-property-milestone.component';
import { TaskPropertyPriority } from '../task-property-priority/task-property-priority.component';
import { TaskPropertyRecurrence } from '../task-property-recurrence/task-property-recurrence.component';
import { TaskPropertyStatusTimes } from '../task-property-status-times/task-property-status-times.component';
import { TaskPropertySubtasks } from '../task-property-subtasks/task-property-subtasks.component';
import { TaskPropertyTime } from '../task-property-time/task-property-time.component';
import { TaskPropertyWatchers } from '../task-property-watchers/task-property-watchers.component';
import { TaskStatusPicker } from '../task-status-picker/task-status-picker.component';

/**
 * Constant CLOCK_MS
 *
 * @description
 * How often the panel's clock moves (the running timer and `today`), as the mockup refreshes
 * its timer (`App.dc.html` line 4385).
 *
 * @type {number}
 */
export const CLOCK_MS: number = 15_000;

/**
 * Component TaskPropertiesPanel
 *
 * @description
 * The properties panel of the task detail (`App.dc.html` lines 2368-2610), rendered by the detail
 * dialog in its aside (`Properties of the task`, `md:w-96`, its own scroll; below the content
 * under 768 px). Under the `Properties` heading, a two-column list of rows: `Status` (the split
 * button of `cw-task-status-picker`: advance to the next status, or the grouped menu; through
 * `TaskStatusChangesStore`, so fast clicks settle once, and `Cancelled` opens the cancel reason
 * dialog rendered here), `Assignees`, `Due date`, `Priority`, `Estimate` (not for a milestone),
 * `Time spent`, `Labels`, `List`, `Repeat`, `Followers`, `Milestone`, `Approval` (not for a
 * milestone) and `Dependencies`; then `Time in status` (not for a milestone) and the subtask
 * progress. Task fields (due date, priority, estimate, list, repetition, milestone) go through
 * `TaskDetailStore.update` or `moveTo` (optimistic, `If-Match`, rollback); collections go through
 * `TaskPropertiesStore` and the time through `TaskTimeStore`, both provided here so they die with
 * the panel. Without the list's `edit` role every row is read-only. It is a container of the
 * detail dialog, which acts as a page: it injects the stores; the rows are presentational.
 */
@Component({
  selector: 'cw-task-properties-panel',
  imports: [
    NgIcon,
    TaskCancelDialog,
    TaskPropertyApprovers,
    TaskPropertyAssignees,
    TaskPropertyDependencies,
    TaskPropertyDue,
    TaskPropertyEstimate,
    TaskPropertyLabels,
    TaskPropertyList,
    TaskPropertyMilestone,
    TaskPropertyPriority,
    TaskPropertyRecurrence,
    TaskPropertyStatusTimes,
    TaskPropertySubtasks,
    TaskPropertyTime,
    TaskPropertyWatchers,
    TaskStatusPicker,
  ],
  providers: [TaskPropertiesStore, TaskTimeStore],
  host: { class: 'flex flex-col gap-1' },
  templateUrl: './task-properties-panel.component.html',
})
export class TaskPropertiesPanel {
  // #region Properties
  /**
   * Property store
   *
   * @description
   * The detail of the open task, provided by the detail dialog.
   *
   * @type {TaskDetailStoreInstance}
   * @readonly
   */
  protected readonly store: TaskDetailStoreInstance = inject(TaskDetailStore);

  /**
   * Property statusChanges
   *
   * @description
   * The status interaction, provided by the detail dialog (whose completed writes read the
   * detail again).
   *
   * @type {TaskStatusChangesInstance}
   * @readonly
   */
  protected readonly statusChanges: TaskStatusChangesInstance = inject(TaskStatusChangesStore);

  /**
   * Property properties
   *
   * @description
   * The collections of the panel.
   *
   * @type {TaskPropertiesStoreInstance}
   * @readonly
   */
  protected readonly properties: TaskPropertiesStoreInstance = inject(TaskPropertiesStore);

  /**
   * Property time
   *
   * @description
   * The time spent and the timer.
   *
   * @type {TaskTimeStoreInstance}
   * @readonly
   */
  protected readonly time: TaskTimeStoreInstance = inject(TaskTimeStore);

  /**
   * Property now
   *
   * @description
   * The panel's clock (epoch milliseconds), moved every `CLOCK_MS`.
   *
   * @type {WritableSignal<number>}
   * @readonly
   */
  protected readonly now: WritableSignal<number> = signal<number>(Date.now());

  /**
   * Property today
   *
   * @description
   * Today (`YYYY-MM-DD`), following the clock.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly today: Signal<string> = computed((): string => localDay(new Date(this.now())));

  /**
   * Property status
   *
   * @description
   * The status shown: a pending click at once, else the task's.
   *
   * @type {Signal<StatusKey>}
   * @readonly
   */
  protected readonly status: Signal<StatusKey> = computed((): StatusKey => {
    const task: TaskDetailTask | null = this.store.task();
    return task ? this.statusChanges.displayedStatus(task) : 'todo';
  });

  /**
   * Property statusFrom
   *
   * @description
   * The previous status shown, which the icon morphs from.
   *
   * @type {Signal<StatusKey | null>}
   * @readonly
   */
  protected readonly statusFrom: Signal<StatusKey | null> = linkedSignal<
    StatusKey,
    StatusKey | null
  >({
    source: (): StatusKey => this.status(),
    computation: (_: StatusKey, previous?: { source: StatusKey }): StatusKey | null =>
      previous?.source ?? null,
  });

  /**
   * Property userId
   *
   * @description
   * The caller's account.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly userId: Signal<string> = computed((): string => this.workspace.user().id);

  /**
   * Property lists
   *
   * @description
   * The lists the task can move to: the sidebar's (Spaces' `LIST_DIRECTORY`).
   *
   * @type {Signal<readonly TaskListOption[]>}
   * @readonly
   */
  protected readonly lists: Signal<readonly TaskListOption[]> = computed(
    (): readonly TaskListOption[] =>
      (this.directory?.lists() ?? []).map((list: ListDirectoryEntry): TaskListOption => ({
        id: list.id,
        name: list.name,
        spaceName: list.spaceName,
        icon: list.icon,
      })),
  );

  /**
   * Property workspace
   *
   * @description
   * The committed workspace (the caller).
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  private readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property directory
   *
   * @description
   * The sidebar's lists, when Spaces provides them.
   *
   * @type {ListDirectoryPort | null}
   * @readonly
   */
  private readonly directory: ListDirectoryPort | null = inject(LIST_DIRECTORY, { optional: true });

  /**
   * Property opener
   *
   * @description
   * Opens another task's detail (a dependency).
   *
   * @type {TaskDetailOpener}
   * @readonly
   */
  private readonly opener: TaskDetailOpener = inject(TaskDetailOpener);

  /**
   * Property toasts
   *
   * @description
   * The toasts of the milestone switch and of an unreadable estimate.
   *
   * @type {CwToastService}
   * @readonly
   */
  private readonly toasts: CwToastService = inject(CwToastService);
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Moves the clock every `CLOCK_MS` while the panel lives.
   *
   * @constructor
   */
  public constructor() {
    const clock: ReturnType<typeof setInterval> = setInterval((): void => {
      this.now.set(Date.now());
    }, CLOCK_MS);
    inject(DestroyRef).onDestroy((): void => {
      clearInterval(clock);
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method changeStatus
   *
   * @description
   * Requests a status through the status interaction (shown at once, settled once). An advance
   * of the split button confirms with the change toast and `Undo`; a status picked from the menu
   * applies without it (`App.dc.html` line 8717), a failure still toasting.
   *
   * @param {StatusKey} status - The clicked status.
   * @param {boolean} [picked] - Whether the status was picked from the menu.
   */
  protected changeStatus(status: StatusKey, picked: boolean = false): void {
    const task: TaskDetailTask | null = this.store.task();
    if (task) {
      this.statusChanges.request(task, status, this.store.statuses(), { quiet: picked });
    }
  }

  /**
   * Method changeMilestone
   *
   * @description
   * Turns the task into a milestone or back; once saved, the toast `Marked as a milestone` or
   * `This is no longer a milestone` names the task.
   *
   * @param {boolean} milestone - Whether it becomes a milestone.
   * @returns {Promise<void>} Resolves once saved.
   */
  protected async changeMilestone(milestone: boolean): Promise<void> {
    const task: TaskDetailTask | null = this.store.task();
    if (!task || task.milestone === milestone) return;
    if (await this.store.update({ milestone })) {
      this.toasts.show(
        milestone
          ? $localize`:@@task.properties.milestone-on:Marked as a milestone`
          : $localize`:@@task.properties.milestone-off:This is no longer a milestone`,
        { description: `${task.key} · ${task.name}` },
      );
    }
  }

  /**
   * Method rejectEstimate
   *
   * @description
   * The toast of an unreadable estimate.
   *
   * @param {string} text - The typed text.
   */
  protected rejectEstimate(text: string): void {
    this.toasts.error($localize`:@@task.properties.estimate-rejected:Unrecognized duration`, {
      description: $localize`:@@task.properties.estimate-rejected-text:“${text}:text:”: try 1 h 30, 45 min or 2h15.`,
    });
  }

  /**
   * Method toggleTimer
   *
   * @description
   * Starts the timer, or stops it and records the time.
   */
  protected toggleTimer(): void {
    if (this.time.timerStartedAt() === null) {
      this.time.startTimer();
    } else {
      this.now.set(Date.now());
      void this.time.stopTimer(this.now());
    }
  }

  /**
   * Method reloadWatchers
   *
   * @description
   * `Retry` of the followers: the people and the watchers again.
   */
  protected reloadWatchers(): void {
    if (this.properties.peopleFailed()) void this.properties.reloadPeople();
    void this.properties.reloadWatchers();
  }

  /**
   * Method openTask
   *
   * @description
   * Opens the detail of a dependency's other task in the same dialog.
   *
   * @param {TaskDependencyTask} task - The task.
   */
  protected openTask(task: TaskDependencyTask): void {
    void this.opener.open(task.key, {
      key: task.key,
      name: task.name,
      status: task.status,
      milestone: task.milestone,
    });
  }
  // #endregion
}
