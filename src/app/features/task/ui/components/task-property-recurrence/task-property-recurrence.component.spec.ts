import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { Recurrence } from '@cadenway/contracts';
import { beforeEach, describe, expect, it } from 'vitest';

import { TaskPropertyRecurrence } from './task-property-recurrence.component';

/**
 * Function trigger
 *
 * @description
 * The row's trigger.
 *
 * @returns {HTMLButtonElement} The trigger.
 */
function trigger(): HTMLButtonElement {
  const found: HTMLButtonElement | null = document.querySelector<HTMLButtonElement>(
    '[data-testid="task-property-recurrence"]',
  );
  if (!found) throw new Error('No trigger');
  return found;
}

describe('TaskPropertyRecurrence', () => {
  let fixture: ComponentFixture<TaskPropertyRecurrence>;
  let changed: Recurrence[];

  beforeEach(async () => {
    fixture = TestBed.createComponent(TaskPropertyRecurrence);
    changed = [];
    fixture.componentInstance.recurrenceChanged.subscribe((rule: Recurrence) => changed.push(rule));
    fixture.componentRef.setInput('today', '2026-11-08');
    await fixture.whenStable();
  });

  it('shows Does not repeat without a hint', () => {
    expect(trigger().textContent.trim()).toBe('Does not repeat');
  });

  it('gives the next occurrence, or asks for a due date', async () => {
    fixture.componentRef.setInput('recurrence', 'weekly');
    fixture.componentRef.setInput('due', '2026-11-02');
    await fixture.whenStable();
    expect(trigger().textContent).toContain('Every week');
    expect(trigger().textContent).toContain('Next: Tomorrow');

    fixture.componentRef.setInput('due', null);
    await fixture.whenStable();
    expect(trigger().textContent).toContain('Add a due date to repeat');
  });

  it('lists the rules and emits another one', async () => {
    trigger().click();
    await fixture.whenStable();
    const items: HTMLElement[] = Array.from(
      document.querySelectorAll<HTMLElement>('[role="menuitemradio"]'),
    );

    expect(items.map((item: HTMLElement) => item.textContent.trim())).toEqual([
      'Does not repeat',
      'Every working day',
      'Every week',
      'Every 2 weeks',
      'Every month',
    ]);
    items[4].click();
    expect(changed).toEqual(['monthly']);
  });

  it('is read-only when disabled', async () => {
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();

    expect(trigger().disabled).toBe(true);
  });
});
