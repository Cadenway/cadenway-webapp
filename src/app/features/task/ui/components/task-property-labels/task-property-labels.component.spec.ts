import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { TaskPropertyLabels } from './task-property-labels.component';

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
    '[data-testid="task-property-labels"]',
  );
  if (!found) throw new Error('No trigger');
  return found;
}

describe('TaskPropertyLabels', () => {
  let fixture: ComponentFixture<TaskPropertyLabels>;
  let toggled: string[];

  beforeEach(async () => {
    fixture = TestBed.createComponent(TaskPropertyLabels);
    toggled = [];
    fixture.componentInstance.toggled.subscribe((label: string) => toggled.push(label));
    fixture.componentRef.setInput('options', ['Auth', 'Back', 'Front', 'Security']);
    await fixture.whenStable();
  });

  it('shows Empty, then the chips', async () => {
    expect(trigger().textContent.trim()).toBe('Empty');
    fixture.componentRef.setInput('labels', ['Front', 'Auth']);
    await fixture.whenStable();

    expect(trigger().textContent).toContain('Front');
    expect(trigger().textContent).toContain('Auth');
  });

  it('ticks the task’s labels without regard to case and emits a toggle', async () => {
    fixture.componentRef.setInput('labels', ['front']);
    await fixture.whenStable();
    trigger().click();
    await fixture.whenStable();
    const items: HTMLElement[] = Array.from(
      document.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]'),
    );

    expect(items.map((item: HTMLElement) => item.getAttribute('aria-checked'))).toEqual([
      'false',
      'false',
      'true',
      'false',
    ]);
    items[3].click();
    expect(toggled).toEqual(['Security']);
  });

  it('is read-only when disabled', async () => {
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();

    expect(trigger().disabled).toBe(true);
  });
});
