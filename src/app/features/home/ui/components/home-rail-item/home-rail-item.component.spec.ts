import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { describe, expect, it } from 'vitest';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { HomeRailItem } from './home-rail-item.component';

/**
 * Constant workspace
 *
 * @description
 * Atelier Nord, as the workspace port shows it.
 *
 * @type {WorkspaceContextPort}
 */
const workspace: WorkspaceContextPort = {
  user: signal({
    id: 'u1',
    name: 'Camille Martin',
    firstName: 'Camille',
    displayName: null,
    email: 'camille.martin@ateliernord.fr',
    initials: 'CM',
  }),
  organization: signal({
    id: 'o1',
    slug: 'atelier-nord',
    name: 'Atelier Nord',
    initials: 'AN',
    role: 'owner',
    plan: 'team',
  }),
  role: signal('owner'),
  can: () => true,
};

/**
 * Component RailHost
 *
 * @description
 * A page showing the rail item, as the shell does.
 */
@Component({
  selector: 'cw-rail-host',
  imports: [HomeRailItem],
  template: '<cw-home-rail-item />',
})
class RailHost {}

describe('HomeRailItem', () => {
  it('links to the workspace and marks itself current on the home screen only', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
        provideRouter([
          { path: 'atelier-nord', component: RailHost },
          { path: 'atelier-nord/t/:key', component: RailHost },
        ]),
      ],
    });
    const harness: RouterTestingHarness = await RouterTestingHarness.create('/atelier-nord');
    await harness.fixture.whenStable();
    harness.detectChanges();
    const link: () => HTMLAnchorElement | null = (): HTMLAnchorElement | null =>
      harness.routeNativeElement?.querySelector<HTMLAnchorElement>(
        '[data-testid="home-rail-item"]',
      ) ?? null;

    expect(link()?.getAttribute('href')).toBe('/atelier-nord');
    expect(link()?.textContent).toContain('Accueil');
    expect(link()?.getAttribute('aria-current')).toBe('page');

    await harness.navigateByUrl('/atelier-nord/t/CAD-482');
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(link()?.getAttribute('aria-current')).toBeNull();
  });
});
