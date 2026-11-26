import {
  booleanAttribute,
  Component,
  input,
  type InputSignal,
  type InputSignalWithTransform,
  linkedSignal,
  output,
  type OutputEmitterRef,
  type Signal,
} from '@angular/core';
import { PRIORITY_KEYS, type PriorityKey } from '@cadenway/contracts';
import { CwMenu, CwMenuItem, CwMenuTriggerFor } from '@cadenway/ui/components/menu';
import { CwPriorityIcon } from '@cadenway/ui/components/priority-icon';

import { PRIORITY_LABELS } from '../../../constants/task-copy/task-copy.constants';

/**
 * Component TaskPropertyPriority
 *
 * @description
 * The `Priority` row of the task detail's properties (`App.dc.html` lines 2418-2428): the
 * trigger shows the priority icon, which morphs from the previous priority, and its word
 * (`Urgent` in the destructive tone); it opens the `Priority` menu (`Urgent`, `High`, `Medium`,
 * `Low`, the current one checked). A different pick emits `priorityChanged`.
 */
@Component({
  selector: 'cw-task-property-priority',
  imports: [CwMenu, CwMenuItem, CwMenuTriggerFor, CwPriorityIcon],
  template: `
    <button
      type="button"
      class="relative isolate flex min-h-8 w-full items-center gap-2 overflow-hidden rounded-md border border-transparent px-2 py-1 text-left text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset disabled:pointer-events-none aria-expanded:bg-selected"
      [class.text-destructive]="priority() === 'urgente'"
      [disabled]="disabled()"
      [cwMenuTriggerFor]="menu"
      data-testid="task-property-priority"
    >
      <cw-priority-icon [priority]="priority()" [from]="from()" size="4" />
      <span>{{ labels[priority()] }}</span>
    </button>
    <cw-menu #menu align="end" ariaLabel="Priority" i18n-ariaLabel="@@task.priority-picker.menu">
      @for (key of keys; track key) {
        <button cwMenuItem type="button" [selected]="key === priority()" (triggered)="choose(key)">
          <cw-priority-icon [priority]="key" size="4" />
          <span [class.text-destructive]="key === 'urgente'">{{ labels[key] }}</span>
        </button>
      }
    </cw-menu>
  `,
})
export class TaskPropertyPriority {
  // #region Properties
  /**
   * Property priority
   *
   * @description
   * The task's priority.
   *
   * @type {InputSignal<PriorityKey>}
   * @readonly
   */
  public readonly priority: InputSignal<PriorityKey> = input.required<PriorityKey>();

  /**
   * Property disabled
   *
   * @description
   * Read-only: the trigger opens nothing.
   *
   * @type {InputSignalWithTransform<boolean, unknown>}
   * @readonly
   */
  public readonly disabled: InputSignalWithTransform<boolean, unknown> = input(false, {
    transform: booleanAttribute,
  });

  /**
   * Property priorityChanged
   *
   * @description
   * A different priority picked.
   *
   * @type {OutputEmitterRef<PriorityKey>}
   * @readonly
   */
  public readonly priorityChanged: OutputEmitterRef<PriorityKey> = output<PriorityKey>();

  /**
   * Property keys
   *
   * @description
   * The priorities, most urgent first.
   *
   * @type {readonly PriorityKey[]}
   * @readonly
   */
  protected readonly keys: readonly PriorityKey[] = PRIORITY_KEYS;

  /**
   * Property labels
   *
   * @description
   * Words of the priorities.
   *
   * @type {Readonly<Record<PriorityKey, string>>}
   * @readonly
   */
  protected readonly labels: Readonly<Record<PriorityKey, string>> = PRIORITY_LABELS;

  /**
   * Property from
   *
   * @description
   * The previous priority, which the icon morphs from.
   *
   * @type {Signal<PriorityKey | null>}
   * @readonly
   */
  protected readonly from: Signal<PriorityKey | null> = linkedSignal<
    PriorityKey,
    PriorityKey | null
  >({
    source: (): PriorityKey => this.priority(),
    computation: (_: PriorityKey, previous?: { source: PriorityKey }): PriorityKey | null =>
      previous?.source ?? null,
  });
  // #endregion

  // #region Methods
  /**
   * Method choose
   *
   * @description
   * Emits a priority other than the current one.
   *
   * @param {PriorityKey} key - The picked priority.
   */
  protected choose(key: PriorityKey): void {
    if (key !== this.priority()) this.priorityChanged.emit(key);
  }
  // #endregion
}
