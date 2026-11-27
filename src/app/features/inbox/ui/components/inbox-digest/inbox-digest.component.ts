import {
  afterRenderEffect,
  Component,
  DOCUMENT,
  ElementRef,
  inject,
  type Signal,
  signal,
  viewChild,
  type WritableSignal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwEmpty,
  CwEmptyContent,
  CwEmptyDescription,
  CwEmptyHeader,
  CwEmptyMedia,
  CwEmptyTitle,
} from '@cadenway/ui/components/empty';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { CwToastService } from '@cadenway/ui/components/toast';
import { NgIcon } from '@ng-icons/core';
import { interval, map } from 'rxjs';

import { TaskDetailOpener } from '@features/task';

import type { InboxNotification } from '../../../models/inbox-notification/inbox-notification.interface';
import { InboxDigestStore } from '../../../state/inbox-digest/inbox-digest.store';
import { NotificationRow } from '../notification-row/notification-row.component';

/**
 * Constant CLOCK_MS
 *
 * @description
 * How often the relative times of the rows are computed again, in milliseconds.
 *
 * @type {number}
 */
const CLOCK_MS: number = 60_000;

/**
 * Component InboxDigest
 *
 * @description
 * The notifications of the home screen's `Mentions and activity` (mockup `App.dc.html` lines
 * 1725-1734): the first page of the person's notifications in `NotificationRow`, in a bordered
 * list, with relative times renewed every minute. The heading stays with the page that hosts it.
 * While the first read runs it shows three skeleton rows (`role="status"`, `Loading the
 * notifications`). A failed read shows an inline error announced as an alert, with `Retry`: the
 * error stays in place with `Retry` busy (focus kept) while the read runs, and once the rows
 * replace it focus moves to the digest's container, unless it went elsewhere. A page without
 * notifications shows the inbox's empty state. It follows the person's notification notices,
 * realtime reconnections and the reads recorded in the rail's popover. Opening a row marks it
 * read at once and opens its task's detail over the current page (`TaskDetailOpener`,
 * `?task=<key>`); a refused read shows the row unread again and the inbox's error toast. It
 * provides its own `InboxDigestStore` and acts as a page widget; the host page needs
 * `WORKSPACE_CONTEXT`, `TaskDetailOpener`, the shell's toaster and, optionally,
 * `RealtimeConnection`.
 */
@Component({
  selector: 'cw-inbox-digest',
  imports: [
    CwButton,
    CwEmpty,
    CwEmptyContent,
    CwEmptyDescription,
    CwEmptyHeader,
    CwEmptyMedia,
    CwEmptyTitle,
    CwSkeleton,
    NgIcon,
    NotificationRow,
  ],
  providers: [InboxDigestStore],
  templateUrl: './inbox-digest.component.html',
})
export class InboxDigest {
  // #region Properties
  /**
   * Property store
   *
   * @description
   * The notifications and their reads.
   *
   * @type {InstanceType<typeof InboxDigestStore>}
   * @readonly
   */
  protected readonly store: InstanceType<typeof InboxDigestStore> = inject(InboxDigestStore);

  /**
   * Property now
   *
   * @description
   * The moment relative times are computed from, renewed every minute.
   *
   * @type {Signal<Date>}
   * @readonly
   */
  protected readonly now: Signal<Date> = toSignal(
    interval(CLOCK_MS).pipe(map((): Date => new Date())),
    { initialValue: new Date() },
  );

  /**
   * Property taskDetail
   *
   * @description
   * Task's detail, opened over the current page by a notification.
   *
   * @type {TaskDetailOpener}
   * @readonly
   */
  private readonly taskDetail: TaskDetailOpener = inject(TaskDetailOpener);

  /**
   * Property toasts
   *
   * @description
   * Toasts of the shell's toaster.
   *
   * @type {CwToastService}
   * @readonly
   */
  private readonly toasts: CwToastService = inject(CwToastService);

  /**
   * Property document
   *
   * @description
   * Document whose focused element tells whether focus was lost with the error.
   *
   * @type {Document}
   * @readonly
   */
  private readonly document: Document = inject(DOCUMENT);

  /**
   * Property region
   *
   * @description
   * The digest's focusable container, where focus lands when the error it was in disappears.
   *
   * @type {Signal<ElementRef<HTMLElement>>}
   * @readonly
   */
  private readonly region: Signal<ElementRef<HTMLElement>> = viewChild.required<
    string,
    ElementRef<HTMLElement>
  >('region', { read: ElementRef });

  /**
   * Property refocus
   *
   * @description
   * Whether `Retry` was activated and its read has not settled yet.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  private readonly refocus: WritableSignal<boolean> = signal(false);
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Once a read sent by `Retry` settles and the error is gone, moves focus that fell to the
   * document body to the digest's container; a new failure keeps focus on `Retry`.
   *
   * @constructor
   */
  public constructor() {
    afterRenderEffect((): void => {
      if (!this.refocus() || this.store.retrying()) return;
      this.refocus.set(false);
      if (this.store.failed()) return;
      const focused: Element | null = this.document.activeElement;
      if (focused === null || focused === this.document.body) this.region().nativeElement.focus();
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method retry
   *
   * @description
   * Reads the page again after a failure; focus is restored once the rows replace the error.
   */
  protected retry(): void {
    if (this.store.retrying()) return;
    this.refocus.set(true);
    this.store.retry();
  }

  /**
   * Method open
   *
   * @description
   * Marks the notification read and opens its task, if it has one. A refused read shows the
   * inbox's error toast.
   *
   * @param {InboxNotification} notification - The activated notification.
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async open(notification: InboxNotification): Promise<void> {
    const done: Promise<boolean> = this.store.markRead(notification);
    if (notification.taskKey !== null) void this.taskDetail.open(notification.taskKey);
    if (await done) return;
    this.toasts.error(
      $localize`:@@inbox.mark-read-failed:The notification could not be marked as read`,
      {
        description: $localize`:@@inbox.write-failed-text:The server did not answer. Try again in a moment.`,
      },
    );
  }
  // #endregion
}
