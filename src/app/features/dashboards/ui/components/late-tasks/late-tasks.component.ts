import {
  Component,
  computed,
  ElementRef,
  inject,
  input,
  type InputSignal,
  output,
  type OutputEmitterRef,
  type Signal,
} from '@angular/core';
import { CwContextMenuTriggerFor } from '@cadenway/ui/components/context-menu';
import { CwEmpty, CwEmptyDescription } from '@cadenway/ui/components/empty';
import type { CwMenu } from '@cadenway/ui/components/menu';

import { TaskLine, type TaskSummary } from '@features/task';

import type { LateTaskRow } from '../../../models/late-task-row/late-task-row.interface';
import { takesSingular } from '../../../utils/plural/plural.util';

/**
 * Component LateTasks
 *
 * @description
 * The `Late` section of the dashboard (`App.dc.html` lines 1873-1889): Task's `cw-task-line`
 * rows in their `late` variant (status, name, list from 640 px, assignees' initials, due date),
 * the first ten the contract returns (gap G-D1), then a `+N more late tasks` line when there are
 * more. A click on a row emits `opened`; its context menu (right click, Shift F10, the Menu key)
 * opens the page's task menu, `menu`, after `menuOpened` gave the row's key. `focusFirst` gives
 * the focus back after a deletion. Without a late task, a
 * dashed box says so (`No late tasks.`). Presentational: inputs and outputs.
 */
@Component({
  selector: 'cw-late-tasks',
  imports: [CwContextMenuTriggerFor, CwEmpty, CwEmptyDescription, TaskLine],
  host: { class: 'block' },
  templateUrl: './late-tasks.component.html',
})
export class LateTasks {
  // #region Properties
  /**
   * Property rows
   *
   * @description
   * The late tasks shown, by due date then key.
   *
   * @type {InputSignal<readonly LateTaskRow[]>}
   * @readonly
   */
  public readonly rows: InputSignal<readonly LateTaskRow[]> =
    input.required<readonly LateTaskRow[]>();

  /**
   * Property hidden
   *
   * @description
   * Late tasks past the rows, which the `+N` line counts; none by default.
   *
   * @type {InputSignal<number>}
   * @readonly
   */
  public readonly hidden: InputSignal<number> = input<number>(0);

  /**
   * Property menu
   *
   * @description
   * The task menu each row's context menu opens.
   *
   * @type {InputSignal<CwMenu>}
   * @readonly
   */
  public readonly menu: InputSignal<CwMenu> = input.required<CwMenu>();

  /**
   * Property opened
   *
   * @description
   * Emits the task of a clicked row.
   *
   * @type {OutputEmitterRef<TaskSummary>}
   * @readonly
   */
  public readonly opened: OutputEmitterRef<TaskSummary> = output<TaskSummary>();

  /**
   * Property menuOpened
   *
   * @description
   * Emits the key of the task whose context menu opens, before the menu shows.
   *
   * @type {OutputEmitterRef<string>}
   * @readonly
   */
  public readonly menuOpened: OutputEmitterRef<string> = output<string>();

  /**
   * Property host
   *
   * @description
   * The section, whose rows and heading take the focus back.
   *
   * @type {ElementRef<HTMLElement>}
   * @readonly
   */
  private readonly host: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * Property moreLabel
   *
   * @description
   * The `+N more late tasks` line.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly moreLabel: Signal<string> = computed((): string => {
    const count: number = this.hidden();
    return takesSingular(count)
      ? $localize`:@@dashboards.late.more-one:+${count}:count: more late task`
      : $localize`:@@dashboards.late.more-other:+${count}:count: more late tasks`;
  });
  // #endregion

  // #region Methods
  /**
   * Method focusFirst
   *
   * @description
   * Focuses the first of these tasks still shown, else the `Late` heading (over the empty state
   * when no row is left).
   *
   * @param {readonly string[]} keys - Task keys, in order of preference.
   */
  public focusFirst(keys: readonly string[]): void {
    const rows: HTMLElement[] = [
      ...this.host.nativeElement.querySelectorAll<HTMLElement>('[data-task-key]'),
    ];
    for (const key of keys) {
      const row: HTMLElement | undefined = rows.find(
        (element: HTMLElement): boolean => element.dataset['taskKey'] === key,
      );
      const button: HTMLButtonElement | null = row?.querySelector('button') ?? null;
      if (button) {
        button.focus();
        return;
      }
    }
    this.host.nativeElement.querySelector<HTMLElement>('h2')?.focus();
  }
  // #endregion
}
