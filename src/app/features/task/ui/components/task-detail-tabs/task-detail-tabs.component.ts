import { Component, inject } from '@angular/core';

import {
  TaskDetailStore,
  type TaskDetailStoreInstance,
} from '../../../state/task-detail/task-detail.store';

/**
 * Component TaskDetailTabs
 *
 * @description
 * Placeholder of the left column of the task detail (`App.dc.html` lines 2111-2366): the tab list
 * `Sections of the task` (`Details`, `Subtasks`, `Comments`, `Activity`, `Details` selected at
 * each opening) and the scrolling area (`px-4 py-4`) with the comment composer pinned at the
 * bottom. The detail dialog renders it in a column that fills the height on desktop and flows in
 * the page scroll under 768 px. It renders nothing until its builder fills it.
 *
 * Extension point: it is a container of the detail dialog, which acts as a page and provides
 * `TaskDetailStore`; it reads `task` (description, checklist items), `subtasks`, `comments`
 * (the first page; `commentsFailed` with `reloadComments()` is the inline error of a partial
 * detail), `commentsRevision` and `gitRevision` (pushed comment and Git link notices, to read
 * later comment pages and the development panel again), and writes the description through
 * `update({ description })`; checklist, subtask, comment, attachment and Git writes go through
 * their own data-access methods and hand the task they return to `accept(task)`.
 */
@Component({
  selector: 'cw-task-detail-tabs',
  host: { class: 'flex min-h-0 min-w-0 flex-1 flex-col' },
  template: '',
})
export class TaskDetailTabs {
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
