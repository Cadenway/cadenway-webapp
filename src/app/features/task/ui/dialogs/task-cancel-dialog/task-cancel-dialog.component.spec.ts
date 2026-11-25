import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';

import type { TaskCancellation } from '../../../models/task-status-change/task-status-change.interface';
import { TaskCancelDialog } from './task-cancel-dialog.component';

/**
 * Function buttonNamed
 *
 * @description
 * Finds a button of the open dialog by its text.
 *
 * @param {string} text - Text of the button.
 * @returns {HTMLButtonElement | undefined} The button.
 */
function buttonNamed(text: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(
    (button: HTMLButtonElement) => button.textContent.trim() === text,
  );
}

describe('TaskCancelDialog', () => {
  afterEach(() => {
    document.body.querySelectorAll('.cdk-overlay-container').forEach((node: Element) => {
      node.remove();
    });
  });

  it('asks a reason and an optional note, then cancels', async () => {
    const fixture: ComponentFixture<TaskCancelDialog> = TestBed.createComponent(TaskCancelDialog);
    const confirmed: TaskCancellation[] = [];
    fixture.componentInstance.confirmed.subscribe((value: TaskCancellation) =>
      confirmed.push(value),
    );
    fixture.componentRef.setInput('taskKeys', ['CAD-482']);
    await fixture.whenStable();

    expect(document.querySelector('[role="dialog"] h2')?.textContent.trim()).toBe(
      'Annuler CAD-482 ?',
    );
    expect(document.body.textContent).toContain('Doublon');
    expect(document.body.textContent).toContain('Hors périmètre');
    Array.from(document.querySelectorAll<HTMLElement>('cw-radio-group-item'))
      .find((item: HTMLElement) => item.textContent.includes('Obsolète'))
      ?.querySelector<HTMLButtonElement>('[role="radio"]')
      ?.click();
    const note: HTMLTextAreaElement | null = document.querySelector('#task-cancel-note');
    if (!note) throw new Error('No note field');
    note.value = '  Remplacée par CAD-490 ';
    note.dispatchEvent(new Event('input'));
    buttonNamed('Annuler la tâche')?.click();

    expect(confirmed).toEqual([{ reason: 'obsolete', note: 'Remplacée par CAD-490' }]);
  });

  it('keeps the task and names several tasks in its title', async () => {
    const fixture: ComponentFixture<TaskCancelDialog> = TestBed.createComponent(TaskCancelDialog);
    let kept: number = 0;
    fixture.componentInstance.kept.subscribe(() => (kept += 1));
    fixture.componentRef.setInput('taskKeys', ['CAD-482', 'CAD-483', 'CAD-484']);
    await fixture.whenStable();

    expect(document.querySelector('[role="dialog"] h2')?.textContent.trim()).toBe(
      'Annuler 3 tâches ?',
    );
    buttonNamed('Garder la tâche')?.click();

    expect(kept).toBe(1);
  });
});
