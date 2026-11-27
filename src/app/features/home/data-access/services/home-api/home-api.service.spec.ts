import type { HttpContext } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  type GetHomeClientResult,
  type ListMembersClientResult,
  MembersService,
  MyTasksService,
} from '@cadenway/api-client';
import { NEVER, type Observable, of } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { PASSIVE_REQUEST } from '@core/api';
import type { Person } from '@features/task';

import type { HomeSnapshot } from '../../../models/home-read/home-read.interface';
import { HomeApi } from './home-api.service';

/**
 * Constant home
 *
 * @description
 * Camille Martin's home screen in Atelier Nord, without tasks or lists.
 *
 * @type {GetHomeClientResult}
 */
const home: GetHomeClientResult = {
  stats: { assigned: 9, late: 2, dueToday: 1, done: 31 },
  priorities: [],
  sprints: [],
  lists: [],
};

describe('HomeApi', () => {
  let getHome: Mock<
    (
      params: { today: string },
      options: { context: HttpContext; cache: string },
    ) => Observable<GetHomeClientResult>
  >;
  let listMembers: Mock<(params: { cursor?: string }) => Observable<ListMembersClientResult>>;

  beforeEach(() => {
    getHome = vi.fn(() => of(home));
    listMembers = vi.fn(
      (params: { cursor?: string }) =>
        of(
          params.cursor
            ? {
                items: [
                  {
                    userId: 'u-ines',
                    name: 'Inès Robert',
                    email: 'ines@ateliernord.test',
                    role: 'member',
                  },
                ],
                nextCursor: null,
              }
            : {
                items: [
                  {
                    userId: 'u-camille',
                    name: 'Camille Martin',
                    email: 'camille@ateliernord.test',
                    role: 'owner',
                  },
                ],
                nextCursor: 'c2',
              },
        ) as Observable<ListMembersClientResult>,
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: MyTasksService, useValue: { getHome } },
        { provide: MembersService, useValue: { listMembers } },
      ],
    });
  });

  it('reads the home screen of the given day without the cache, passive when asked', async () => {
    const api: HomeApi = TestBed.inject(HomeApi);

    const snapshot: HomeSnapshot = await api.read('2026-11-12', { passive: true });

    expect(snapshot.stats).toEqual({ assigned: 9, late: 2, dueToday: 1, done: 31 });
    expect(getHome.mock.calls[0][0]).toEqual({ today: '2026-11-12' });
    expect(getHome.mock.calls[0][1].cache).toBe('no-store');
    expect(getHome.mock.calls[0][1].context.get(PASSIVE_REQUEST)).toBe(true);
  });

  it('rejects an aborted read', async () => {
    getHome.mockReturnValueOnce(NEVER);
    const api: HomeApi = TestBed.inject(HomeApi);
    const controller: AbortController = new AbortController();

    const reading: Promise<HomeSnapshot> = api.read('2026-11-12', {
      passive: false,
      signal: controller.signal,
    });
    controller.abort();

    await expect(reading).rejects.toThrow();
  });

  it('reads the assignable members to the last page', async () => {
    const api: HomeApi = TestBed.inject(HomeApi);

    const people: readonly Person[] = await api.people();

    expect(people.map((person: Person) => person.name)).toEqual(['Camille Martin', 'Inès Robert']);
    expect(listMembers).toHaveBeenCalledTimes(2);
    expect(listMembers.mock.calls[1][0]).toEqual(expect.objectContaining({ cursor: 'c2' }));
  });
});
