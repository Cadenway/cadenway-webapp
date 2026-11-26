import type { Type } from '@angular/core';
import { signalStore, withState } from '@ngrx/signals';

/**
 * Function createWorkloadViewStore
 *
 * @description
 * Creates the `Workload` view's store, empty until the view's package fills it.
 *
 * @returns {Type<object>} Injectable store constructor.
 */
function createWorkloadViewStore(): Type<object> {
  return signalStore(withState({}));
}

/**
 * Constant WorkloadViewStore
 *
 * @description
 * The state of the `Workload` view (`l/:listId/workload`), route-scoped through
 * `WORKLOAD_VIEW_PROVIDERS`. A stub: the view's package owns this file and replaces it.
 *
 * @type {ReturnType<typeof createWorkloadViewStore>}
 */
export const WorkloadViewStore: ReturnType<typeof createWorkloadViewStore> =
  createWorkloadViewStore();
