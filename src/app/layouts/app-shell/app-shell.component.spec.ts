import {
  ApplicationRef,
  Component,
  DestroyRef,
  inject,
  input,
  type InputSignal,
} from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { SHELL_SIDEBAR, type ShellSidebar, type SlotContribution } from '@shared/layout-slot';
import { describe, expect, it } from 'vitest';

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
 * Component ClaimingScreen
 *
 * @description
 * Routed screen that renders the expand toggle itself, as the list screen does in its breadcrumb
 * row.
 */
@Component({
  selector: 'cw-claiming-screen',
  template:
    '<button type="button" data-testid="screen-toggle" (click)="sidebar?.toggle()">Toggle</button>',
})
class ClaimingScreen {
  // #region Properties
  /**
   * Property sidebar
   *
   * @description
   * Port to the hosting shell's sidebar.
   *
   * @type {ShellSidebar | null}
   * @readonly
   */
  protected readonly sidebar: ShellSidebar | null = inject(SHELL_SIDEBAR, { optional: true });
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Claims the toggle for the screen's lifetime.
   *
   * @constructor
   */
  public constructor() {
    this.sidebar?.claimToggle(inject(DestroyRef));
  }
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
 * Function byTestId
 *
 * @description
 * Finds an element by its `data-testid`.
 *
 * @param {ParentNode} root - Root to search.
 * @param {string} id - Test id.
 * @returns {HTMLElement | null} The element, or null.
 */
function byTestId(root: ParentNode, id: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-testid="${id}"]`);
}

/**
 * Function click
 *
 * @description
 * Focuses and clicks a button, as a keyboard user does, then waits for the application to settle.
 *
 * @param {HTMLElement | null} button - Button to activate.
 * @returns {Promise<void>} Resolves once rendering and focus moves are done.
 */
async function click(button: HTMLElement | null): Promise<void> {
  button?.focus();
  button?.click();
  await TestBed.inject(ApplicationRef).whenStable();
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
    expect(labels(byTestId(host, 'app-shell-organization-switcher'))).toEqual(['organizations']);
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
    expect(byTestId(host, 'app-shell-organization-switcher')).toBeNull();
    expect(host.querySelector('cw-app-rail-separator')).toBeNull();
    expect(host.querySelector('cw-app-rail-footer')).toBeNull();
    expect(host.querySelector('cw-sidebar-footer')).toBeNull();
  });

  it('exposes the rail, the space navigation and an unnamed main landmark around the outlet', async () => {
    const host: HTMLElement = await render({});

    expect(landmark(host, 'nav', RAIL_NAME)).not.toBeNull();
    expect(landmark(host, 'nav', SIDEBAR_NAME)).not.toBeNull();
    const main: HTMLElement | null = host.querySelector('main');
    expect(main?.hasAttribute('aria-label')).toBe(false);
    expect(main?.querySelector('router-outlet')).not.toBeNull();
  });

  it('starts expanded with a collapse control in the sidebar and no expand toggle', async () => {
    const host: HTMLElement = await render({});
    const sidebar: HTMLElement | null = landmark(host, 'nav', SIDEBAR_NAME);
    const collapse: HTMLElement | null = byTestId(host, 'app-shell-sidebar-collapse');

    expect(sidebar?.getAttribute('data-state')).toBe('expanded');
    expect(collapse?.getAttribute('aria-label')).toBe(
      $localize`:@@layouts.app-shell.sidebar-collapse:Collapse the sidebar`,
    );
    expect(sidebar?.contains(collapse)).toBe(true);
    expect(collapse?.hasAttribute('aria-keyshortcuts')).toBe(false);
    expect(byTestId(host, 'app-shell-sidebar-expand')).toBeNull();
  });

  it('returns focus to the expand toggle on collapse and moves it into the sidebar on expand', async () => {
    const host: HTMLElement = await render({});
    const sidebar: HTMLElement | null = landmark(host, 'nav', SIDEBAR_NAME);

    await click(byTestId(host, 'app-shell-sidebar-collapse'));

    expect(sidebar?.getAttribute('data-state')).toBe('collapsed');
    const expand: HTMLElement | null = byTestId(host, 'app-shell-sidebar-expand');
    expect(expand?.getAttribute('aria-label')).toBe(
      $localize`:@@layouts.app-shell.sidebar-expand:Expand the sidebar`,
    );
    expect(document.activeElement).toBe(expand);
    expect(expand?.hasAttribute('aria-keyshortcuts')).toBe(false);

    await click(expand);

    expect(sidebar?.getAttribute('data-state')).toBe('expanded');
    expect(document.activeElement).toBe(byTestId(host, 'app-shell-sidebar-collapse'));
  });
});

describe('AppShell routing', () => {
  it('reads slots from the route that loads the shell only, never from its child routes', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        provideRouter([
          {
            path: '',
            component: AppShell,
            providers: [provideAppShellSlots({ railFooter: [probe('from-shell-route', 0)] })],
            children: [
              {
                path: 'child',
                component: ClaimingScreen,
                providers: [provideAppShellSlots({ railFooter: [probe('from-child-route', 1)] })],
              },
            ],
          },
        ]),
      ],
    });
    const harness: RouterTestingHarness = await RouterTestingHarness.create('/child');
    const host: HTMLElement = routedElement(harness);

    expect(labels(host.querySelector('cw-app-rail-footer'))).toEqual(['from-shell-route']);
    expect(byTestId(host, 'screen-toggle')).not.toBeNull();
  });

  it('lets a routed screen claim the toggle and returns focus to it', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        provideRouter([
          { path: '', component: AppShell, children: [{ path: '', component: ClaimingScreen }] },
        ]),
      ],
    });
    const harness: RouterTestingHarness = await RouterTestingHarness.create('/');
    const host: HTMLElement = routedElement(harness);
    const sidebar: HTMLElement | null = landmark(host, 'nav', SIDEBAR_NAME);
    const screenToggle: HTMLElement | null = byTestId(host, 'screen-toggle');

    await click(screenToggle);

    expect(sidebar?.getAttribute('data-state')).toBe('collapsed');
    expect(byTestId(host, 'app-shell-sidebar-expand')).toBeNull();

    await click(screenToggle);

    expect(sidebar?.getAttribute('data-state')).toBe('expanded');
    expect(document.activeElement).toBe(byTestId(host, 'app-shell-sidebar-collapse'));

    await click(byTestId(host, 'app-shell-sidebar-collapse'));

    expect(document.activeElement).toBe(screenToggle);
  });
});
