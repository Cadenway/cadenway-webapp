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

  it('opens with `?` and lists the sections of the mockup', async () => {
    const fixture: ComponentFixture<ShortcutsDialog> = await render();
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true }));
    await fixture.whenStable();

    const dialog: HTMLElement | null = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Keyboard shortcuts');
    expect(
      Array.from(dialog?.querySelectorAll('h3') ?? []).map((title: Element) => title.textContent),
    ).toEqual(['Everywhere', 'Lists and tasks', 'Editing']);
    expect(dialog?.textContent).toContain('Command palette and search');
    const keys: Element[] = Array.from(dialog?.querySelectorAll('kbd') ?? []);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every((key: Element) => key.getAttribute('data-size') === 'xl')).toBe(true);
  });

  it('opens from the button of the sidebar footer', async () => {
    const fixture: ComponentFixture<ShortcutsDialog> = await render();
    const button: ComponentFixture<ShortcutsButton> = TestBed.createComponent(ShortcutsButton);
    await button.whenStable();

    (button.nativeElement as HTMLElement).querySelector('button')?.click();
    await fixture.whenStable();

    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Everywhere');
  });
});
