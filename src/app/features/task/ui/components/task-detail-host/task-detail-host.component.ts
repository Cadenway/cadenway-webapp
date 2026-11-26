import { Component, inject } from '@angular/core';

import { TaskDetailOpener } from '../../../services/task-detail-opener/task-detail-opener.service';
import { TaskDetailDialog } from '../../dialogs/task-detail-dialog/task-detail-dialog.component';

/**
 * Component TaskDetailHost
 *
 * @description
 * The shell's host of the task detail (`withTaskDetail()`, `overlays` slot), on every workspace
 * page: while the address carries `?task=<KEY>` it renders the detail dialog of that task, loaded
 * in its own chunk; another key shows that task in the same dialog. When the dialog closes it
 * removes `?task=` from the address, keeping the path and the other parameters. A navigation that
 * drops the parameter (Back) closes the dialog with it.
 */
@Component({
  selector: 'cw-task-detail-host',
  imports: [TaskDetailDialog],
  host: { class: 'contents' },
  template: `
    @if (opener.taskKey(); as key) {
      @defer (on immediate) {
        <cw-task-detail-dialog
          [taskKey]="key"
          [preview]="opener.preview()"
          (closed)="opener.close()"
        />
      }
    }
  `,
})
export class TaskDetailHost {
  // #region Properties
  /**
   * Property opener
   *
   * @description
   * The address's open task.
   *
   * @type {TaskDetailOpener}
   * @readonly
   */
  protected readonly opener: TaskDetailOpener = inject(TaskDetailOpener);
  // #endregion
}
