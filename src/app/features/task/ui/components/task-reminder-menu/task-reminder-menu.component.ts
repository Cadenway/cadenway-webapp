import {
  Component,
  computed,
  inject,
  input,
  type InputSignal,
  LOCALE_ID,
  output,
  type OutputEmitterRef,
  type Signal,
  signal,
  type WritableSignal,
} from '@angular/core';
import { CwButton } from '@cadenway/ui/components/button';
import { CwInput } from '@cadenway/ui/components/input';
import { CwPopover, CwPopoverTrigger } from '@cadenway/ui/components/popover';
import { NgIcon } from '@ng-icons/core';

import type { TaskReminder } from '../../../models/task-detail/task-detail.interface';
import {
  at,
  daysFrom,
  REMINDER_HOURS,
  reminderDays,
  type ReminderPreset,
  type ReminderPresetKey,
  reminderPresets,
  reminderTimeLabel,
} from '../../../utils/reminder-time/reminder-time.util';

/**
 * Interface ReminderChoice
 *
 * @description
 * A reminder the person picked: the instant, how it reads, and the note typed so far.
 */
export interface ReminderChoice {
  // #region Properties
  /**
   * Property at
   *
   * @description
   * When to remind.
   *
   * @type {Date}
   * @readonly
   */
  readonly at: Date;

  /**
   * Property when
   *
   * @description
   * How the moment reads (`Tomorrow, 9:00 AM`).
   *
   * @type {string}
   * @readonly
   */
  readonly when: string;

  /**
   * Property note
   *
   * @description
   * The note of the reminder.
   *
   * @type {string}
   * @readonly
   */
  readonly note: string;
  // #endregion
}

/**
 * Interface PresetRow
 *
 * @description
 * One preset row of the popover.
 */
interface PresetRow {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Which moment.
   *
   * @type {ReminderPresetKey}
   * @readonly
   */
  readonly key: ReminderPresetKey;

  /**
   * Property label
   *
   * @description
   * Its name (`Tomorrow morning`).
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property icon
   *
   * @description
   * Its icon.
   *
   * @type {string}
   * @readonly
   */
  readonly icon: string;

  /**
   * Property at
   *
   * @description
   * The instant.
   *
   * @type {Date}
   * @readonly
   */
  readonly at: Date;

  /**
   * Property when
   *
   * @description
   * How the instant reads.
   *
   * @type {string}
   * @readonly
   */
  readonly when: string;
  // #endregion
}

/**
 * Constant PRESET_ICONS
 *
 * @description
 * The icon of each preset (`REM_PRESETS` of `App.dc.html`).
 *
 * @type {Readonly<Record<ReminderPresetKey, string>>}
 */
const PRESET_ICONS: Readonly<Record<ReminderPresetKey, string>> = {
  hour: 'phosphorTimerBold',
  afternoon: 'phosphorSunBold',
  tomorrow: 'phosphorSunHorizonBold',
  week: 'phosphorCalendarBlankBold',
  due: 'phosphorFlagBold',
};

/**
 * Component TaskReminderMenu
 *
 * @description
 * The header's reminder button and its popover (`App.dc.html` lines 2048-2070, 4884-4949): the
 * button names the pending reminder (`Reminder: Tomorrow, 9:00 AM`, the grenat tone once it fired)
 * or offers `Remind me of this task`; the popover lists the presets (in one hour, this afternoon,
 * tomorrow morning, next week, the day before the due date when there is one), `Choose a date and
 * a time…` (14 days and six hours, a past hour refused), the note (saved on change while a
 * reminder exists, else sent with the next one) and `Delete the reminder`. It only emits: the
 * detail dialog writes.
 */
@Component({
  selector: 'cw-task-reminder-menu',
  imports: [CwButton, CwInput, CwPopover, CwPopoverTrigger, NgIcon],
  host: { class: 'contents' },
  templateUrl: './task-reminder-menu.component.html',
})
export class TaskReminderMenu {
  // #region Properties
  /**
   * Property reminder
   *
   * @description
   * The caller's pending reminder, or null.
   *
   * @type {InputSignal<TaskReminder | null>}
   * @readonly
   */
  public readonly reminder: InputSignal<TaskReminder | null> = input<TaskReminder | null>(null);

  /**
   * Property due
   *
   * @description
   * The task's due date (`YYYY-MM-DD`), for `The day before the due date`.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly due: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property disabled
   *
   * @description
   * Whether the button is unavailable (detail not read, write in flight).
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly disabled: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property scheduled
   *
   * @description
   * Emitted with the moment and note the person picked.
   *
   * @type {OutputEmitterRef<ReminderChoice>}
   * @readonly
   */
  public readonly scheduled: OutputEmitterRef<ReminderChoice> = output<ReminderChoice>();

  /**
   * Property noteChanged
   *
   * @description
   * Emitted with the note when it changes while a reminder exists.
   *
   * @type {OutputEmitterRef<string>}
   * @readonly
   */
  public readonly noteChanged: OutputEmitterRef<string> = output<string>();

  /**
   * Property deleted
   *
   * @description
   * Emitted when the person deletes the reminder.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly deleted: OutputEmitterRef<void> = output();

  /**
   * Property open
   *
   * @description
   * Whether the popover is open.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly open: WritableSignal<boolean> = signal<boolean>(false);

  /**
   * Property now
   *
   * @description
   * The instant the popover opened at, which its moments start from.
   *
   * @type {WritableSignal<Date>}
   * @readonly
   */
  protected readonly now: WritableSignal<Date> = signal<Date>(new Date());

  /**
   * Property note
   *
   * @description
   * The note typed in the popover.
   *
   * @type {WritableSignal<string>}
   * @readonly
   */
  protected readonly note: WritableSignal<string> = signal<string>('');

  /**
   * Property pickedDay
   *
   * @description
   * Day chosen in the custom picker (days from today), or null while it is closed.
   *
   * @type {WritableSignal<number | null>}
   * @readonly
   */
  protected readonly pickedDay: WritableSignal<number | null> = signal<number | null>(null);

  /**
   * Property pickedHour
   *
   * @description
   * Hour chosen in the custom picker.
   *
   * @type {WritableSignal<number>}
   * @readonly
   */
  protected readonly pickedHour: WritableSignal<number> = signal<number>(9);

  /**
   * Property hours
   *
   * @description
   * Hours of the custom picker.
   *
   * @type {readonly number[]}
   * @readonly
   */
  protected readonly hours: readonly number[] = REMINDER_HOURS;

  /**
   * Property presets
   *
   * @description
   * The preset rows, from the opening instant.
   *
   * @type {Signal<readonly PresetRow[]>}
   * @readonly
   */
  protected readonly presets: Signal<readonly PresetRow[]> = computed((): readonly PresetRow[] =>
    reminderPresets(this.now(), this.due()).map((preset: ReminderPreset): PresetRow => ({
      key: preset.key,
      label: this.presetLabel(preset.key),
      icon: PRESET_ICONS[preset.key],
      at: preset.at,
      when: this.whenOf(preset.at),
    })),
  );

  /**
   * Property days
   *
   * @description
   * The days of the custom picker with their labels (`Today`, `Tomorrow`, `Mon 10`).
   *
   * @type {Signal<readonly { readonly offset: number; readonly label: string }[]>}
   * @readonly
   */
  protected readonly days: Signal<readonly { readonly offset: number; readonly label: string }[]> =
    computed((): readonly { readonly offset: number; readonly label: string }[] =>
      reminderDays(this.now()).map((day: Date, offset: number) => ({
        offset,
        label:
          offset === 0
            ? $localize`:@@task.detail.reminder.today:Today`
            : offset === 1
              ? $localize`:@@task.detail.reminder.tomorrow:Tomorrow`
              : new Intl.DateTimeFormat(this.locale, { weekday: 'short', day: 'numeric' }).format(
                  day,
                ),
      })),
    );

  /**
   * Property custom
   *
   * @description
   * The instant of the custom picker, or null while it is closed.
   *
   * @type {Signal<Date | null>}
   * @readonly
   */
  protected readonly custom: Signal<Date | null> = computed((): Date | null => {
    const day: number | null = this.pickedDay();
    return day === null ? null : at(this.now(), day, this.pickedHour());
  });

  /**
   * Property customPast
   *
   * @description
   * Whether the custom instant is already past.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly customPast: Signal<boolean> = computed((): boolean => {
    const custom: Date | null = this.custom();
    return custom !== null && custom <= this.now();
  });

  /**
   * Property label
   *
   * @description
   * Accessible name and tooltip of the button.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly label: Signal<string> = computed((): string => {
    const reminder: TaskReminder | null = this.reminder();
    return reminder
      ? $localize`:@@task.detail.reminder.label-set:Reminder: ${this.whenOf(new Date(reminder.at))}:when:`
      : $localize`:@@task.detail.reminder.label:Remind me of this task`;
  });

  /**
   * Property when
   *
   * @description
   * How the pending reminder reads, or null.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  protected readonly when: Signal<string | null> = computed((): string | null => {
    const reminder: TaskReminder | null = this.reminder();
    return reminder ? this.whenOf(new Date(reminder.at)) : null;
  });

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
  // #endregion

  // #region Methods
  /**
   * Method setOpen
   *
   * @description
   * Opens the popover from now, with the pending reminder's note, or closes it.
   *
   * @param {boolean} open - Whether it opens.
   */
  protected setOpen(open: boolean): void {
    if (open) {
      this.now.set(new Date());
      this.note.set(this.reminder()?.note ?? '');
      this.pickedDay.set(null);
      this.pickedHour.set(9);
    }
    this.open.set(open);
  }

  /**
   * Method pick
   *
   * @description
   * Schedules a moment with the typed note and closes the popover.
   *
   * @param {Date} instant - When to remind.
   */
  protected pick(instant: Date): void {
    this.scheduled.emit({ at: instant, when: this.whenOf(instant), note: this.note() });
    this.open.set(false);
  }

  /**
   * Method openCustom
   *
   * @description
   * Opens the custom picker on tomorrow at 9 h.
   */
  protected openCustom(): void {
    this.pickedDay.set(1);
    this.pickedHour.set(9);
  }

  /**
   * Method closeCustom
   *
   * @description
   * Closes the custom picker.
   */
  protected closeCustom(): void {
    this.pickedDay.set(null);
  }

  /**
   * Method saveCustom
   *
   * @description
   * Schedules the custom instant, unless it is past.
   */
  protected saveCustom(): void {
    const custom: Date | null = this.custom();
    if (custom && !this.customPast()) this.pick(custom);
  }

  /**
   * Method changeNote
   *
   * @description
   * Keeps the typed note and saves it when a reminder exists.
   *
   * @param {string} note - The note.
   */
  protected changeNote(note: string): void {
    this.note.set(note);
    if (this.reminder()) this.noteChanged.emit(note);
  }

  /**
   * Method remove
   *
   * @description
   * Deletes the reminder and closes the popover.
   */
  protected remove(): void {
    this.deleted.emit();
    this.open.set(false);
  }

  /**
   * Method hourLabel
   *
   * @description
   * How a whole hour of the picker reads (`9:00 AM`).
   *
   * @param {number} hour - Hour, 0 to 23.
   * @returns {string} The label.
   */
  protected hourLabel(hour: number): string {
    return reminderTimeLabel(at(this.now(), 0, hour), this.locale);
  }

  /**
   * Method whenOf
   *
   * @description
   * How an instant reads: `Today, 11:00 AM`, `Tomorrow, 9:00 AM`, else the short day (`Mon, Nov 9,
   * 9:00 AM`), the time through `reminderTimeLabel`.
   *
   * @param {Date} instant - The instant.
   * @returns {string} The label.
   */
  protected whenOf(instant: Date): string {
    const offset: number = daysFrom(this.now(), instant);
    const time: string = reminderTimeLabel(instant, this.locale);
    if (offset === 0) return $localize`:@@task.detail.reminder.today-at:Today, ${time}:time:`;
    if (offset === 1) return $localize`:@@task.detail.reminder.tomorrow-at:Tomorrow, ${time}:time:`;
    const day: string = new Intl.DateTimeFormat(this.locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      ...(instant.getFullYear() === this.now().getFullYear() ? {} : { year: 'numeric' }),
    }).format(instant);
    const shown: string = day.charAt(0).toLocaleUpperCase(this.locale) + day.slice(1);
    return $localize`:@@task.detail.reminder.day-at:${shown}:day:, ${time}:time:`;
  }

  /**
   * Method presetLabel
   *
   * @description
   * The name of a preset.
   *
   * @param {ReminderPresetKey} key - The preset.
   * @returns {string} Its name.
   */
  private presetLabel(key: ReminderPresetKey): string {
    switch (key) {
      case 'hour':
        return $localize`:@@task.detail.reminder.in-hour:In 1 hour`;
      case 'afternoon':
        return $localize`:@@task.detail.reminder.afternoon:This afternoon`;
      case 'tomorrow':
        return $localize`:@@task.detail.reminder.tomorrow-morning:Tomorrow morning`;
      case 'week':
        return $localize`:@@task.detail.reminder.next-week:Next week`;
      case 'due':
        return $localize`:@@task.detail.reminder.due-eve:The day before the due date`;
    }
  }
  // #endregion
}
