/**
 * Interface InboxReminder
 *
 * @description
 * A pending reminder of the signed-in person, as the `Reminders` tab shows it.
 */
export interface InboxReminder {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Reminder identifier.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property taskKey
   *
   * @description
   * Key of the task it reminds of.
   *
   * @type {string}
   * @readonly
   */
  readonly taskKey: string;

  /**
   * Property taskName
   *
   * @description
   * Name of that task.
   *
   * @type {string}
   * @readonly
   */
  readonly taskName: string;

  /**
   * Property remindAt
   *
   * @description
   * When it is due, as an ISO 8601 instant.
   *
   * @type {string}
   * @readonly
   */
  readonly remindAt: string;

  /**
   * Property note
   *
   * @description
   * The person's private note, or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly note: string | null;
  // #endregion
}

/**
 * Interface InboxReminderPage
 *
 * @description
 * The pending reminders, the soonest first, and their count across all pages.
 */
export interface InboxReminderPage {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * Pending reminders, overdue ones included.
   *
   * @type {readonly InboxReminder[]}
   * @readonly
   */
  readonly items: readonly InboxReminder[];

  /**
   * Property pendingCount
   *
   * @description
   * Pending reminders across every page.
   *
   * @type {number}
   * @readonly
   */
  readonly pendingCount: number;
  // #endregion
}
