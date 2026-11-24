import { Component, input, type InputSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import type { SlotContribution } from '@shared/layout-slot';
import { describe, expect, it } from 'vitest';

import { AuthLayout } from './auth-layout.component';
import { provideAuthLayoutSlots, type AuthLayoutSlots } from './providers';

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
 * Renders the layout with the given slot configuration and returns its host element.
 *
 * @param {AuthLayoutSlots} slots - Contributions per slot.
 * @returns {Promise<HTMLElement>} The stable host element.
 */
async function render(slots: AuthLayoutSlots): Promise<HTMLElement> {
  TestBed.configureTestingModule({
    imports: [AuthLayout],
    providers: [provideRouter([]), provideCadenwayIcons(), provideAuthLayoutSlots(slots)],
  });
  const fixture: ComponentFixture<AuthLayout> = TestBed.createComponent(AuthLayout);
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

describe('AuthLayout', () => {
  it('renders the header actions and the footer links in order with their inputs', async () => {
    const host: HTMLElement = await render({
      headerActions: [probe('theme', 20), probe('host', 10)],
      footerLinks: [probe('help', 3), probe('privacy', 1), probe('terms', 2)],
    });

    expect(labels(host.querySelector('header'))).toEqual(['host', 'theme']);
    expect(labels(host.querySelector('footer'))).toEqual(['privacy', 'terms', 'help']);
  });

  it('renders nothing for empty slots', async () => {
    const host: HTMLElement = await render({});

    expect(host.querySelector('[data-testid="auth-layout-header-actions"]')).toBeNull();
    expect(host.querySelector('footer')).toBeNull();
    expect(labels(host)).toEqual([]);
  });

  it('exposes the header, the named home link and the main landmark around the card outlet', async () => {
    const host: HTMLElement = await render({});

    const home: HTMLAnchorElement | null = host.querySelector('header a');
    expect(home?.getAttribute('aria-label')).toBe(
      $localize`:@@layouts.auth-layout.home-link:Cadenway, sign-in page`,
    );
    expect(home?.getAttribute('href')).toBe('/');
    expect(host.querySelector('cw-logo')).not.toBeNull();
    const main: HTMLElement | null = host.querySelector('main');
    expect(main?.getAttribute('aria-label')).toBe(
      $localize`:@@layouts.auth-layout.main:Main content`,
    );
    expect(main?.querySelector('[data-testid="auth-layout-card"] router-outlet')).not.toBeNull();
  });
});
