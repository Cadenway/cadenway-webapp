import type { Provider } from '@angular/core';

import { TASK_WRITE_LANE } from '../../ports/task-write-lane';
import { TaskRowWriteLaneStore } from '../task-row-write-lane/task-row-write-lane.store';
import { TaskStatusChangesStore } from '../task-status-changes/task-status-changes.store';
import { TaskRowActionsStore } from './task-row-actions.store';

/**
 * Constant TASK_ROW_ACTIONS_PROVIDERS
 *
 * @description
 * What a page of rows outside a list (Home, My tasks, Dashboards) provides on its route for
 * `cw-task-line` and `cw-task-menu`: one write lane per page (`TaskRowWriteLaneStore`, also
 * `TASK_WRITE_LANE`), so the status changes (`TaskStatusChangesStore`) and the menu's other
 * writes (`TaskRowActionsStore`) of a task never overlap and each goes against the version the
 * previous one returned.
 *
 * @type {Provider[]}
 */
export const TASK_ROW_ACTIONS_PROVIDERS: Provider[] = [
  TaskRowWriteLaneStore,
  { provide: TASK_WRITE_LANE, useExisting: TaskRowWriteLaneStore },
  TaskStatusChangesStore,
  TaskRowActionsStore,
];
