import {
  afterNextRender,
  Component,
  computed,
  DOCUMENT,
  ElementRef,
  inject,
  Injector,
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
  trashCappedText,
  trashEmptyText,
  trashPurgeText,
} from '../../../constants/trash-copy/trash-copy.constants';
import type { TrashEntry } from '../../../models/trash-entry/trash-entry.interface';
import type { TrashRow as TrashRowModel } from '../../../models/trash-row/trash-row.interface';
import { TrashStore, type TrashStoreInstance } from '../../../state/trash/trash.store';
import { TrashRow } from '../../components/trash-row/trash-row.component';

/**
 * Component TrashPage
 *
 * @description
 * The trash at `/:org/trash` (`App.dc.html` lines 1965-1997): `Trash` and its summary
 * (`n items · erased for good after 30 days`), `Empty the trash` when it holds entries, then one
 * row per entry, or `The trash is empty`. A trash larger than a read lists says how many entries
 * it does not show. The page skeleton (`Loading the trash`) shows while the first read runs; a
 * failed read renders the route's error boundary in place of the page.
 *
 * `Delete forever` confirms in an alert dialog naming the task; `Empty the trash` asks to type
 * `trash` (the translated word). Each dialog belongs to the organization epoch it opened in: an
 * organization change closes it, and a confirmation from another epoch does nothing. A dialog
 * stays open, its action spinning, until the write settles; the outcome toasts come from
 * `TrashStore`. `Restore` needs no confirmation. When a row leaves after a write, the focus goes
 * to the next row's `Restore`, else the previous one's, else the `h1`; after a dialog closes, the
 * same applies. The mockup draws no filter on this page. Below 768 px the header and the rows wrap.
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
   * Property host
   *
   * @description
   * The page element, where the focus targets are found.
   *
   * @type {ElementRef<HTMLElement>}
   * @readonly
   */
  private readonly host: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * Property document
   *
   * @description
   * The document, to read where the focus is.
   *
   * @type {Document}
   * @readonly
   */
  private readonly document: Document = inject(DOCUMENT);

  /**
   * Property injector
   *
   * @description
   * Runs the focus move after the render that removes a row or closes a dialog.
   *
   * @type {Injector}
   * @readonly
   */
  private readonly injector: Injector = inject(Injector);

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
   * Property purgeEpoch
   *
   * @description
   * The organization epoch the `Delete forever` confirmation opened in, or null when closed.
   *
   * @type {WritableSignal<number | null>}
   * @readonly
   */
  private readonly purgeEpoch: WritableSignal<number | null> = signal<number | null>(null);

  /**
   * Property purgeOpen
   *
   * @description
   * Whether the `Delete forever` confirmation shows: opened, and in the current epoch.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly purgeOpen: Signal<boolean> = computed(
    (): boolean => this.purgeEpoch() !== null && this.purgeEpoch() === this.store.epoch(),
  );

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
   * Property emptyEpoch
   *
   * @description
   * The organization epoch the `Empty the trash` confirmation opened in, or null when closed.
   *
   * @type {WritableSignal<number | null>}
   * @readonly
   */
  private readonly emptyEpoch: WritableSignal<number | null> = signal<number | null>(null);

  /**
   * Property emptyOpen
   *
   * @description
   * Whether the `Empty the trash` confirmation shows: opened, and in the current epoch.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly emptyOpen: Signal<boolean> = computed(
    (): boolean => this.emptyEpoch() !== null && this.emptyEpoch() === this.store.epoch(),
  );

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
   * The description of the `Empty the trash` confirmation, counting the entries.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly emptyText: Signal<string> = computed((): string =>
    trashEmptyText(this.store.count()),
  );

  /**
   * Property cappedText
   *
   * @description
   * The notice under the rows when the trash holds more entries than the read lists.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly cappedText: Signal<string> = computed((): string =>
    trashCappedText(this.store.rows().length, this.store.count()),
  );
  // #endregion

  // #region Methods
  /**
   * Method restore
   *
   * @description
   * Restores an entry, without confirmation, then moves the focus off its row if it left.
   *
   * @param {TrashEntry} entry - The entry.
   * @returns {Promise<void>} Settles once the outcome is shown.
   */
  protected async restore(entry: TrashEntry): Promise<void> {
    const order: readonly string[] = this.neighbours(entry.id);
    await this.store.restore(entry);
    this.focusAway(entry.id, order);
  }

  /**
   * Method askPurge
   *
   * @description
   * Opens the `Delete forever` confirmation for an entry, in the current epoch.
   *
   * @param {TrashEntry} entry - The entry.
   */
  protected askPurge(entry: TrashEntry): void {
    this.purgeTarget.set(entry);
    this.purgeEpoch.set(this.store.epoch());
  }

  /**
   * Method purgeOpenChanged
   *
   * @description
   * Follows the dialog closing itself (`Cancel`, Escape).
   *
   * @param {boolean} open - Whether the dialog is open.
   */
  protected purgeOpenChanged(open: boolean): void {
    if (!open) this.purgeEpoch.set(null);
  }

  /**
   * Method confirmPurge
   *
   * @description
   * Erases the named entry when the confirmation still belongs to the current epoch, then closes
   * it and moves the focus off the row if it left.
   *
   * @returns {Promise<void>} Settles once the dialog is closed.
   */
  protected async confirmPurge(): Promise<void> {
    const target: TrashEntry | null = this.purgeTarget();
    const epoch: number | null = this.purgeEpoch();
    if (!target || epoch === null || epoch !== this.store.epoch()) {
      this.purgeEpoch.set(null);
      return;
    }
    const order: readonly string[] = this.neighbours(target.id);
    await this.store.purge(target, epoch);
    this.purgeEpoch.set(null);
    this.focusAway(target.id, order);
  }

  /**
   * Method askEmpty
   *
   * @description
   * Opens the `Empty the trash` confirmation in the current epoch, unless a write runs.
   */
  protected askEmpty(): void {
    if (!this.store.writing()) this.emptyEpoch.set(this.store.epoch());
  }

  /**
   * Method emptyOpenChanged
   *
   * @description
   * Follows the dialog closing itself (`Cancel`, Escape).
   *
   * @param {boolean} open - Whether the dialog is open.
   */
  protected emptyOpenChanged(open: boolean): void {
    if (!open) this.emptyEpoch.set(null);
  }

  /**
   * Method confirmEmpty
   *
   * @description
   * Empties the trash when the confirmation still belongs to the current epoch, then closes it and
   * moves the focus to the `h1` if the rows left.
   *
   * @returns {Promise<void>} Settles once the dialog is closed.
   */
  protected async confirmEmpty(): Promise<void> {
    const epoch: number | null = this.emptyEpoch();
    if (epoch === null || epoch !== this.store.epoch()) {
      this.emptyEpoch.set(null);
      return;
    }
    await this.store.empty(epoch);
    this.emptyEpoch.set(null);
    this.focusAway(null, []);
  }

  /**
   * Method neighbours
   *
   * @description
   * The rows to focus if an entry's row leaves, in order: those after it, then those before it,
   * nearest first.
   *
   * @param {string} entryId - The entry.
   * @returns {readonly string[]} Entry ids.
   */
  private neighbours(entryId: string): readonly string[] {
    const ids: readonly string[] = this.store.rows().map((row: TrashRowModel) => row.entry.id);
    const index: number = ids.indexOf(entryId);
    if (index < 0) return [];
    return [...ids.slice(index + 1), ...ids.slice(0, index).reverse()];
  }

  /**
   * Method focusAway
   *
   * @description
   * Moves the focus off a row that left (or, for null, off every row) when it was in that row, on
   * the page body or nowhere: to the first remaining row of `order`, else the `h1`. It runs at once,
   * while the row is still rendered, and again after the next render, once a dialog has returned
   * the focus to a removed button.
   *
   * @param {string | null} entryId - The entry whose row may have left, or null for all rows.
   * @param {readonly string[]} order - Candidate rows.
   */
  private focusAway(entryId: string | null, order: readonly string[]): void {
    const move: () => void = (): void => {
      const ids: ReadonlySet<string> = new Set(
        this.store.rows().map((row: TrashRowModel) => row.entry.id),
      );
      if (entryId !== null && ids.has(entryId)) return;
      const page: HTMLElement = this.host.nativeElement;
      const active: Element | null = this.document.activeElement;
      const leaving: readonly Element[] = [...page.querySelectorAll('[data-entry-id]')].filter(
        (row: Element) => entryId === null || row.getAttribute('data-entry-id') === entryId,
      );
      const lost: boolean =
        active === null ||
        active === this.document.body ||
        !active.isConnected ||
        leaving.some((row: Element) => row.contains(active));
      if (!lost) return;
      for (const id of order) {
        if (!ids.has(id)) continue;
        const target: HTMLElement | null | undefined = [
          ...page.querySelectorAll<HTMLElement>('[data-entry-id]'),
        ]
          .find((row: HTMLElement) => row.getAttribute('data-entry-id') === id)
          ?.querySelector<HTMLElement>('[data-testid="trash-row-restore"]');
        if (target) {
          target.focus();
          return;
        }
      }
      page.querySelector<HTMLElement>('[data-route-focus]')?.focus();
    };
    move();
    afterNextRender(move, { injector: this.injector });
  }
  // #endregion
}
