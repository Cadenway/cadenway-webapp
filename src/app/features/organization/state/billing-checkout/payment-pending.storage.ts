/**
 * Constant PAYMENT_PENDING_STORAGE
 *
 * @description
 * Prefix of the `sessionStorage` entry of an organization's payment awaiting Billing's
 * confirmation; the organization id follows it.
 *
 * @type {string}
 */
export const PAYMENT_PENDING_STORAGE: string = 'cadenway-billing-payment-pending:';

/**
 * Constant PAYMENT_PENDING_LIFETIME_MS
 *
 * @description
 * How long a payment is awaited after Stripe's successful return: one hour. Past it the section
 * offers the upgrade again.
 *
 * @type {number}
 */
export const PAYMENT_PENDING_LIFETIME_MS: number = 60 * 60 * 1000;

/**
 * Interface PaymentPending
 *
 * @description
 * A payment Billing has not confirmed yet.
 */
export interface PaymentPending {
  // #region Properties
  /**
   * Property since
   *
   * @description
   * When Stripe returned, in milliseconds since the epoch.
   *
   * @type {number}
   * @readonly
   */
  readonly since: number;

  /**
   * Property unconfirmed
   *
   * @description
   * Whether the last confirmation read still showed the Free plan.
   *
   * @type {boolean}
   * @readonly
   */
  readonly unconfirmed: boolean;
  // #endregion
}

/**
 * Function readPaymentPending
 *
 * @description
 * Reads the organization's payment awaiting confirmation, within its lifetime. An expired,
 * malformed or unreadable entry reads as none, and an expired one is removed.
 *
 * @param {Storage | null} storage - The tab's `sessionStorage`, or null.
 * @param {string} organizationId - The organization.
 * @param {number} now - Current time, in milliseconds since the epoch.
 * @returns {PaymentPending | null} The pending payment, or null.
 */
export function readPaymentPending(
  storage: Storage | null,
  organizationId: string,
  now: number,
): PaymentPending | null {
  try {
    const text: string | null = storage?.getItem(PAYMENT_PENDING_STORAGE + organizationId) ?? null;
    if (text === null) return null;
    const value: unknown = JSON.parse(text);
    const record: Record<string, unknown> =
      typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
    const since: unknown = record['since'];
    if (
      typeof since === 'number' &&
      typeof record['unconfirmed'] === 'boolean' &&
      now >= since &&
      now - since < PAYMENT_PENDING_LIFETIME_MS
    ) {
      return { since, unconfirmed: record['unconfirmed'] };
    }
    storage?.removeItem(PAYMENT_PENDING_STORAGE + organizationId);
    return null;
  } catch {
    return null;
  }
}

/**
 * Function writePaymentPending
 *
 * @description
 * Stores the organization's payment awaiting confirmation; a storage the browser refuses keeps
 * nothing.
 *
 * @param {Storage | null} storage - The tab's `sessionStorage`, or null.
 * @param {string} organizationId - The organization.
 * @param {PaymentPending} pending - The pending payment.
 */
export function writePaymentPending(
  storage: Storage | null,
  organizationId: string,
  pending: PaymentPending,
): void {
  try {
    storage?.setItem(PAYMENT_PENDING_STORAGE + organizationId, JSON.stringify(pending));
  } catch {
    // A full or refused storage keeps nothing; the page's own state still holds the wait.
  }
}

/**
 * Function clearPaymentPending
 *
 * @description
 * Removes the organization's payment awaiting confirmation.
 *
 * @param {Storage | null} storage - The tab's `sessionStorage`, or null.
 * @param {string} organizationId - The organization.
 */
export function clearPaymentPending(storage: Storage | null, organizationId: string): void {
  try {
    storage?.removeItem(PAYMENT_PENDING_STORAGE + organizationId);
  } catch {
    // A refused storage holds nothing to remove.
  }
}
