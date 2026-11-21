import type { Routes } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';

import { resolveOrganizationId } from '@features/auth';

/**
 * Constant TASK_ROUTES
 *
 * @description
 * Task detail routes mounted below the authenticated `/taches` entry.
 *
 * @type {Routes}
 */
export const TASK_ROUTES: Routes = [
  {
    path: ':taskKey',
    providers: provideCadenwayIcons(),
    resolve: { organizationId: resolveOrganizationId },
    runGuardsAndResolvers: 'always',
    loadComponent: () =>
      import('./ui/pages/task-detail-page/task-detail-page.component').then(
        (entry) => entry.TaskDetailPage,
      ),
  },
];
