import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { TaskLabelPicker } from './task-label-picker.component';

/**
 * Function open
 *
 * @description
 * Renders the picker with the organization's labels and opens it.
 *
 * @returns {Promise<ComponentFixture<TaskLabelPicker>>} The fixture.
 */
async function open(): Promise<ComponentFixture<TaskLabelPicker>> {
  const fixture: ComponentFixture<TaskLabelPicker> = TestBed.createComponent(TaskLabelPicker);
  fixture.componentRef.setInput('labels', ['Front', 'Bug']);
  await fixture.whenStable();
  (fixture.nativeElement as HTMLElement)
    .querySelector<HTMLButtonElement>('button[role="combobox"]')
    ?.click();
  await fixture.whenStable();
  return fixture;
}

/**
 * Function search
 *
 * @description
 * Types in the picker's search field.
 *
 * @param {ComponentFixture<TaskLabelPicker>} fixture - The open picker.
 * @param {string} text - Text to type.
 * @returns {Promise<void>} Resolves once rendered.
 */
async function search(fixture: ComponentFixture<TaskLabelPicker>, text: string): Promise<void> {
  const field: HTMLInputElement | null = document.querySelector('input[role="combobox"]');
  if (!field) throw new Error('No search field');
  field.value = text;
  field.dispatchEvent(new Event('input'));
  await fixture.whenStable();
}

describe('TaskLabelPicker', () => {
  it('offers retry inside the picker when labels fail to load', async () => {
    const fixture: ComponentFixture<TaskLabelPicker> = TestBed.createComponent(TaskLabelPicker);
    let retries: number = 0;
    fixture.componentInstance.retry.subscribe(() => retries++);
    fixture.componentRef.setInput('failed', true);
    fixture.componentRef.setInput('labels', ['Front']);
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button[role="combobox"]')
      ?.click();
    await fixture.whenStable();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Impossible');
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(0);
    Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
      .find((button: HTMLButtonElement) => button.textContent.trim() === 'Réessayer')
      ?.click();
    expect(retries).toBe(1);
  });
  it('checks several labels', async () => {
    const fixture: ComponentFixture<TaskLabelPicker> = await open();
    const options: HTMLElement[] = Array.from(
      document.querySelectorAll<HTMLElement>('[role="option"]'),
    );
    options[0].click();
    options[1].click();
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toEqual(['Front', 'Bug']);
  });

  it('creates a label from the typed text and reuses one that differs by case', async () => {
    const fixture: ComponentFixture<TaskLabelPicker> = await open();
    await search(fixture, 'Sécurité');
    Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'))
      .find((option: HTMLElement) => option.textContent.includes('Créer'))
      ?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toEqual(['Sécurité']);
  });
});
