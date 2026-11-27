/**
 * Constant CHECKOUT_KEY_STORAGE
 *
 * @description
 * `sessionStorage` entry of the checkout key. It survives the same-tab round trip to Stripe,
 * which reloads the application, and the tab's other pages, but not the tab.
 *
 * @type {string}
 */
export const CHECKOUT_KEY_STORAGE: string = 'cadenway-billing-checkout-key';

/**
 * Constant CHECKOUT_KEY_LIFETIME_MS
 *
 * @description
 * How long a key is sent again: two hours, the time Billing keeps a Checkout open (its
 * configuration, not yet in the contract). After it, Billing can replace the expired session, so a
 * new key is taken.
 *
 * @type {number}
 */
export const CHECKOUT_KEY_LIFETIME_MS: number = 2 * 60 * 60 * 1000;

/**
 * Interface CheckoutKeyRecord
 *
 * @description
 * The idempotency key of a person's checkout for an organization, and when it was made.
 */
export interface CheckoutKeyRecord {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * Organization the key was made for.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property userId
   *
   * @description
   * Person who started the checkout.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property key
   *
   * @description
   * The `Idempotency-Key`.
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;

  /**
   * Property createdAt
   *
   * @description
   * When the key was made, in milliseconds since the epoch.
   *
   * @type {number}
   * @readonly
   */
  readonly createdAt: number;
  // #endregion
}

/**
 * Function isRecord
 *
 * @description
 * Whether a stored value has the shape of a key record.
 *
 * @param {unknown} value - Parsed stored value.
 * @returns {boolean} True for a complete record.
 */
function isRecord(value: unknown): value is CheckoutKeyRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record: Record<string, unknown> = value as Record<string, unknown>;
  return (
    typeof record['organizationId'] === 'string' &&
    typeof record['userId'] === 'string' &&
    typeof record['key'] === 'string' &&
    record['key'] !== '' &&
    typeof record['createdAt'] === 'number'
  );
}

/**
 * Function isUsable
 *
 * @description
 * Whether a record belongs to the organization and the person and is still within its lifetime.
 *
 * @param {CheckoutKeyRecord | null} record - The record.
 * @param {string} organizationId - Organization shown.
 * @param {string} userId - Person signed in.
 * @param {number} now - Current time, in milliseconds since the epoch.
 * @returns {boolean} True when the key may be sent again.
 */
export function isUsable(
  record: CheckoutKeyRecord | null,
  organizationId: string,
  userId: string,
  now: number,
): record is CheckoutKeyRecord {
  return (
    record !== null &&
    record.organizationId === organizationId &&
    record.userId === userId &&
    now >= record.createdAt &&
    now - record.createdAt < CHECKOUT_KEY_LIFETIME_MS
  );
}

/**
 * Function readCheckoutKey
 *
 * @description
 * Reads the stored record. A missing, unreadable or malformed entry, or a storage the browser
 * refuses, reads as none.
 *
 * @param {Storage | null} storage - The tab's `sessionStorage`, or null.
 * @returns {CheckoutKeyRecord | null} The record, or null.
 */
export function readCheckoutKey(storage: Storage | null): CheckoutKeyRecord | null {
  try {
    const text: string | null = storage?.getItem(CHECKOUT_KEY_STORAGE) ?? null;
    if (text === null) return null;
    const value: unknown = JSON.parse(text);
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Function writeCheckoutKey
 *
 * @description
 * Stores the record; a storage the browser refuses keeps nothing, and the store's own copy then
 * lasts as long as the page.
 *
 * @param {Storage | null} storage - The tab's `sessionStorage`, or null.
 * @param {CheckoutKeyRecord} record - The record.
 */
export function writeCheckoutKey(storage: Storage | null, record: CheckoutKeyRecord): void {
  try {
    storage?.setItem(CHECKOUT_KEY_STORAGE, JSON.stringify(record));
  } catch {
    // A full or refused storage keeps nothing; the page's copy still serves its retries.
  }
}

/**
 * Function clearCheckoutKey
 *
 * @description
 * Removes the stored record.
 *
 * @param {Storage | null} storage - The tab's `sessionStorage`, or null.
 */
export function clearCheckoutKey(storage: Storage | null): void {
  try {
    storage?.removeItem(CHECKOUT_KEY_STORAGE);
  } catch {
    // A refused storage holds nothing to remove.
  }
}

/**
 * Function sessionStorageOf
 *
 * @description
 * The tab's `sessionStorage`, or null when the browser refuses it.
 *
 * @param {Document} document - The document.
 * @returns {Storage | null} The storage, or null.
 */
export function sessionStorageOf(document: Document): Storage | null {
  try {
    return document.defaultView?.sessionStorage ?? null;
  } catch {
    return null;
  }
}
