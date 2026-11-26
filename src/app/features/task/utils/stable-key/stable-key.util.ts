/**
 * Constant PART_SEPARATOR
 *
 * @description
 * Separator of the parts a key is derived from (the unit separator, absent from keys and ids).
 *
 * @type {string}
 */
const PART_SEPARATOR: string = '\u001f';

/**
 * Function stableKey
 *
 * @description
 * A UUID-shaped key derived from its parts: the first 128 bits of their SHA-256 digest, marked
 * as a UUID version 8 (custom) of the RFC 9562 variant. The same parts give the same key in every
 * tab and session, so a write two tabs send for the same thing (a timer stop) carries one
 * `Idempotency-Key`; the gateway accepts any string of 1 to 255 characters. Needs a secure
 * context, like `crypto.randomUUID`.
 *
 * @param {readonly string[]} parts - What the key stands for, in a fixed order.
 * @returns {Promise<string>} The key, `xxxxxxxx-xxxx-8xxx-yxxx-xxxxxxxxxxxx`.
 */
export async function stableKey(parts: readonly string[]): Promise<string> {
  const digest: ArrayBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(parts.join(PART_SEPARATOR)),
  );
  const bytes: Uint8Array = new Uint8Array(digest).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex: string = Array.from(bytes, (byte: number): string =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
