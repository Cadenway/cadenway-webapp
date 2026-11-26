import { Component, computed, input, type InputSignal, type Signal } from '@angular/core';
import { CwProgress } from '@cadenway/ui/components/progress';

import type { TaskProgress } from '../../../models/task-summary/task-summary.interface';

/**
 * Component TaskPropertySubtasks
 *
 * @description
 * The subtask progress at the bottom of the task detail's properties (`App.dc.html` lines
 * 2604-2609): `Subtasks` with `{d} / {n} done` and a jade bar, shown when the task has subtasks.
 */
@Component({
  selector: 'cw-task-property-subtasks',
  imports: [CwProgress],
  template: `
    @if (progress().total > 0) {
      <div class="mt-2 flex flex-col gap-1.5 border-t border-border px-2 pt-3">
        <div class="flex justify-between text-sm">
          <span class="font-medium" i18n="@@task.properties.subtasks">Subtasks</span>
          <span class="whitespace-nowrap text-muted-foreground tabular-nums">{{ label() }}</span>
        </div>
        <cw-progress
          size="sm"
          variant="success"
          [value]="progress().closed"
          [max]="progress().total"
          [valueText]="label()"
          ariaLabel="Subtasks"
          i18n-ariaLabel="@@task.properties.subtasks"
        />
      </div>
    }
  `,
})
export class TaskPropertySubtasks {
  // #region Properties
  /**
   * Property progress
   *
   * @description
   * Closed and total subtasks.
   *
   * @type {InputSignal<TaskProgress>}
   * @readonly
   */
  public readonly progress: InputSignal<TaskProgress> = input<TaskProgress>({
    closed: 0,
    total: 0,
  });

  /**
   * Property label
   *
   * @description
   * `{d} / {n} done`.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly label: Signal<string> = computed((): string => {
    const { closed, total }: TaskProgress = this.progress();
    return $localize`:@@task.properties.subtasks-done:${closed}:closed: / ${total}:total: done`;
  });
  // #endregion
}
