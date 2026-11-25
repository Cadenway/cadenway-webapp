import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';
import { provideCwAlertDialogLabels } from '@cadenway/ui/components/alert-dialog';
import { provideCwAvatarLabels } from '@cadenway/ui/components/avatar';
import { provideCwBreadcrumbLabels } from '@cadenway/ui/components/breadcrumb';
import { provideCwDialogLabels } from '@cadenway/ui/components/dialog';
import { provideCwInlineEditLabels } from '@cadenway/ui/components/inline-edit';
import { provideCwStatusLabels } from '@cadenway/ui/components/status-icon';
import { provideCwToolbarLabels } from '@cadenway/ui/components/toolbar';

import type { RouteErrorData } from '@features/errors';
import { TaskStatusChangesStore } from '@features/task';

import { LIST_TABLE_TEXTS } from './constants/data-table-texts/data-table-texts.constants';
import { statusLabels } from './constants/view-labels/view-labels.constants';
import { ListTasksApi } from './data-access/services/list-tasks-api/list-tasks-api.service';
import { ListPageStore } from './state/list-page/list-page.store';
import { ListRowsStore } from './state/list-rows/list-rows.store';
import { ListViewStore } from './state/list-view/list-view.store';

/**
 * Constant SPACES_ROUTES
 *
 * @description
 * The spaces screens below `/:org`: `spaces/:spaceId` is the space overview, `l/:listId` the list
 * frame with one child per view segment (only `list`, the default, in step 4a; `?savedView=`
 * applies a saved view). The list route provides the list's `ListPageStore` and `ListViewStore`
 * to its views; the `list` view provides its rows (`ListRowsStore`) with the task feature's
 * status store and rows data access, so they can use the workspace context and pending changes
 * die with the view. The default error
 * boundary renders a failed primary read in the failing route's outlet, so a failed view keeps
 * the list header; the `list` view's `RouteErrorData` titles it `Could not load the tasks`
 * (`spaces.list-view.load-failed`). The bricks' texts are the English source copy.
 *
 * @type {Routes}
 */
export const SPACES_ROUTES: Routes = [
  {
    path: '',
    providers: [
      provideCwStatusLabels(statusLabels),
      provideCwAlertDialogLabels(() => ({
        confirm: $localize`:@@spaces.labels.confirm:To confirm, type`,
        more: (count: number): string => $localize`:@@spaces.labels.more:+ ${count}:count: others`,
      })),
      provideCwAvatarLabels(() => ({
        unknown: $localize`:@@spaces.labels.avatar-unknown:Unknown user`,
        online: $localize`:@@spaces.labels.avatar-online:online`,
        away: $localize`:@@spaces.labels.avatar-away:away`,
        disabled: $localize`:@@spaces.labels.avatar-disabled:disabled`,
        group: $localize`:@@spaces.labels.avatar-group:Members`,
        othersPrefix: $localize`:@@spaces.labels.avatar-others:and`,
        add: $localize`:@@spaces.labels.avatar-add:Assign`,
      })),
      provideCwBreadcrumbLabels(() => ({
        aria: $localize`:@@spaces.header.breadcrumb:Breadcrumb`,
        ellipsis: $localize`:@@spaces.labels.breadcrumb-hidden:Hidden levels`,
      })),
      provideCwDialogLabels(() => ({ close: $localize`:@@spaces.labels.close:Close` })),
      provideCwInlineEditLabels(() => ({
        editHint: $localize`:@@spaces.labels.edit-hint:Click to edit`,
        enterKey: $localize`:@@spaces.labels.enter:Enter`,
        escapeKey: $localize`:@@spaces.labels.escape:Esc`,
        controlKey: $localize`:@@spaces.labels.control:Ctrl`,
        submit: $localize`:@@spaces.labels.submit:to confirm`,
        cancel: $localize`:@@spaces.labels.cancel:to cancel`,
        submitMultiline: $localize`:@@spaces.labels.submit-multiline:confirm`,
        cancelMultiline: $localize`:@@spaces.labels.cancel-multiline:cancel`,
        saving: $localize`:@@spaces.labels.saving:Saving…`,
        saved: $localize`:@@spaces.labels.saved:Change saved`,
        required: $localize`:@@spaces.labels.required:This field cannot be empty.`,
        readonly: $localize`:@@spaces.labels.readonly:Read only`,
      })),
      provideCwToolbarLabels(() => ({
        overflow: $localize`:@@spaces.labels.overflow:More options`,
      })),
    ],
    children: [
      {
        path: 'spaces/:spaceId',
        title: $localize`:@@spaces.route.overview:Overview`,
        loadComponent: async (): Promise<Type<unknown>> =>
          (await import('./ui/pages/space-overview-page/space-overview-page.component'))
            .SpaceOverviewPage,
      },
      {
        path: 'l/:listId',
        title: $localize`:@@spaces.route.list:List`,
        providers: [ListPageStore, ListViewStore],
        loadComponent: async (): Promise<Type<unknown>> =>
          (await import('./ui/pages/list-page/list-page.component')).ListPage,
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'list' },
          {
            path: 'list',
            data: {
              unavailableTitle: $localize`:@@spaces.list-view.load-failed:Could not load the tasks`,
            } satisfies RouteErrorData,
            providers: [TaskStatusChangesStore, ListTasksApi, ListRowsStore, LIST_TABLE_TEXTS],
            loadComponent: async (): Promise<Type<unknown>> =>
              (await import('./ui/pages/list-view-page/list-view-page.component')).ListViewPage,
          },
        ],
      },
    ],
  },
];
