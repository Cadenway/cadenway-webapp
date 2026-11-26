import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { beforeEach, describe, expect, it } from 'vitest';

import type { TaskTimeDraft, TaskTimeEntry } from '../../../models/task-time/task-time.interface';
import { personOf } from '../../../utils/person/person.util';
import { TaskPropertyTime } from './task-property-time.component';

/**
 * Constant NOW
 *
 * @description
 * Sunday 8 November 2026, 10:00, the mockup's now.
 *
 * @type {number}
 */
const NOW: number = new Date(2026, 10, 8, 10, 0, 0).getTime();

/**
 * Constant ENTRIES
 *
 * @description
 * Time recorded on CAD-482, newest first: Camille's 45 min of today, Inès's 1 h 35 of yesterday.
 *
 * @type {readonly TaskTimeEntry[]}
 */
const ENTRIES: readonly TaskTimeEntry[] = [
  {
    id: 'e2',
    authorId: 'u1',
    minutes: 45,
    workDate: '2026-11-08',
    note: '',
    createdAt: new Date(2026, 10, 8, 9, 5).toISOString(),
  },
  {
    id: 'e1',
    authorId: 'u2',
    minutes: 95,
    workDate: '2026-11-07',
    note: 'OAuth buttons',
    createdAt: new Date(2026, 10, 7, 17, 30).toISOString(),
  },
];

/**
 * Function byTestId
 *
 * @description
 * A button by its test id.
 *
 * @param {string} id - The test id.
 * @returns {HTMLButtonElement} The button.
 */
function byTestId(id: string): HTMLButtonElement {
  const found: HTMLButtonElement | null = document.querySelector<HTMLButtonElement>(
    `[data-testid="${id}"]`,
  );
  if (!found) throw new Error(`No ${id}`);
  return found;
}

/**
 * Function buttonNamed
 *
 * @description
 * A button of the page by its text or accessible name.
 *
 * @param {string} name - The text or name.
 * @returns {HTMLButtonElement | undefined} The button.
 */
function buttonNamed(name: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
    (button: HTMLButtonElement) =>
      button.textContent.trim() === name || button.getAttribute('aria-label') === name,
  );
}

describe('TaskPropertyTime', () => {
  let fixture: ComponentFixture<TaskPropertyTime>;
  let added: TaskTimeDraft[];
  let removed: TaskTimeEntry[];

  /**
   * Function openPanel
   *
   * @description
   * Opens the add time panel.
   *
   * @returns {Promise<void>} Resolves once open.
   */
  async function openPanel(): Promise<void> {
    byTestId('task-property-time').click();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
    fixture = TestBed.createComponent(TaskPropertyTime);
    added = [];
    removed = [];
    fixture.componentInstance.added.subscribe((draft: TaskTimeDraft) => added.push(draft));
    fixture.componentInstance.removed.subscribe((entry: TaskTimeEntry) => removed.push(entry));
    fixture.componentRef.setInput('now', NOW);
    fixture.componentRef.setInput('currentUserId', 'u1');
    fixture.componentRef.setInput('people', [
      personOf('u1', 'Camille Martin'),
      personOf('u2', 'Inès Robert'),
    ]);
    await fixture.whenStable();
  });

  it('shows None, then the time spent against the estimate', async () => {
    expect(byTestId('task-property-time').textContent.trim()).toBe('None');
    fixture.componentRef.setInput('totalMinutes', 140);
    fixture.componentRef.setInput('estimateMinutes', 480);
    await fixture.whenStable();

    expect(byTestId('task-property-time').textContent).toContain('2 h 20');
    expect(byTestId('task-property-time').textContent).toContain('/ 8 h');
    expect(document.querySelector('[aria-label="Time spent against the estimate"]')).not.toBeNull();
  });

  it('adds a shortcut at once', async () => {
    await openPanel();
    buttonNamed('+ 15 min')?.click();

    expect(added).toEqual([{ minutes: 15, note: '' }]);
  });

  it('shows the error of an unreadable duration on Add, then adds a typed one', async () => {
    await openPanel();
    const duration: HTMLInputElement | null = document.querySelector<HTMLInputElement>(
      'input[placeholder="1 h 30, 45 min…"]',
    );
    if (!duration) throw new Error('No duration');
    duration.value = 'later';
    duration.dispatchEvent(new Event('input'));
    buttonNamed('Add')?.click();
    await fixture.whenStable();
    expect(document.body.textContent).toContain('Unrecognized duration: try 1 h 30 or 45 min.');
    expect(duration.getAttribute('aria-invalid')).toBe('true');

    duration.value = '90';
    duration.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(document.body.textContent).toContain('= 1 h 30');
    buttonNamed('Add')?.click();
    expect(added).toEqual([{ minutes: 90, note: '' }]);
  });

  it('lists the entries and deletes only the caller’s own after confirmation', async () => {
    fixture.componentRef.setInput('entries', ENTRIES);
    await fixture.whenStable();
    await openPanel();

    expect(document.body.textContent).toContain('Entries · 2');
    expect(document.body.textContent).toContain('OAuth buttons · yesterday');
    expect(buttonNamed('Delete the 1 h 35 entry')).toBeUndefined();
    buttonNamed('Delete the 45 min entry')?.click();
    await fixture.whenStable();
    expect(document.body.textContent).toContain('Delete this 45 min entry?');
    expect(removed).toEqual([]);
    buttonNamed('Delete the entry')?.click();
    await fixture.whenStable();

    expect(removed).toEqual([ENTRIES[0]]);
  });

  it('names the timer and emits its toggle; hides it when disabled', async () => {
    const toggles: number[] = [];
    fixture.componentInstance.timerToggled.subscribe(() => toggles.push(1));
    expect(byTestId('task-property-timer').getAttribute('aria-label')).toBe('Start the timer');
    fixture.componentRef.setInput('timerStartedAt', NOW - 12 * 60_000);
    await fixture.whenStable();
    expect(byTestId('task-property-timer').getAttribute('aria-label')).toBe(
      'Stop the timer (12 min)',
    );
    byTestId('task-property-timer').click();
    expect(toggles).toHaveLength(1);

    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();
    expect(document.querySelector('[data-testid="task-property-timer"]')).toBeNull();
    expect(byTestId('task-property-time').disabled).toBe(true);
  });
});
