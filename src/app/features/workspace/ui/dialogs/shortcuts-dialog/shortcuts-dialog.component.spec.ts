import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';

import { ShortcutsHelp } from '../../../services/shortcuts-help/shortcuts-help.service';
import { ShortcutsButton } from '../../components/shortcuts-button/shortcuts-button.component';
import { ShortcutsDialog } from './shortcuts-dialog.component';

describe('ShortcutsDialog', () => {
  afterEach(() => {
    TestBed.inject(ShortcutsHelp).setOpen(false);
  });

  /**
   * Function render
   *
   * @description
   * Renders the dialog, closed.
   *
   * @returns {Promise<ComponentFixture<ShortcutsDialog>>} The dialog.
   */
  async function render(): Promise<ComponentFixture<ShortcutsDialog>> {
    const fixture: ComponentFixture<ShortcutsDialog> = TestBed.createComponent(ShortcutsDialog);
    await fixture.whenStable();
    return fixture;
  }

  it('opens with « ? » and lists the mockup’s sections', async () => {
    const fixture: ComponentFixture<ShortcutsDialog> = await render();
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true }));
    await fixture.whenStable();

    const dialog: HTMLElement | null = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Raccourcis clavier');
    expect(
      Array.from(dialog?.querySelectorAll('h3') ?? []).map((title: Element) => title.textContent),
    ).toEqual(['Partout', 'Listes et tâches', 'Édition']);
    expect(dialog?.textContent).toContain('Palette de commandes et recherche');
  });

  it('opens from the sidebar footer’s button', async () => {
    const fixture: ComponentFixture<ShortcutsDialog> = await render();
    const button: ComponentFixture<ShortcutsButton> = TestBed.createComponent(ShortcutsButton);
    await button.whenStable();

    (button.nativeElement as HTMLElement).querySelector('button')?.click();
    await fixture.whenStable();

    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Partout');
  });
});
