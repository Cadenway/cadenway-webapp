import { InjectionToken } from '@angular/core';

import type { ViewTaskWriter } from '../../models/view-task-write/view-task-write.interface';

/**
 * Constant VIEW_TASK_WRITER
 *
 * @description
 * The writes of the shown task view, which `ViewTaskWritesStore` sends: the view's reader store
 * (composing `withViewTaskWrites`), provided by the view's page next to `ViewTaskWritesStore`,
 * for instance `{ provide: VIEW_TASK_WRITER, useExisting: ListRowsStore }`.
 *
 * @type {InjectionToken<ViewTaskWriter>}
 */
export const VIEW_TASK_WRITER: InjectionToken<ViewTaskWriter> = new InjectionToken<ViewTaskWriter>(
  'VIEW_TASK_WRITER',
);
