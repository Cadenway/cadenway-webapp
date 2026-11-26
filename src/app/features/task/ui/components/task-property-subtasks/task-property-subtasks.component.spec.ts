import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { TaskPropertySubtasks } from './task-property-subtasks.component';

describe('TaskPropertySubtasks', () => {
  let fixture: ComponentFixture<TaskPropertySubtasks>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(TaskPropertySubtasks);
    await fixture.whenStable();
  });

  it('is hidden without subtasks', () => {
    expect((fixture.nativeElement as HTMLElement).textContent.trim()).toBe('');
  });

  it('shows the closed subtasks against the total with a bar', async () => {
    fixture.componentRef.setInput('progress', { closed: 1, total: 3 });
    await fixture.whenStable();
    const bar: HTMLElement | null = (fixture.nativeElement as HTMLElement).querySelector(
      '[role="progressbar"]',
    );

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Subtasks');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('1 / 3 done');
    expect(bar?.getAttribute('aria-valuenow')).toBe('1');
    expect(bar?.getAttribute('aria-valuemax')).toBe('3');
  });
});
