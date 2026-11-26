import {
  booleanAttribute,
  Component,
  computed,
  inject,
  input,
  type InputSignal,
  type InputSignalWithTransform,
  LOCALE_ID,
  output,
  type OutputEmitterRef,
  type Signal,
} from '@angular/core';
import { RECURRENCES, type Recurrence } from '@cadenway/contracts';
import {
  CwMenu,
  CwMenuItemRadio,
  CwMenuRadioGroup,
  CwMenuTriggerFor,
} from '@cadenway/ui/components/menu';

import {
  localDay,
  nextOccurrence,
  shortDayLabel,
} from '../../../utils/task-property/task-property.util';

/**
 * Constant RECURRENCE_LABELS
 *
 * @description
 * Words of the repetition rules (`RECURS` of `App.dc.html`).
 *
 * @type {Readonly<Record<Recurrence, string>>}
 */
export const RECURRENCE_LABELS: Readonly<Record<Recurrence, string>> = {
  none: $localize`:@@task.properties.recurrence-none:Does not repeat`,
  daily: $localize`:@@task.properties.recurrence-daily:Every working day`,
  weekly: $localize`:@@task.properties.recurrence-weekly:Every week`,
  biweekly: $localize`:@@task.properties.recurrence-biweekly:Every 2 weeks`,
  monthly: $localize`:@@task.properties.recurrence-monthly:Every month`,
};

/**
 * Component TaskPropertyRecurrence
 *
 * @description
 * The `Repeat` row of the task detail's properties (`App.dc.html` lines 2529-2537): the trigger
 * shows the rule and, when it repeats, `Next: {date}` (or `Add a due date to repeat` without a
 * due date); it opens the `Repeat` menu of radio items (`Does not repeat`, `Every working day`,
 * `Every week`, `Every 2 weeks`, `Every month`). Another rule emits `recurrenceChanged`; the
 * gateway creates the next occurrence when the task is done.
 */
@Component({
  selector: 'cw-task-property-recurrence',
  imports: [CwMenu, CwMenuItemRadio, CwMenuRadioGroup, CwMenuTriggerFor],
  template: `
    <button
      type="button"
      class="relative isolate flex min-h-8 w-full items-center gap-2 overflow-hidden rounded-md border border-transparent px-2 py-1 text-left text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset disabled:pointer-events-none aria-expanded:bg-selected"
      [disabled]="disabled()"
      [cwMenuTriggerFor]="menu"
      data-testid="task-property-recurrence"
    >
      <span class="flex min-w-0 flex-col leading-tight">
        <span class="truncate" [class.text-muted-foreground]="recurrence() === 'none'">{{
          labels[recurrence()]
        }}</span>
        @if (hint(); as hint) {
          <span class="text-xs text-muted-foreground">{{ hint }}</span>
        }
      </span>
    </button>
    <cw-menu
      #menu
      side="top"
      align="end"
      ariaLabel="Repeat"
      i18n-ariaLabel="@@task.properties.recurrence"
    >
      <cw-menu-radio-group [value]="recurrence()" (valueChange)="pick($event)">
        @for (key of keys; track key) {
          <button cwMenuItemRadio type="button" [value]="key">{{ labels[key] }}</button>
        }
      </cw-menu-radio-group>
    </cw-menu>
  `,
})
export class TaskPropertyRecurrence {
  // #region Properties
  /**
   * Property recurrence
   *
   * @description
   * The task's rule.
   *
   * @type {InputSignal<Recurrence>}
   * @readonly
   */
  public readonly recurrence: InputSignal<Recurrence> = input<Recurrence>('none');

  /**
   * Property due
   *
   * @description
   * The task's due date, from which the next occurrence counts.
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
   * Read-only: the trigger opens nothing.
   *
   * @type {InputSignalWithTransform<boolean, unknown>}
   * @readonly
   */
  public readonly disabled: InputSignalWithTransform<boolean, unknown> = input(false, {
    transform: booleanAttribute,
  });

  /**
   * Property recurrenceChanged
   *
   * @description
   * Another rule picked.
   *
   * @type {OutputEmitterRef<Recurrence>}
   * @readonly
   */
  public readonly recurrenceChanged: OutputEmitterRef<Recurrence> = output<Recurrence>();

  /**
   * Property keys
   *
   * @description
   * The rules, in the menu's order.
   *
   * @type {readonly Recurrence[]}
   * @readonly
   */
  protected readonly keys: readonly Recurrence[] = RECURRENCES;

  /**
   * Property labels
   *
   * @description
   * Words of the rules.
   *
   * @type {Readonly<Record<Recurrence, string>>}
   * @readonly
   */
  protected readonly labels: Readonly<Record<Recurrence, string>> = RECURRENCE_LABELS;

  /**
   * Property locale
   *
   * @description
   * Locale of the dates.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);

  /**
   * Property hint
   *
   * @description
   * `Next: {date}`, `Add a due date to repeat`, or nothing for a task that does not repeat.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  protected readonly hint: Signal<string | null> = computed((): string | null => {
    const recurrence: Recurrence = this.recurrence();
    if (recurrence === 'none') return null;
    const due: string | null = this.due();
    if (due === null)
      return $localize`:@@task.properties.recurrence-needs-due:Add a due date to repeat`;
    const next: string = shortDayLabel(nextOccurrence(due, recurrence), this.today(), this.locale);
    return $localize`:@@task.properties.recurrence-next:Next: ${next}:date:`;
  });
  // #endregion

  // #region Methods
  /**
   * Method pick
   *
   * @description
   * Emits a rule other than the current one.
   *
   * @param {unknown} value - The radio group's value.
   */
  protected pick(value: unknown): void {
    const key: Recurrence | undefined = this.keys.find(
      (item: Recurrence): boolean => item === value,
    );
    if (key && key !== this.recurrence()) this.recurrenceChanged.emit(key);
  }
  // #endregion
}
