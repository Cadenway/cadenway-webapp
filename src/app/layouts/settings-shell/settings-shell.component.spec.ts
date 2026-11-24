import { Component, input, type InputSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import type { SlotContribution } from '@shared/layout-slot';
import { describe, expect, it } from 'vitest';

import { provideSettingsShellSlots, type SettingsShellSlots } from './providers';
import { SettingsShell } from './settings-shell.component';

/**
 * Component SlotProbe
 *
 * @description
 * Contribution rendering its `label` input, so a spec can read the rendered order and inputs.
 */
@Component({
  selector: 'cw-slot-probe',
  template: '<span data-testid="slot-probe">{{ label() }}</span>',
})
class SlotProbe {
  // #region Properties
  /**
   * Property label
   *
   * @description
   * Text the probe renders.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly label: InputSignal<string> = input('');
  // #endregion
}

/**
 * Function probe
 *
 * @description
 * Builds a slot feature rendering a probe labelled with its id.
 *
 * @param {string} id - Contribution id and probe label.
 * @param {number} order - Contribution order.
 * @returns {{ useFactory: () => SlotContribution }} The slot feature.
 */
function probe(id: string, order: number): { useFactory: () => SlotContribution } {
  return {
    useFactory: (): SlotContribution => ({
      id,
      order,
      component: SlotProbe,
      inputs: { label: id },
    }),
  };
}

/**
 * Function render
 *
 * @description
 * Renders the shell with the given slot configuration and returns its host element.
 *
 * @param {SettingsShellSlots} slots - Contributions per slot.
 * @returns {Promise<HTMLElement>} The stable host element.
 */
async function render(slots: SettingsShellSlots): Promise<HTMLElement> {
  TestBed.configureTestingModule({
    imports: [SettingsShell],
    providers: [provideRouter([]), provideCadenwayIcons(), provideSettingsShellSlots(slots)],
  });
  const fixture: ComponentFixture<SettingsShell> = TestBed.createComponent(SettingsShell);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

/**
 * Function labels
 *
 * @description
 * Reads the probe labels rendered inside a container, in document order.
 *
 * @param {Element | null} container - Container to read.
 * @returns {string[]} The rendered labels.
 */
function labels(container: Element | null): string[] {
  return Array.from(
    container?.querySelectorAll('[data-testid="slot-probe"]') ?? [],
    (element: Element): string => element.textContent.trim(),
  );
}

/**
 * Function landmark
 *
 * @description
 * Finds a landmark element by tag and accessible name.
 *
 * @param {HTMLElement} host - Rendered shell.
 * @param {string} tag - Landmark element name.
 * @param {string} name - Expected `aria-label`.
 * @returns {HTMLElement | null} The landmark, or null when absent.
 */
function landmark(host: HTMLElement, tag: string, name: string): HTMLElement | null {
  return (
    Array.from(host.querySelectorAll<HTMLElement>(tag)).find(
      (element: HTMLElement): boolean => element.getAttribute('aria-label') === name,
    ) ?? null
  );
}

/**
 * Constant NAVIGATION_NAME
 *
 * @description
 * Accessible name of the settings navigation in the loaded catalog.
 *
 * @type {string}
 */
const NAVIGATION_NAME: string = $localize`:@@layouts.settings-shell.navigation:Settings`;

describe('SettingsShell', () => {
  it('renders the rail and the settings navigation in order with their inputs', async () => {
    const host: HTMLElement = await render({
      railNavigation: [probe('spaces', 2), probe('applications', 1)],
      railFooter: [probe('avatar', 3), probe('search', 1)],
      settingsNavigation: [probe('organization', 20), probe('back', 0), probe('account', 10)],
    });

    const rail: HTMLElement | null = landmark(
      host,
      'nav',
      $localize`:@@layouts.settings-shell.rail:Applications`,
    );
    expect(labels(rail)).toEqual(['applications', 'spaces', 'search', 'avatar']);
    expect(labels(rail?.querySelector('cw-app-rail-footer') ?? null)).toEqual(['search', 'avatar']);
    expect(labels(landmark(host, 'nav', NAVIGATION_NAME))).toEqual([
      'back',
      'account',
      'organization',
    ]);
  });

  it('renders nothing for empty slots', async () => {
    const host: HTMLElement = await render({});

    expect(labels(host)).toEqual([]);
    expect(host.querySelector('cw-app-rail-footer')).toBeNull();
    expect(landmark(host, 'nav', NAVIGATION_NAME)).toBeNull();
  });

  it('exposes the main landmark around the outlet', async () => {
    const host: HTMLElement = await render({});

    const main: HTMLElement | null = landmark(
      host,
      'main',
      $localize`:@@layouts.settings-shell.main:Main content`,
    );
    expect(main?.querySelector('router-outlet')).not.toBeNull();
  });
});
