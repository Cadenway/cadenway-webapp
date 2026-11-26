import type { Provider } from '@angular/core';

import { TaskStatusChangesStore } from '@features/task';

import { LIST_TABLE_TEXTS } from '../../constants/data-table-texts/data-table-texts.constants';
import { ListTasksApi } from '../../data-access/services/list-tasks-api/list-tasks-api.service';
import { SheetTasksApi } from '../../data-access/services/sheet-tasks-api/sheet-tasks-api.service';
import { ListTasksStore } from '../list-tasks/list-tasks.store';
import { SheetViewStore } from './sheet-view.store';

/**
 * Constant SHEET_VIEW_PROVIDERS
 *
 * @description
 * The providers of the `sheet` route below `l/:listId`: Task's `TaskStatusChangesStore`, so
 * pending status changes die with the view; the sheet's data access (`SheetTasksApi`), which also
 * stands for `ListTasksApi` in this subtree so the shared flat reader (`ListTasksStore`) and the
 * shared writes read each page once while the sheet keeps its estimates and custom field values;
 * the reader; the view's store (`SheetViewStore`); and the table texts of the task views.
 * `spaces.routes.ts` only references this list.
 *
 * @type {Provider[]}
 */
export const SHEET_VIEW_PROVIDERS: Provider[] = [
  TaskStatusChangesStore,
  SheetTasksApi,
  { provide: ListTasksApi, useExisting: SheetTasksApi },
  ListTasksStore,
  SheetViewStore,
  LIST_TABLE_TEXTS,
];
