import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { describe, expect, it, type Mock, vi } from 'vitest';

import type { SavedViewDraft } from '../../../models/saved-view/saved-view.interface';
import { SaveViewDialog } from './save-view-dialog.component';

/**
 * Function submitButton
 *
 * @description
 * The dialog's submit button, rendered in the overlay.
 *
 * @returns {HTMLButtonElement | null} The button.
 */
function submitButton(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>('[data-testid="save-view-submit"]');
}

describe('SaveViewDialog', () => {
  it('keeps the submit button disabled without a name, then submits the name and icon', async () => {
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
    const fixture: ComponentFixture<SaveViewDialog> = TestBed.createComponent(SaveViewDialog);
    const submitted: Mock<(draft: SavedViewDraft) => void> = vi.fn();
    fixture.componentInstance.submitted.subscribe((draft: SavedViewDraft) => {
      submitted(draft);
    });
    fixture.componentRef.setInput('summary', 'List · 1 filter.');
    fixture.componentRef.setInput('placeholder', 'List · filtered');
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.body.textContent).toContain('Save the view');
    expect(document.body.textContent).toContain('List · 1 filter.');
    expect(submitButton()?.disabled).toBe(true);

    const name: HTMLInputElement | null = document.querySelector<HTMLInputElement>(
      '[data-testid="save-view-name"]',
    );
    if (name) {
      name.value = '  My bugs  ';
      name.dispatchEvent(new Event('input'));
    }
    document.querySelector<HTMLButtonElement>('[aria-label="Bug"]')?.click();
    fixture.detectChanges();
    expect(submitButton()?.disabled).toBe(false);
    submitButton()?.click();

    expect(submitted).toHaveBeenCalledWith({ name: 'My bugs', icon: 'bug' });
  });

  it('renames with the current name filled in', async () => {
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
    const fixture: ComponentFixture<SaveViewDialog> = TestBed.createComponent(SaveViewDialog);
    fixture.componentRef.setInput('mode', 'rename');
    fixture.componentRef.setInput('initialName', 'Critical bugs');
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.body.textContent).toContain('Rename the view');
    expect(document.querySelector<HTMLInputElement>('[data-testid="save-view-name"]')?.value).toBe(
      'Critical bugs',
    );
  });
});
