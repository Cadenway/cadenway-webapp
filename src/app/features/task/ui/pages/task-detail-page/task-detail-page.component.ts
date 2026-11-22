import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, type InputSignal, type Signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwEmpty,
  CwEmptyContent,
  CwEmptyDescription,
  CwEmptyHeader,
} from '@cadenway/ui/components/empty';
import { CwMarkdown } from '@cadenway/ui/components/markdown';
import { CwSelect, CwSelectOption } from '@cadenway/ui/components/select';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { CwStatusIcon } from '@cadenway/ui/components/status-icon';

import { TASK_STATUS_LABELS } from '../../../constants/task-detail/task-detail-copy.constants';
import type {
  TaskDetailView,
  TaskRouteContext,
} from '../../../models/task-detail/task-detail.model';
import { TaskDetailStore } from '../../../state/task-detail/task-detail.store';

/**
 * Class TaskDetailPage
 *
 * @description
 * Displays the task accessible in the active organization and delegates status changes to its page store.
 */
@Component({
  selector: 'cw-task-detail-page',
  templateUrl: './task-detail-page.component.html',
  imports: [
    RouterLink,
    DatePipe,
    CwButton,
    CwEmpty,
    CwEmptyContent,
    CwEmptyDescription,
    CwEmptyHeader,
    CwMarkdown,
    CwSelect,
    CwSelectOption,
    CwSkeleton,
    CwStatusIcon,
  ],
  providers: [TaskDetailStore],
})
export class TaskDetailPage {
  // #region Properties
  /**
   * Property taskKey
   *
   * @description
   * The current key bound by the route, including changes while the route is reused.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly taskKey: InputSignal<string> = input.required<string>();

  /**
   * Property organizationId
   *
   * @description
   * The active organization verified when resolving the current task route.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly organizationId: InputSignal<string> = input.required<string>();

  /**
   * Property store
   *
   * @description
   * Holds only the task data and write state for the current page.
   *
   * @type {InstanceType<typeof TaskDetailStore>}
   * @readonly
   */
  protected readonly store: InstanceType<typeof TaskDetailStore> = inject(TaskDetailStore);

  /**
   * Property statusLabel
   *
   * @description
   * Space-specific label for the displayed status, including a hidden current status.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly statusLabel: Signal<string> = computed(() => {
    const task: TaskDetailView | undefined = this.store.detail();
    if (!task) return '';
    return (
      task.options.find((option) => option.key === task.status)?.label ??
      TASK_STATUS_LABELS[task.status]
    );
  });
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Loads the task identified by the router and follows changes until the page is destroyed.
   *
   * @constructor
   */
  public constructor() {
    this.store.followTask(
      computed<TaskRouteContext>(() => ({
        key: this.taskKey(),
        organizationId: this.organizationId(),
      })),
    );
  }
  // #endregion
}
