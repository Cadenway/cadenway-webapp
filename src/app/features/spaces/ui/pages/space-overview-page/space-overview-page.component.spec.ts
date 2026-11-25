import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  withComponentInputBinding,
  withErrorBoundaries,
  withRouterConfig,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { RouteErrorBoundary } from '@features/errors/ui/components/route-error-boundary/route-error-boundary.component';

import { SpacesApi } from '../../../data-access/services/spaces-api/spaces-api.service';
import type { Space } from '../../../models/space/space.interface';
import type { SpaceOverview } from '../../../models/task-list/task-list.interface';
import { SPACES_ROUTES } from '../../../spaces.routes';
import { SpacesNavigationStore } from '../../../state/spaces-navigation/spaces-navigation.store';

/**
 * Constant design
 *
 * @description
 * The mockup's private « Design » space.
 *
 * @type {Space}
 */
const design: Space = {
  id: 'sp-design',
  name: 'Design',
  description: 'Système de design et recherche utilisateur.',
  icon: 'paint',
  color: 'rose',
  private: true,
  statuses: [],
};

/**
 * Constant overview
 *
 * @description
 * Its two lists, one of them late.
 *
 * @type {SpaceOverview}
 */
const overview: SpaceOverview = {
  spaceId: 'sp-design',
  taskCount: 32,
  lists: [
    {
      list: {
        id: 'l-ds',
        spaceId: 'sp-design',
        name: 'Système de design',
        icon: null,
        color: 'gris',
        sprint: null,
        archived: false,
        canEdit: true,
        version: 1,
      },
      counts: { total: 32, open: 14, done: 12, cancelled: 0, late: 3 },
    },
  ],
};

describe('SpaceOverviewPage', () => {
  let api: Record<string, Mock>;

  beforeEach(() => {
    api = {
      space: vi.fn(() => Promise.resolve(design)),
      overview: vi.fn(() => Promise.resolve(overview)),
      milestones: vi.fn(() => Promise.resolve({ items: [], total: 0 })),
      spaces: vi.fn(() => Promise.resolve([design])),
      favorites: vi.fn(() => Promise.resolve([])),
      addFavorite: vi.fn(() =>
        Promise.resolve({
          id: 'f1',
          kind: 'space',
          targetId: 'sp-design',
          name: 'Design',
          listId: null,
        }),
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        provideRouter(
          [{ path: ':org', children: SPACES_ROUTES }],
          withComponentInputBinding(),
          withErrorBoundaries({ defaultErrorComponent: RouteErrorBoundary }),
          withRouterConfig({ paramsInheritanceStrategy: 'always' }),
        ),
        SpacesNavigationStore,
        {
          provide: WORKSPACE_CONTEXT,
          useValue: { organization: () => ({ id: 'org-1', slug: 'atelier-nord' }) },
        },
        { provide: SpacesApi, useValue: api },
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

  it('reuses a fresh sidebar overview', async () => {
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    TestBed.inject(SpacesNavigationStore);
    await expect.poll(() => api['overview'].mock.calls.length).toBe(1);
    await expect.poll(() => TestBed.inject(SpacesNavigationStore).overviews.hasValue()).toBe(true);
    await harness.navigateByUrl('/atelier-nord/spaces/sp-design');
    await expect.poll(() => text(harness, 'space-lists')).toContain('Système de design');
    expect(api['overview']).toHaveBeenCalledTimes(1);
  });

  it('retries a failed primary space read through the route boundary', async () => {
    api['space'].mockRejectedValueOnce(new Error('unavailable'));
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/spaces/sp-design',
    );
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.textContent;
      })
      .toContain('Réessayer');
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent.includes('Réessayer'))
      ?.click();
    await expect
      .poll(() => {
        harness.detectChanges();
        return api['space'].mock.calls.length;
      })
      .toBe(2);
    await expect.poll(() => text(harness, 'space-lists')).toContain('Système de design');
  });

  it('shows the list cards with their counts', async () => {
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/spaces/sp-design',
    );
    await expect.poll(() => text(harness, 'space-lists')).toContain('Système de design');

    const card: string = text(harness, 'list-card');
    expect(card).toContain('32 tâches');
    expect(card).toContain('12 / 32 terminées');
    expect(card).toContain('38%');
    expect(card).toContain('14 ouvertes');
    expect(card).toContain('3 en retard');
    expect(text(harness, 'space-meta')).toContain('1 liste');
    expect(harness.routeNativeElement?.querySelector('[aria-label="Espace privé"]')).not.toBeNull();
    expect(
      harness.routeNativeElement?.querySelector('[data-testid="list-card"]')?.getAttribute('href'),
    ).toBe('/atelier-nord/l/l-ds');
  });

  it('tells an empty space from a failed milestones read, whose Retry reads them again', async () => {
    api['overview'].mockResolvedValueOnce({ ...overview, taskCount: 0, lists: [] });
    api['milestones'].mockRejectedValueOnce(new Error('unavailable'));
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/spaces/sp-design',
    );

    await expect.poll(() => text(harness, 'space-empty')).toContain('Aucune liste dans cet espace');
    await expect
      .poll(() => text(harness, 'space-milestones-failed'))
      .toContain('Impossible de charger les jalons');
    harness.routeNativeElement
      ?.querySelector<HTMLButtonElement>('[data-testid="space-milestones-failed"] button')
      ?.click();
    await expect.poll(() => api['milestones'].mock.calls.length).toBe(2);
  });

  it('adds the space to the favorites', async () => {
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/spaces/sp-design',
    );
    await expect.poll(() => text(harness, 'space-lists')).toContain('Système de design');
    await expect.poll(() => api['favorites'].mock.calls.length).toBe(1);

    const star: HTMLButtonElement | null | undefined = harness.routeNativeElement?.querySelector(
      '[data-testid="space-favorite"]',
    );
    expect(star?.getAttribute('aria-label')).toBe('Ajouter aux espaces favoris');
    star?.click();
    await expect.poll(() => api['addFavorite'].mock.calls.length).toBe(1);
    expect(api['addFavorite']).toHaveBeenCalledWith('space', 'sp-design');
    harness.detectChanges();
    expect(star?.getAttribute('aria-pressed')).toBe('true');
  });
});
