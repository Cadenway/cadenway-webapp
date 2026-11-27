import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { beforeEach, describe, expect, it } from 'vitest';

import { type ThemePick, ThemeCards } from './theme-cards.component';

describe('ThemeCards', () => {
  let fixture: ComponentFixture<ThemeCards>;
  let picks: ThemePick[];

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
    fixture = TestBed.createComponent(ThemeCards);
    fixture.componentRef.setInput('preference', 'light');
    fixture.componentRef.setInput('shown', 'dark');
    fixture.componentRef.setInput('labelledBy', 'theme-title');
    picks = [];
    fixture.componentInstance.picked.subscribe((pick: ThemePick) => picks.push(pick));
    fixture.detectChanges();
  });

  /**
   * Function radio
   *
   * @description
   * The radio of a card, by the id the card's label points to.
   *
   * @param {string} preference - The card's preference.
   * @returns {HTMLElement} The radio.
   */
  function radio(preference: string): HTMLElement {
    const found: HTMLElement | null = (fixture.nativeElement as HTMLElement).querySelector(
      `#account-preferences-theme-${preference}`,
    );
    if (!found) throw new Error(`No radio for ${preference}`);
    return found;
  }

  it('names each radio by its card and checks the preference', () => {
    const host: HTMLElement = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('[role="radiogroup"]')?.getAttribute('aria-labelledby')).toBe(
      'theme-title',
    );
    expect(
      ['light', 'dark', 'system'].map((preference: string) =>
        host
          .querySelector(`label[for="account-preferences-theme-${preference}"]`)
          ?.textContent.trim(),
      ),
    ).toEqual(['Light', 'Dark', 'System']);
    expect(radio('light').getAttribute('aria-checked')).toBe('true');
  });

  it('draws the System preview in the theme shown now', () => {
    const previews: string[] = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('[data-theme]'),
    ).map((preview: Element) => preview.getAttribute('data-theme') ?? '');

    expect(previews).toEqual(['light', 'dark', 'dark']);
  });

  it('emits a chosen card with its centre, and nothing for the checked one', () => {
    radio('light').click();
    radio('system').click();

    expect(picks.map((pick: ThemePick) => pick.preference)).toEqual(['system']);
    expect(typeof picks[0]?.origin?.x).toBe('number');
    expect(typeof picks[0]?.origin?.y).toBe('number');
  });
});
