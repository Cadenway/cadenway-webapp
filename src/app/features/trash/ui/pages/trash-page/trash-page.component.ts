import {
  Component,
  computed,
  inject,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import {
  CwAlertDialog,
  CwAlertDialogAction,
  CwAlertDialogCancel,
  CwAlertDialogDescription,
  CwAlertDialogMedia,
  CwAlertDialogTitle,
} from '@cadenway/ui/components/alert-dialog';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwEmpty,
  CwEmptyDescription,
  CwEmptyHeader,
  CwEmptyMedia,
  CwEmptyTitle,
} from '@cadenway/ui/components/empty';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { NgIcon } from '@ng-icons/core';

import {
  TRASH_CONFIRM_LABEL,
  TRASH_CONFIRM_WORD,
  trashEmptyText,
  trashPurgeText,
} from '../../../constants/trash-copy/trash-copy.constants';
import type { TrashEntry } from '../../../models/trash-entry/trash-entry.interface';
import { TrashStore, type TrashStoreInstance } from '../../../state/trash/trash.store';
import { TrashRow } from '../../components/trash-row/trash-row.component';

/**
 * Component TrashPage
 *
 * @description
 * The trash at `/:org/trash` (`App.dc.html` lines 1965-1997): `Trash` and its summary
 * (`n items · erased for good after 30 days`), `Empty the trash` when it holds entries, then one
 * row per entry, or `The trash is empty`. The page skeleton (`Loading the trash`) shows while the
 * first read runs; a failed read renders the route's error boundary in place of the page.
 *
 * `Delete forever` confirms in an alert dialog naming the task; `Empty the trash` asks to type
 * `trash` (the translated word). Each dialog stays open, its action spinning, until the write
 * settles; the outcome toasts come from `TrashStore`. `Restore` needs no confirmation. The
 * mockup draws no filter on this page. Below 768 px the header and the rows wrap.
 */
@Component({
  selector: 'cw-trash-page',
  imports: [
    CwAlertDialog,
    CwAlertDialogAction,
    CwAlertDialogCancel,
    CwAlertDialogDescription,
    CwAlertDialogMedia,
    CwAlertDialogTitle,
    CwButton,
    CwEmpty,
    CwEmptyDescription,
    CwEmptyHeader,
    CwEmptyMedia,
    CwEmptyTitle,
    CwSkeleton,
    NgIcon,
    TrashRow,
  ],
  providers: [TrashStore],
  host: { class: 'flex min-h-0 flex-1 flex-col overflow-y-auto' },
  templateUrl: './trash-page.component.html',
})
export class TrashPage {
  // #region Properties
  /**
   * Property store
   *
   * @description
   * The trash of the current organization and its writes.
   *
   * @type {TrashStoreInstance}
   * @readonly
   */
  protected readonly store: TrashStoreInstance = inject(TrashStore);

  /**
   * Property confirmWord
   *
   * @description
   * The word `Empty the trash` asks to type.
   *
   * @type {string}
   * @readonly
   */
  protected readonly confirmWord: string = TRASH_CONFIRM_WORD;

  /**
   * Property confirmLabel
   *
   * @description
   * The prompt before that word.
   *
   * @type {string}
   * @readonly
   */
  protected readonly confirmLabel: string = TRASH_CONFIRM_LABEL;

  /**
   * Property purgeOpen
   *
   * @description
   * Whether the `Delete forever` confirmation is open.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly purgeOpen: WritableSignal<boolean> = signal(false);

  /**
   * Property purgeTarget
   *
   * @description
   * The entry the `Delete forever` confirmation names; kept while the dialog closes.
   *
   * @type {WritableSignal<TrashEntry | null>}
   * @readonly
   */
  protected readonly purgeTarget: WritableSignal<TrashEntry | null> = signal<TrashEntry | null>(
    null,
  );

  /**
   * Property purgePending
   *
   * @description
   * Whether the purge of the named entry is in flight.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly purgePending: Signal<boolean> = computed((): boolean => {
    const target: TrashEntry | null = this.purgeTarget();
    return target !== null && this.store.isPending(target.id);
  });

  /**
   * Property emptyOpen
   *
   * @description
   * Whether the `Empty the trash` confirmation is open.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly emptyOpen: WritableSignal<boolean> = signal(false);

  /**
   * Property purgeText
   *
   * @description
   * The description of the `Delete forever` confirmation, naming the task.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly purgeText: Signal<string> = computed((): string =>
    trashPurgeText(this.purgeTarget()?.taskName ?? ''),
  );

  /**
   * Property emptyText
   *
   * @description
   * The description of the `Empty the trash` confirmation, counting the entries shown.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly emptyText: Signal<string> = computed((): string =>
    trashEmptyText(this.store.count()),
  );
  // #endregion

  // #region Methods
  /**
   * Method restore
   *
   * @description
   * Restores an entry, without confirmation.
   *
   * @param {TrashEntry} entry - The entry.
   */
  protected restore(entry: TrashEntry): void {
    void this.store.restore(entry);
  }

  /**
   * Method askPurge
   *
   * @description
   * Opens the `Delete forever` confirmation for an entry.
   *
   * @param {TrashEntry} entry - The entry.
   */
  protected askPurge(entry: TrashEntry): void {
    this.purgeTarget.set(entry);
    this.purgeOpen.set(true);
  }

  /**
   * Method confirmPurge
   *
   * @description
   * Erases the named entry, then closes the confirmation.
   *
   * @returns {Promise<void>} Settles once the dialog is closed.
   */
  protected async confirmPurge(): Promise<void> {
    const target: TrashEntry | null = this.purgeTarget();
    if (target) await this.store.purge(target);
    this.purgeOpen.set(false);
  }

  /**
   * Method confirmEmpty
   *
   * @description
   * Empties the trash, then closes the confirmation.
   *
   * @returns {Promise<void>} Settles once the dialog is closed.
   */
  protected async confirmEmpty(): Promise<void> {
    await this.store.empty();
    this.emptyOpen.set(false);
  }
  // #endregion
}
