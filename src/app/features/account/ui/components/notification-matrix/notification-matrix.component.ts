import {
  Component,
  computed,
  input,
  type InputSignal,
  output,
  type OutputEmitterRef,
  type Signal,
} from '@angular/core';
import { CwCheckbox } from '@cadenway/ui/components/checkbox';
import {
  CwTable,
  CwTableBody,
  CwTableCell,
  CwTableContainer,
  CwTableHead,
  CwTableHeader,
  CwTableRow,
} from '@cadenway/ui/components/table';

import type {
  NotificationChannel,
  NotificationChannelChange,
  NotificationEvent,
  NotificationMatrix as NotificationMatrixValue,
} from '../../../models/notification-preferences/notification-preferences.interface';

/**
 * Interface MatrixColumn
 *
 * @description
 * A channel column of the matrix.
 */
interface MatrixColumn {
  // #region Properties
  /**
   * Property channel
   *
   * @description
   * The channel.
   *
   * @type {NotificationChannel}
   * @readonly
   */
  readonly channel: NotificationChannel;

  /**
   * Property label
   *
   * @description
   * Header of the column, also shown beside the box on a phone.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property boxLabel
   *
   * @description
   * Accessible name of a box of the column, from the event's label.
   *
   * @type {(event: string) => string}
   * @readonly
   */
  readonly boxLabel: (event: string) => string;
  // #endregion
}

/**
 * Interface MatrixCell
 *
 * @description
 * A box of the matrix.
 */
interface MatrixCell {
  // #region Properties
  /**
   * Property channel
   *
   * @description
   * Channel of the box.
   *
   * @type {NotificationChannel}
   * @readonly
   */
  readonly channel: NotificationChannel;

  /**
   * Property label
   *
   * @description
   * Name of the channel, shown beside the box on a phone.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property ariaLabel
   *
   * @description
   * Accessible name of the box (`Mentions by email`).
   *
   * @type {string}
   * @readonly
   */
  readonly ariaLabel: string;

  /**
   * Property enabled
   *
   * @description
   * Whether the box is ticked.
   *
   * @type {boolean}
   * @readonly
   */
  readonly enabled: boolean;
  // #endregion
}

/**
 * Interface MatrixRow
 *
 * @description
 * An event row of the matrix.
 */
interface MatrixRow {
  // #region Properties
  /**
   * Property event
   *
   * @description
   * The event.
   *
   * @type {NotificationEvent}
   * @readonly
   */
  readonly event: NotificationEvent;

  /**
   * Property label
   *
   * @description
   * Name of the event.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property hint
   *
   * @description
   * What the event covers.
   *
   * @type {string}
   * @readonly
   */
  readonly hint: string;

  /**
   * Property cells
   *
   * @description
   * One box per channel, in the column order.
   *
   * @type {readonly MatrixCell[]}
   * @readonly
   */
  readonly cells: readonly MatrixCell[];
  // #endregion
}

/**
 * Constant COLUMNS
 *
 * @description
 * The channel columns (mockup `Compte.dc.html` lines 365 and 1483).
 *
 * @type {readonly MatrixColumn[]}
 */
const COLUMNS: readonly MatrixColumn[] = [
  {
    channel: 'inApp',
    label: $localize`:@@account.notifications.channel-in-app:In the app`,
    boxLabel: (event: string): string =>
      $localize`:@@account.notifications.box-in-app:${event}:event: in the app`,
  },
  {
    channel: 'email',
    label: $localize`:@@account.notifications.channel-email:Email`,
    boxLabel: (event: string): string =>
      $localize`:@@account.notifications.box-email:${event}:event: by email`,
  },
  {
    channel: 'mobile',
    label: $localize`:@@account.notifications.channel-mobile:Mobile`,
    boxLabel: (event: string): string =>
      $localize`:@@account.notifications.box-mobile:${event}:event: on mobile`,
  },
];

/**
 * Function eventsOf
 *
 * @description
 * The event rows in the mockup's order (`Compte.dc.html` lines 1475-1482), with their label and
 * hint; the mention hint names the person's mention handle.
 *
 * @param {string} handle - The person's mention handle, without `@`.
 * @returns {readonly { event: NotificationEvent; label: string; hint: string }[]} The events.
 */
function eventsOf(
  handle: string,
): readonly { event: NotificationEvent; label: string; hint: string }[] {
  return [
    {
      event: 'mention',
      label: $localize`:@@account.notifications.event-mention:Mentions`,
      hint: $localize`:@@account.notifications.event-mention-hint:@${handle}:handle: in a comment or a description`,
    },
    {
      event: 'assignment',
      label: $localize`:@@account.notifications.event-assignment:Assignments`,
      hint: $localize`:@@account.notifications.event-assignment-hint:A task is assigned to you or taken off you`,
    },
    {
      event: 'comment',
      label: $localize`:@@account.notifications.event-comment:Comments`,
      hint: $localize`:@@account.notifications.event-comment-hint:On the tasks you follow`,
    },
    {
      event: 'statusChange',
      label: $localize`:@@account.notifications.event-status-change:Status changes`,
      hint: $localize`:@@account.notifications.event-status-change-hint:On the tasks you follow`,
    },
    {
      event: 'dueDate',
      label: $localize`:@@account.notifications.event-due-date:Due dates`,
      hint: $localize`:@@account.notifications.event-due-date-hint:The day before and on the due date`,
    },
    {
      event: 'access',
      label: $localize`:@@account.notifications.event-access:Invitations and access`,
      hint: $localize`:@@account.notifications.event-access-hint:New organization, new role`,
    },
    {
      event: 'billing',
      label: $localize`:@@account.notifications.event-billing:Billing`,
      hint: $localize`:@@account.notifications.event-billing-hint:Invoices, payments, quotas (owners)`,
    },
  ];
}

/**
 * Component NotificationMatrix
 *
 * @description
 * The `Events` table of the notifications section (mockup `Compte.dc.html` lines 360-381): one
 * row per event, with its hint, and one box per channel (`In the app`, `Email`, `Mobile`), each
 * named `<event> in the app | by email | on mobile`. The table scrolls sideways when narrower
 * than 520 px; below 768 px it becomes cards (the mockup's `.cw-cards` rule): the header row is
 * hidden, the event takes the whole width and the boxes follow it, each with its channel's name.
 * It shows `channels` as given and emits `channelChanged` for each box ticked or cleared; the
 * page saves it and passes the new value back.
 */
@Component({
  selector: 'cw-notification-matrix',
  imports: [
    CwCheckbox,
    CwTable,
    CwTableBody,
    CwTableCell,
    CwTableContainer,
    CwTableHead,
    CwTableHeader,
    CwTableRow,
  ],
  templateUrl: './notification-matrix.component.html',
})
export class NotificationMatrix {
  // #region Properties
  /**
   * Property channels
   *
   * @description
   * The channels of every event, as shown.
   *
   * @type {InputSignal<NotificationMatrixValue>}
   * @readonly
   */
  public readonly channels: InputSignal<NotificationMatrixValue> =
    input.required<NotificationMatrixValue>();

  /**
   * Property mentionHandle
   *
   * @description
   * The person's mention handle, without `@`, which the mention hint names.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly mentionHandle: InputSignal<string> = input.required<string>();

  /**
   * Property channelChanged
   *
   * @description
   * A box ticked or cleared.
   *
   * @type {OutputEmitterRef<NotificationChannelChange>}
   * @readonly
   */
  public readonly channelChanged: OutputEmitterRef<NotificationChannelChange> =
    output<NotificationChannelChange>();

  /**
   * Property columns
   *
   * @description
   * The channel columns.
   *
   * @type {readonly MatrixColumn[]}
   * @readonly
   */
  protected readonly columns: readonly MatrixColumn[] = COLUMNS;

  /**
   * Property rows
   *
   * @description
   * The event rows with their boxes.
   *
   * @type {Signal<readonly MatrixRow[]>}
   * @readonly
   */
  protected readonly rows: Signal<readonly MatrixRow[]> = computed((): readonly MatrixRow[] => {
    const channels: NotificationMatrixValue = this.channels();
    return eventsOf(this.mentionHandle()).map(
      ({ event, label, hint }: { event: NotificationEvent; label: string; hint: string }) => ({
        event,
        label,
        hint,
        cells: COLUMNS.map((column: MatrixColumn): MatrixCell => ({
          channel: column.channel,
          label: column.label,
          ariaLabel: column.boxLabel(label),
          enabled: channels[event][column.channel],
        })),
      }),
    );
  });
  // #endregion

  // #region Methods
  /**
   * Method toggle
   *
   * @description
   * Emits the new value of a box.
   *
   * @param {NotificationEvent} event - Row of the box.
   * @param {NotificationChannel} channel - Column of the box.
   * @param {boolean} enabled - Whether it is now ticked.
   */
  protected toggle(event: NotificationEvent, channel: NotificationChannel, enabled: boolean): void {
    this.channelChanged.emit({ kind: 'channel', event, channel, enabled });
  }
  // #endregion
}
