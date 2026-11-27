import type { HttpContext } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  type ListMembersClientResult,
  type ListMyTasksClientResult,
  MembersService,
  MyTasksService,
} from '@cadenway/api-client';
import { NEVER, type Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { PASSIVE_REQUEST } from '@core/api';
import type { Person, TaskSummary } from '@features/task';

import type { MyTasksPage } from '../../../models/my-tasks-read/my-tasks-read.interface';

import type { MyTaskDto } from '../../adapters/my-task/my-task.adapter';
import { MyTasksApi } from './my-tasks-api.service';

/**
 * Function dto
 *
 * @description
 * A task of `listMyTasks`, in Atelier Nord's `Sprint 14`.
 *
 * @param {string} key - Its key.
 * @returns {MyTaskDto} The task.
 */
function dto(key: string): MyTaskDto {
  return {
    key,
    name: 'Review of the SSO flow',
    status: 'todo',
    cancelReason: null,
    priority: 'haute',
    assignees: [{ userId: 'u-camille' }],
    dueDate: '2026-11-12',
    startDate: null,
    estimateMinutes: null,
    labels: [],
    parentKey: null,
    listId: 'l-sprint-14',
    spaceId: 'sp-product',
    subtaskCounts: { closed: 0, total: 0 },
    checklistCounts: { done: 0, total: 0 },
    completedAt: null,
    createdAt: '2026-11-02T08:00:00Z',
    version: 1,
  };
}

/**
 * Function page
 *
 * @description
 * A page of `listMyTasks`.
 *
 * @param {readonly string[]} keys - The keys of its tasks.
 * @param {string | null} nextCursor - The cursor of the next page.
 * @param {number} open - The `To do` count.
 * @returns {ListMyTasksClientResult} The page.
 */
function page(
  keys: readonly string[],
  nextCursor: string | null,
  open: number = 3,
): ListMyTasksClientResult {
  return { items: keys.map(dto), nextCursor, counts: { open, closed: 12 } };
}

describe('MyTasksApi', () => {
  let listMyTasks: Mock<
    (
      params: { state: string; cursor?: string },
      options: { context: HttpContext },
    ) => Observable<ListMyTasksClientResult>
  >;
  let listMembers: Mock<(params: { cursor?: string }) => Observable<ListMembersClientResult>>;

  beforeEach(() => {
    listMyTasks = vi.fn();
    listMembers = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: MyTasksService, useValue: { listMyTasks } },
        { provide: MembersService, useValue: { listMembers } },
      ],
    });
  });

  it('reads a tab to its last page, each task once, with the counts of the last page', async () => {
    listMyTasks
      .mockReturnValueOnce(of(page(['CAD-482', 'CAD-475'], 'c2')))
      .mockReturnValueOnce(of(page(['CAD-475', 'CAD-470'], null, 4)));

    const read: MyTasksPage = await TestBed.inject(MyTasksApi).read('open', { passive: true });

    expect(read.tasks.map((task: TaskSummary) => task.key)).toEqual([
      'CAD-482',
      'CAD-475',
      'CAD-470',
    ]);
    expect(read.counts).toEqual({ open: 4, closed: 12 });
    expect(read.complete).toBe(true);
    expect(listMyTasks.mock.calls[0][0]).toMatchObject({ state: 'open', limit: 100 });
    expect(listMyTasks.mock.calls[1][0]).toMatchObject({ state: 'open', cursor: 'c2' });
    expect(listMyTasks.mock.calls[0][1].context.get(PASSIVE_REQUEST)).toBe(true);
  });

  it('rejects when the first page fails', async () => {
    listMyTasks.mockReturnValueOnce(throwError(() => new Error('unavailable')));

    await expect(TestBed.inject(MyTasksApi).read('closed', { passive: false })).rejects.toThrow(
      'unavailable',
    );
  });

  it('keeps the pages read before a failed later page and says it is incomplete', async () => {
    listMyTasks
      .mockReturnValueOnce(of(page(['CAD-482'], 'c2')))
      .mockReturnValueOnce(throwError(() => new Error('unavailable')));

    const read: MyTasksPage = await TestBed.inject(MyTasksApi).read('open', { passive: false });

    expect(read.tasks.map((task: TaskSummary) => task.key)).toEqual(['CAD-482']);
    expect(read.complete).toBe(false);
  });

  it('rejects an aborted read', async () => {
    const controller: AbortController = new AbortController();
    listMyTasks.mockReturnValueOnce(NEVER);

    const pending: Promise<unknown> = TestBed.inject(MyTasksApi).read('open', {
      passive: false,
      signal: controller.signal,
    });
    controller.abort();

    await expect(pending).rejects.toBeDefined();
  });

  it('reads the assignable members to the last page', async () => {
    listMembers
      .mockReturnValueOnce(
        of({
          items: [{ userId: 'u-camille', name: 'Camille Martin' }],
          nextCursor: 'm2',
        } as ListMembersClientResult),
      )
      .mockReturnValueOnce(
        of({
          items: [{ userId: 'u-ines', name: 'Inès Robert' }],
          nextCursor: null,
        } as ListMembersClientResult),
      );

    const people: readonly Person[] = await TestBed.inject(MyTasksApi).people();

    expect(people.map((person: Person) => person.initials)).toEqual(['CM', 'IR']);
    expect(listMembers.mock.calls[0][0]).toMatchObject({ role: ['owner', 'admin', 'member'] });
    expect(listMembers.mock.calls[1][0]).toMatchObject({ cursor: 'm2' });
  });
});
