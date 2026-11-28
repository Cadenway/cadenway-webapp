import type { CwToastService } from '@cadenway/ui/components/toast';

/**
 * Function documentPath
 *
 * @description
 * The router path of a document, `/<slug>/d/<id>` (the mockup's `copyDocLink`, `App.dc.html`
 * line 9197). `AppLinkService.absolute` turns it into the shareable address, below the locale
 * segment.
 *
 * @param {string} slug - The organization's slug.
 * @param {string} id - The document.
 * @returns {string} The path.
 */
export function documentPath(slug: string, id: string): string {
  return `/${encodeURIComponent(slug)}/d/${encodeURIComponent(id)}`;
}

/**
 * Function copyDocumentLink
 *
 * @description
 * Copies a document's address to the clipboard and confirms it with `Document link copied`, or
 * says the copy failed when the clipboard refuses or is missing.
 *
 * @param {Document} document - Document whose window holds the clipboard.
 * @param {string} link - The document's absolute address.
 * @param {CwToastService} toasts - The shell's toaster.
 * @returns {Promise<void>} Resolves once the clipboard answered.
 */
export async function copyDocumentLink(
  document: Document,
  link: string,
  toasts: CwToastService,
): Promise<void> {
  try {
    const clipboard: Clipboard | undefined = document.defaultView?.navigator.clipboard;
    if (clipboard === undefined) throw new Error('The clipboard is unavailable.');
    await clipboard.writeText(link);
    toasts.success($localize`:@@docs.toast.link-copied:Document link copied`);
  } catch {
    toasts.error($localize`:@@docs.toast.copy-failed:The link could not be copied`, {
      description: $localize`:@@docs.toast.copy-failed-text:The browser refused access to the clipboard.`,
    });
  }
}
