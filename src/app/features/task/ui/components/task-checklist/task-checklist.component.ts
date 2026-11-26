import {
  Component,
  computed,
  type ElementRef,
  input,
  type InputSignal,
  output,
  type OutputEmitterRef,
  type Signal,
  signal,
  viewChild,
  type WritableSignal,
} from '@angular/core';
import { CwCheckbox } from '@cadenway/ui/components/checkbox';
import { CwInput } from '@cadenway/ui/components/input';
import { CwProgress } from '@cadenway/ui/components/progress';
import { NgIcon } from '@ng-icons/core';

import type { TaskAddRequest } from '../../../models/task-detail-sections/task-detail-sections.interface';
import type { TaskChecklistItem } from '../../../models/task-detail/task-detail.interface';

/**
 * Component TaskChecklist
 *
 * @description
 * The `Checklist` of `Details` (`App.dc.html` lines 2141-2168): `<done> / <n>` with its bar, the
 * items with their box (`Complete: <item>` or `Reopen: <item>`, ticked items struck through), the
 * empty text, then `Add an item`, which opens a field: Enter emits `added` and keeps it open,
 * emptied for the next item once the item is saved (a refused one keeps its text), Escape (or leaving it empty) closes it. The mockup has no deletion,
 * edition or reordering. Without edit rights the boxes are disabled and nothing can be added.
 */
@Component({
  selector: 'cw-task-checklist',
  imports: [CwCheckbox, CwInput, CwProgress, NgIcon],
  host: { class: 'flex flex-col gap-1 px-2' },
  templateUrl: './task-checklist.component.html',
})
export class TaskChecklist {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * The items, pending ticks shown.
   *
   * @type {InputSignal<readonly TaskChecklistItem[]>}
   * @readonly
   */
  public readonly items: InputSignal<readonly TaskChecklistItem[]> =
    input.required<readonly TaskChecklistItem[]>();

  /**
   * Property canEdit
   *
   * @description
   * Whether the caller may tick and add.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly canEdit: InputSignal<boolean> = input<boolean>(true);

  /**
   * Property toggled
   *
   * @description
   * Emits the item whose box was clicked.
   *
   * @type {OutputEmitterRef<TaskChecklistItem>}
   * @readonly
   */
  public readonly toggled: OutputEmitterRef<TaskChecklistItem> = output<TaskChecklistItem>();

  /**
   * Property added
   *
   * @description
   * Emits the text of a new item, trimmed and not blank, with how its addition settled.
   *
   * @type {OutputEmitterRef<TaskAddRequest>}
   * @readonly
   */
  public readonly added: OutputEmitterRef<TaskAddRequest> = output<TaskAddRequest>();

  /**
   * Property adding
   *
   * @description
   * Whether the add field is open.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly adding: WritableSignal<boolean> = signal<boolean>(false);

  /**
   * Property done
   *
   * @description
   * Ticked items.
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly done: Signal<number> = computed(
    (): number => this.items().filter((item: TaskChecklistItem) => item.done).length,
  );

  /**
   * Property field
   *
   * @description
   * The add field while open.
   *
   * @type {Signal<ElementRef<HTMLInputElement> | undefined>}
   * @readonly
   */
  private readonly field: Signal<ElementRef<HTMLInputElement> | undefined> =
    viewChild<ElementRef<HTMLInputElement>>('field');
  // #endregion

  // #region Methods
  /**
   * Method itemLabel
   *
   * @description
   * Accessible name of an item's box.
   *
   * @param {TaskChecklistItem} item - The item.
   * @returns {string} The name.
   */
  protected itemLabel(item: TaskChecklistItem): string {
    return item.done
      ? $localize`:@@task.checklist.reopen:Reopen: ${item.text}:item:`
      : $localize`:@@task.checklist.complete:Complete: ${item.text}:item:`;
  }

  /**
   * Method open
   *
   * @description
   * Opens the add field and focuses it.
   */
  protected open(): void {
    this.adding.set(true);
    queueMicrotask((): void => this.field()?.nativeElement.focus());
  }

  /**
   * Method key
   *
   * @description
   * Enter adds the typed item and keeps the field open; Escape closes it.
   *
   * @param {KeyboardEvent} event - The key event of the field.
   */
  protected key(event: KeyboardEvent): void {
    const field: HTMLInputElement = event.target as HTMLInputElement;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.adding.set(false);
      return;
    }
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    const text: string = field.value.trim();
    if (text === '') return;
    this.added.emit({
      text,
      settle: (saved: boolean): void => {
        if (saved && field.value.trim() === text) field.value = '';
      },
    });
  }

  /**
   * Method blurred
   *
   * @description
   * Leaving an empty field closes it.
   *
   * @param {FocusEvent} event - The blur event of the field.
   */
  protected blurred(event: FocusEvent): void {
    if ((event.target as HTMLInputElement).value.trim() === '') this.adding.set(false);
  }
  // #endregion
}
