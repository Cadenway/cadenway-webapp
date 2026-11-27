import { Component, input, type InputSignal, output, type OutputEmitterRef } from '@angular/core';
import { CwButton } from '@cadenway/ui/components/button';
import { NgIcon } from '@ng-icons/core';

/**
 * Component ArchiveRow
 *
 * @description
 * One row of the archives (`App.dc.html` lines 2009-2013): the kind icon in its muted tile, the
 * name with the task key when there is one, the meta line, and `Restore`. The row wraps below
 * 640 px so `Restore` drops under the text on a phone. Its host is a `listitem`, so it lives in
 * the page's `role="list"` container. `Restore` is disabled while its write runs (`pending`) and
 * emits `restored` on click; the page owns the write and its toast.
 */
@Component({
  selector: 'cw-archive-row',
  imports: [CwButton, NgIcon],
  host: {
    role: 'listitem',
    class:
      'flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-4 py-3 first:border-t-0 hover:bg-muted/60',
  },
  templateUrl: './archive-row.component.html',
})
export class ArchiveRow {
  // #region Properties
  /**
   * Property icon
   *
   * @description
   * Bold Phosphor icon of the kind: lightning for a sprint, list bullets for a list, check-square
   * for a task.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly icon: InputSignal<string> = input.required<string>();

  /**
   * Property name
   *
   * @description
   * Name of the list or task.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly name: InputSignal<string> = input.required<string>();

  /**
   * Property taskKey
   *
   * @description
   * Key of a task, shown in monospace after its name, or null for a list.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly taskKey: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property meta
   *
   * @description
   * The meta line (space or list, count, date and author), truncated on one line.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly meta: InputSignal<string> = input.required<string>();

  /**
   * Property restoreLabel
   *
   * @description
   * Accessible name of `Restore`, naming the item (`Restore the list Sprint 13`).
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly restoreLabel: InputSignal<string> = input.required<string>();

  /**
   * Property pending
   *
   * @description
   * Whether the restore of this item runs.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly pending: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property restored
   *
   * @description
   * Emits when `Restore` is clicked.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly restored: OutputEmitterRef<void> = output();
  // #endregion
}
