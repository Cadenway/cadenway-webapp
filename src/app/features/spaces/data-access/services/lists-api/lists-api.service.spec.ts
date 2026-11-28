import { HttpErrorResponse, HttpHeaders, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  AccessService,
  ArchivesService,
  ListsService,
  MembersService,
  TaskQueriesService,
  type SavedView as SavedViewDto,
  type SavedViewPatch,
  TasksService,
  type TaskList,
} from '@cadenway/api-client';
import { Observable, of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { OrganizationPin, OrganizationSwitchPendingError } from '@core/api';
import { AccessDeniedRouteError } from '@shared/route-errors';

import { DEFAULT_VIEW_CONFIG } from '../../../utils/list-view-query/list-view-query.util';
import type { ListMember, ListMembers } from '../../../models/list-member/list-member.interface';
import type { SavedView } from '../../../models/saved-view/saved-view.interface';
import type { ListSprint } from '../../../models/task-list/task-list.interface';
import { ListsApi } from './lists-api.service';

/**
 * Constant bugs
 *
 * @description
 * The `Bugs` list as the gateway answers it.
 *
 * @type {TaskList}
 */
const bugs: TaskList = {
  id: 'l-bugs',
  spaceId: 'sp-product',
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
            body: '"Key";"Name"\n"CAD-499";"Notifications"',
            headers: new HttpHeaders({ 'Content-Disposition': 'attachment; filename="bugs.csv"' }),
          }),
        ),
      ),
      deleteList: vi.fn(() => of(undefined)),
      createList: vi.fn(() => of({ ...bugs, id: 'l-sprint15', name: 'Sprint 15' })),
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
        {
          provide: ArchivesService,
          useValue: { archiveList: vi.fn(() => of(bugs)), unarchiveList: vi.fn(() => of(bugs)) },
        },
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

  it('reads every member page for assignee choices', async () => {
    members['listMembers'].mockReturnValueOnce(
      of({ items: [{ userId: 'u1', name: 'Inès' }], nextCursor: 'next' }),
    );
    members['listMembers'].mockReturnValueOnce(
      of({ items: [{ userId: 'u2', name: 'Camille' }], nextCursor: null }),
    );
    expect(await api.organizationMembers()).toEqual([
      { userId: 'u1', name: 'Inès' },
      { userId: 'u2', name: 'Camille' },
    ]);
    expect(members['listMembers']).toHaveBeenLastCalledWith({ limit: 100, cursor: 'next' });
  });

  it('cancels an in-flight paginated read when superseded', async () => {
    let cancelled: boolean = false;
    tasks['listLabels'].mockReturnValueOnce(
      new Observable(() => () => {
        cancelled = true;
      }),
    );
    const controller: AbortController = new AbortController();
    const pending: Promise<readonly string[]> = api.labels(controller.signal);
    controller.abort();
    await expect(pending).rejects.toThrow();
    expect(cancelled).toBe(true);
    expect(tasks['listLabels']).toHaveBeenCalledTimes(1);
  });

  it('reads every labels page', async () => {
    tasks['listLabels'].mockReturnValueOnce(of({ items: [{ name: 'Auth' }], nextCursor: 'next' }));
    tasks['listLabels'].mockReturnValueOnce(of({ items: [{ name: 'Front' }], nextCursor: null }));
    expect(await api.labels()).toEqual(['Auth', 'Front']);
    expect(tasks['listLabels']).toHaveBeenLastCalledWith({ limit: 100, cursor: 'next' });
  });

  it('reads the first directory page once for the header and the assignees that ask together', async () => {
    const directory: Subject<unknown> = new Subject<unknown>();
    members['listMembers'].mockReturnValueOnce(directory);

    const header: Promise<ListMembers> = api.listMembers('l-bugs');
    const assignees: Promise<readonly ListMember[]> = api.organizationMembers();
    await new Promise<void>((resolve: () => void) => setTimeout(resolve));
    expect(members['listMembers']).toHaveBeenCalledTimes(1);
    directory.next({ items: [{ userId: 'u1', name: 'Inès Robert' }], nextCursor: null, total: 1 });
    directory.complete();

    expect((await header).items[0]?.name).toBe('Inès Robert');
    expect(await assignees).toEqual([{ userId: 'u1', name: 'Inès Robert' }]);
    expect(members['listMembers']).toHaveBeenCalledTimes(1);

    await api.organizationMembers();
    expect(members['listMembers']).toHaveBeenCalledTimes(2);
  });

  it('shares the first directory page with the assignees even when the grants answer last', async () => {
    const grants: Subject<unknown> = new Subject<unknown>();
    (TestBed.inject(AccessService).listListGrants as unknown as Mock).mockReturnValueOnce(grants);
    const directory: Subject<unknown> = new Subject<unknown>();
    members['listMembers'].mockReturnValueOnce(directory);
    const header: Promise<ListMembers> = api.listMembers('l-bugs');
    const assignees: Promise<readonly ListMember[]> = api.organizationMembers();
    directory.next({ items: [{ userId: 'u1', name: 'Inès Robert' }], nextCursor: null, total: 1 });
    directory.complete();

    expect(await assignees).toHaveLength(1);
    grants.next({ items: [{ userId: 'u1' }], nextCursor: null, total: 1 });
    grants.complete();

    expect((await header).items[0]?.name).toBe('Inès Robert');
    expect(members['listMembers']).toHaveBeenCalledTimes(1);
  });

  it('shares no directory page across organizations and stops a read once it changed', async () => {
    const pin: OrganizationPin = TestBed.inject(OrganizationPin);
    pin.set('org-atelier');
    const old: Subject<unknown> = new Subject<unknown>();
    members['listMembers'].mockReturnValueOnce(old);
    const before: Promise<readonly ListMember[]> = api.organizationMembers();
    await new Promise<void>((resolve: () => void) => setTimeout(resolve));

    pin.set('org-studio');
    members['listMembers'].mockReturnValueOnce(
      of({ items: [{ userId: 'u7', name: 'Hugo Durand' }], nextCursor: null, total: 1 }),
    );
    const after: Promise<readonly ListMember[]> = api.organizationMembers();
    old.next({ items: [{ userId: 'u1', name: 'Inès Robert' }], nextCursor: 'next', total: 2 });
    old.complete();

    expect(await after).toEqual([{ userId: 'u7', name: 'Hugo Durand' }]);
    await expect(before).rejects.toBeInstanceOf(OrganizationSwitchPendingError);
    expect(members['listMembers']).toHaveBeenCalledTimes(2);
    expect(members['listMembers']).not.toHaveBeenCalledWith({ limit: 100, cursor: 'next' });
  });

  it('keeps the members without names when the directory is refused', async () => {
    members['listMembers'].mockReturnValueOnce(
      throwError(() => new Error('members.read-forbidden')),
    );
    expect((await api.listMembers('l-bugs')).items[0]?.name).toBeNull();
  });

  it('writes the list with its version and exports with the gateway file name', async () => {
    const list: Awaited<ReturnType<ListsApi['list']>> = await api.list('l-bugs');

    expect(
      (await api.update(list, { name: 'Anomalies', icon: 'bug', color: 'rouge', sprint: null }))
        .version,
    ).toBe(3);
    expect(lists['updateList']).toHaveBeenCalledWith(
      'l-bugs',
      { name: 'Anomalies', icon: 'bug', color: 'rouge', sprint: null },
      { headers: { 'If-Match': '"2"' } },
    );
    expect((await api.duplicate(list)).taskCount).toBe(3);
    expect(await api.exportCsv(list, { level: 'roots', sort: 'manual' })).toEqual({
      fileName: 'bugs.csv',
      content: '"Key";"Name"\n"CAD-499";"Notifications"',
    });
    await api.archive('l-bugs');
    await api.remove(list);
    expect(lists['deleteList']).toHaveBeenCalledWith('l-bugs', { headers: { 'If-Match': '"2"' } });
    expect((await api.unarchive('l-bugs')).id).toBe('l-bugs');
  });

  it('creates a sprint with its dates in a space', async () => {
    const sprint: ListSprint = { startDate: '2026-11-18', endDate: '2026-12-01', goal: null };
    const created: Awaited<ReturnType<ListsApi['create']>> = await api.create(
      'sp-product',
      { name: 'Sprint 15', icon: 'lightning', color: 'violet', sprint },
      'key-15',
    );

    expect(created.name).toBe('Sprint 15');
    expect(lists['createList']).toHaveBeenCalledWith(
      'sp-product',
      { name: 'Sprint 15', icon: 'lightning', color: 'violet', sprint },
      { headers: { 'Idempotency-Key': 'key-15' } },
    );
  });

  it('creates and deletes saved views and runs a bulk action', async () => {
    const view: Awaited<ReturnType<ListsApi['createSavedView']>> = await api.createSavedView(
      'l-bugs',
      {
        name: 'By person',
        icon: null,
        layout: 'list',
        config: { ...DEFAULT_VIEW_CONFIG, groupBy: 'assignee' },
      },
    );

    expect(view.config.groupBy).toBe('assignee');
    await api.deleteSavedView(view);
    expect(lists['deleteSavedView']).toHaveBeenCalledWith('l-bugs', 'sv-1');
    expect(await api.bulk([{ taskKey: 'CAD-499' }], { type: 'done' }, 'key-1')).toBe(2);
    expect(tasks['executeBulkTaskAction']).toHaveBeenCalledWith(expect.anything(), {
      headers: { 'Idempotency-Key': 'key-1' },
    });
  });

  it('keeps the presentation values it does not read when a view is saved again', async () => {
    const stored: SavedViewDto = {
      id: 'sv-sheet',
      listId: 'l-bugs',
      name: 'Sheet by due date',
      icon: null,
      configuration: {
        layout: 'table',
        filters: {},
        sort: 'manual',
        groupBy: 'status',
        presentation: {
          hiddenBoardStatusKeys: ['backlog', 'archived' as never],
          hiddenSheetColumns: ['spent', 'future-column'],
          hiddenCustomFieldIds: ['cf-points'],
          sheetSort: { column: 'future-column', direction: 'asc' },
        },
      },
      createdAt: '',
      updatedAt: '',
      version: 4,
    };
    lists['listSavedViews'].mockReturnValue(of({ items: [stored], nextCursor: null }));
    lists['updateSavedView'].mockReturnValue(of({ ...stored, version: 5 }));
    const views: readonly SavedView[] = await api.savedViews('l-bugs');
    const view: SavedView = views[0];
    expect(view.config.presentation.hiddenSheetColumns).toEqual(['spent']);

    await api.updateSavedView(view, {
      config: {
        ...view.config,
        filters: { ...view.config.filters, priority: ['haute'] },
      },
    });

    const patch: SavedViewPatch = lists['updateSavedView'].mock.calls[0]?.[2] as SavedViewPatch;
    expect(patch.configuration?.filters?.priority).toEqual(['haute']);
    expect(patch.configuration?.presentation).toEqual({
      hiddenSheetColumns: ['spent', 'future-column'],
      hiddenCustomFieldIds: ['cf-points'],
      sheetSort: { column: 'future-column', direction: 'asc' },
      customFieldSort: null,
    });
    expect(patch.configuration?.presentation).not.toHaveProperty('hiddenBoardStatusKeys');
    expect(lists['updateSavedView']).toHaveBeenCalledWith('l-bugs', 'sv-sheet', patch, {
      headers: { 'If-Match': '"4"' },
    });
  });

  it('restores a deleted board view with its sheet settings and the values it did not read', async () => {
    const presentation: NonNullable<SavedViewDto['configuration']['presentation']> = {
      hiddenBoardStatusKeys: ['waiting', 'archived' as never],
      hiddenSheetColumns: ['client', 'future-column'],
      hiddenCustomFieldIds: ['cf-points'],
      sheetSort: { column: 'future-column', direction: 'asc' },
    };
    lists['listSavedViews'].mockReturnValue(
      of({
        items: [
          {
            id: 'sv-board',
            listId: 'l-bugs',
            name: 'Board without waiting',
            icon: 'flag',
            configuration: {
              layout: 'board',
              filters: { label: ['Bug'] },
              sort: '-priority',
              groupBy: null,
              presentation,
            },
            createdAt: '',
            updatedAt: '',
            version: 3,
          },
        ],
        nextCursor: null,
      }),
    );
    const views: readonly SavedView[] = await api.savedViews('l-bugs');

    const restored: SavedView = await api.restoreSavedView(views[0]);

    expect(lists['createSavedView']).toHaveBeenCalledExactlyOnceWith('l-bugs', {
      name: 'Board without waiting',
      icon: 'flag',
      configuration: {
        layout: 'board',
        filters: { status: [], priority: [], assignee: [], label: ['Bug'] },
        sort: '-priority',
        groupBy: null,
        presentation,
      },
    });
    expect(restored.id).toBe('sv-1');
    expect(restored.config.presentation.hiddenSheetColumns).toEqual(['client']);
  });
});
