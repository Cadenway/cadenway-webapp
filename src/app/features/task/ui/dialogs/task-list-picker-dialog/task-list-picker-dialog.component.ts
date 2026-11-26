import {
  Component,
  computed,
  input,
  type InputSignal,
  model,
  type ModelSignal,
  output,
  type OutputEmitterRef,
  type Signal,
  signal,
  type WritableSignal,
} from '@angular/core';
import { CwDialog, CwDialogHeader, CwDialogTitle } from '@cadenway/ui/components/dialog';
import { NgIcon } from '@ng-icons/core';

/**
 * Interface TaskListOption
 *
 * @description
 * A list the task can move to, with its space as hint.
 */
export interface TaskListOption {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Identifier of the list.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * Name of the list.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property spaceName
   *
   * @description
   * Name of its space.
   *
   * @type {string}
   * @readonly
   */
  readonly spaceName: string;

  /**
   * Property icon
   *
   * @description
   * Bold icon of the list.
   *
   * @type {string}
   * @readonly
   */
  readonly icon: string;
  // #endregion
}

/**
 * Component TaskListPickerDialog
 *
 * @description
 * `Move to…` (`App.dc.html` lines 2518-2528, 9067-9070): the lists of the workspace, each with its
 * space as hint, filtered by name, the current one checked. Picking another list emits it and
 * closes; the detail dialog moves the task (`{id} moved`, `To {list}.`, no undo). It only emits.
 */
@Component({
  selector: 'cw-task-list-picker-dialog',
  imports: [CwDialog, CwDialogHeader, CwDialogTitle, NgIcon],
  templateUrl: './task-list-picker-dialog.component.html',
})
export class TaskListPickerDialog {
  // #region Properties
  /**
   * Property open
   *
   * @description
   * Whether the dialog is open.
   *
   * @type {ModelSignal<boolean>}
   * @readonly
   */
  public readonly open: ModelSignal<boolean> = model<boolean>(false);

  /**
   * Property lists
   *
   * @description
   * The lists the task can move to, in sidebar order.
   *
   * @type {InputSignal<readonly TaskListOption[]>}
   * @readonly
   */
  public readonly lists: InputSignal<readonly TaskListOption[]> = input<readonly TaskListOption[]>(
    [],
  );

  /**
   * Property currentListId
   *
   * @description
   * The task's list, checked and not pickable.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly currentListId: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property picked
   *
   * @description
   * Emitted with the chosen list.
   *
   * @type {OutputEmitterRef<TaskListOption>}
   * @readonly
   */
  public readonly picked: OutputEmitterRef<TaskListOption> = output<TaskListOption>();

  /**
   * Property query
   *
   * @description
   * The typed filter.
   *
   * @type {WritableSignal<string>}
   * @readonly
   */
  protected readonly query: WritableSignal<string> = signal<string>('');

  /**
   * Property shown
   *
   * @description
   * The lists whose name or space matches the filter, without regard to case or accents.
   *
   * @type {Signal<readonly TaskListOption[]>}
   * @readonly
   */
  protected readonly shown: Signal<readonly TaskListOption[]> = computed(
    (): readonly TaskListOption[] => {
      const fold: (text: string) => string = (text: string): string => {
        return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
      };
      const query: string = fold(this.query().trim());
      return query === ''
        ? this.lists()
        : this.lists().filter((list: TaskListOption): boolean =>
            fold(`${list.name} ${list.spaceName}`).includes(query),
          );
    },
  );
  // #endregion

  // #region Methods
  /**
   * Method pick
   *
   * @description
   * Emits another list and closes; the current one only closes.
   *
   * @param {TaskListOption} list - The chosen list.
   */
  protected pick(list: TaskListOption): void {
    if (list.id !== this.currentListId()) this.picked.emit(list);
    this.query.set('');
    this.open.set(false);
  }
  // #endregion
}
