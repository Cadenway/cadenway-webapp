import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';

import { RouteErrorBoundary } from '@features/errors';

/**
 * Constant DOCS_ROUTES
 *
 * @description
 * The documents below `/:org`, mounted by Workspace in the application shell: `docs`, the catalog
 * (`?q=` searches it), and `d/:docId`, the shareable address of a document (`?mode=edit` opens it in
 * edit mode). The document route's title is a fallback until its page reads the document. A failed
 * primary read renders `RouteErrorBoundary` in place of the page, so the shell stays.
 *
 * @type {Routes}
 */
export const DOCS_ROUTES: Routes = [
  {
    path: 'docs',
    title: $localize`:@@docs.route.title:Documents`,
    errorComponent: RouteErrorBoundary,
    loadComponent: async (): Promise<Type<unknown>> =>
      (await import('./ui/pages/docs-page/docs-page.component')).DocsPage,
  },
  {
    path: 'd/:docId',
    title: $localize`:@@docs.route.document:Document`,
    errorComponent: RouteErrorBoundary,
    loadComponent: async (): Promise<Type<unknown>> =>
      (await import('./ui/pages/document-page/document-page.component')).DocumentPage,
  },
];
