import { describe, expect, it } from 'vitest';

import type { SlotContribution } from '@shared/layout-slot';

import { TaskCreateDialog } from '../../ui/dialogs/task-create-dialog/task-create-dialog.component';
import { withTaskCreate } from './task-create.provider';

describe('withTaskCreate', () => {
  it('contributes the create dialog after the palette and the shortcuts dialog', () => {
    const contribution: SlotContribution = withTaskCreate().useFactory();

    expect(contribution).toEqual({
      id: 'task.create-dialog',
      order: 20,
      component: TaskCreateDialog,
    });
  });
});
