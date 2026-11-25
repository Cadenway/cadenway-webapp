import {
  booleanAttribute,
  Component,
  computed,
  input,
  type InputSignal,
  type InputSignalWithTransform,
  linkedSignal,
  output,
  type OutputEmitterRef,
  type Signal,
} from '@angular/core';
import { PRIORITY_KEYS, type PriorityKey } from '@cadenway/contracts';
import { CwButton } from '@cadenway/ui/components/button';
import { CwMenu, CwMenuItem, CwMenuTriggerFor } from '@cadenway/ui/components/menu';
import { CwPriorityIcon } from '@cadenway/ui/components/priority-icon';

import { PRIORITY_LABELS } from '../../../constants/task-copy/task-copy.constants';

/**
 * Component TaskPriorityPicker
 *
 * @description
 * The priority property of the task detail and the create dialog (`App.dc.html` near line
 * 2940): a button with the priority icon and word that opens the menu of the four priorities,
 * from `Urgent` to `Low`, the current one marked. It emits `priorityChanged` with the
 * chosen key; the owner passes the new priority back.
 */
@Component({
  selector: 'cw-task-priority-picker',
  imports: [CwButton, CwMenu, CwMenuItem, CwMenuTriggerFor, CwPriorityIcon],
  template: `
    <button
      cwButton
      type="button"
      variant="outline"
      size="xs"
      class="h-7 w-full justify-start"
      [disabled]="disabled()"
      [cwMenuTriggerFor]="menu"
      [attr.aria-label]="ariaLabel()"
      [class.text-destructive]="priority() === 'urgente'"
    >
      <cw-priority-icon [priority]="priority()" [from]="from()" size="3.5" />
      <span>{{ label() }}</span>
    </button>
    <cw-menu #menu ariaLabel="Priority" i18n-ariaLabel="@@task.priority-picker.menu">
      @for (key of keys; track key) {
        <button cwMenuItem type="button" [selected]="key === priority()" (triggered)="choose(key)">
          <cw-priority-icon [priority]="key" size="4" />
          <span [class.text-destructive]="key === 'urgente'">{{ labels[key] }}</span>
        </button>
      }
    </cw-menu>
  `,
})
export class TaskPriorityPicker {
  // #region Properties
  /**
   * Property priority
   *
   * @description
   * Priority shown.
   *
   * @type {InputSignal<PriorityKey>}
   * @readonly
   */
  public readonly priority: InputSignal<PriorityKey> = input.required<PriorityKey>();

  /**
   * Property from
   *
   * @description
   * The priority the icon animates from (`PrioriteTache.dc.html`): the one shown before the last
   * change, none at first.
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

  /**
   * Property disabled
   *
   * @description
   * Whether the priority cannot be changed.
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
   * Emits the priority chosen in the menu, when it differs from the shown one.
   *
   * @type {OutputEmitterRef<PriorityKey>}
   * @readonly
   */
  public readonly priorityChanged: OutputEmitterRef<PriorityKey> = output<PriorityKey>();

  /**
   * Property keys
   *
   * @description
   * The four priorities, most urgent first.
   *
   * @type {readonly PriorityKey[]}
   * @readonly
   */
  protected readonly keys: readonly PriorityKey[] = PRIORITY_KEYS;

  /**
   * Property labels
   *
   * @description
   * Word of each priority.
   *
   * @type {Readonly<Record<PriorityKey, string>>}
   * @readonly
   */
  protected readonly labels: Readonly<Record<PriorityKey, string>> = PRIORITY_LABELS;

  /**
   * Property label
   *
   * @description
   * Word of the shown priority.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly label: Signal<string> = computed(
    (): string => PRIORITY_LABELS[this.priority()],
  );

  /**
   * Property ariaLabel
   *
   * @description
   * Accessible name of the button (`Priority: High`).
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly ariaLabel: Signal<string> = computed(
    (): string => $localize`:@@task.priority-picker.label:Priority: ${this.label()}:priority:`,
  );
  // #endregion

  // #region Methods
  /**
   * Method choose
   *
   * @description
   * Emits a priority chosen in the menu unless it is the shown one.
   *
   * @param {PriorityKey} priority - Chosen priority.
   */
  protected choose(priority: PriorityKey): void {
    if (priority !== this.priority()) this.priorityChanged.emit(priority);
  }
  // #endregion
}
