import { readProblem } from '@core/api';

/**
 * Function refusalText
 *
 * @description
 * The description of a toast for a write the gateway refused: a `403` says the caller may no
 * longer edit the space's documents, a `400` that the content was refused as invalid (a title or
 * a body past the contract's limits), anything else the fallback.
 *
 * @param {unknown} error - The refusal.
 * @param {string} fallback - The description of any other refusal.
 * @returns {string} The description.
 */
export function refusalText(error: unknown, fallback: string): string {
  switch (readProblem(error)?.status) {
    case 403:
      return $localize`:@@docs.toast.forbidden-text:You can no longer edit the documents of this space.`;
    case 400:
      return $localize`:@@docs.toast.invalid-text:It was refused as invalid. Check the length of its title and its content.`;
    default:
      return fallback;
  }
}
