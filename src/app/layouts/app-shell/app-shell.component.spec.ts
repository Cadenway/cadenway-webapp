import { ApplicationRef, Component, input, type InputSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import type { SlotContribution } from '@shared/layout-slot';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from './app-shell.component';
import { provideAppShellSlots, type AppShellSlots } from './providers';

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
 * @param {AppShellSlots} slots - Contributions per slot.
 * @returns {Promise<HTMLElement>} The stable host element.
 */
async function render(slots: AppShellSlots): Promise<HTMLElement> {
  TestBed.configureTestingModule({
    imports: [AppShell],
    providers: [provideRouter([]), provideCadenwayIcons(), provideAppShellSlots(slots)],
  });
  const fixture: ComponentFixture<AppShell> = TestBed.createComponent(AppShell);
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
 * Constant RAIL_NAME
 *
 * @description
 * Accessible name of the applications rail in the loaded catalog.
 *
 * @type {string}
 */
const RAIL_NAME: string = $localize`:@@layouts.app-shell.rail:Applications`;

/**
 * Constant SIDEBAR_NAME
 *
 * @description
 * Accessible name of the space sidebar in the loaded catalog.
 *
 * @type {string}
 */
const SIDEBAR_NAME: string = $localize`:@@layouts.app-shell.sidebar:Space navigation`;

describe('AppShell', () => {
  afterEach(() => {
    Reflect.deleteProperty(document.defaultView ?? {}, 'matchMedia');
  });

  it('renders every slot in order with its inputs, overlays last', async () => {
    const host: HTMLElement = await render({
      banners: [probe('banner-b', 2), probe('banner-a', 1)],
      organizationSwitcher: [probe('organizations', 0)],
      railNavigation: [probe('favorites', 20), probe('applications', 10)],
      railFooter: [probe('account', 3), probe('search', 1), probe('theme', 2)],
      sidebarHeader: [probe('sidebar-search', 2), probe('organization-row', 1)],
      sidebar: [probe('spaces', 2), probe('shortcuts', 1)],
      sidebarFooter: [probe('sprint', 0)],
      overlays: [probe('palette', 0)],
    });

    expect(labels(host)).toEqual([
      'banner-a',
      'banner-b',
      'organizations',
      'applications',
      'favorites',
      'search',
      'theme',
      'account',
      'organization-row',
      'sidebar-search',
      'shortcuts',
      'spaces',
      'sprint',
      'palette',
    ]);
    const rail: HTMLElement | null = landmark(host, 'nav', RAIL_NAME);
    expect(
      labels(rail?.querySelector('[data-testid="app-shell-organization-switcher"]') ?? null),
    ).toEqual(['organizations']);
    expect(labels(rail?.querySelector('cw-app-rail-footer') ?? null)).toEqual([
      'search',
      'theme',
      'account',
    ]);
    expect(labels(host.querySelector('cw-sidebar-header'))).toEqual([
      'organization-row',
      'sidebar-search',
    ]);
    expect(labels(host.querySelector('cw-sidebar-footer'))).toEqual(['sprint']);
  });

  it('renders nothing for empty slots', async () => {
    const host: HTMLElement = await render({});

    expect(labels(host)).toEqual([]);
    expect(host.querySelector('[data-testid="app-shell-organization-switcher"]')).toBeNull();
    expect(host.querySelector('cw-app-rail-separator')).toBeNull();
    expect(host.querySelector('cw-app-rail-footer')).toBeNull();
    expect(host.querySelector('cw-sidebar-header')).toBeNull();
    expect(host.querySelector('cw-sidebar-footer')).toBeNull();
  });

  it('exposes the rail, the space navigation and the main landmark around the outlet', async () => {
    const host: HTMLElement = await render({});

    expect(landmark(host, 'nav', RAIL_NAME)).not.toBeNull();
    expect(landmark(host, 'nav', SIDEBAR_NAME)).not.toBeNull();
    const main: HTMLElement | null = landmark(
      host,
      'main',
      $localize`:@@layouts.app-shell.main:Main content`,
    );
    expect(main?.querySelector('router-outlet')).not.toBeNull();
  });

  it('keeps the sidebar open from 1024 px, without the expand toggle', async () => {
    const host: HTMLElement = await render({});

    expect(landmark(host, 'nav', SIDEBAR_NAME)?.getAttribute('data-state')).toBe('expanded');
    expect(host.querySelector('main button')).toBeNull();
  });

  it('starts with the sidebar closed below 1024 px and opens it from the main panel', async () => {
    Object.defineProperty(document.defaultView, 'matchMedia', {
      configurable: true,
      value: (query: string): Partial<MediaQueryList> => ({
        matches: query === '(max-width: 1023.98px)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
    const host: HTMLElement = await render({});
    const sidebar: HTMLElement | null = landmark(host, 'nav', SIDEBAR_NAME);

    expect(sidebar?.getAttribute('data-state')).toBe('collapsed');
    const toggle: HTMLButtonElement | null = host.querySelector('main button');
    expect(toggle?.getAttribute('aria-label')).toBe(
      $localize`:@@layouts.app-shell.sidebar-expand:Expand the sidebar`,
    );

    toggle?.click();
    await TestBed.inject(ApplicationRef).whenStable();

    expect(sidebar?.getAttribute('data-state')).toBe('expanded');
  });
});
