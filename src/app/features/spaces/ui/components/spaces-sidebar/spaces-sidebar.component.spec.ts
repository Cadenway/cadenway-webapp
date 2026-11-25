import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwSidebar } from '@cadenway/ui/components/sidebar';
import { CwToastService } from '@cadenway/ui/components/toast';
import { beforeEach, describe, expect, it, type Mock, type MockInstance, vi } from 'vitest';

import { SHELL_SIDEBAR } from '@shared/layout-slot';

import { ListsApi } from '../../../data-access/services/lists-api/lists-api.service';
import { SidebarApi } from '../../../data-access/services/sidebar-api/sidebar-api.service';
import { SpacesApi } from '../../../data-access/services/spaces-api/spaces-api.service';
import type { SpaceDetails } from '../../../models/space/space.interface';
import type { SpaceOverview, TaskList } from '../../../models/task-list/task-list.interface';
import { SpacesNavigationStore } from '../../../state/spaces-navigation/spaces-navigation.store';
import { todayIso } from '../../../utils/calendar-date/calendar-date.util';
import { SidebarFooterLinks } from '../sidebar-footer-links/sidebar-footer-links.component';
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
  imports: [CwSidebar, SidebarFooterLinks, SpacesRailItem, SpacesSidebar, SprintProgress],
  template: `
    <cw-spaces-rail-item />
    <cw-sidebar ariaLabel="Navigation">
      <cw-spaces-sidebar />
      <cw-sprint-progress />
      <cw-sidebar-footer-links />
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
 * @type {SpaceDetails}
 */
const produit: SpaceDetails = {
  id: 'sp-produit',
  name: 'Produit',
  prefix: 'CAD',
  canEdit: true,
  canManage: true,
  description: null,
  icon: null,
  color: 'violet',
  private: false,
  statuses: [],
};

describe('SpacesSidebar', () => {
  let spaces: Mock;
  let favorites: Mock;
  let overviewRead: Mock;
  let createSpace: Mock;
  let deleteSpace: Mock;
  let lists: Record<string, Mock>;

  beforeEach(() => {
    localStorage.removeItem('cadenway-tips');
    spaces = vi.fn(() => Promise.resolve([produit]));
    createSpace = vi.fn();
    deleteSpace = vi.fn(() => Promise.resolve());
    favorites = vi.fn(() =>
      Promise.resolve([
        {
          id: 'f1',
          kind: 'saved-view',
          targetId: 'sv-bugs',
          name: 'Bugs critiques',
          listId: 'l-bugs',
        },
        { id: 'f2', kind: 'space', targetId: 'sp-produit', name: 'Produit favori', listId: null },
      ]),
    );
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
    overviewRead = vi.fn(() => Promise.resolve(overview));
    lists = {
      create: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(() => Promise.resolve()),
      unarchive: vi.fn(() => Promise.resolve(list('l-backlog', 'Backlog'))),
      remove: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        provideRouter([
          { path: ':org', component: ShellStub },
          { path: ':org/l/:listId', component: ShellStub },
          { path: ':org/spaces/:spaceId', component: ShellStub },
        ]),
        SpacesNavigationStore,
        {
          provide: WORKSPACE_CONTEXT,
          useValue: {
            organization: () => ({ id: 'org-1', slug: 'atelier-nord', name: 'Atelier Nord' }),
          },
        },
        {
          provide: SHELL_SIDEBAR,
          useValue: {
            expanded: signal(true),
            toggleClaimed: signal(false),
            toggle: vi.fn(),
            claimToggle: vi.fn(),
          },
        },
        {
          provide: SpacesApi,
          useValue: {
            spaces,
            overview: overviewRead,
            favorites,
            createSpace,
            updateSpace: vi.fn(),
            deleteSpace,
          },
        },
        { provide: ListsApi, useValue: lists },
        {
          provide: SidebarApi,
          useValue: {
            seats: vi.fn(() => Promise.resolve({ plan: 'team', free: 7 })),
            trashCount: vi.fn(() => Promise.resolve(2)),
            archiveCount: vi.fn(() => Promise.resolve(5)),
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

  /**
   * Function menuItem
   *
   * @description
   * The item of the open menu whose text contains a label.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @param {string} label - Part of its text.
   * @returns {HTMLButtonElement | undefined} The item.
   */
  function menuItem(harness: RouterTestingHarness, label: string): HTMLButtonElement | undefined {
    harness.detectChanges();
    return [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(
      (item: HTMLButtonElement) => item.textContent.includes(label),
    );
  }

  /**
   * Function rightClick
   *
   * @description
   * Opens the context menu of an element.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @param {Element | null | undefined} element - The element.
   */
  function rightClick(harness: RouterTestingHarness, element: Element | null | undefined): void {
    element?.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }),
    );
    harness.detectChanges();
  }

  /**
   * Function sidebarLink
   *
   * @description
   * A link of the sidebar's spaces by its text.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @param {string} label - Its text.
   * @returns {HTMLAnchorElement | undefined} The link.
   */
  function sidebarLink(
    harness: RouterTestingHarness,
    label: string,
  ): HTMLAnchorElement | undefined {
    return [
      ...(harness.routeNativeElement?.querySelectorAll<HTMLAnchorElement>(
        '[data-testid="sidebar-spaces"] a',
      ) ?? []),
    ].find((link: HTMLAnchorElement) => link.textContent.includes(label));
  }

  it('lists the favorite views, the spaces with their counts, the sprint progress and the tips', async () => {
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/l/l-sprint14',
    );

    await expect.poll(() => text(harness, 'sidebar-spaces')).toContain('Sprint 14');
    expect(text(harness, 'sidebar-favorites')).toContain('Bugs critiques');
    expect(text(harness, 'sidebar-favorites')).not.toContain('Produit favori');
    expect(text(harness, 'sidebar-spaces')).toContain('Produit');
    expect(text(harness, 'sidebar-spaces')).toContain('40');
    expect(text(harness, 'sprint-progress')).toContain('7 / 25 · 28 %');
    expect(text(harness, 'sidebar-tips')).toContain('Connecter GitHub');
    const favorite: HTMLAnchorElement | null | undefined =
      harness.routeNativeElement?.querySelector('[data-testid="sidebar-favorites"] a');
    expect(favorite?.getAttribute('href')).toBe('/atelier-nord/l/l-bugs?savedView=sv-bugs');
    expect(
      harness.routeNativeElement
        ?.querySelector('[aria-label="Modifier l’espace Produit"]')
        ?.getAttribute('title'),
    ).toBe('Modifier l’espace Produit');
  });

  it('shows the favorite spaces in the rail, which open their overview', async () => {
    const harness: RouterTestingHarness = await RouterTestingHarness.create('/atelier-nord');
    await expect.poll(() => text(harness, 'rail-spaces')).toContain('Produit');

    harness.routeNativeElement
      ?.querySelector<HTMLButtonElement>('[data-testid="rail-spaces"] button')
      ?.click();
    await expect.poll(() => TestBed.inject(Router).url).toBe('/atelier-nord/spaces/sp-produit');
    harness.detectChanges();
    expect(
      harness.routeNativeElement
        ?.querySelector('[data-testid="rail-spaces"] button')
        ?.getAttribute('aria-current'),
    ).toBe('page');
  });

  it('opens the spaces screen from the rail and marks it current on a list', async () => {
    const harness: RouterTestingHarness = await RouterTestingHarness.create('/atelier-nord');
    await expect.poll(() => text(harness, 'sidebar-spaces')).toContain('Backlog');
    const item: HTMLButtonElement | null | undefined = harness.routeNativeElement?.querySelector(
      '[data-testid="spaces-rail-item"]',
    );

    item?.click();
    await expect.poll(() => TestBed.inject(Router).url).toBe('/atelier-nord/spaces/sp-produit');
    await harness.navigateByUrl('/atelier-nord/l/l-sprint14');
    await harness.navigateByUrl('/atelier-nord');
    harness.routeNativeElement
      ?.querySelector<HTMLButtonElement>('[data-testid="spaces-rail-item"]')
      ?.click();
    await expect.poll(() => TestBed.inject(Router).url).toBe('/atelier-nord/l/l-sprint14');
    harness.detectChanges();
    const current: HTMLButtonElement | null | undefined = harness.routeNativeElement?.querySelector(
      '[data-testid="spaces-rail-item"]',
    );
    expect(current?.getAttribute('aria-current')).toBe('page');
    expect(current?.hasAttribute('aria-expanded')).toBe(false);
    expect(current?.textContent).toContain('Espaces');
  });

  it('offers the invitation with the free seats and hides the tips for good once dismissed', async () => {
    const harness: RouterTestingHarness = await RouterTestingHarness.create('/atelier-nord');
    await expect.poll(() => text(harness, 'sidebar-tips')).toContain('1 / 3');

    harness.routeNativeElement
      ?.querySelector<HTMLButtonElement>('[aria-label="Suggestion suivante"]')
      ?.click();
    expect(text(harness, 'sidebar-tips')).toContain('Inviter votre équipe');
    expect(text(harness, 'sidebar-tips')).toContain('7 sièges libres sur votre plan Équipe.');
    expect(
      harness.routeNativeElement
        ?.querySelector('[data-testid="sidebar-tips"] a')
        ?.getAttribute('href'),
    ).toBe('/atelier-nord/organization/members');
    harness.routeNativeElement
      ?.querySelector<HTMLButtonElement>('[aria-label="Masquer les suggestions"]')
      ?.click();

    expect(text(harness, 'sidebar-tips')).toBe('');
    expect(JSON.parse(localStorage.getItem('cadenway-tips') ?? '[]')).toEqual([
      'github',
      'invite',
      'mfa',
    ]);
  });

  it('shows the trash and archive rows with their counts', async () => {
    const harness: RouterTestingHarness = await RouterTestingHarness.create('/atelier-nord');

    await expect.poll(() => text(harness, 'sidebar-trash')).toContain('Corbeille2');
    expect(text(harness, 'sidebar-archives')).toContain('Archives5');
    expect(
      harness.routeNativeElement
        ?.querySelector('[data-testid="sidebar-archives"]')
        ?.getAttribute('href'),
    ).toBe('/atelier-nord/archives');
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

  it('offers retry for failed favorites and space overview reads', async () => {
    favorites.mockRejectedValueOnce(new Error('unavailable'));
    overviewRead.mockRejectedValueOnce(new Error('unavailable'));
    const harness: RouterTestingHarness = await RouterTestingHarness.create('/atelier-nord');
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.textContent;
      })
      .toContain('Impossible de charger les favoris');
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.textContent;
      })
      .toContain('Impossible de charger les listes');
    const alerts: NodeListOf<Element> | undefined =
      harness.routeNativeElement?.querySelectorAll('[role="alert"]');
    alerts?.forEach((alert: Element) => {
      alert.querySelector<HTMLButtonElement>('button')?.click();
    });
    await expect.poll(() => favorites.mock.calls.length).toBe(2);
    await expect.poll(() => overviewRead.mock.calls.length).toBe(2);
    await expect.poll(() => text(harness, 'sidebar-favorites')).toContain('Bugs critiques');
  });

  it('archives a list from its context menu and brings it back with Annuler', async () => {
    const show: MockInstance<CwToastService['show']> = vi.spyOn(
      TestBed.inject(CwToastService),
      'show',
    );
    const harness: RouterTestingHarness = await RouterTestingHarness.create('/atelier-nord');
    await expect.poll(() => text(harness, 'sidebar-spaces')).toContain('Backlog');

    rightClick(harness, sidebarLink(harness, 'Backlog'));
    expect(menuItem(harness, 'Nouvelle tâche')).toBeDefined();
    expect(menuItem(harness, 'Modifier la liste')).toBeDefined();
    menuItem(harness, 'Archiver')?.click();

    await expect.poll(() => lists['archive'].mock.calls.length).toBe(1);
    await expect.poll(() => show.mock.calls.length).toBe(1);
    harness.detectChanges();
    expect(sidebarLink(harness, 'Backlog')).toBeUndefined();
    expect(show.mock.calls[0]?.[0]).toBe('Liste archivée');
    show.mock.calls[0]?.[1]?.undo?.();
    await expect.poll(() => lists['unarchive'].mock.calls.length).toBe(1);
    expect(lists['unarchive']).toHaveBeenCalledWith('l-backlog');
  });

  it('creates a space from the Espaces heading and opens its first list', async () => {
    createSpace.mockResolvedValueOnce({
      space: { ...produit, id: 'sp-rh', name: 'Ressources humaines', prefix: 'RES' },
      firstList: { ...list('l-first', 'Première liste'), spaceId: 'sp-rh' },
    });
    const harness: RouterTestingHarness = await RouterTestingHarness.create('/atelier-nord');
    await expect.poll(() => text(harness, 'sidebar-spaces')).toContain('Backlog');

    harness.routeNativeElement
      ?.querySelector<HTMLButtonElement>('[aria-label="Créer un espace"]')
      ?.click();
    harness.detectChanges();
    const name: HTMLInputElement | null = document.querySelector(
      '[data-testid="space-dialog-name"]',
    );
    if (!name) throw new Error('No dialog');
    name.value = 'Ressources humaines';
    name.dispatchEvent(new Event('input'));
    harness.detectChanges();
    expect(
      document.querySelector<HTMLInputElement>('[data-testid="space-dialog-prefix"]')?.value,
    ).toBe('RES');
    document.querySelector<HTMLButtonElement>('[data-testid="space-dialog-submit"]')?.click();

    await expect.poll(() => TestBed.inject(Router).url).toBe('/atelier-nord/l/l-first');
    expect(createSpace.mock.calls[0][0]).toMatchObject({
      name: 'Ressources humaines',
      prefix: 'RES',
      private: false,
    });
  });

  it('deletes a space from its context menu once its name is typed', async () => {
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/spaces/sp-produit',
    );
    await expect.poll(() => text(harness, 'sidebar-spaces')).toContain('Backlog');

    rightClick(
      harness,
      harness.routeNativeElement?.querySelector('[data-testid="sidebar-spaces"] cw-sidebar-space'),
    );
    menuItem(harness, 'Supprimer l’espace')?.click();
    harness.detectChanges();
    const dialog: Element | null = document.querySelector('[data-testid="space-delete-dialog"]');
    expect(document.body.textContent).toContain('Supprimer l’espace « Produit » ?');
    expect(document.body.textContent).toContain(
      '2 listes et 40 tâches : les tâches vont dans la corbeille',
    );
    expect(dialog).not.toBeNull();
    const confirm: HTMLInputElement | null = document.querySelector('[role="alertdialog"] input');
    if (!confirm) throw new Error('No confirmation field');
    confirm.value = 'Produit';
    confirm.dispatchEvent(new Event('input'));
    harness.detectChanges();
    [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')]
      .find((button: HTMLButtonElement) => button.textContent.includes('Supprimer l’espace'))
      ?.click();

    await expect.poll(() => deleteSpace.mock.calls.length).toBe(1);
    expect(deleteSpace).toHaveBeenCalledWith('sp-produit');
    await expect.poll(() => TestBed.inject(Router).url).toBe('/atelier-nord');
  });

  it('expands and collapses every space from the background menu', async () => {
    const harness: RouterTestingHarness = await RouterTestingHarness.create('/atelier-nord');
    await expect.poll(() => text(harness, 'sidebar-spaces')).toContain('Backlog');
    const navigation: InstanceType<typeof SpacesNavigationStore> =
      TestBed.inject(SpacesNavigationStore);

    rightClick(
      harness,
      harness.routeNativeElement?.querySelector('[data-testid="sidebar-background"]'),
    );
    menuItem(harness, 'Déplier tous les espaces')?.click();
    expect(navigation.expanded()).toEqual({ 'sp-produit': true });
    rightClick(
      harness,
      harness.routeNativeElement?.querySelector('[data-testid="sidebar-background"]'),
    );
    menuItem(harness, 'Replier tous les espaces')?.click();
    expect(navigation.expanded()).toEqual({});
  });
});
