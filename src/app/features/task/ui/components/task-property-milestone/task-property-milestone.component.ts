import {
  booleanAttribute,
  Component,
  computed,
  input,
  type InputSignal,
  type InputSignalWithTransform,
  output,
  type OutputEmitterRef,
  type Signal,
} from '@angular/core';
import type { StatusKey } from '@cadenway/contracts';
import { CwSwitch } from '@cadenway/ui/components/switch';

import { localDay } from '../../../utils/task-property/task-property.util';

/**
 * Component TaskPropertyMilestone
 *
 * @description
 * The `Milestone` row of the task detail's properties (`App.dc.html` lines 2548-2552 and
 * 5332-5344): the `Mark as a milestone` switch and its hint, `Key date, no duration`, or for a
 * milestone `Reached` once done and `Late` past its date. A toggle emits `milestoneChanged`; the
 * gateway then clears the estimate, aligns the start on the due date and maps the status
 * (`To do` becomes `Upcoming`, `Blocked` `At risk`, `Done` `Reached`; another one `Upcoming`).
 */
@Component({
  selector: 'cw-task-property-milestone',
  imports: [CwSwitch],
  host: { class: 'flex min-h-8 items-center gap-2 px-2' },
  template: `
    <cw-switch
      ariaLabel="Mark as a milestone"
      i18n-ariaLabel="@@task.properties.milestone-switch"
      [checked]="milestone()"
      [disabled]="disabled()"
      (checkedChange)="milestoneChanged.emit($event)"
    />
    <span class="text-xs text-muted-foreground">{{ hint() }}</span>
  `,
})
export class TaskPropertyMilestone {
  // #region Properties
  /**
   * Property milestone
   *
   * @description
   * Whether the task is a milestone.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly milestone: InputSignal<boolean> = input(false);

  /**
   * Property status
   *
   * @description
   * Status of the task.
   *
   * @type {InputSignal<StatusKey>}
   * @readonly
   */
  public readonly status: InputSignal<StatusKey> = input<StatusKey>('todo');

  /**
   * Property due
   *
   * @description
   * Due date of the task, or null.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly due: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property today
   *
   * @description
   * Today (`YYYY-MM-DD`).
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly today: InputSignal<string> = input<string>(localDay(new Date()));

  /**
   * Property disabled
   *
   * @description
   * Read-only: the switch is disabled.
   *
   * @type {InputSignalWithTransform<boolean, unknown>}
   * @readonly
   */
  public readonly disabled: InputSignalWithTransform<boolean, unknown> = input(false, {
    transform: booleanAttribute,
  });

  /**
   * Property milestoneChanged
   *
   * @description
   * The switch toggled: whether the task becomes a milestone.
   *
   * @type {OutputEmitterRef<boolean>}
   * @readonly
   */
  public readonly milestoneChanged: OutputEmitterRef<boolean> = output<boolean>();

  /**
   * Property hint
   *
   * @description
   * What the switch means now.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly hint: Signal<string> = computed((): string => {
    const due: string | null = this.due();
    if (this.milestone() && this.status() === 'done') {
      return $localize`:@@task.properties.milestone-reached:Reached`;
    }
    if (this.milestone() && due !== null && due.slice(0, 10) < this.today()) {
      return $localize`:@@task.properties.milestone-late:Late`;
    }
    return $localize`:@@task.properties.milestone-hint:Key date, no duration`;
  });
  // #endregion
}
