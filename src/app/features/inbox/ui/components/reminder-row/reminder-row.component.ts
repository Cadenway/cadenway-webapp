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
} from '@angular/core';
import { CwButton } from '@cadenway/ui/components/button';
import { NgIcon } from '@ng-icons/core';

import type { InboxReminder } from '../../../models/inbox-reminder/inbox-reminder.interface';
import { reminderTime } from '../../../utils/inbox-time/inbox-time.util';

/**
 * Component ReminderRow
 *
 * @description
 * One pending reminder of the « Rappels » tab (mockup `App.dc.html` lines 160-164): the alarm, the
 * due time (« Aujourd’hui, 9 h », followed by « · en retard » in red once due), the task key and
 * name, the note, then « Reporter à demain matin » (`snoozed`) and « Marquer comme fait »
 * (`completed`). The text part is a button that emits `opened`.
 */
@Component({
  selector: 'cw-reminder-row',
  imports: [CwButton, NgIcon],
  templateUrl: './reminder-row.component.html',
})
export class ReminderRow {
  // #region Properties
  /**
   * Property reminder
   *
   * @description
   * The reminder shown.
   *
   * @type {InputSignal<InboxReminder>}
   * @readonly
   */
  public readonly reminder: InputSignal<InboxReminder> = input.required<InboxReminder>();

  /**
   * Property now
   *
   * @description
   * The moment lateness and due times are computed from, set when the popover opens.
   *
   * @type {InputSignal<Date>}
   * @readonly
   */
  public readonly now: InputSignal<Date> = input.required<Date>();

  /**
   * Property opened
   *
   * @description
   * Fires when the reminder's text is activated.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly opened: OutputEmitterRef<void> = output();

  /**
   * Property snoozed
   *
   * @description
   * Fires when « Reporter à demain matin » is clicked.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly snoozed: OutputEmitterRef<void> = output();

  /**
   * Property completed
   *
   * @description
   * Fires when « Marquer comme fait » is clicked.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly completed: OutputEmitterRef<void> = output();

  /**
   * Property locale
   *
   * @description
   * Application locale of the dates.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);

  /**
   * Property late
   *
   * @description
   * Whether the reminder is due.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly late: Signal<boolean> = computed(
    (): boolean => Date.parse(this.reminder().remindAt) <= this.now().getTime(),
  );

  /**
   * Property when
   *
   * @description
   * The due time, with « · en retard » once due.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly when: Signal<string> = computed((): string => {
    const time: string = reminderTime(this.reminder().remindAt, this.now(), this.locale);
    return this.late() ? $localize`:@@inbox.reminder.late:${time}:time: · late` : time;
  });

  /**
   * Property snoozeLabel
   *
   * @description
   * Accessible name of the snooze button, naming the task.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly snoozeLabel: Signal<string> = computed(
    (): string =>
      $localize`:@@inbox.reminder.snooze-label:Postpone the reminder of ${this.reminder().taskKey}:task: to tomorrow morning`,
  );

  /**
   * Property doneLabel
   *
   * @description
   * Accessible name of the done button, naming the task.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly doneLabel: Signal<string> = computed(
    (): string =>
      $localize`:@@inbox.reminder.done-label:Mark the reminder of ${this.reminder().taskKey}:task: as done`,
  );
  // #endregion
}
