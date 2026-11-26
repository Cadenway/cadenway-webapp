import { InjectionToken } from '@angular/core';

import type { TaskWriteLane } from './task-write-lane-port.interface';

/**
 * Constant TASK_WRITE_LANE
 *
 * @description
 * Optional write path the status changes use instead of writing on their own; the task detail
 * dialog provides it with its `TaskDetailStore`.
 *
 * @type {InjectionToken<TaskWriteLane>}
 */
export const TASK_WRITE_LANE: InjectionToken<TaskWriteLane> = new InjectionToken<TaskWriteLane>(
  'TASK_WRITE_LANE',
);
