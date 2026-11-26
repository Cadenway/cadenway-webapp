import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { beforeEach, describe, expect, it } from 'vitest';

import { TaskDetailApi } from '../../../data-access/services/task-detail-api/task-detail-api.service';
import { TaskParentPickerDialog } from './task-parent-picker-dialog.component';

describe('TaskParentPickerDialog', () => {
  let fixture: ComponentFixture<TaskParentPickerDialog>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideCadenwayIcons(), { provide: TaskDetailApi, useValue: {} }],
    });
    fixture = TestBed.createComponent(TaskParentPickerDialog);
    fixture.componentRef.setInput('open', true);
    await fixture.whenStable();
  });

  it('names the dialog Attach to a task above its Become a subtask of… title', () => {
    const dialog: HTMLElement | null = document.querySelector('[role="dialog"]');
    const title: HTMLElement | null = document.getElementById(
      dialog?.getAttribute('aria-labelledby') ?? '',
    );

    expect(title?.getAttribute('aria-label')).toBe('Attach to a task');
    expect(title?.textContent.trim()).toBe('Become a subtask of…');
  });
});
