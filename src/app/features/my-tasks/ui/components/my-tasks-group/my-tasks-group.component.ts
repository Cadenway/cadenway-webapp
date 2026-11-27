import { Component, input, type InputSignal, output, type OutputEmitterRef } from '@angular/core';
import { CwContextMenuTriggerFor } from '@cadenway/ui/components/context-menu';
import type { CwMenu } from '@cadenway/ui/components/menu';

import { TaskLine, type TaskSummary } from '@features/task';

import type { MyTaskRow } from '../../../models/my-tasks-group/my-tasks-group.interface';

/**
 * Component MyTasksGroup
 *
 * @description
 * One group of `My tasks` (`App.dc.html` lines 1761-1779): a section named by its label, an `h2`
 * with the label and the number of lines (`late` paints it grenat), then one Task `cw-task-line`
 * (`mine` variant) per row in a bordered list. Each list item opens the page's task menu on right
 * click, Shift F10, the Menu key or a long press (`[cwContextMenuTriggerFor]`), and says which
 * task it opened it for (`menuOpened`); the trigger sits on the item rather than on the line,
 * whose own `opened` output would otherwise receive the menu's. Below 768 px the key is hidden,
 * below 640 px the list and the priority (Task's line). Presentational: inputs and outputs only.
 */
@Component({
  selector: 'cw-my-tasks-group',
  imports: [CwContextMenuTriggerFor, TaskLine],
  host: { class: 'block' },
  templateUrl: './my-tasks-group.component.html',
})
export class MyTasksGroup {
  // #region Properties
  /**
   * Property label
   *
   * @description
   * The group's name, also the section's accessible name.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly label: InputSignal<string> = input.required<string>();

  /**
   * Property late
   *
   * @description
   * Whether the group holds the late tasks, whose heading is grenat.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly late: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property rows
   *
   * @description
   * The lines, never empty.
   *
   * @type {InputSignal<readonly MyTaskRow[]>}
   * @readonly
   */
  public readonly rows: InputSignal<readonly MyTaskRow[]> = input.required<readonly MyTaskRow[]>();

  /**
   * Property menu
   *
   * @description
   * The page's task menu (`TaskMenu.menu()`), opened from each line.
   *
   * @type {InputSignal<CwMenu>}
   * @readonly
   */
  public readonly menu: InputSignal<CwMenu> = input.required<CwMenu>();

  /**
   * Property opened
   *
   * @description
   * Emits the task of a clicked or activated line.
   *
   * @type {OutputEmitterRef<TaskSummary>}
   * @readonly
   */
  public readonly opened: OutputEmitterRef<TaskSummary> = output<TaskSummary>();

  /**
   * Property menuOpened
   *
   * @description
   * Emits the task whose line opened the menu, as it opens.
   *
   * @type {OutputEmitterRef<TaskSummary>}
   * @readonly
   */
  public readonly menuOpened: OutputEmitterRef<TaskSummary> = output<TaskSummary>();
  // #endregion
}
