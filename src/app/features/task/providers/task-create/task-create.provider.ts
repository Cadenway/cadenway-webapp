import type { SlotContribution, SlotFeature } from '@shared/layout-slot';

import { TaskCreateDialog } from '../../ui/dialogs/task-create-dialog/task-create-dialog.component';

/**
 * Function withTaskCreate
 *
 * @description
 * Contributes the task create dialog, opened by `N` or `TaskCreate.open`, to the shell's
 * `overlays` slot. Bind it on the `/:org` route, whose injector provides `WORKSPACE_CONTEXT`.
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withTaskCreate(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'task.create-dialog',
      order: 20,
      component: TaskCreateDialog,
    }),
  };
}
