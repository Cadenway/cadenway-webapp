import type { CwToastService } from '@cadenway/ui/components/toast';

/**
 * Function documentLink
 *
 * @description
 * The shareable address of a document, `<origin>/<slug>/d/<id>` (the mockup's `copyDocLink`,
 * `App.dc.html` line 9197).
 *
 * @param {Document} document - Document whose location gives the origin.
 * @param {string} slug - The organization's slug.
 * @param {string} id - The document.
 * @returns {string} The address.
 */
export function documentLink(document: Document, slug: string, id: string): string {
  return `${document.location.origin}/${encodeURIComponent(slug)}/d/${encodeURIComponent(id)}`;
}

/**
 * Function copyDocumentLink
 *
 * @description
 * Copies a document's address to the clipboard and confirms it with `Document link copied`, or
 * says the copy failed when the clipboard refuses or is missing.
 *
 * @param {Document} document - Document whose window holds the clipboard.
 * @param {string} slug - The organization's slug.
 * @param {string} id - The document.
 * @param {CwToastService} toasts - The shell's toaster.
 * @returns {Promise<void>} Resolves once the clipboard answered.
 */
export async function copyDocumentLink(
  document: Document,
  slug: string,
  id: string,
  toasts: CwToastService,
): Promise<void> {
  try {
    const clipboard: Clipboard | undefined = document.defaultView?.navigator.clipboard;
    if (clipboard === undefined) throw new Error('The clipboard is unavailable.');
    await clipboard.writeText(documentLink(document, slug, id));
    toasts.success($localize`:@@docs.toast.link-copied:Document link copied`);
  } catch {
    toasts.error($localize`:@@docs.toast.copy-failed:The link could not be copied`, {
      description: $localize`:@@docs.toast.copy-failed-text:The browser refused access to the clipboard.`,
    });
  }
}
