import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

import { DiscardChangesDialog } from './discard-changes-dialog.component';

/**
 * Function button
 *
 * @description
 * Finds a button of the open confirmation by its text.
 *
 * @param {string} text - Visible text of the button.
 * @returns {HTMLButtonElement | undefined} The button, when the confirmation shows it.
 */
function button(text: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find(
    (candidate: HTMLButtonElement) => candidate.textContent.trim() === text,
  );
}

/**
 * Function render
 *
 * @description
 * Creates the dialog and waits for it to render.
 *
 * @returns {Promise<ComponentFixture<DiscardChangesDialog>>} The fixture.
 */
async function render(): Promise<ComponentFixture<DiscardChangesDialog>> {
  const fixture: ComponentFixture<DiscardChangesDialog> =
    TestBed.createComponent(DiscardChangesDialog);
  await fixture.whenStable();
  return fixture;
}

describe('DiscardChangesDialog', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('answers true when the person discards the changes', async () => {
    const fixture: ComponentFixture<DiscardChangesDialog> = await render();

    const answer: Promise<boolean> = fixture.componentInstance.ask();
    await fixture.whenStable();
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain(
      'Discard unsaved changes?',
    );
    button('Discard')?.click();

    expect(await answer).toBe(true);
  });

  it('answers false when the person keeps editing', async () => {
    const fixture: ComponentFixture<DiscardChangesDialog> = await render();

    const answer: Promise<boolean> = fixture.componentInstance.ask();
    await fixture.whenStable();
    button('Keep editing')?.click();

    expect(await answer).toBe(false);
  });

  it('answers false when the dialog is destroyed while asking', async () => {
    const fixture: ComponentFixture<DiscardChangesDialog> = await render();
    const settled: Mock<(discard: boolean) => void> = vi.fn();

    void fixture.componentInstance.ask().then(settled);
    fixture.destroy();
    await Promise.resolve();

    expect(settled).toHaveBeenCalledWith(false);
  });
});
