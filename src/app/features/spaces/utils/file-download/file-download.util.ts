/**
 * Function saveTextFile
 *
 * @description
 * Hands a text file to the browser's download, through a temporary object URL that is revoked at
 * once.
 *
 * @param {Document} document - Document of the page.
 * @param {string} fileName - Name of the saved file.
 * @param {string} content - File content.
 * @param {string} type - Media type.
 * @returns {boolean} Whether the download could start (false without `URL.createObjectURL`).
 */
export function saveTextFile(
  document: Document,
  fileName: string,
  content: string,
  type: string = 'text/csv;charset=utf-8',
): boolean {
  const view: (Window & typeof globalThis) | null = document.defaultView;
  if (!view || typeof view.URL.createObjectURL !== 'function') return false;
  const url: string = view.URL.createObjectURL(new Blob([content], { type }));
  const link: HTMLAnchorElement = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  view.URL.revokeObjectURL(url);
  return true;
}
