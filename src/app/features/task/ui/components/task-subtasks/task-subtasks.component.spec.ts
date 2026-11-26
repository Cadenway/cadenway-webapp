import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import type { TaskAddRequest } from '../../../models/task-detail-sections/task-detail-sections.interface';
import { TaskSubtasks } from './task-subtasks.component';

/**
 * Function type
 *
 * @description
 * Types a name in the add field and presses Enter.
 *
 * @param {HTMLInputElement} field - The add field.
 * @param {string} text - The typed name.
 */
function type(field: HTMLInputElement, text: string): void {
  field.value = text;
  field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
}

describe('TaskSubtasks', () => {
  let fixture: ComponentFixture<TaskSubtasks>;
  let requests: TaskAddRequest[];
  let field: HTMLInputElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(TaskSubtasks);
    fixture.componentRef.setInput('rows', []);
    requests = [];
    fixture.componentInstance.created.subscribe((request: TaskAddRequest) => {
      requests.push(request);
    });
    await fixture.whenStable();
    const found: HTMLInputElement | null = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLInputElement>('input[placeholder="Add a subtask (Enter)"]');
    if (!found) throw new Error('The add field is missing.');
    field = found;
  });

  it('keeps the typed name when the creation is refused', () => {
    type(field, ' Write the tests ');

    expect(requests.map((request: TaskAddRequest) => request.text)).toEqual(['Write the tests']);
    expect(field.value).toBe(' Write the tests ');
    requests[0].settle(false);
    expect(field.value).toBe(' Write the tests ');
  });

  it('empties the field once the creation is saved', () => {
    type(field, 'Write the tests');

    requests[0].settle(true);

    expect(field.value).toBe('');
  });

  it('keeps a name typed while the creation was being saved', () => {
    type(field, 'Write the tests');
    field.value = 'Review the copy';

    requests[0].settle(true);

    expect(field.value).toBe('Review the copy');
  });
});
