import type { Provider } from '@angular/core';

import { TaskStatusChangesStore } from '@features/task';

import { ListTasksApi } from '../../data-access/services/list-tasks-api/list-tasks-api.service';
import { ListTasksStore } from '../list-tasks/list-tasks.store';
import { CalendarViewStore } from './calendar-view.store';
import { UNWINDOWED_TASKS } from './unwindowed-tasks.token';

/**
 * Constant CALENDAR_VIEW_PROVIDERS
 *
 * @description
 * The providers of the `calendar` route below `l/:listId`: Task's `TaskStatusChangesStore`, so
 * pending status changes die with the view; `ListTasksApi`, the data access of the reads and
 * single-field writes; the grid's windowed `ListTasksStore`; a second `ListTasksStore`, read
 * without a window, for the `No due date` panel (`UNWINDOWED_TASKS`); and `CalendarViewStore`,
 * which merges them. `spaces.routes.ts` only references this list. Brick label providers go in
 * the page's own `providers`.
 *
 * @type {Provider[]}
 */
export const CALENDAR_VIEW_PROVIDERS: Provider[] = [
  TaskStatusChangesStore,
  ListTasksApi,
  ListTasksStore,
  { provide: UNWINDOWED_TASKS, useClass: ListTasksStore },
  CalendarViewStore,
];
