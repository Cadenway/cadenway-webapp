import { Component, input, type InputSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import type { SlotContribution } from '@shared/layout-slot';
import { describe, expect, it } from 'vitest';

import { provideSettingsShellSlots, type SettingsShellSlots } from './providers';
import type { SettingsShellRouteData } from './models/settings-shell-route-data.interface';
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
 * Function routedElement
 *
 * @description
 * Returns the element of the component the harness routed to.
 *
 * @param {RouterTestingHarness} harness - Harness after a navigation.
 * @returns {HTMLElement} The routed component's element.
 * @throws {Error} When the navigation rendered no component.
 */
function routedElement(harness: RouterTestingHarness): HTMLElement {
  const element: HTMLElement | null = harness.routeNativeElement;
  if (!element) throw new Error('Expected a routed component.');
  return element;
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
 * Mounts the shell as the routed component of a route with the given slots and `data`, and returns
 * the rendered element.
 *
 * @param {SettingsShellSlots} slots - Contributions per slot.
 * @param {Partial<SettingsShellRouteData>} data - Route data of the shell route.
 * @returns {Promise<HTMLElement>} The stable rendered element.
 */
async function render(
  slots: SettingsShellSlots,
  data: Partial<SettingsShellRouteData> = {},
): Promise<HTMLElement> {
  TestBed.configureTestingModule({
    providers: [
      provideCadenwayIcons(),
      provideRouter([
        {
          path: '',
          component: SettingsShell,
          data,
          providers: [provideSettingsShellSlots(slots)],
        },
      ]),
    ],
  });
  const harness: RouterTestingHarness = await RouterTestingHarness.create('/');
  return routedElement(harness);
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
 * Accessible name the account route gives the settings navigation in these specs.
 *
 * @type {string}
 */
const NAVIGATION_NAME: string = 'Account settings';

describe('SettingsShell', () => {
  it('renders the rail and the settings navigation in order with their inputs', async () => {
    const host: HTMLElement = await render(
      {
        railNavigation: [probe('spaces', 2), probe('applications', 1)],
        railFooter: [probe('avatar', 3), probe('search', 1)],
        settingsNavigation: [probe('organization', 20), probe('back', 0), probe('account', 10)],
      },
      { settingsNavigationLabel: NAVIGATION_NAME },
    );

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

  it('names the settings navigation from the route data only', async () => {
    const host: HTMLElement = await render({ settingsNavigation: [probe('back', 0)] });

    const navigation: HTMLElement | null = host.querySelector(
      'nav:has([data-testid="slot-probe"])',
    );
    expect(navigation).not.toBeNull();
    expect(navigation?.hasAttribute('aria-label')).toBe(false);
  });

  it('renders nothing for empty slots', async () => {
    const host: HTMLElement = await render({}, { settingsNavigationLabel: NAVIGATION_NAME });

    expect(labels(host)).toEqual([]);
    expect(host.querySelector('cw-app-rail-footer')).toBeNull();
    expect(landmark(host, 'nav', NAVIGATION_NAME)).toBeNull();
  });

  it('exposes an unnamed main landmark around the outlet', async () => {
    const host: HTMLElement = await render({});

    const main: HTMLElement | null = host.querySelector('main');
    expect(main?.hasAttribute('aria-label')).toBe(false);
    expect(main?.querySelector('router-outlet')).not.toBeNull();
  });
});
