import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { type CreatedTask, TaskCreate } from '@features/task';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { ListsApi } from '../../data-access/services/lists-api/lists-api.service';
import { SidebarApi } from '../../data-access/services/sidebar-api/sidebar-api.service';
import { SpacesApi } from '../../data-access/services/spaces-api/spaces-api.service';
import type { SpaceDetails } from '../../models/space/space.interface';
import type { NavigationRefreshPort } from '../../ports/navigation-refresh/navigation-refresh-port.interface';
import { NAVIGATION_REFRESH } from '../../ports/navigation-refresh/navigation-refresh.token';
import type { SpaceDirectoryPort } from '../../ports/space-directory/space-directory-port.interface';
import { SPACE_DIRECTORY } from '../../ports/space-directory/space-directory.token';
import { SpacesNavigationStore } from '../../state/spaces-navigation/spaces-navigation.store';
import { provideSpacesNavigation } from './spaces-navigation.provider';

/**
 * Function space
 *
 * @description
 * A space of Atelier Nord as the sidebar reads it.
 *
 * @param {Partial<SpaceDetails> & Pick<SpaceDetails, 'id' | 'name'>} overrides - Its fields.
 * @returns {SpaceDetails} The space.
 */
function space(overrides: Partial<SpaceDetails> & Pick<SpaceDetails, 'id' | 'name'>): SpaceDetails {
  return {
    prefix: overrides.name.slice(0, 3).toUpperCase(),
    canEdit: true,
    callerRole: 'edit',
    canManage: true,
    version: 1,
    description: null,
    icon: null,
    color: 'gris',
    private: false,
    statuses: [],
    ...overrides,
  };
}

describe('provideSpacesNavigation', () => {
  let spacesApi: {
    readonly spaces: Mock;
    readonly overview: Mock;
    readonly favorites: Mock;
  };
  let sidebar: { readonly trashCount: Mock; readonly archiveCount: Mock };

  beforeEach(() => {
    spacesApi = {
      spaces: vi.fn(() =>
        Promise.resolve([
          space({ id: 'sp-product', name: 'Product', icon: 'rocket', color: 'violet' }),
          space({ id: 'sp-design', name: 'Design', canEdit: false, callerRole: 'comment' }),
          space({ id: 'sp-shared', name: 'Shared', canEdit: false, callerRole: null }),
        ]),
      ),
      overview: vi.fn((spaceId: string) => Promise.resolve({ spaceId, taskCount: 0, lists: [] })),
      favorites: vi.fn(() => Promise.resolve([])),
    };
    sidebar = {
      trashCount: vi.fn(() => Promise.resolve(2)),
      archiveCount: vi.fn(() => Promise.resolve(3)),
    };
    TestBed.configureTestingModule({
      providers: [
        provideSpacesNavigation(),
        { provide: SpacesApi, useValue: spacesApi },
        { provide: ListsApi, useValue: {} },
        { provide: SidebarApi, useValue: sidebar },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: { organization: signal({ id: 'org-1', slug: 'atelier-nord' }) },
        },
        { provide: TaskCreate, useValue: { created: new Subject<CreatedTask>().asObservable() } },
      ],
    });
  });

  it('lists no space before the read, then each space with its mark and the caller role', async () => {
    const directory: SpaceDirectoryPort = TestBed.inject(SPACE_DIRECTORY);
    TestBed.inject(SpacesNavigationStore);

    expect(directory.spaces()).toEqual([]);
    await expect.poll(() => directory.spaces().length).toBe(3);
    expect(directory.spaces()).toEqual([
      {
        id: 'sp-product',
        name: 'Product',
        icon: 'phosphorRocketBold',
        tone: 'text-amethyste',
        callerRole: 'edit',
      },
      {
        id: 'sp-design',
        name: 'Design',
        icon: null,
        tone: 'text-muted-foreground',
        callerRole: 'comment',
      },
      {
        id: 'sp-shared',
        name: 'Shared',
        icon: null,
        tone: 'text-muted-foreground',
        callerRole: null,
      },
    ]);
  });

  it('lists no space when the read failed', async () => {
    spacesApi.spaces.mockImplementation(() => Promise.reject(new Error('unavailable')));
    const directory: SpaceDirectoryPort = TestBed.inject(SPACE_DIRECTORY);
    const store: InstanceType<typeof SpacesNavigationStore> = TestBed.inject(SpacesNavigationStore);

    await expect.poll(() => store.spaces.status()).toBe('error');
    expect(directory.spaces()).toEqual([]);
  });

  it('reads the spaces, the favorites and the counts again on refresh', async () => {
    const refresh: NavigationRefreshPort = TestBed.inject(NAVIGATION_REFRESH);
    const store: InstanceType<typeof SpacesNavigationStore> = TestBed.inject(SpacesNavigationStore);
    store.request(['favorites', 'overviews', 'counts']);
    await expect.poll(() => store.overviews.status()).toBe('resolved');
    await expect
      .poll(
        () =>
          store.favorites.status() === 'resolved' &&
          store.trashCount.status() === 'resolved' &&
          store.archiveCount.status() === 'resolved',
      )
      .toBe(true);

    refresh.refresh();

    await expect.poll(() => spacesApi.spaces.mock.calls.length).toBe(2);
    await expect.poll(() => spacesApi.favorites.mock.calls.length).toBe(2);
    await expect.poll(() => sidebar.trashCount.mock.calls.length).toBe(2);
    await expect.poll(() => sidebar.archiveCount.mock.calls.length).toBe(2);
  });

  it('reads only the counts again on refreshCounts, once more after a first read in flight', async () => {
    let answer: (count: number) => void = (): void => undefined;
    sidebar.archiveCount.mockImplementationOnce(
      () =>
        new Promise<number>((resolve: (count: number) => void): void => {
          answer = resolve;
        }),
    );
    const refresh: NavigationRefreshPort = TestBed.inject(NAVIGATION_REFRESH);
    const store: InstanceType<typeof SpacesNavigationStore> = TestBed.inject(SpacesNavigationStore);
    store.request(['favorites', 'overviews', 'counts']);
    await expect.poll(() => sidebar.archiveCount.mock.calls.length).toBe(1);
    await expect.poll(() => store.trashCount.status()).toBe('resolved');

    refresh.refreshCounts();
    answer(1);

    await expect.poll(() => sidebar.trashCount.mock.calls.length).toBe(2);
    await expect.poll(() => sidebar.archiveCount.mock.calls.length).toBe(2);
    await expect.poll(() => store.archiveCount.value()).toBe(3);
    expect(spacesApi.spaces).toHaveBeenCalledTimes(1);
    expect(spacesApi.favorites).toHaveBeenCalledTimes(1);
  });
});
