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
import { NgIcon } from '@ng-icons/core';

import {
  KIND_ICONS,
  notificationVerb,
} from '../../../constants/notification-kinds/notification-kinds.constants';
import type { InboxNotification } from '../../../models/inbox-notification/inbox-notification.interface';
import { relativeTime } from '../../../utils/inbox-time/inbox-time.util';

/**
 * Component NotificationRow
 *
 * @description
 * One notification of the inbox popover (mockup `App.dc.html` line 153): the actor's initials with
 * the category icon, `<actor> <verb>`, the task key and name, the quoted excerpt, the relative
 * time and, while unread, the violet dot named `Unread`. The whole row is a button; `opened`
 * fires on click. Read rows dim their sentence.
 */
@Component({
  selector: 'cw-notification-row',
  imports: [NgIcon],
  templateUrl: './notification-row.component.html',
})
export class NotificationRow {
  // #region Properties
  /**
   * Property notification
   *
   * @description
   * The notification shown.
   *
   * @type {InputSignal<InboxNotification>}
   * @readonly
   */
  public readonly notification: InputSignal<InboxNotification> =
    input.required<InboxNotification>();

  /**
   * Property now
   *
   * @description
   * The moment relative times are computed from, set when the popover opens.
   *
   * @type {InputSignal<Date>}
   * @readonly
   */
  public readonly now: InputSignal<Date> = input.required<Date>();

  /**
   * Property opened
   *
   * @description
   * Fires when the row is activated.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly opened: OutputEmitterRef<void> = output();

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
   * Property icon
   *
   * @description
   * Icon of the notification's category.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly icon: Signal<string> = computed(
    (): string => KIND_ICONS[this.notification().kind] ?? 'phosphorBellBold',
  );

  /**
   * Property verb
   *
   * @description
   * What the actor did.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly verb: Signal<string> = computed((): string =>
    notificationVerb(this.notification().kind, this.notification().status),
  );

  /**
   * Property time
   *
   * @description
   * When it arrived (`12 min`, `yesterday`).
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly time: Signal<string> = computed((): string =>
    relativeTime(this.notification().createdAt, this.now(), this.locale),
  );
  // #endregion
}
