import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import type { TaskAddRequest } from '../../../models/task-detail-sections/task-detail-sections.interface';
import { TaskChecklist } from './task-checklist.component';

describe('TaskChecklist', () => {
  let fixture: ComponentFixture<TaskChecklist>;
  let requests: TaskAddRequest[];
  let field: HTMLInputElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(TaskChecklist);
    fixture.componentRef.setInput('items', [{ id: 'i1', text: 'Mockup approved', done: true }]);
    requests = [];
    fixture.componentInstance.added.subscribe((request: TaskAddRequest) => {
      requests.push(request);
    });
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement as HTMLElement;
    const add: HTMLButtonElement | undefined = Array.from(host.querySelectorAll('button')).find(
      (button: HTMLButtonElement) => button.textContent.trim() === 'Add an item',
    );
    add?.click();
    await fixture.whenStable();
    const found: HTMLInputElement | null =
      host.querySelector<HTMLInputElement>('#task-checklist-new');
    if (!found) throw new Error('The add field is not open.');
    field = found;
    field.value = 'Test on Safari';
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
  });

  it('keeps the typed item when the addition is refused', () => {
    expect(requests.map((request: TaskAddRequest) => request.text)).toEqual(['Test on Safari']);

    requests[0].settle(false);

    expect(field.value).toBe('Test on Safari');
  });

  it('empties the field for the next item once the addition is saved', () => {
    requests[0].settle(true);

    expect(field.value).toBe('');
  });
});
