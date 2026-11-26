import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { StatusKey } from '@cadenway/contracts';
import { describe, expect, it } from 'vitest';

import { TaskDueDate } from './task-due-date.component';

/**
 * Function render
 *
 * @description
 * Renders a due date on Sunday 8 November 2026, the mockup's today.
 *
 * @param {string | null} due - Due date.
 * @param {StatusKey} [status] - Status of the task.
 * @returns {Promise<HTMLElement>} The host element.
 */
async function render(due: string | null, status: StatusKey = 'todo'): Promise<HTMLElement> {
  const fixture: ComponentFixture<TaskDueDate> = TestBed.createComponent(TaskDueDate);
  fixture.componentRef.setInput('due', due);
  fixture.componentRef.setInput('status', status);
  fixture.componentRef.setInput('today', '2026-11-08');
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('TaskDueDate', () => {
  it('reads today and tomorrow in words, today in violet', async () => {
    const today: HTMLElement = await render('2026-11-08');
    const tomorrow: HTMLElement = await render('2026-11-09');

    expect(today.textContent.trim()).toBe('Today');
    expect(today.getAttribute('data-tone')).toBe('today');
    expect(tomorrow.textContent.trim()).toBe('Tomorrow');
    expect(tomorrow.getAttribute('data-tone')).toBe('plain');
  });

  it('shows the short date, with the year only for another year', async () => {
    expect((await render('2026-11-12')).textContent.trim()).toBe('12 Nov');
    expect((await render('2027-01-04')).textContent.trim()).toBe('4 Jan 2027');
  });

  it('is late in garnet before today unless the task is closed', async () => {
    const late: HTMLElement = await render('2026-11-05');

    expect(late.getAttribute('data-tone')).toBe('late');
    expect(late.textContent).toContain('5 Nov');
    expect((await render('2026-11-05', 'done')).getAttribute('data-tone')).toBe('plain');
  });

  it('draws a dash without a date', async () => {
    const none: HTMLElement = await render(null);

    expect(none.textContent).toContain('—');
    expect(none.getAttribute('data-tone')).toBe('none');
  });
});
