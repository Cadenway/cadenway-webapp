/**
 * Function safeReturnUrl
 *
 * @description
 * Accepts a `?next=` destination only when it is a path of this application: it starts with one
 * slash, not two, and holds no backslash or control character, so it can never send the browser
 * to another origin after sign-in.
 *
 * @param {unknown} value - The query parameter value.
 * @returns {string | null} The path, or null when it is absent or unsafe.
 */
export function safeReturnUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2_048) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return /[\\\p{Cc}]/u.test(value) ? null : value;
}
