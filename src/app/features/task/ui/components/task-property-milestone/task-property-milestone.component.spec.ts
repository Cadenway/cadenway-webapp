import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { TaskPropertyMilestone } from './task-property-milestone.component';

/**
 * Function toggle
 *
 * @description
 * The `Mark as a milestone` switch.
 *
 * @returns {HTMLButtonElement} The switch.
 */
function toggle(): HTMLButtonElement {
  const found: HTMLButtonElement | null = document.querySelector<HTMLButtonElement>(
    '[role="switch"][aria-label="Mark as a milestone"]',
  );
  if (!found) throw new Error('No switch');
  return found;
}

describe('TaskPropertyMilestone', () => {
  let fixture: ComponentFixture<TaskPropertyMilestone>;
  let changed: boolean[];

  beforeEach(async () => {
    fixture = TestBed.createComponent(TaskPropertyMilestone);
    changed = [];
    fixture.componentInstance.milestoneChanged.subscribe((on: boolean) => changed.push(on));
    fixture.componentRef.setInput('today', '2026-11-08');
    await fixture.whenStable();
  });

  it('explains a key date and emits the toggle', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Key date, no duration');
    expect(toggle().getAttribute('aria-checked')).toBe('false');
    toggle().click();

    expect(changed).toEqual([true]);
  });

  it('says Reached for a done milestone and Late past its date', async () => {
    fixture.componentRef.setInput('milestone', true);
    fixture.componentRef.setInput('status', 'done');
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Reached');

    fixture.componentRef.setInput('status', 'todo');
    fixture.componentRef.setInput('due', '2026-11-02');
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Late');
  });

  it('is read-only when disabled', async () => {
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();

    expect(toggle().disabled).toBe(true);
  });
});
