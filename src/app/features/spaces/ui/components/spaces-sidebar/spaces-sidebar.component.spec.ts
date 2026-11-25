import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwSidebar } from '@cadenway/ui/components/sidebar';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { SHELL_SIDEBAR } from '@shared/layout-slot';

import { SpacesApi } from '../../../data-access/services/spaces-api/spaces-api.service';
import type { Space } from '../../../models/space/space.interface';
import type { SpaceOverview, TaskList } from '../../../models/task-list/task-list.interface';
import { SpacesNavigationStore } from '../../../state/spaces-navigation/spaces-navigation.store';
import { todayIso } from '../../../utils/calendar-date/calendar-date.util';
import { SpacesRailItem } from '../spaces-rail-item/spaces-rail-item.component';
import { SprintProgress } from '../sprint-progress/sprint-progress.component';
import { SpacesSidebar } from './spaces-sidebar.component';

/**
 * Component ShellStub
 *
 * @description
 * Renders the contributions inside a sidebar, as the app shell does.
 */
@Component({
  selector: 'cw-shell-stub',
  imports: [CwSidebar, SpacesRailItem, SpacesSidebar, SprintProgress],
  template: `
    <cw-spaces-rail-item />
    <cw-sidebar ariaLabel="Navigation">
      <cw-spaces-sidebar />
      <cw-sprint-progress />
    </cw-sidebar>
  `,
})
class ShellStub {}

/**
 * Function list
 *
 * @description
 * A list of « Produit ».
 *
 * @param {string} id - Identifier.
 * @param {string} name - Name.
 * @param {boolean} sprint - Whether it is the current sprint.
 * @returns {TaskList} The list.
 */
function list(id: string, name: string, sprint: boolean = false): TaskList {
  return {
    id,
    spaceId: 'sp-produit',
    name,
    icon: null,
    color: 'gris',
    sprint: sprint ? { startDate: todayIso(), endDate: todayIso(), goal: null } : null,
    archived: false,
    canEdit: true,
    version: 1,
  };
}

/**
 * Constant produit
 *
 * @description
 * The « Produit » space.
 *
 * @type {Space}
 */
const produit: Space = {
  id: 'sp-produit',
  name: 'Produit',
  description: null,
  icon: null,
  color: 'violet',
  private: false,
  statuses: [],
};

describe('SpacesSidebar', () => {
  let spaces: Mock;
  let toggle: Mock;

  beforeEach(() => {
    localStorage.removeItem('cadenway-tips');
    spaces = vi.fn(() => Promise.resolve([produit]));
    toggle = vi.fn();
    const overview: SpaceOverview = {
      spaceId: 'sp-produit',
      taskCount: 40,
      lists: [
        {
          list: list('l-backlog', 'Backlog'),
          counts: { total: 12, open: 12, done: 0, cancelled: 0, late: 0 },
        },
        {
          list: list('l-sprint14', 'Sprint 14', true),
          counts: { total: 28, open: 20, done: 7, cancelled: 3, late: 2 },
        },
      ],
    };
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        provideRouter([
          { path: ':org', component: ShellStub },
          { path: ':org/l/:listId', component: ShellStub },
        ]),
        SpacesNavigationStore,
        {
          provide: SHELL_SIDEBAR,
          useValue: {
            expanded: signal(true),
            toggleClaimed: signal(false),
            toggle,
            claimToggle: vi.fn(),
          },
        },
        {
          provide: SpacesApi,
          useValue: {
            spaces,
            overview: vi.fn(() => Promise.resolve(overview)),
            favorites: vi.fn(() =>
              Promise.resolve([
                {
                  id: 'f1',
                  kind: 'saved-view',
                  targetId: 'sv-bugs',
                  name: 'Bugs critiques',
                  listId: 'l-bugs',
                },
              ]),
            ),
          },
        },
      ],
    });
  });

  /**
   * Function text
   *
   * @description
   * Text of an element of the page by test id.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @param {string} id - Test id.
   * @returns {string} Its text, empty when absent.
   */
  function text(harness: RouterTestingHarness, id: string): string {
    harness.detectChanges();
    return harness.routeNativeElement?.querySelector(`[data-testid="${id}"]`)?.textContent ?? '';
  }

  it('lists the favorites, the spaces with their counts, the sprint progress and the tips', async () => {
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/l/l-sprint14',
    );

    await expect.poll(() => text(harness, 'sidebar-spaces')).toContain('Sprint 14');
    expect(text(harness, 'sidebar-favorites')).toContain('Bugs critiques');
    expect(text(harness, 'sidebar-spaces')).toContain('Produit');
    expect(text(harness, 'sidebar-spaces')).toContain('40');
    expect(text(harness, 'sprint-progress')).toContain('7 / 25 · 28 %');
    expect(text(harness, 'sidebar-tips')).toContain('Connecter GitHub');
    const favorite: HTMLAnchorElement | null | undefined =
      harness.routeNativeElement?.querySelector('[data-testid="sidebar-favorites"] a');
    expect(favorite?.getAttribute('href')).toBe('/atelier-nord/l/l-bugs?savedView=sv-bugs');
  });

  it('hides the tips for good once dismissed', async () => {
    const harness: RouterTestingHarness = await RouterTestingHarness.create('/atelier-nord');
    await expect.poll(() => text(harness, 'sidebar-tips')).toContain('1 / 2');

    harness.routeNativeElement
      ?.querySelector<HTMLButtonElement>('[aria-label="Suggestion suivante"]')
      ?.click();
    expect(text(harness, 'sidebar-tips')).toContain('2 / 2');
    harness.routeNativeElement
      ?.querySelector<HTMLButtonElement>('[aria-label="Masquer les suggestions"]')
      ?.click();

    expect(text(harness, 'sidebar-tips')).toBe('');
    expect(JSON.parse(localStorage.getItem('cadenway-tips') ?? '[]')).toEqual(['github', 'mfa']);
  });

  it('shows an inline error whose Retry reads the spaces again', async () => {
    spaces.mockRejectedValueOnce(new Error('unavailable'));
    const harness: RouterTestingHarness = await RouterTestingHarness.create('/atelier-nord');
    await expect
      .poll(() => text(harness, 'sidebar-spaces'))
      .toContain('Impossible de charger les espaces.');

    harness.routeNativeElement
      ?.querySelector<HTMLButtonElement>('[data-testid="sidebar-spaces"] [role="alert"] button')
      ?.click();
    await expect.poll(() => text(harness, 'sidebar-spaces')).toContain('Produit');
    expect(spaces).toHaveBeenCalledTimes(2);
  });

  it('toggles the shell sidebar from the rail and marks it current on a list', async () => {
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/l/l-sprint14',
    );
    const item: HTMLButtonElement | null | undefined = harness.routeNativeElement?.querySelector(
      '[data-testid="spaces-rail-item"]',
    );

    item?.click();
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(item?.getAttribute('aria-current')).toBe('page');
    expect(item?.textContent).toContain('Espaces');
  });
});
