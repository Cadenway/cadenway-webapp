import type { SlotContribution, SlotFeature } from '@shared/layout-slot';

import { TaskDetailHost } from '../../ui/components/task-detail-host/task-detail-host.component';

/**
 * Function withTaskDetail
 *
 * @description
 * Contributes the task detail host to the shell's `overlays` slot: the detail opens as a dialog
 * over any workspace page while the address carries `?task=<KEY>` (`TaskDetailOpener.open`).
 * Bind it on the `/:org` route, whose injector provides `WORKSPACE_CONTEXT` and Spaces'
 * `LIST_DIRECTORY`.
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withTaskDetail(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'task.detail',
      order: 30,
      component: TaskDetailHost,
    }),
  };
}
