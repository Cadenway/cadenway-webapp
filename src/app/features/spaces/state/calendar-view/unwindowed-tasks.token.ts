import { InjectionToken } from '@angular/core';

import type { ListTasksStoreInstance } from '../list-tasks/list-tasks.store';

/**
 * Constant UNWINDOWED_TASKS
 *
 * @description
 * The `Calendar` view's second `ListTasksStore`, read without a due window: the gateway has no
 * "no due date" filter (gap G4) and leaves undated tasks out of a windowed read, so the
 * `No due date` panel keeps the undated tasks of this read on the client. Provided through
 * `CALENDAR_VIEW_PROVIDERS` as `{ provide: UNWINDOWED_TASKS, useClass: ListTasksStore }`, next to
 * the windowed `ListTasksStore` of the grid.
 *
 * @type {InjectionToken<ListTasksStoreInstance>}
 */
export const UNWINDOWED_TASKS: InjectionToken<ListTasksStoreInstance> =
  new InjectionToken<ListTasksStoreInstance>('UNWINDOWED_TASKS');
