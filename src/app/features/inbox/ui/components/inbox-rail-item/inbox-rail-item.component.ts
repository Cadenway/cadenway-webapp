import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  LOCALE_ID,
  type Signal,
  signal,
  viewChild,
  type WritableSignal,
} from '@angular/core';
import { Router } from '@angular/router';
import { CwAppRailGroup, CwAppRailItem } from '@cadenway/ui/components/app-rail';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwEmpty,
  CwEmptyContent,
  CwEmptyDescription,
  CwEmptyHeader,
  CwEmptyMedia,
  CwEmptyTitle,
} from '@cadenway/ui/components/empty';
import { CwPopover, CwPopoverTrigger } from '@cadenway/ui/components/popover';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { CwTab, CwTabPanel, CwTabs, CwTabsList } from '@cadenway/ui/components/tabs';
import { CwToastService } from '@cadenway/ui/components/toast';
import { NgIcon } from '@ng-icons/core';

import { PRESENCE, type PresencePort } from '@features/account/ports/presence';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import type { InboxNotification } from '../../../models/inbox-notification/inbox-notification.interface';
import type { InboxReminder } from '../../../models/inbox-reminder/inbox-reminder.interface';
import { InboxStore } from '../../../state/inbox/inbox.store';
import { reminderTime, tomorrowMorning } from '../../../utils/inbox-time/inbox-time.util';
import { NotificationRow } from '../notification-row/notification-row.component';
import { ReminderRow } from '../reminder-row/reminder-row.component';

/**
 * Component InboxRailItem
 *
 * @description
 * The « Boîte de réception » item of the rail and its popover (mockup `App.dc.html` lines 39-43
 * and 139-174). The badge counts unread notifications, refreshed by realtime, focus and polling.
 * It is hidden while the person's presence is « Ne pas déranger ». The popover has the
 * title with the unread count, « Tout marquer comme lu » (disabled with nothing to read), the
 * « Notifications » and « Rappels » tabs with their counts, the do-not-disturb notice, the rows,
 * the empty states, skeletons while loading, an inline error with « Réessayer », and « Tout
 * afficher dans l’accueil », which opens `/<slug>`. Opening a notification marks it read and opens
 * `/<slug>/t/<key>`; a reminder offers « demain matin » and « Marquer comme fait », confirmed by a
 * toast. Writes are optimistic; a refusal restores the row and shows an error toast. It provides
 * its own `InboxStore` and acts as a page of the shell. Its host is `display: contents`, so the
 * item joins the rail group's layout.
 */
@Component({
  selector: 'cw-inbox-rail-item',
  imports: [
    CwAppRailGroup,
    CwAppRailItem,
    CwButton,
    CwEmpty,
    CwEmptyContent,
    CwEmptyDescription,
    CwEmptyHeader,
    CwEmptyMedia,
    CwEmptyTitle,
    CwPopover,
    CwPopoverTrigger,
    CwSkeleton,
    CwTab,
    CwTabPanel,
    CwTabs,
    CwTabsList,
    NgIcon,
    NotificationRow,
    ReminderRow,
  ],
  providers: [InboxStore],
  host: { class: 'contents' },
  templateUrl: './inbox-rail-item.component.html',
})
export class InboxRailItem {
  // #region Properties
  /**
   * Property workspace
   *
   * @description
   * Workspace context whose tasks and home screen the popover opens.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  protected readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property store
   *
   * @description
   * Badge, notifications and reminders.
   *
   * @type {InstanceType<typeof InboxStore>}
   * @readonly
   */
  protected readonly store: InstanceType<typeof InboxStore> = inject(InboxStore);

  /**
   * Property open
   *
   * @description
   * Whether the popover is open.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly open: WritableSignal<boolean> = signal(false);

  /**
   * Property tab
   *
   * @description
   * The active tab, `notifications` or `reminders`.
   *
   * @type {WritableSignal<string>}
   * @readonly
   */
  protected readonly tab: WritableSignal<string> = signal('notifications');

  /**
   * Property now
   *
   * @description
   * The moment relative times are computed from, set at each opening.
   *
   * @type {WritableSignal<Date>}
   * @readonly
   */
  protected readonly now: WritableSignal<Date> = signal(new Date());

  /**
   * Property presence
   *
   * @description
   * The person's own presence, when the workspace provides it.
   *
   * @type {PresencePort | null}
   * @readonly
   */
  private readonly presence: PresencePort | null = inject(PRESENCE, { optional: true });

  /**
   * Property router
   *
   * @description
   * Router opening tasks and the home screen.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

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
   * Property injector
   *
   * @description
   * Injector scheduling the focus moves after rendering.
   *
   * @type {Injector}
   * @readonly
   */
  private readonly injector: Injector = inject(Injector);

  /**
   * Property content
   *
   * @description
   * The popover's content, where focus moves after a row or a button disappears.
   *
   * @type {Signal<ElementRef<HTMLElement> | undefined>}
   * @readonly
   */
  private readonly content: Signal<ElementRef<HTMLElement> | undefined> = viewChild<
    string,
    ElementRef<HTMLElement>
  >('popoverContent', { read: ElementRef });

  /**
   * Property doNotDisturb
   *
   * @description
   * Whether the person's presence is « Ne pas déranger ».
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly doNotDisturb: Signal<boolean> = computed(
    (): boolean => this.presence?.ownStatus() === 'do-not-disturb',
  );

  /**
   * Property unread
   *
   * @description
   * Unread notifications, zero before the first answer.
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly unread: Signal<number> = computed((): number => this.store.unreadCount() ?? 0);

  /**
   * Property badge
   *
   * @description
   * The rail badge: the unread count, hidden at zero and while « Ne pas déranger ».
   *
   * @type {Signal<number | null>}
   * @readonly
   */
  protected readonly badge: Signal<number | null> = computed((): number | null =>
    this.unread() > 0 && !this.doNotDisturb() ? this.unread() : null,
  );

  /**
   * Property badgeLabel
   *
   * @description
   * How the badge is read after the item's name.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly badgeLabel: Signal<string> = computed(
    (): string => $localize`:@@inbox.rail.badge:${this.unread()}:count: unread`,
  );
  // #endregion

  // #region Methods
  /**
   * Method setOpen
   *
   * @description
   * Follows the popover; each opening reads the lists again from the current moment.
   *
   * @param {boolean} open - Whether the popover is open.
   */
  protected setOpen(open: boolean): void {
    this.open.set(open);
    if (!open) {
      this.store.close();
      return;
    }
    this.now.set(new Date());
    this.store.open();
  }

  /**
   * Method markAllRead
   *
   * @description
   * Marks every notification read; the button then becomes disabled, so focus moves to the
   * popover's heading. A refusal shows an error toast.
   *
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async markAllRead(): Promise<void> {
    const done: Promise<boolean> = this.store.markAllRead();
    this.focusAfterRender('[data-inbox-heading]');
    if (await done) return;
    this.failed($localize`:@@inbox.mark-all-failed:The notifications could not be marked as read`);
  }

  /**
   * Method openNotification
   *
   * @description
   * Marks the notification read and opens its task, if it has one, closing the popover. A
   * refused read shows the inbox's error toast.
   *
   * @param {InboxNotification} notification - The activated notification.
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async openNotification(notification: InboxNotification): Promise<void> {
    const done: Promise<boolean> = this.store.markRead(notification);
    if (notification.taskKey !== null) this.openTask(notification.taskKey);
    if (await done) return;
    this.failed($localize`:@@inbox.mark-read-failed:The notification could not be marked as read`);
  }

  /**
   * Method openTask
   *
   * @description
   * Closes the popover and opens `/<slug>/t/<key>`.
   *
   * @param {string} taskKey - Key of the task.
   */
  protected openTask(taskKey: string): void {
    this.open.set(false);
    this.store.close();
    void this.router.navigate(['/', this.workspace.organization().slug, 't', taskKey]);
  }

  /**
   * Method openHome
   *
   * @description
   * Closes the popover and opens the home screen of the workspace.
   */
  protected openHome(): void {
    this.open.set(false);
    this.store.close();
    void this.router.navigate(['/', this.workspace.organization().slug]);
  }

  /**
   * Method snooze
   *
   * @description
   * Postpones a reminder to 9 h tomorrow and confirms with a toast.
   *
   * @param {InboxReminder} reminder - The reminder.
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async snooze(reminder: InboxReminder): Promise<void> {
    const now: Date = new Date();
    const remindAt: string = tomorrowMorning(now);
    if (await this.store.snooze(reminder, remindAt)) {
      this.toasts.success($localize`:@@inbox.reminder.snoozed:Reminder postponed`, {
        description: `${reminderTime(remindAt, now, this.locale)} · ${reminder.taskKey}`,
      });
      return;
    }
    this.failed($localize`:@@inbox.reminder.snooze-failed:The reminder could not be postponed`);
  }

  /**
   * Method complete
   *
   * @description
   * Marks a reminder done and confirms with a toast. Its row disappears at once, so focus moves to
   * the row that takes its place, or to the « Rappels » tab when it was the last one.
   *
   * @param {InboxReminder} reminder - The reminder.
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async complete(reminder: InboxReminder): Promise<void> {
    const rows: readonly InboxReminder[] = this.store.reminders.hasValue()
      ? this.store.reminders.value().items
      : [];
    const index: number = rows.findIndex((row: InboxReminder) => row.id === reminder.id);
    const done: Promise<boolean> = this.store.complete(reminder);
    this.focusAfterRender('', index, '[data-inbox-reminders-tab]');
    if (await done) {
      this.toasts.success($localize`:@@inbox.reminder.completed:Reminder done`, {
        description: `${reminder.taskKey} · ${reminder.taskName}`,
      });
      return;
    }
    this.failed(
      $localize`:@@inbox.reminder.complete-failed:The reminder could not be marked as done`,
    );
  }

  /**
   * Method focusAfterRender
   *
   * @description
   * Once the change is rendered, focuses an element of the popover: the `index`-th row button when
   * an index is given (the row now at that place, else the previous one), else the fallback.
   *
   * @param {string} selector - Element to focus when no index is given.
   * @param {number} index - Position of the removed row, or -1.
   * @param {string} fallback - Element to focus when no row is left.
   */
  private focusAfterRender(selector: string, index: number = -1, fallback: string = ''): void {
    afterNextRender(
      (): void => {
        const content: HTMLElement | undefined = this.content()?.nativeElement;
        if (!content) return;
        if (index < 0) {
          content.querySelector<HTMLElement>(selector)?.focus();
          return;
        }
        const buttons: HTMLElement[] = Array.from(
          content.querySelectorAll<HTMLElement>('[data-testid="reminder-row"] > button'),
        );
        const row: HTMLElement | undefined = buttons.at(Math.min(index, buttons.length - 1));
        (row ?? content.querySelector<HTMLElement>(fallback))?.focus();
      },
      { injector: this.injector },
    );
  }

  /**
   * Method failed
   *
   * @description
   * Reports a refused write; the row is already restored.
   *
   * @param {string} title - What failed.
   */
  private failed(title: string): void {
    this.toasts.error(title, {
      description: $localize`:@@inbox.write-failed-text:The server did not answer. Try again in a moment.`,
    });
  }
  // #endregion
}
