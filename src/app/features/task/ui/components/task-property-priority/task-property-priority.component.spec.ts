import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { PriorityKey } from '@cadenway/contracts';
import { beforeEach, describe, expect, it } from 'vitest';

import { TaskPropertyPriority } from './task-property-priority.component';

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
    '[data-testid="task-property-priority"]',
  );
  if (!found) throw new Error('No trigger');
  return found;
}

describe('TaskPropertyPriority', () => {
  let fixture: ComponentFixture<TaskPropertyPriority>;
  let changed: PriorityKey[];

  beforeEach(async () => {
    fixture = TestBed.createComponent(TaskPropertyPriority);
    changed = [];
    fixture.componentInstance.priorityChanged.subscribe((key: PriorityKey) => changed.push(key));
    fixture.componentRef.setInput('priority', 'haute');
    await fixture.whenStable();
  });

  it('shows the priority word', () => {
    expect(trigger().textContent.trim()).toBe('High');
  });

  it('lists the priorities and emits another one', async () => {
    trigger().click();
    await fixture.whenStable();
    const items: HTMLElement[] = Array.from(
      document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    );

    expect(items.map((item: HTMLElement) => item.textContent.trim())).toEqual([
      'Urgent',
      'High',
      'Medium',
      'Low',
    ]);
    items[0].click();
    expect(changed).toEqual(['urgente']);
  });

  it('emits nothing for the current priority', async () => {
    trigger().click();
    await fixture.whenStable();
    document.querySelectorAll<HTMLElement>('[role="menuitem"]')[1].click();

    expect(changed).toEqual([]);
  });

  it('is read-only when disabled', async () => {
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();

    expect(trigger().disabled).toBe(true);
  });
});
