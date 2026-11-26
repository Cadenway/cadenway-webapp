import { Component, input, type InputSignal, model, type ModelSignal } from '@angular/core';

import type { TaskList } from '../../../models/task-list/task-list.interface';

/**
 * Component SprintReportDialog
 *
 * @description
 * `Sprint report` (`App.dc.html` lines 2729-2776): a sprint's burndown and velocity. A stub
 * hosted by the list page, which opens it from the `Sprint report` button of a sprint's goal line
 * (`App.dc.html` line 309); the opener shows once the lead adds the dialog to
 * `RELEASED_LIST_DIALOGS`. The dialog's package owns this folder and keeps these inputs: `open`
 * (two-way; the dialog sets it to false when it closes) and `list`, always a sprint.
 */
@Component({
  selector: 'cw-sprint-report-dialog',
  templateUrl: './sprint-report-dialog.component.html',
})
export class SprintReportDialog {
  // #region Properties
  /**
   * Property open
   *
   * @description
   * Whether the dialog shows; `[(open)]`.
   *
   * @type {ModelSignal<boolean>}
   * @readonly
   */
  public readonly open: ModelSignal<boolean> = model(false);

  /**
   * Property list
   *
   * @description
   * The list the dialog is about, or null while it is read.
   *
   * @type {InputSignal<TaskList | null>}
   * @readonly
   */
  public readonly list: InputSignal<TaskList | null> = input<TaskList | null>(null);
  // #endregion
}
