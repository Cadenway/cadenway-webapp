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
  signal,
  type WritableSignal,
} from '@angular/core';
import type { StatusKey } from '@cadenway/contracts';
import { CwCalendar } from '@cadenway/ui/components/calendar';
import { CwPopover, CwPopoverTrigger } from '@cadenway/ui/components/popover';
import { NgIcon } from '@ng-icons/core';

import { isClosedStatus } from '../../../utils/task-status/task-status.util';
import {
  addDays,
  dateOf,
  dayOffset,
  localDay,
  longDayLabel,
  shortDayLabel,
} from '../../../utils/task-property/task-property.util';

/**
 * Interface DueShortcut
 *
 * @description
 * A shortcut of the due date dialog.
 */
interface DueShortcut {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Stable identity of the shortcut.
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;

  /**
   * Property label
   *
   * @description
   * Its words (`Tomorrow`).
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property date
   *
   * @description
   * The day it sets, or null for `No due date`.
   *
   * @type {string | null}
   * @readonly
   */
  readonly date: string | null;

  /**
   * Property hint
   *
   * @description
   * The long date, or nothing for `No due date`.
   *
   * @type {string}
   * @readonly
   */
  readonly hint: string;
  // #endregion
}

/**
 * Component TaskPropertyDue
 *
 * @description
 * The `Due date` row of the task detail's properties (`App.dc.html` lines 2406-2417): the trigger
 * writes `Today`, `Tomorrow`, `Yesterday` or the short date (the year when it is not this one),
 * titled with the long date and `(late)`, with a warning icon when an open task is late, or
 * `Empty`. It opens the `Due date` dialog: the shortcuts `Today`, `Tomorrow`, `Friday`,
 * `End of the sprint` (when the list is a sprint) and `No due date`, each with its long date,
 * then the month calendar (arrows, Home, End, Page Up, Page Down). A pick emits `dueChanged`
 * (`YYYY-MM-DD` or null) and closes the dialog; the focus goes back to the trigger.
 */
@Component({
  selector: 'cw-task-property-due',
  imports: [CwCalendar, CwPopover, CwPopoverTrigger, NgIcon],
  template: `
    <button
      type="button"
      class="relative isolate flex min-h-8 w-full items-center gap-2 overflow-hidden rounded-md border border-transparent px-2 py-1 text-left text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset disabled:pointer-events-none aria-expanded:bg-selected"
      [class.text-grenat-text]="tone() === 'late'"
      [class.text-primary]="tone() === 'today'"
      [class.text-muted-foreground]="tone() === 'none'"
      [disabled]="disabled()"
      [cwPopoverTrigger]="popover"
      data-testid="task-property-due"
    >
      @if (tone() === 'late') {
        <ng-icon
          name="phosphorWarningCircleFill"
          class="shrink-0 text-destructive"
          size="0.875rem"
          aria-hidden="true"
        />
      }
      <span class="truncate whitespace-nowrap" [title]="title()">{{ label() }}</span>
      @if (tone() === 'late') {
        <span class="sr-only" i18n="@@task.due.late">(late)</span>
      }
    </button>
    <cw-popover
      #popover
      side="bottom"
      align="end"
      padding="none"
      ariaLabel="Due date"
      i18n-ariaLabel="@@task.properties.due"
      [open]="open()"
      (openChange)="open.set($event)"
    >
      <div class="flex flex-col gap-1 p-1">
        @for (shortcut of shortcuts(); track shortcut.key) {
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-selected focus-visible:outline-none aria-pressed:bg-selected"
            [attr.aria-pressed]="shortcut.date === due()"
            (click)="pick(shortcut.date)"
          >
            {{ shortcut.label }}
            <span class="ml-auto truncate text-xs text-muted-foreground">{{ shortcut.hint }}</span>
          </button>
        }
        <div class="border-t border-border px-1 pt-2 pb-1">
          <cw-calendar
            [selected]="selected()"
            [locale]="locale"
            previousMonthLabel="Previous month"
            i18n-previousMonthLabel="@@task.properties.due-previous-month"
            nextMonthLabel="Next month"
            i18n-nextMonthLabel="@@task.properties.due-next-month"
            (selectedChange)="pickDate($event)"
          />
        </div>
      </div>
    </cw-popover>
  `,
})
export class TaskPropertyDue {
  // #region Properties
  /**
   * Property due
   *
   * @description
   * The due date (`YYYY-MM-DD`), or null.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly due: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property status
   *
   * @description
   * Status of the task: a closed task is never late.
   *
   * @type {InputSignal<StatusKey>}
   * @readonly
   */
  public readonly status: InputSignal<StatusKey> = input<StatusKey>('todo');

  /**
   * Property sprintEnd
   *
   * @description
   * Last day of the list's sprint, which adds `End of the sprint`; null for another list.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly sprintEnd: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property today
   *
   * @description
   * Today (`YYYY-MM-DD`), the reference of the labels and shortcuts.
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
   * Property dueChanged
   *
   * @description
   * The picked day (`YYYY-MM-DD`), or null for `No due date`.
   *
   * @type {OutputEmitterRef<string | null>}
   * @readonly
   */
  public readonly dueChanged: OutputEmitterRef<string | null> = output<string | null>();

  /**
   * Property open
   *
   * @description
   * Whether the dialog is open.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly open: WritableSignal<boolean> = signal<boolean>(false);

  /**
   * Property locale
   *
   * @description
   * Locale of the dates.
   *
   * @type {string}
   * @readonly
   */
  protected readonly locale: string = inject(LOCALE_ID);

  /**
   * Property tone
   *
   * @description
   * `late` for an open task past its date, `today` for an open task due today, `none` without
   * a date, else `plain`.
   *
   * @type {Signal<'late' | 'today' | 'plain' | 'none'>}
   * @readonly
   */
  protected readonly tone: Signal<'late' | 'today' | 'plain' | 'none'> = computed(
    (): 'late' | 'today' | 'plain' | 'none' => {
      const due: string | null = this.due();
      if (due === null) return 'none';
      if (isClosedStatus(this.status())) return 'plain';
      const offset: number = dayOffset(due, this.today());
      return offset < 0 ? 'late' : offset === 0 ? 'today' : 'plain';
    },
  );

  /**
   * Property label
   *
   * @description
   * The trigger's words.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly label: Signal<string> = computed((): string => {
    const due: string | null = this.due();
    return due === null
      ? $localize`:@@task.properties.empty:Empty`
      : shortDayLabel(due, this.today(), this.locale);
  });

  /**
   * Property title
   *
   * @description
   * The long date, with `(late)` when late.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly title: Signal<string> = computed((): string => {
    const due: string | null = this.due();
    if (due === null) return '';
    const long: string = longDayLabel(due, this.today(), this.locale);
    return this.tone() === 'late'
      ? $localize`:@@task.properties.due-late:${long}:date: (late)`
      : long;
  });

  /**
   * Property selected
   *
   * @description
   * The due date as the calendar's selection.
   *
   * @type {Signal<Date | null>}
   * @readonly
   */
  protected readonly selected: Signal<Date | null> = computed((): Date | null => {
    const due: string | null = this.due();
    return due === null ? null : dateOf(due);
  });

  /**
   * Property shortcuts
   *
   * @description
   * The shortcuts of the dialog, each with its long date.
   *
   * @type {Signal<readonly DueShortcut[]>}
   * @readonly
   */
  protected readonly shortcuts: Signal<readonly DueShortcut[]> = computed(
    (): readonly DueShortcut[] => {
      const today: string = this.today();
      const untilFriday: number = (5 - dateOf(today).getDay() + 7) % 7 || 7;
      const sprintEnd: string | null = this.sprintEnd();
      const entry: (key: string, label: string, date: string | null) => DueShortcut = (
        key: string,
        label: string,
        date: string | null,
      ): DueShortcut => ({
        key,
        label,
        date,
        hint: date === null ? '' : longDayLabel(date, today, this.locale),
      });
      return [
        entry('today', $localize`:@@task.create.due-today:Today`, today),
        entry('tomorrow', $localize`:@@task.create.due-tomorrow:Tomorrow`, addDays(today, 1)),
        entry('friday', $localize`:@@task.create.due-friday:Friday`, addDays(today, untilFriday)),
        ...(sprintEnd
          ? [entry('sprint', $localize`:@@task.create.due-sprint:End of the sprint`, sprintEnd)]
          : []),
        entry('none', $localize`:@@task.create.due-none:No due date`, null),
      ];
    },
  );
  // #endregion

  // #region Methods
  /**
   * Method pick
   *
   * @description
   * Applies a shortcut and closes the dialog; the current date changes nothing.
   *
   * @param {string | null} date - The day, or null.
   */
  protected pick(date: string | null): void {
    this.open.set(false);
    if (date !== this.due()) this.dueChanged.emit(date);
  }

  /**
   * Method pickDate
   *
   * @description
   * Applies a day of the calendar and closes the dialog.
   *
   * @param {unknown} value - The calendar's selection (a `Date` in single mode).
   */
  protected pickDate(value: unknown): void {
    if (value instanceof Date) this.pick(localDay(value));
  }
  // #endregion
}
