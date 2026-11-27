import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';
import { provideCwAlertDialogLabels } from '@cadenway/ui/components/alert-dialog';
import { provideCwAvatarLabels } from '@cadenway/ui/components/avatar';
import { provideCwMarkdownLabels } from '@cadenway/ui/components/markdown';

import { RouteErrorBoundary } from '@features/errors';
import { unsavedChangesGuard } from '@shared/unsaved-changes';

import { DOCS_BLOCK_EDITOR_LABELS } from './constants/block-editor-labels/block-editor-labels.constants';

/**
 * Constant DOCS_ROUTES
 *
 * @description
 * The documents below `/:org`, mounted by Workspace in the application shell: `docs`, the catalog
 * (`?q=` searches it), and `d/:docId`, the shareable address of a document (`?mode=edit` opens it in
 * edit mode). The document route's title is a fallback until its page reads the document, which
 * then titles the page; it keeps unsaved edits with `unsavedChangesGuard`. A failed primary read
 * renders `RouteErrorBoundary` in place of the page, so the shell stays. Both get the
 * English texts of the bricks they render.
 *
 * @type {Routes}
 */
export const DOCS_ROUTES: Routes = [
  {
    path: '',
    providers: [
      DOCS_BLOCK_EDITOR_LABELS,
      provideCwAlertDialogLabels(() => ({
        confirm: $localize`:@@docs.labels.confirm:To confirm, type`,
        more: (count: number): string => $localize`:@@docs.labels.more:+ ${count}:count: others`,
      })),
      provideCwAvatarLabels(() => ({
        unknown: $localize`:@@docs.labels.avatar-unknown:Unknown user`,
        online: $localize`:@@docs.labels.avatar-online:online`,
        away: $localize`:@@docs.labels.avatar-away:away`,
        disabled: $localize`:@@docs.labels.avatar-disabled:disabled`,
      })),
      provideCwMarkdownLabels(() => ({ mention: $localize`:@@docs.labels.mention:mention` })),
    ],
    children: [
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
        canDeactivate: [unsavedChangesGuard],
        loadComponent: async (): Promise<Type<unknown>> =>
          (await import('./ui/pages/document-page/document-page.component')).DocumentPage,
      },
    ],
  },
];
