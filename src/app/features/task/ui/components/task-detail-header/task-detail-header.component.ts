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
import type { CancelReason } from '@cadenway/contracts';
import { CwButton } from '@cadenway/ui/components/button';
import { CwDialogTitle } from '@cadenway/ui/components/dialog';
import {
  CwMenu,
  CwMenuItem,
  CwMenuSeparator,
  CwMenuTriggerFor,
} from '@cadenway/ui/components/menu';
import { CwStatusIcon } from '@cadenway/ui/components/status-icon';
import { NgIcon } from '@ng-icons/core';

import { CANCEL_REASON_LABELS } from '../../../constants/task-copy/task-copy.constants';
import type {
  TaskReference,
  TaskReminder,
  TaskWatchers,
} from '../../../models/task-detail/task-detail.interface';
import type { TaskDetailHeader as TaskDetailHeaderModel } from '../../../state/task-detail/task-detail.store';
import {
  type ReminderChoice,
  TaskReminderMenu,
} from '../task-reminder-menu/task-reminder-menu.component';

/**
 * Component TaskDetailHeader
 *
 * @description
 * The header of the task detail (`App.dc.html` lines 2036-2106): the key, `Subtask of <key> ·
 * <name>` (opens the parent), the read-only status badge with the space's label, the
 * cancellation line, the title field (saved on change or blur when it changed and is not blank;
 * a blank title comes back), then the actions: follow (`aria-pressed`, the count), the reminder
 * (`cw-task-reminder-menu`), `Copy the link`, the `More actions` menu (copy the identifier,
 * duplicate, move to…, archive, save as a template, convert to a subtask of… or move to another
 * task…, detach from the parent, delete) and `Close`. A failed read of the followers or of the
 * reminder shows an inline error under the title with `Retry`. Before the detail is read it shows what
 * the opening screen gave and disables the actions; without edit rights the title is read-only and
 * the writing actions are disabled. It only emits: the detail dialog acts.
 */
@Component({
  selector: 'cw-task-detail-header',
  imports: [
    CwButton,
    CwDialogTitle,
    CwMenu,
    CwMenuItem,
    CwMenuSeparator,
    CwMenuTriggerFor,
    CwStatusIcon,
    NgIcon,
    TaskReminderMenu,
  ],
  host: { class: 'flex items-start gap-2' },
  templateUrl: './task-detail-header.component.html',
})
export class TaskDetailHeader {
  // #region Properties
  /**
   * Property header
   *
   * @description
   * Key, name, status and milestone shown.
   *
   * @type {InputSignal<TaskDetailHeaderModel>}
   * @readonly
   */
  public readonly header: InputSignal<TaskDetailHeaderModel> =
    input.required<TaskDetailHeaderModel>();

  /**
   * Property statusLabel
   *
   * @description
   * The space's word for the status, or null when unknown.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly statusLabel: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property parent
   *
   * @description
   * The parent of a subtask, or null.
   *
   * @type {InputSignal<TaskReference | null>}
   * @readonly
   */
  public readonly parent: InputSignal<TaskReference | null> = input<TaskReference | null>(null);

  /**
   * Property cancelReason
   *
   * @description
   * Reason of a cancelled task, or null.
   *
   * @type {InputSignal<CancelReason | null>}
   * @readonly
   */
  public readonly cancelReason: InputSignal<CancelReason | null> = input<CancelReason | null>(null);

  /**
   * Property cancelNote
   *
   * @description
   * Details of the cancellation, or null.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly cancelNote: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property due
   *
   * @description
   * Due date of the task, for the reminder presets.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly due: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property ready
   *
   * @description
   * Whether the detail is read: the actions need it.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly ready: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property canEdit
   *
   * @description
   * Whether the caller may change the task.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly canEdit: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property busy
   *
   * @description
   * Whether a menu action runs.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly busy: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property watchers
   *
   * @description
   * Who follows the task, or null until read.
   *
   * @type {InputSignal<TaskWatchers | null>}
   * @readonly
   */
  public readonly watchers: InputSignal<TaskWatchers | null> = input<TaskWatchers | null>(null);

  /**
   * Property watchersFailed
   *
   * @description
   * Whether the followers could not be read: an inline error with `Retry` (`watchersRetried`).
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly watchersFailed: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property watchPending
   *
   * @description
   * Whether a follow change runs.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly watchPending: InputSignal<boolean> = input<boolean>(false);

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
   * Property reminderFailed
   *
   * @description
   * Whether the caller's reminder could not be read: an inline error with `Retry`
   * (`reminderRetried`).
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly reminderFailed: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property reminderPending
   *
   * @description
   * Whether a reminder write runs.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly reminderPending: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property renamed
   *
   * @description
   * Emitted with the new, trimmed title.
   *
   * @type {OutputEmitterRef<string>}
   * @readonly
   */
  public readonly renamed: OutputEmitterRef<string> = output<string>();

  /**
   * Property parentOpened
   *
   * @description
   * Emitted with the parent's key when the person opens it.
   *
   * @type {OutputEmitterRef<TaskReference>}
   * @readonly
   */
  public readonly parentOpened: OutputEmitterRef<TaskReference> = output<TaskReference>();

  /**
   * Property watchToggled
   *
   * @description
   * Emitted when the person follows or stops following the task.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly watchToggled: OutputEmitterRef<void> = output();

  /**
   * Property watchersRetried
   *
   * @description
   * Emitted when the person asks to read the followers again.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly watchersRetried: OutputEmitterRef<void> = output();

  /**
   * Property reminderRetried
   *
   * @description
   * Emitted when the person asks to read the reminder again.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly reminderRetried: OutputEmitterRef<void> = output();

  /**
   * Property reminderScheduled
   *
   * @description
   * Emitted with the reminder the person picked.
   *
   * @type {OutputEmitterRef<ReminderChoice>}
   * @readonly
   */
  public readonly reminderScheduled: OutputEmitterRef<ReminderChoice> = output<ReminderChoice>();

  /**
   * Property reminderNoteChanged
   *
   * @description
   * Emitted with the note of the pending reminder.
   *
   * @type {OutputEmitterRef<string>}
   * @readonly
   */
  public readonly reminderNoteChanged: OutputEmitterRef<string> = output<string>();

  /**
   * Property reminderDeleted
   *
   * @description
   * Emitted when the person deletes the reminder.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly reminderDeleted: OutputEmitterRef<void> = output();

  /**
   * Property linkCopied
   *
   * @description
   * Emitted by `Copy the link`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly linkCopied: OutputEmitterRef<void> = output();

  /**
   * Property keyCopied
   *
   * @description
   * Emitted by `Copy the identifier`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly keyCopied: OutputEmitterRef<void> = output();

  /**
   * Property duplicated
   *
   * @description
   * Emitted by `Duplicate`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly duplicated: OutputEmitterRef<void> = output();

  /**
   * Property moveRequested
   *
   * @description
   * Emitted by `Move to…` (the list picker).
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly moveRequested: OutputEmitterRef<void> = output();

  /**
   * Property archived
   *
   * @description
   * Emitted by `Archive`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly archived: OutputEmitterRef<void> = output();

  /**
   * Property templateSaved
   *
   * @description
   * Emitted by `Save as a template`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly templateSaved: OutputEmitterRef<void> = output();

  /**
   * Property parentPickRequested
   *
   * @description
   * Emitted by `Convert to a subtask of…` or `Move to another task…` (the parent picker).
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly parentPickRequested: OutputEmitterRef<void> = output();

  /**
   * Property detached
   *
   * @description
   * Emitted by `Detach from <key>`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly detached: OutputEmitterRef<void> = output();

  /**
   * Property deleteRequested
   *
   * @description
   * Emitted by `Delete` (the confirmation).
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly deleteRequested: OutputEmitterRef<void> = output();

  /**
   * Property closed
   *
   * @description
   * Emitted by `Close`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly closed: OutputEmitterRef<void> = output();

  /**
   * Property cancelText
   *
   * @description
   * `Duplicate · replaced by CAD-482` of a cancelled task, or null.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  protected readonly cancelText: Signal<string | null> = computed((): string | null => {
    const reason: CancelReason | null = this.cancelReason();
    if (this.header().status !== 'cancelled' || reason === null) return null;
    const note: string = this.cancelNote()?.trim() ?? '';
    return note === '' ? CANCEL_REASON_LABELS[reason] : `${CANCEL_REASON_LABELS[reason]} · ${note}`;
  });

  /**
   * Property watchLabel
   *
   * @description
   * Accessible name and tooltip of the follow button.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly watchLabel: Signal<string> = computed((): string => {
    const watchers: TaskWatchers | null = this.watchers();
    const count: number = watchers?.total ?? 0;
    const one: boolean = this.plurals.select(count) === 'one';
    if (watchers?.following) {
      return one
        ? $localize`:@@task.detail.unwatch-one:Stop following this task (${count}:count: follower)`
        : $localize`:@@task.detail.unwatch:Stop following this task (${count}:count: followers)`;
    }
    return one
      ? $localize`:@@task.detail.watch-one:Follow this task (${count}:count: follower)`
      : $localize`:@@task.detail.watch:Follow this task (${count}:count: followers)`;
  });

  /**
   * Property plurals
   *
   * @description
   * Plural rules of the application locale, for the follower count.
   *
   * @type {Intl.PluralRules}
   * @readonly
   */
  private readonly plurals: Intl.PluralRules = new Intl.PluralRules(inject(LOCALE_ID));
  // #endregion

  // #region Methods
  /**
   * Method rename
   *
   * @description
   * Emits a changed, non-blank title; a blank or unchanged one puts the shown title back.
   *
   * @param {HTMLInputElement} field - The title field.
   */
  protected rename(field: HTMLInputElement): void {
    const name: string = field.value.trim();
    if (name === '' || name === this.header().name) {
      field.value = this.header().name;
      return;
    }
    this.renamed.emit(name);
  }
  // #endregion
}
