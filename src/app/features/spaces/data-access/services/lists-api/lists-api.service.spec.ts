import { HttpErrorResponse, HttpHeaders, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  AccessService,
  ArchivesService,
  ListsService,
  MembersService,
  TaskQueriesService,
  TasksService,
  type TaskList,
} from '@cadenway/api-client';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { AccessDeniedRouteError } from '@shared/route-errors';

import { DEFAULT_VIEW_CONFIG } from '../../../utils/list-view-query/list-view-query.util';
import { ListsApi } from './lists-api.service';

/**
 * Constant bugs
 *
 * @description
 * The « Bugs » list as the gateway answers it.
 *
 * @type {TaskList}
 */
const bugs: TaskList = {
  id: 'l-bugs',
  spaceId: 'sp-produit',
  name: 'Bugs',
  icon: 'bug',
  color: 'rouge',
  sprint: null,
  createdAt: '2026-11-01T00:00:00Z',
  version: 2,
  callerRole: 'edit',
};

describe('ListsApi', () => {
  let lists: Record<string, Mock>;
  let tasks: Record<string, Mock>;
  let members: Record<string, Mock>;
  let api: ListsApi;

  beforeEach(() => {
    lists = {
      getList: vi.fn(() => of(bugs)),
      getListCounts: vi.fn(() =>
        of({ list: bugs, counts: { total: 3, open: 3, done: 0, cancelled: 0, late: 1 } }),
      ),
      updateList: vi.fn(() => of({ ...bugs, name: 'Anomalies', version: 3 })),
      duplicateList: vi.fn(() => of({ list: { ...bugs, id: 'l-copy' }, taskCount: 3 })),
      exportListTasks: vi.fn(() =>
        of(
          new HttpResponse({
            body: '"Identifiant";"Nom"\n"CAD-499";"Notifications"',
            headers: new HttpHeaders({ 'Content-Disposition': 'attachment; filename="bugs.csv"' }),
          }),
        ),
      ),
      deleteList: vi.fn(() => of(undefined)),
      listSavedViews: vi.fn(),
      createSavedView: vi.fn((_listId: string, body: Record<string, unknown>) =>
        of({
          id: 'sv-1',
          listId: 'l-bugs',
          createdAt: '',
          updatedAt: '',
          version: 1,
          ...body,
        }),
      ),
      updateSavedView: vi.fn(),
      duplicateSavedView: vi.fn(),
      deleteSavedView: vi.fn(() => of(undefined)),
    };
    tasks = {
      listLabels: vi.fn(() => of({ items: [{ name: 'Bug' }], nextCursor: null })),
      executeBulkTaskAction: vi.fn(() => of({ results: [], affectedCount: 2 })),
    };
    members = {
      listMembers: vi.fn(() =>
        of({ items: [{ userId: 'u1', name: 'Inès Robert' }], nextCursor: null, total: 1 }),
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: ListsService, useValue: lists },
        { provide: TasksService, useValue: tasks },
        { provide: MembersService, useValue: members },
        { provide: ArchivesService, useValue: { archiveList: vi.fn(() => of(bugs)) } },
        {
          provide: AccessService,
          useValue: {
            listListGrants: vi.fn(() =>
              of({
                items: [
                  { userId: 'u1', role: 'edit' },
                  { userId: 'u2', role: 'view' },
                ],
                nextCursor: null,
                total: 5,
              }),
            ),
          },
        },
        {
          provide: TaskQueriesService,
          useValue: { queryListTasks: vi.fn(() => of({ items: [], nextCursor: null, total: 2 })) },
        },
      ],
    });
    api = TestBed.inject(ListsApi);
  });

  it('reads a list and turns a hidden one into access denied', async () => {
    expect((await api.list('l-bugs')).name).toBe('Bugs');

    lists['getList'].mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 404,
            error: { status: 404, code: 'list.not-found', title: 'x', type: 'about:blank' },
          }),
      ),
    );
    await expect(api.list('l-x')).rejects.toBeInstanceOf(AccessDeniedRouteError);
  });

  it('reads the counts, the milestones, the members and the labels', async () => {
    expect((await api.counts('l-bugs', '2026-11-08')).counts.late).toBe(1);
    expect(lists['getListCounts']).toHaveBeenCalledWith(
      'l-bugs',
      { today: '2026-11-08' },
      { cache: 'no-store' },
    );
    expect(await api.milestoneCount('l-bugs')).toBe(2);
    expect(await api.listMembers('l-bugs')).toEqual({
      total: 5,
      items: [
        { userId: 'u1', name: 'Inès Robert' },
        { userId: 'u2', name: null },
      ],
    });
    expect(await api.labels()).toEqual(['Bug']);
  });

  it('keeps the members without names when the directory is refused', async () => {
    members['listMembers'].mockReturnValueOnce(
      throwError(() => new Error('members.read-forbidden')),
    );
    expect((await api.listMembers('l-bugs')).items[0]?.name).toBeNull();
  });

  it('writes the list with its version and exports with the gateway file name', async () => {
    const list: Awaited<ReturnType<ListsApi['list']>> = await api.list('l-bugs');

    expect((await api.rename(list, 'Anomalies')).version).toBe(3);
    expect(lists['updateList']).toHaveBeenCalledWith(
      'l-bugs',
      { name: 'Anomalies' },
      { headers: { 'If-Match': '"2"' } },
    );
    expect((await api.duplicate(list)).taskCount).toBe(3);
    expect(await api.exportCsv(list, { level: 'roots', sort: 'manual' })).toEqual({
      fileName: 'bugs.csv',
      content: '"Identifiant";"Nom"\n"CAD-499";"Notifications"',
    });
    await api.archive('l-bugs');
    await api.remove(list);
    expect(lists['deleteList']).toHaveBeenCalledWith('l-bugs', { headers: { 'If-Match': '"2"' } });
  });

  it('creates and deletes saved views and runs a bulk action', async () => {
    const view: Awaited<ReturnType<ListsApi['createSavedView']>> = await api.createSavedView(
      'l-bugs',
      {
        name: 'Par personne',
        icon: null,
        layout: 'list',
        config: { ...DEFAULT_VIEW_CONFIG, groupBy: 'assignee' },
      },
    );

    expect(view.config.groupBy).toBe('assignee');
    await api.deleteSavedView(view);
    expect(lists['deleteSavedView']).toHaveBeenCalledWith('l-bugs', 'sv-1');
    expect(await api.bulk([{ taskKey: 'CAD-499' }], { type: 'done' })).toBe(2);
  });
});
