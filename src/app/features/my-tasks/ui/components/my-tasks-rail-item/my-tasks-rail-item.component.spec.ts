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

import { MyTasksRailItem } from './my-tasks-rail-item.component';

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
  imports: [MyTasksRailItem],
  template: '<cw-my-tasks-rail-item />',
})
class RailHost {}

describe('MyTasksRailItem', () => {
  it('links to my tasks and marks itself current on that screen, whatever its tab', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
        provideRouter([
          { path: 'atelier-nord', component: RailHost },
          { path: 'atelier-nord/my-tasks', component: RailHost },
        ]),
      ],
    });
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/my-tasks?tab=closed',
    );
    await harness.fixture.whenStable();
    harness.detectChanges();
    const link: () => HTMLAnchorElement | null = (): HTMLAnchorElement | null =>
      harness.routeNativeElement?.querySelector<HTMLAnchorElement>(
        '[data-testid="my-tasks-rail-item"]',
      ) ?? null;

    expect(link()?.getAttribute('href')).toBe('/atelier-nord/my-tasks');
    expect(link()?.textContent).toContain('My tasks');
    expect(link()?.getAttribute('aria-current')).toBe('page');

    await harness.navigateByUrl('/atelier-nord');
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(link()?.getAttribute('aria-current')).toBeNull();
  });
});
