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
  it('keeps « Enregistrer la vue » disabled without a name, then submits the name and icon', async () => {
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
    const fixture: ComponentFixture<SaveViewDialog> = TestBed.createComponent(SaveViewDialog);
    const submitted: Mock<(draft: SavedViewDraft) => void> = vi.fn();
    fixture.componentInstance.submitted.subscribe((draft: SavedViewDraft) => {
      submitted(draft);
    });
    fixture.componentRef.setInput('summary', 'Liste · 1 filtre.');
    fixture.componentRef.setInput('placeholder', 'Liste · filtrée');
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.body.textContent).toContain('Enregistrer la vue');
    expect(document.body.textContent).toContain('Liste · 1 filtre.');
    expect(submitButton()?.disabled).toBe(true);

    const name: HTMLInputElement | null = document.querySelector<HTMLInputElement>(
      '[data-testid="save-view-name"]',
    );
    if (name) {
      name.value = '  Mes bugs  ';
      name.dispatchEvent(new Event('input'));
    }
    document.querySelector<HTMLButtonElement>('[aria-label="Bogue"]')?.click();
    fixture.detectChanges();
    expect(submitButton()?.disabled).toBe(false);
    submitButton()?.click();

    expect(submitted).toHaveBeenCalledWith({ name: 'Mes bugs', icon: 'bug' });
  });

  it('renames with the current name filled in', async () => {
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
    const fixture: ComponentFixture<SaveViewDialog> = TestBed.createComponent(SaveViewDialog);
    fixture.componentRef.setInput('mode', 'rename');
    fixture.componentRef.setInput('initialName', 'Bugs critiques');
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.body.textContent).toContain('Renommer la vue');
    expect(document.querySelector<HTMLInputElement>('[data-testid="save-view-name"]')?.value).toBe(
      'Bugs critiques',
    );
  });
});
