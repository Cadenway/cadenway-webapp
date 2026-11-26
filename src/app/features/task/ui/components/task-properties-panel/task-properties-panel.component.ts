import { Component, inject } from '@angular/core';

import {
  TaskDetailStore,
  type TaskDetailStoreInstance,
} from '../../../state/task-detail/task-detail.store';

/**
 * Component TaskPropertiesPanel
 *
 * @description
 * Placeholder of the properties panel of the task detail (`App.dc.html` lines 2368-2610), rendered
 * by the detail dialog in its aside (`Properties of the task`, `md:w-96`, its own scroll; below
 * the content under 768 px). It shows the `Properties` heading only until its builder fills it.
 *
 * Extension point: it is a container of the detail dialog, which acts as a page and provides
 * `TaskDetailStore`; it reads `task`, `statuses`, `space`, `list`, `canEdit`, `subtasks` and
 * `isPending(field)`, and writes every field through `update(patch)` (optimistic, `If-Match`,
 * rollback, `412` handled). Status goes through Task's `TaskStatusChangesStore`, which the dialog
 * provides and whose completed writes make the detail read again; collection writes (assignees,
 * labels, approvers, dependencies, time entries) hand the task they return to `accept(task)` or
 * their new version to `acceptVersion(version)`. `Move to…` of the header already opens the list
 * picker; the panel's `List` row may reuse `cw-task-list-picker-dialog`.
 */
@Component({
  selector: 'cw-task-properties-panel',
  host: { class: 'flex flex-col gap-1' },
  template: `<p
    class="px-2 pt-1 pb-1 text-xs font-medium text-muted-foreground"
    i18n="@@task.detail.properties"
  >
    Properties
  </p>`,
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
  // #endregion
}
