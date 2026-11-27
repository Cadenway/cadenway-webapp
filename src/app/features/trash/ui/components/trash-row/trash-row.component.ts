import {
  Component,
  computed,
  input,
  type InputSignal,
  type InputSignalWithTransform,
  output,
  type OutputEmitterRef,
  type Signal,
  booleanAttribute,
} from '@angular/core';
import { CwButton } from '@cadenway/ui/components/button';
import { CwStatusIcon } from '@cadenway/ui/components/status-icon';
import { NgIcon } from '@ng-icons/core';

import { STATUS_LABELS } from '@features/task';

import {
  trashDaysLeftTitle,
  trashPurgeLabel,
  trashRestoreLabel,
} from '../../../constants/trash-copy/trash-copy.constants';
import type { TrashEntry } from '../../../models/trash-entry/trash-entry.interface';
import type { TrashRow as TrashRowModel } from '../../../models/trash-row/trash-row.interface';
import { daysLeft, daysSince, WARNING_DAYS } from '../../../utils/trash-time/trash-time.util';

/**
 * Component TrashRow
 *
 * @description
 * One entry of the trash (`App.dc.html` lines 1982-1991), a `listitem` of the page's list: the status
 * icon (its word for screen readers), the name, the key and the parent's key for a subtask, then
 * `<list> · Deleted <when> by <name>` (`Deleted list` for a deleted list), the days left before
 * the entry is erased (grenat at 5 or fewer), `Restore` and the purge button. The row wraps below
 * 640 px. Inputs: `row`, `now` (the instant the days count from) and `disabled` (while the trash
 * is being emptied); a write in flight on the entry spins its button and disables both. Outputs
 * `restoreRequested` and `purgeRequested` carry the entry; the page confirms the purge.
 */
@Component({
  selector: 'cw-trash-row',
  imports: [CwButton, CwStatusIcon, NgIcon],
  host: {
    role: 'listitem',
    class:
      'flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-4 py-3 first:border-t-0 hover:bg-muted/60',
    '[attr.aria-busy]': "row().pending ? 'true' : null",
    'data-testid': 'trash-row',
  },
  templateUrl: './trash-row.component.html',
})
export class TrashRow {
  // #region Properties
  /**
   * Property row
   *
   * @description
   * The entry with who deleted it and the write in flight on it.
   *
   * @type {InputSignal<TrashRowModel>}
   * @readonly
   */
  public readonly row: InputSignal<TrashRowModel> = input.required<TrashRowModel>();

  /**
   * Property now
   *
   * @description
   * The instant the days count from, in milliseconds since the epoch.
   *
   * @type {InputSignal<number>}
   * @readonly
   */
  public readonly now: InputSignal<number> = input.required<number>();

  /**
   * Property disabled
   *
   * @description
   * Disables both buttons, while the trash is being emptied.
   *
   * @type {InputSignalWithTransform<boolean, unknown>}
   * @readonly
   */
  public readonly disabled: InputSignalWithTransform<boolean, unknown> = input(false, {
    transform: booleanAttribute,
  });

  /**
   * Property restoreRequested
   *
   * @description
   * Emits the entry when `Restore` is clicked.
   *
   * @type {OutputEmitterRef<TrashEntry>}
   * @readonly
   */
  public readonly restoreRequested: OutputEmitterRef<TrashEntry> = output<TrashEntry>();

  /**
   * Property purgeRequested
   *
   * @description
   * Emits the entry when the purge button is clicked.
   *
   * @type {OutputEmitterRef<TrashEntry>}
   * @readonly
   */
  public readonly purgeRequested: OutputEmitterRef<TrashEntry> = output<TrashEntry>();

  /**
   * Property warningDays
   *
   * @description
   * Days left at or below which the countdown is grenat.
   *
   * @type {number}
   * @readonly
   */
  protected readonly warningDays: number = WARNING_DAYS;

  /**
   * Property deletedDays
   *
   * @description
   * Calendar days since the deletion.
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly deletedDays: Signal<number> = computed((): number =>
    daysSince(this.row().entry.trashedAt, this.now()),
  );

  /**
   * Property leftDays
   *
   * @description
   * Days before the entry is erased.
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly leftDays: Signal<number> = computed((): number =>
    daysLeft(this.row().entry.purgeAt, this.now()),
  );

  /**
   * Property leftTitle
   *
   * @description
   * The countdown's title.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly leftTitle: Signal<string> = computed((): string =>
    trashDaysLeftTitle(this.leftDays()),
  );

  /**
   * Property restoreLabel
   *
   * @description
   * The accessible name of `Restore`, naming the task.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly restoreLabel: Signal<string> = computed((): string =>
    trashRestoreLabel(this.row().entry.taskKey),
  );

  /**
   * Property purgeLabel
   *
   * @description
   * The accessible name and title of the purge button, naming the task.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly purgeLabel: Signal<string> = computed((): string =>
    trashPurgeLabel(this.row().entry.taskKey),
  );

  /**
   * Property statusLabel
   *
   * @description
   * The status word, read by screen readers next to the decorative icon.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly statusLabel: Signal<string> = computed(
    (): string => STATUS_LABELS[this.row().entry.status],
  );
  // #endregion
}
