import {
  Component,
  computed,
  effect,
  input,
  type InputSignal,
  model,
  type ModelSignal,
  output,
  type OutputEmitterRef,
  type Signal,
  signal,
  untracked,
  type WritableSignal,
} from '@angular/core';
import { type FieldTree, form, FormField, maxLength, required } from '@angular/forms/signals';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwDatePicker,
  type CwDatePickerValue,
  provideCwDatePickerLabels,
} from '@cadenway/ui/components/date-picker';
import {
  CwDialog,
  CwDialogClose,
  CwDialogFooter,
  CwDialogHeader,
  CwDialogTitle,
  provideCwDialogLabels,
} from '@cadenway/ui/components/dialog';
import { CwInput } from '@cadenway/ui/components/input';
import { CwSwitch } from '@cadenway/ui/components/switch';
import { CwTextarea } from '@cadenway/ui/components/textarea';
import { NgIcon } from '@ng-icons/core';

import type { LookColor, LookIcon } from '../../../models/look/look.type';
import type { ListDraft } from '../../../models/task-list/task-list.interface';
import { todayIso, toLocalDate } from '../../../utils/calendar-date/calendar-date.util';
import { lookIconName, lookTone } from '../../../utils/look/look.util';
import { LookPicker } from '../look-picker/look-picker.component';

/**
 * Constant DAY_MS
 *
 * @description
 * Milliseconds of a day, to count the days of a sprint.
 *
 * @type {number}
 */
const DAY_MS: number = 86_400_000;

/**
 * Interface ListFormModel
 *
 * @description
 * The text fields of the list dialog.
 */
interface ListFormModel {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * « Nom ».
   *
   * @type {string}
   */
  name: string;

  /**
   * Property goal
   *
   * @description
   * « Objectif du sprint ».
   *
   * @type {string}
   */
  goal: string;
  // #endregion
}

/**
 * Function addDays
 *
 * @description
 * Moves a calendar date by whole days.
 *
 * @param {string} iso - The date, `YYYY-MM-DD`.
 * @param {number} days - Days to add, negative to go back.
 * @returns {string} The date reached, `YYYY-MM-DD`.
 */
export function addDays(iso: string, days: number): string {
  const date: Date = toLocalDate(iso);
  date.setDate(date.getDate() + days);
  return todayIso(date);
}

/**
 * Component ListDialog
 *
 * @description
 * « Créer une liste », « Créer un sprint », « Modifier la liste » and « Modifier le sprint »
 * (`App.dc.html`, `dlgList`): the name, the « Sprint » switch with its start and end dates (the
 * end on or after the start, with the length in days and weeks) and its goal, then the icon and
 * the color. Turning the switch on proposes today and 14 days, and the lightning when no icon was
 * chosen. The submit button stays disabled while the name is empty or the dates are invalid.
 * Presentational: it emits the trimmed draft; the host records it and closes.
 */
@Component({
  selector: 'cw-list-dialog',
  imports: [
    CwButton,
    CwDatePicker,
    CwDialog,
    CwDialogClose,
    CwDialogFooter,
    CwDialogHeader,
    CwDialogTitle,
    CwInput,
    CwSwitch,
    CwTextarea,
    FormField,
    LookPicker,
    NgIcon,
  ],
  providers: [
    provideCwDialogLabels(() => ({ close: $localize`:@@spaces.labels.close:Close` })),
    provideCwDatePickerLabels(() => ({
      placeholder: $localize`:@@spaces.list-dialog.pick-date:Pick a date`,
      dialog: $localize`:@@spaces.list-dialog.date-dialog:Date`,
      clear: $localize`:@@spaces.list-dialog.date-clear:Clear`,
      addTime: $localize`:@@spaces.list-dialog.date-add-time:Add a time`,
      time: $localize`:@@spaces.list-dialog.date-time:Time`,
      openCalendar: $localize`:@@spaces.list-dialog.date-calendar:Open the calendar`,
      inputPlaceholder: $localize`:@@spaces.list-dialog.date-input:dd/mm/yyyy`,
    })),
  ],
  templateUrl: './list-dialog.component.html',
})
export class ListDialog {
  // #region Properties
  /**
   * Property open
   *
   * @description
   * Whether the dialog shows; opening it starts over from `initial`.
   *
   * @type {ModelSignal<boolean>}
   * @readonly
   */
  public readonly open: ModelSignal<boolean> = model(false);

  /**
   * Property mode
   *
   * @description
   * `create` or `edit`.
   *
   * @type {InputSignal<'create' | 'edit'>}
   * @readonly
   */
  public readonly mode: InputSignal<'create' | 'edit'> = input<'create' | 'edit'>('create');

  /**
   * Property initial
   *
   * @description
   * The values the dialog opens with: the list edited, or the proposal of a new list or sprint.
   *
   * @type {InputSignal<ListDraft>}
   * @readonly
   */
  public readonly initial: InputSignal<ListDraft> = input<ListDraft>({
    name: '',
    icon: null,
    color: 'gris',
    sprint: null,
  });

  /**
   * Property pending
   *
   * @description
   * Whether the draft is being recorded.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly pending: InputSignal<boolean> = input(false);

  /**
   * Property submitted
   *
   * @description
   * Emits the trimmed draft.
   *
   * @type {OutputEmitterRef<ListDraft>}
   * @readonly
   */
  public readonly submitted: OutputEmitterRef<ListDraft> = output<ListDraft>();

  /**
   * Property model
   *
   * @description
   * The text fields.
   *
   * @type {WritableSignal<ListFormModel>}
   * @readonly
   */
  protected readonly model: WritableSignal<ListFormModel> = signal({ name: '', goal: '' });

  /**
   * Property listForm
   *
   * @description
   * The validated fields: a name of 100 characters at most and a goal of 300.
   *
   * @type {FieldTree<ListFormModel>}
   * @readonly
   */
  protected readonly listForm: FieldTree<ListFormModel> = form(this.model, (path) => {
    required(path.name, {
      message: $localize`:@@spaces.list-dialog.name-required:Enter a name.`,
    });
    maxLength(path.name, 100);
    maxLength(path.goal, 300);
  });

  /**
   * Property sprint
   *
   * @description
   * Whether a sprint is edited.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly sprint: WritableSignal<boolean> = signal(false);

  /**
   * Property start
   *
   * @description
   * « Début », `YYYY-MM-DD`, or null.
   *
   * @type {WritableSignal<string | null>}
   * @readonly
   */
  protected readonly start: WritableSignal<string | null> = signal<string | null>(null);

  /**
   * Property end
   *
   * @description
   * « Fin », `YYYY-MM-DD`, or null.
   *
   * @type {WritableSignal<string | null>}
   * @readonly
   */
  protected readonly end: WritableSignal<string | null> = signal<string | null>(null);

  /**
   * Property icon
   *
   * @description
   * The icon chosen, or null for the default.
   *
   * @type {WritableSignal<LookIcon>}
   * @readonly
   */
  protected readonly icon: WritableSignal<LookIcon> = signal<LookIcon>(null);

  /**
   * Property color
   *
   * @description
   * The color chosen.
   *
   * @type {WritableSignal<LookColor>}
   * @readonly
   */
  protected readonly color: WritableSignal<LookColor> = signal<LookColor>('gris');

  /**
   * Property startDate
   *
   * @description
   * « Début » for the date picker.
   *
   * @type {Signal<Date | null>}
   * @readonly
   */
  protected readonly startDate: Signal<Date | null> = computed((): Date | null => {
    const start: string | null = this.start();
    return start ? toLocalDate(start) : null;
  });

  /**
   * Property endDate
   *
   * @description
   * « Fin » for the date picker.
   *
   * @type {Signal<Date | null>}
   * @readonly
   */
  protected readonly endDate: Signal<Date | null> = computed((): Date | null => {
    const end: string | null = this.end();
    return end ? toLocalDate(end) : null;
  });

  /**
   * Property datesInvalid
   *
   * @description
   * Whether a sprint misses a date or ends before it starts.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly datesInvalid: Signal<boolean> = computed((): boolean => {
    if (!this.sprint()) return false;
    const start: string | null = this.start();
    const end: string | null = this.end();
    return !start || !end || end < start;
  });

  /**
   * Property datesHint
   *
   * @description
   * « La fin doit suivre le début. », or the length of the sprint (« 14 jours · 2 semaines »).
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly datesHint: Signal<string> = computed((): string => {
    if (this.datesInvalid()) {
      return $localize`:@@spaces.list-dialog.dates-invalid:The end must follow the start.`;
    }
    const start: string | null = this.start();
    const end: string | null = this.end();
    if (!this.sprint() || !start || !end) return '';
    const days: number =
      Math.round((toLocalDate(end).getTime() - toLocalDate(start).getTime()) / DAY_MS) + 1;
    const weeks: number = Math.ceil(days / 7);
    return weeks > 1
      ? $localize`:@@spaces.list-dialog.length-weeks:${days}:days: days · ${weeks}:weeks: weeks`
      : $localize`:@@spaces.list-dialog.length-week:${days}:days: days · ${weeks}:weeks: week`;
  });

  /**
   * Property title
   *
   * @description
   * The dialog's title.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly title: Signal<string> = computed((): string => {
    if (this.mode() === 'edit') {
      return this.sprint()
        ? $localize`:@@spaces.header.rename-sprint:Edit the sprint`
        : $localize`:@@spaces.header.rename-list:Edit the list`;
    }
    return this.sprint()
      ? $localize`:@@spaces.list-dialog.create-sprint:Create a sprint`
      : $localize`:@@spaces.list-dialog.create-list:Create a list`;
  });

  /**
   * Property submitLabel
   *
   * @description
   * « Enregistrer », « Créer le sprint » or « Créer la liste ».
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly submitLabel: Signal<string> = computed((): string => {
    if (this.mode() === 'edit') return $localize`:@@spaces.save-view.rename-submit:Save`;
    return this.sprint()
      ? $localize`:@@spaces.list-dialog.create-sprint-submit:Create the sprint`
      : $localize`:@@spaces.list-dialog.create-list-submit:Create the list`;
  });

  /**
   * Property markIcon
   *
   * @description
   * Fill glyph of the preview beside the title.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly markIcon: Signal<string> = computed((): string => {
    const icon: LookIcon = this.icon() ?? (this.sprint() ? 'lightning' : null);
    return icon ? lookIconName(icon, true) : 'phosphorListBulletsFill';
  });

  /**
   * Property markTone
   *
   * @description
   * Text color of the preview.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly markTone: Signal<string> = computed((): string =>
    this.color() === 'gris' ? 'text-foreground' : lookTone(this.color()),
  );
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Starts the fields over from `initial` each time the dialog opens.
   *
   * @constructor
   */
  public constructor() {
    effect((): void => {
      if (!this.open()) return;
      untracked((): void => {
        const initial: ListDraft = this.initial();
        this.model.set({ name: initial.name, goal: initial.sprint?.goal ?? '' });
        this.sprint.set(initial.sprint !== null);
        this.start.set(initial.sprint?.startDate ?? null);
        this.end.set(initial.sprint?.endDate ?? null);
        this.icon.set(initial.icon);
        this.color.set(initial.color);
        this.listForm().reset();
      });
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method toggleSprint
   *
   * @description
   * Turns the list into a sprint, proposing today, 14 days and the lightning, or back.
   *
   * @param {boolean} on - Whether it becomes a sprint.
   */
  protected toggleSprint(on: boolean): void {
    this.sprint.set(on);
    if (!on) return;
    const start: string = this.start() ?? todayIso();
    this.start.set(start);
    if (!this.end()) this.end.set(addDays(start, 13));
    if (!this.icon()) this.icon.set('lightning');
  }

  /**
   * Method pickStart
   *
   * @description
   * Takes the start; an end before it moves to it.
   *
   * @param {CwDatePickerValue} value - The picked date.
   */
  protected pickStart(value: CwDatePickerValue): void {
    const start: string | null = value instanceof Date ? todayIso(value) : null;
    this.start.set(start);
    const end: string | null = this.end();
    if (start && end && end < start) this.end.set(start);
  }

  /**
   * Method pickEnd
   *
   * @description
   * Takes the end.
   *
   * @param {CwDatePickerValue} value - The picked date.
   */
  protected pickEnd(value: CwDatePickerValue): void {
    this.end.set(value instanceof Date ? todayIso(value) : null);
  }

  /**
   * Method submit
   *
   * @description
   * Emits the trimmed draft, or focuses the name when it is missing.
   *
   * @param {HTMLInputElement} nameField - The name field.
   */
  protected submit(nameField: HTMLInputElement): void {
    if (this.pending() || this.datesInvalid()) return;
    if (this.listForm.name().invalid() || !this.model().name.trim()) {
      this.listForm.name().markAsTouched();
      nameField.focus();
      return;
    }
    const start: string | null = this.start();
    const end: string | null = this.end();
    this.submitted.emit({
      name: this.model().name.trim(),
      icon: this.icon(),
      color: this.color(),
      sprint:
        this.sprint() && start && end
          ? { startDate: start, endDate: end, goal: this.model().goal.trim() || null }
          : null,
    });
  }
  // #endregion
}
