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
import { beforeEach, describe, expect, it, type Mock, type MockInstance, vi } from 'vitest';

import { RuntimeConfigStore } from '@core/config';
import { RouteErrorBoundary } from '@features/errors/ui/components/route-error-boundary/route-error-boundary.component';

import { SpacesApi } from '../../../data-access/services/spaces-api/spaces-api.service';
import { CwToastService } from '@cadenway/ui/components/toast';

import { SidebarApi } from '../../../data-access/services/sidebar-api/sidebar-api.service';
import type { Space, SpaceDetails } from '../../../models/space/space.interface';
import type { SpaceOverview } from '../../../models/task-list/task-list.interface';
import { SPACES_ROUTES } from '../../../spaces.routes';
import { SpacesNavigationStore } from '../../../state/spaces-navigation/spaces-navigation.store';

/**
 * Constant design
 *
 * @description
 * The mockup's private `Design` space.
 *
 * @type {SpaceDetails}
 */
const design: SpaceDetails = {
  id: 'sp-design',
  name: 'Design',
  prefix: 'DES',
  canEdit: true,
  callerRole: 'edit',
  canManage: true,
  version: 3,
  description: 'Design system and user research.',
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
        name: 'Design system',
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
          provide: RuntimeConfigStore,
          useValue: { config: () => ({ apiUrl: 'http://api.test' }) },
        },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: { organization: () => ({ id: 'org-1', slug: 'atelier-nord' }) },
        },
        { provide: SpacesApi, useValue: api },
        {
          provide: SidebarApi,
          useValue: {
            trashCount: vi.fn(() => Promise.resolve(0)),
            archiveCount: vi.fn(() => Promise.resolve(0)),
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

  it('reuses a fresh sidebar overview', async () => {
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    TestBed.inject(SpacesNavigationStore);
    await expect.poll(() => api['overview'].mock.calls.length).toBe(1);
    await expect.poll(() => TestBed.inject(SpacesNavigationStore).overviews.hasValue()).toBe(true);
    await harness.navigateByUrl('/atelier-nord/spaces/sp-design');
    await expect.poll(() => text(harness, 'space-lists')).toContain('Design system');
    expect(api['overview']).toHaveBeenCalledTimes(1);
  });

  it('reads the overview once when it opens before the sidebar has read the spaces', async () => {
    let listSpaces: (value: readonly Space[]) => void = () => undefined;
    api['spaces'].mockImplementationOnce(
      () =>
        new Promise<readonly Space[]>((resolve: (value: readonly Space[]) => void) => {
          listSpaces = resolve;
        }),
    );
    const created: Promise<RouterTestingHarness> = RouterTestingHarness.create(
      '/atelier-nord/spaces/sp-design',
    );
    await expect.poll(() => api['overview'].mock.calls.length).toBe(1);
    listSpaces([design]);
    const harness: RouterTestingHarness = await created;
    const navigation: InstanceType<typeof SpacesNavigationStore> =
      TestBed.inject(SpacesNavigationStore);

    await expect.poll(() => navigation.overviews.value()?.['sp-design']).toEqual(overview);
    expect(text(harness, 'list-card')).toContain('32 tasks');
    expect(api['overview']).toHaveBeenCalledTimes(1);
  });

  it('follows the sidebar overview of the space once it changes', async () => {
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/spaces/sp-design',
    );
    await expect.poll(() => text(harness, 'list-card')).toContain('32 tasks');
    const navigation: InstanceType<typeof SpacesNavigationStore> =
      TestBed.inject(SpacesNavigationStore);
    await expect.poll(() => navigation.overviews.hasValue()).toBe(true);

    api['overview'].mockResolvedValueOnce({
      ...overview,
      taskCount: 33,
      lists: [{ ...overview.lists[0], counts: { ...overview.lists[0].counts, total: 33 } }],
    });
    navigation.overviews.reload();

    await expect.poll(() => text(harness, 'list-card')).toContain('33 tasks');
  });

  it('keeps a sidebar overview read after its own began, even while its own runs', async () => {
    const navigation: InstanceType<typeof SpacesNavigationStore> =
      TestBed.inject(SpacesNavigationStore);
    let answer: (value: SpaceOverview) => void = () => undefined;
    api['overview'].mockRejectedValueOnce(new Error('unavailable'));
    api['overview'].mockImplementationOnce(
      () =>
        new Promise<SpaceOverview>((resolve: (value: SpaceOverview) => void) => {
          answer = resolve;
        }),
    );
    await expect.poll(() => navigation.overviews.hasValue()).toBe(true);
    const created: Promise<RouterTestingHarness> = RouterTestingHarness.create(
      '/atelier-nord/spaces/sp-design',
    );
    await expect.poll(() => api['overview'].mock.calls.length).toBe(2);

    api['overview'].mockResolvedValueOnce({
      ...overview,
      taskCount: 34,
      lists: [{ ...overview.lists[0], counts: { ...overview.lists[0].counts, total: 34 } }],
    });
    navigation.overviews.reload();
    await expect
      .poll(() =>
        navigation.overviews.hasValue()
          ? (navigation.overviews.value()['sp-design'] as SpaceOverview | undefined)?.taskCount
          : undefined,
      )
      .toBe(34);
    TestBed.tick();
    answer(overview);
    const harness: RouterTestingHarness = await created;

    await expect.poll(() => text(harness, 'list-card')).toContain('34 tasks');
  });

  it('keeps its own read over a sidebar read begun before it, and gives it to the sidebar', async () => {
    let finish: (value: SpaceOverview) => void = () => undefined;
    api['overview'].mockImplementationOnce(
      () =>
        new Promise<SpaceOverview>((resolve: (value: SpaceOverview) => void) => {
          finish = resolve;
        }),
    );
    const navigation: InstanceType<typeof SpacesNavigationStore> =
      TestBed.inject(SpacesNavigationStore);
    await expect.poll(() => api['overview'].mock.calls.length).toBe(1);

    const created: Promise<RouterTestingHarness> = RouterTestingHarness.create(
      '/atelier-nord/spaces/sp-design',
    );
    await expect.poll(() => api['overview'].mock.calls.length).toBe(2);
    TestBed.tick();
    finish({
      ...overview,
      taskCount: 30,
      lists: [{ ...overview.lists[0], counts: { ...overview.lists[0].counts, total: 30 } }],
    });
    const harness: RouterTestingHarness = await created;
    await expect.poll(() => navigation.overviews.status()).toBe('resolved');

    expect(navigation.overviews.value()?.['sp-design'].taskCount).toBe(32);

    expect(text(harness, 'list-card')).toContain('32 tasks');
  });

  it('gives its own read to a sidebar that failed to read the space', async () => {
    const navigation: InstanceType<typeof SpacesNavigationStore> =
      TestBed.inject(SpacesNavigationStore);
    api['overview'].mockRejectedValueOnce(new Error('unavailable'));
    await expect.poll(() => navigation.overviews.hasValue()).toBe(true);
    expect(navigation.overviews.value()).toEqual({});

    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/spaces/sp-design',
    );

    await expect.poll(() => text(harness, 'list-card')).toContain('32 tasks');
    expect(navigation.overviews.value()?.['sp-design']).toEqual(overview);
  });

  it('never brings its offered read back after a newer sidebar read and a failed one', async () => {
    const navigation: InstanceType<typeof SpacesNavigationStore> =
      TestBed.inject(SpacesNavigationStore);
    api['overview'].mockRejectedValueOnce(new Error('unavailable'));
    await expect.poll(() => navigation.overviews.hasValue()).toBe(true);
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/spaces/sp-design',
    );
    await expect.poll(() => navigation.overviews.value()?.['sp-design']).toEqual(overview);

    api['overview'].mockResolvedValueOnce({
      ...overview,
      taskCount: 33,
      lists: [{ ...overview.lists[0], counts: { ...overview.lists[0].counts, total: 33 } }],
    });
    navigation.overviews.reload();
    await expect.poll(() => text(harness, 'list-card')).toContain('33 tasks');
    api['overview'].mockRejectedValueOnce(new Error('unavailable'));
    navigation.overviews.reload();
    await expect.poll(() => navigation.overviews.status()).toBe('resolved');

    expect(navigation.overviews.value()).toEqual({});
    expect(text(harness, 'list-card')).toContain('33 tasks');
  });

  it('recovers a failed own read with a newer sidebar value received during it', async () => {
    const navigation: InstanceType<typeof SpacesNavigationStore> =
      TestBed.inject(SpacesNavigationStore);
    let fail: (reason: Error) => void = () => undefined;
    api['overview'].mockRejectedValueOnce(new Error('unavailable'));
    api['overview'].mockImplementationOnce(
      () =>
        new Promise<SpaceOverview>(
          (_resolve: (value: SpaceOverview) => void, reject: (reason: Error) => void) => {
            fail = reject;
          },
        ),
    );
    await expect.poll(() => navigation.overviews.hasValue()).toBe(true);
    const created: Promise<RouterTestingHarness> = RouterTestingHarness.create(
      '/atelier-nord/spaces/sp-design',
    );
    await expect.poll(() => api['overview'].mock.calls.length).toBe(2);

    api['overview'].mockResolvedValueOnce({
      ...overview,
      taskCount: 34,
      lists: [{ ...overview.lists[0], counts: { ...overview.lists[0].counts, total: 34 } }],
    });
    navigation.overviews.reload();
    await expect
      .poll(() =>
        navigation.overviews.hasValue()
          ? (navigation.overviews.value()['sp-design'] as SpaceOverview | undefined)?.taskCount
          : undefined,
      )
      .toBe(34);
    fail(new Error('unavailable'));
    const harness: RouterTestingHarness = await created;

    await expect.poll(() => text(harness, 'list-card')).toContain('34 tasks');
  });

  it('reads on its own instead of waiting for a slow sidebar read of another space', async () => {
    const other: Space = { ...design, id: 'sp-marketing', name: 'Marketing' };
    let release: (value: SpaceOverview) => void = () => undefined;
    api['spaces'].mockResolvedValue([design, other]);
    api['overview'].mockImplementation((spaceId: string) =>
      spaceId === other.id
        ? new Promise<SpaceOverview>((resolve: (value: SpaceOverview) => void) => {
            release = resolve;
          })
        : Promise.resolve(overview),
    );
    TestBed.inject(SpacesNavigationStore);
    await expect.poll(() => api['overview'].mock.calls.length).toBe(2);

    const created: Promise<RouterTestingHarness> = RouterTestingHarness.create(
      '/atelier-nord/spaces/sp-design',
    );
    await expect.poll(() => api['overview'].mock.calls.length).toBe(3);
    release({ ...overview, spaceId: other.id, taskCount: 0, lists: [] });
    const harness: RouterTestingHarness = await created;

    await expect.poll(() => text(harness, 'list-card')).toContain('32 tasks');
  });

  it('shows the sidebar value at once while the sidebar reads again, then its newer one', async () => {
    const navigation: InstanceType<typeof SpacesNavigationStore> =
      TestBed.inject(SpacesNavigationStore);
    await expect.poll(() => navigation.overviews.hasValue()).toBe(true);
    let finish: (value: SpaceOverview) => void = () => undefined;
    api['overview'].mockImplementationOnce(
      () =>
        new Promise<SpaceOverview>((resolve: (value: SpaceOverview) => void) => {
          finish = resolve;
        }),
    );
    navigation.overviews.reload();
    await expect.poll(() => navigation.overviews.isLoading()).toBe(true);
    const created: Promise<RouterTestingHarness> = RouterTestingHarness.create(
      '/atelier-nord/spaces/sp-design',
    );
    await expect.poll(() => api['space'].mock.calls.length).toBe(1);
    TestBed.tick();
    finish({
      ...overview,
      taskCount: 33,
      lists: [{ ...overview.lists[0], counts: { ...overview.lists[0].counts, total: 33 } }],
    });
    const harness: RouterTestingHarness = await created;

    await expect.poll(() => text(harness, 'list-card')).toContain('33 tasks');
    expect(api['overview']).toHaveBeenCalledTimes(2);
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
      .toContain('Retry');
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent.includes('Retry'))
      ?.click();
    await expect
      .poll(() => {
        harness.detectChanges();
        return api['space'].mock.calls.length;
      })
      .toBe(2);
    await expect.poll(() => text(harness, 'space-lists')).toContain('Design system');
  });

  it('shows the list cards with their counts', async () => {
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/spaces/sp-design',
    );
    await expect.poll(() => text(harness, 'space-lists')).toContain('Design system');

    const card: string = text(harness, 'list-card');
    expect(card).toContain('32 tasks');
    expect(card).toContain('12 / 32 done');
    expect(card).toContain('38%');
    expect(card).toContain('14 open');
    expect(card).toContain('3 late');
    expect(text(harness, 'space-meta')).toContain('1 list');
    expect(
      harness.routeNativeElement?.querySelector('[aria-label="Private space"]'),
    ).not.toBeNull();
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

    await expect.poll(() => text(harness, 'space-empty')).toContain('No list in this space');
    await expect
      .poll(() => text(harness, 'space-milestones-failed'))
      .toContain('The milestones could not be loaded');
    harness.routeNativeElement
      ?.querySelector<HTMLButtonElement>('[data-testid="space-milestones-failed"] button')
      ?.click();
    await expect.poll(() => api['milestones'].mock.calls.length).toBe(2);
  });

  it('adds the space to the favorites', async () => {
    const show: MockInstance<CwToastService['show']> = vi.spyOn(
      TestBed.inject(CwToastService),
      'show',
    );
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/spaces/sp-design',
    );
    await expect.poll(() => text(harness, 'space-lists')).toContain('Design system');
    await expect.poll(() => api['favorites'].mock.calls.length).toBe(1);

    const star: HTMLButtonElement | null | undefined = harness.routeNativeElement?.querySelector(
      '[data-testid="space-favorite"]',
    );
    expect(star?.getAttribute('aria-label')).toBe('Add to favorite spaces');
    star?.click();
    await expect.poll(() => api['addFavorite'].mock.calls.length).toBe(1);
    expect(api['addFavorite']).toHaveBeenCalledWith('space', 'sp-design');
    harness.detectChanges();
    expect(star?.getAttribute('aria-pressed')).toBe('true');
    await expect.poll(() => show.mock.calls.length).toBe(1);
    expect(show).toHaveBeenCalledWith('Added to favorite spaces', { description: 'Design' });
  });

  it('opens the space dialog and the list dialog from the header buttons', async () => {
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/spaces/sp-design',
    );
    const navigation: InstanceType<typeof SpacesNavigationStore> =
      TestBed.inject(SpacesNavigationStore);
    await expect.poll(() => text(harness, 'space-lists')).toContain('Design system');
    await expect.poll(() => navigation.spaceById('sp-design')).toBeTruthy();
    const button: (id: string) => HTMLButtonElement | null | undefined = (id: string) => {
      harness.detectChanges();
      return harness.routeNativeElement?.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`);
    };

    expect(button('space-edit')?.textContent).toContain('Edit');
    button('space-edit')?.click();
    expect(navigation.dialog()).toEqual({ kind: 'space', space: design });
    button('space-new-sprint')?.click();
    expect(navigation.dialog()).toEqual({
      kind: 'list',
      spaceId: 'sp-design',
      list: null,
      sprint: true,
    });
    expect(button('space-new-list')?.textContent).toContain('New list');
    button('space-new-list')?.click();
    expect(navigation.dialog()).toMatchObject({ kind: 'list', sprint: false });
  });
});
