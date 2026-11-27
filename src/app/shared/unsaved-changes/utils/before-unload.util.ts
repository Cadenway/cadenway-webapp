import { DestroyRef, DOCUMENT, inject } from '@angular/core';

/**
 * Function warnBeforeUnload
 *
 * @description
 * Asks the browser to confirm before the tab closes or reloads while `dirty()` holds, through
 * the `beforeunload` event; the browser shows its own wording. The listener is removed when the
 * calling component or service is destroyed. Call it in an injection context, from the page that
 * also implements `UnsavedChanges`.
 *
 * @param {() => boolean} dirty - Whether the page holds unsaved changes now.
 */
export function warnBeforeUnload(dirty: () => boolean): void {
  const view: Window | null = inject(DOCUMENT).defaultView;
  if (view === null) return;
  const listener: (event: BeforeUnloadEvent) => void = (event: BeforeUnloadEvent): void => {
    if (!dirty()) return;
    event.preventDefault();
  };
  view.addEventListener('beforeunload', listener);
  inject(DestroyRef).onDestroy((): void => {
    view.removeEventListener('beforeunload', listener);
  });
}
