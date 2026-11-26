import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { beforeEach, describe, expect, it } from 'vitest';

import { TaskPropertyEstimate } from './task-property-estimate.component';

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
    '[data-testid="task-property-estimate"]',
  );
  if (!found) throw new Error('No trigger');
  return found;
}

/**
 * Function field
 *
 * @description
 * The estimate field of the open panel.
 *
 * @returns {HTMLInputElement} The field.
 */
function field(): HTMLInputElement {
  const found: HTMLInputElement | null =
    document.querySelector<HTMLInputElement>('input[role="combobox"]');
  if (!found) throw new Error('No field');
  return found;
}

/**
 * Function press
 *
 * @description
 * Presses a key in the field.
 *
 * @param {string} key - The key.
 */
function press(key: string): void {
  field().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

describe('TaskPropertyEstimate', () => {
  let fixture: ComponentFixture<TaskPropertyEstimate>;
  let estimated: (number | null)[];
  let rejected: string[];

  /**
   * Function type
   *
   * @description
   * Opens the panel and types a text.
   *
   * @param {string} text - The text.
   * @returns {Promise<void>} Resolves once rendered.
   */
  async function type(text: string): Promise<void> {
    trigger().click();
    await fixture.whenStable();
    field().value = text;
    field().dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
    fixture = TestBed.createComponent(TaskPropertyEstimate);
    estimated = [];
    rejected = [];
    fixture.componentInstance.estimated.subscribe((minutes: number | null) =>
      estimated.push(minutes),
    );
    fixture.componentInstance.rejected.subscribe((text: string) => rejected.push(text));
    await fixture.whenStable();
  });

  it('shows Empty, then the estimate', async () => {
    expect(trigger().textContent.trim()).toBe('Empty');
    fixture.componentRef.setInput('estimateMinutes', 90);
    await fixture.whenStable();
    expect(trigger().textContent.trim()).toBe('1 h 30');
  });

  it('applies a typed duration with Enter', async () => {
    await type('1h30');
    press('Enter');

    expect(estimated).toEqual([90]);
  });

  it('rejects an unreadable duration and shows the help', async () => {
    await type('soon');

    expect(document.body.textContent).toContain('Unrecognized duration: 1 h 30, 45 min, 2h15…');
    press('Enter');
    expect(rejected).toEqual(['soon']);
    expect(estimated).toEqual([]);
  });

  it('removes the estimate with Remove', async () => {
    fixture.componentRef.setInput('estimateMinutes', 120);
    await fixture.whenStable();
    trigger().click();
    await fixture.whenStable();
    Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
      .find((button: HTMLButtonElement) => button.textContent.trim() === 'Remove')
      ?.click();

    expect(estimated).toEqual([null]);
  });

  it('applies nothing after Escape', async () => {
    await type('3');
    press('Escape');
    await fixture.whenStable();

    expect(estimated).toEqual([]);
    expect(rejected).toEqual([]);
  });

  it('is read-only when disabled', async () => {
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();

    expect(trigger().disabled).toBe(true);
  });
});
