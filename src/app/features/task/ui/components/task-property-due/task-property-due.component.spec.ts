import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { beforeEach, describe, expect, it } from 'vitest';

import { TaskPropertyDue } from './task-property-due.component';

/**
 * Constant TODAY
 *
 * @description
 * Sunday 8 November 2026, the mockup's today.
 *
 * @type {string}
 */
const TODAY: string = '2026-11-08';

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
    '[data-testid="task-property-due"]',
  );
  if (!found) throw new Error('No trigger');
  return found;
}

/**
 * Function shortcuts
 *
 * @description
 * The shortcut buttons of the open dialog.
 *
 * @returns {HTMLButtonElement[]} The shortcuts.
 */
function shortcuts(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-pressed]'));
}

describe('TaskPropertyDue', () => {
  let fixture: ComponentFixture<TaskPropertyDue>;
  let changed: (string | null)[];

  /**
   * Function show
   *
   * @description
   * Shows a due date and a status.
   *
   * @param {string | null} due - The due date.
   * @param {string} [status] - The status.
   * @returns {Promise<void>} Resolves once rendered.
   */
  async function show(due: string | null, status: string = 'todo'): Promise<void> {
    fixture.componentRef.setInput('due', due);
    fixture.componentRef.setInput('status', status);
    await fixture.whenStable();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
    fixture = TestBed.createComponent(TaskPropertyDue);
    changed = [];
    fixture.componentInstance.dueChanged.subscribe((due: string | null) => changed.push(due));
    fixture.componentRef.setInput('today', TODAY);
    await fixture.whenStable();
  });

  it('writes Empty, Today, Tomorrow and Yesterday', async () => {
    expect(trigger().textContent.trim()).toBe('Empty');
    await show(TODAY);
    expect(trigger().textContent.trim()).toBe('Today');
    await show('2026-11-09');
    expect(trigger().textContent.trim()).toBe('Tomorrow');
    await show('2026-11-07', 'done');
    expect(trigger().textContent.trim()).toBe('Yesterday');
  });

  it('warns about an open late task, not a closed one', async () => {
    await show('2026-11-02');
    const label: HTMLElement | null = trigger().querySelector('[title]');

    expect(trigger().textContent).toContain('(late)');
    expect(label?.getAttribute('title')).toBe('Monday, November 2 (late)');
    await show('2026-11-02', 'done');
    expect(trigger().textContent).not.toContain('(late)');
  });

  it('applies a shortcut, closes the dialog and offers End of the sprint for a sprint', async () => {
    trigger().click();
    await fixture.whenStable();
    expect(
      shortcuts().map((item: HTMLButtonElement) => item.firstChild?.textContent?.trim()),
    ).toEqual(['Today', 'Tomorrow', 'Friday', 'No due date']);
    shortcuts()[1].click();
    await fixture.whenStable();

    expect(changed).toEqual(['2026-11-09']);
    expect(shortcuts()).toHaveLength(0);

    fixture.componentRef.setInput('sprintEnd', '2026-11-13');
    await fixture.whenStable();
    trigger().click();
    await fixture.whenStable();
    expect(
      shortcuts().some((item: HTMLButtonElement) => item.textContent.includes('End of the sprint')),
    ).toBe(true);
  });

  it('removes the due date with No due date', async () => {
    await show('2026-11-12');
    trigger().click();
    await fixture.whenStable();
    shortcuts()
      .find((item: HTMLButtonElement) => item.textContent.includes('No due date'))
      ?.click();

    expect(changed).toEqual([null]);
  });

  it('is read-only when disabled', async () => {
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();

    expect(trigger().disabled).toBe(true);
  });
});
