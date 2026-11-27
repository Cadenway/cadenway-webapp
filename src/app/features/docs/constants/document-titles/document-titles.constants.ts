/**
 * Constant TITLE_MAX_LENGTH
 *
 * @description
 * Longest title the contract accepts (`components/documents.yaml`, `DocumentTitle`).
 *
 * @type {number}
 */
export const TITLE_MAX_LENGTH: number = 200;

/**
 * Constant BODY_MAX_LENGTH
 *
 * @description
 * Longest Markdown body the contract accepts (`components/documents.yaml`, `DocumentMarkdown`).
 *
 * @type {number}
 */
export const BODY_MAX_LENGTH: number = 100_000;

/**
 * Function untitledTitle
 *
 * @description
 * The title of a new document, and of a document saved with an empty title (`App.dc.html`
 * lines 9170 and 9187).
 *
 * @returns {string} `Untitled`.
 */
export function untitledTitle(): string {
  return $localize`:@@docs.untitled:Untitled`;
}

/**
 * Function normalizedTitle
 *
 * @description
 * The title a typed one saves as: trimmed, `Untitled` when empty, and cut at the contract's 200
 * characters, counted as code points.
 *
 * @param {string} typed - The title as typed.
 * @returns {string} The title to store.
 */
export function normalizedTitle(typed: string): string {
  const trimmed: string = Array.from(typed.trim()).slice(0, TITLE_MAX_LENGTH).join('').trim();
  return trimmed === '' ? untitledTitle() : trimmed;
}
