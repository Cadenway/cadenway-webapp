import {
  booleanAttribute,
  Component,
  input,
  type InputSignal,
  type InputSignalWithTransform,
  output,
  type OutputEmitterRef,
} from '@angular/core';
import { CwMenu, CwMenuItem, CwMenuTriggerFor } from '@cadenway/ui/components/menu';
import { NgIcon } from '@ng-icons/core';

import type { TaskListOption } from '../../dialogs/task-list-picker-dialog/task-list-picker-dialog.component';

/**
 * Component TaskPropertyList
 *
 * @description
 * The `List` row of the task detail's properties (`App.dc.html` lines 2518-2528): the trigger
 * shows the list's name and its space's; it opens the `List` menu of the sidebar's lists, each
 * with its space as a hint and the current one checked. Another list emits `picked`; the
 * container moves the task (`Moved` toast, no undo).
 */
@Component({
  selector: 'cw-task-property-list',
  imports: [CwMenu, CwMenuItem, CwMenuTriggerFor, NgIcon],
  template: `
    <button
      type="button"
      class="relative isolate flex min-h-8 w-full items-center gap-2 overflow-hidden rounded-md border border-transparent px-2 py-1 text-left text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset disabled:pointer-events-none aria-expanded:bg-selected"
      [disabled]="disabled() || lists().length === 0"
      [cwMenuTriggerFor]="menu"
      data-testid="task-property-list"
    >
      <span class="truncate">{{ listName() }}</span>
      <span class="truncate text-xs text-muted-foreground">{{ spaceName() }}</span>
    </button>
    <cw-menu #menu align="end" ariaLabel="List" i18n-ariaLabel="@@task.properties.list">
      @for (list of lists(); track list.id) {
        <button
          cwMenuItem
          type="button"
          [selected]="list.id === currentListId()"
          (triggered)="pick(list)"
        >
          <ng-icon name="phosphorListBulletsBold" aria-hidden="true" />
          <span class="truncate">{{ list.name }}</span>
          <span class="ml-auto pl-3 text-xs text-muted-foreground">{{ list.spaceName }}</span>
        </button>
      }
    </cw-menu>
  `,
})
export class TaskPropertyList {
  // #region Properties
  /**
   * Property listName
   *
   * @description
   * Name of the task's list.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly listName: InputSignal<string> = input<string>('');

  /**
   * Property spaceName
   *
   * @description
   * Name of the list's space.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly spaceName: InputSignal<string> = input<string>('');

  /**
   * Property currentListId
   *
   * @description
   * Id of the task's list.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly currentListId: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property lists
   *
   * @description
   * The lists the task can move to (the sidebar's); none leaves the trigger inert.
   *
   * @type {InputSignal<readonly TaskListOption[]>}
   * @readonly
   */
  public readonly lists: InputSignal<readonly TaskListOption[]> = input<readonly TaskListOption[]>(
    [],
  );

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
   * Property picked
   *
   * @description
   * Another list picked.
   *
   * @type {OutputEmitterRef<TaskListOption>}
   * @readonly
   */
  public readonly picked: OutputEmitterRef<TaskListOption> = output<TaskListOption>();
  // #endregion

  // #region Methods
  /**
   * Method pick
   *
   * @description
   * Emits a list other than the current one.
   *
   * @param {TaskListOption} list - The list.
   */
  protected pick(list: TaskListOption): void {
    if (list.id !== this.currentListId()) this.picked.emit(list);
  }
  // #endregion
}
