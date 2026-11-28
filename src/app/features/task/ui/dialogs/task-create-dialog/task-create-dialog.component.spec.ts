import { getDebugNode, signal, type WritableSignal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CwDialog, CwDialogHeader } from '@cadenway/ui/components/dialog';
import { CwToastService, type CwToastOptions } from '@cadenway/ui/components/toast';
import { Observable, of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { TaskCreateApi } from '../../../data-access/services/task-create-api/task-create-api.service';
import type {
  CreatedTask,
  ListDestination,
  SpaceSetup,
  TaskDraft,
} from '../../../models/task-create/task-create.interface';
import { TaskCreate } from '../../../services/task-create/task-create.service';
import { TaskDetailOpener } from '../../../services/task-detail-opener/task-detail-opener.service';
import { defaultStatusOptions } from '../../../utils/task-status/task-status.util';
import { TaskCreateDialog } from './task-create-dialog.component';

/**
 * Constant workspace
 *
 * @description
 * Camille Martin in Atelier Nord.
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
 * Constant destinations
 *
 * @description
 * Backlog and Sprint 14 of the Product space.
 *
 * @type {readonly ListDestination[]}
 */
const destinations: readonly ListDestination[] = [
  {
    listId: 'backlog',
    listName: 'Backlog',
    spaceId: 'product',
    spaceName: 'Product',
    sprintEnd: null,
  },
  {
    listId: 'sprint-14',
    listName: 'Sprint 14',
    spaceId: 'product',
    spaceName: 'Product',
    sprintEnd: '2026-11-17',
  },
];

/**
 * Constant space
 *
 * @description
 * Product, whose next key is CAD-495.
 *
 * @type {SpaceSetup}
 */
const space: SpaceSetup = {
  spaceId: 'product',
  nextKey: 'CAD-495',
  statuses: defaultStatusOptions(),
};

/**
 * Function buttonNamed
 *
 * @description
 * Finds a button of the open dialog by its text.
 *
 * @param {string} text - Text the button starts with.
 * @returns {HTMLButtonElement | undefined} The button.
 */
function buttonNamed(text: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(
    (button: HTMLButtonElement) => button.textContent.trim().startsWith(text),
  );
}

/**
 * Function typeName
 *
 * @description
 * Types the task name.
 *
 * @param {string} name - Name to type.
 */
function typeName(name: string): void {
  const field: HTMLInputElement | null = document.querySelector('#task-create-name');
  if (!field) throw new Error('No name field');
  field.value = name;
  field.dispatchEvent(new Event('input'));
}

describe('TaskCreateDialog', () => {
  let create: Mock<(listId: string, draft: TaskDraft, key: string) => Observable<CreatedTask>>;
  let createSubtask: Mock<(parentKey: string, draft: TaskDraft) => Observable<CreatedTask>>;
  let show: Mock<(title: string, options?: CwToastOptions) => string>;
  let error: Mock<(title: string, options?: CwToastOptions) => string>;
  let openTask: Mock<(taskKey: string) => Promise<boolean>>;
  let detailOpen: WritableSignal<boolean>;
  let fixture: ComponentFixture<TaskCreateDialog>;

  beforeEach(async () => {
    create = vi.fn(() => of({ key: 'CAD-495', listId: 'sprint-14', status: 'todo', subtasks: 1 }));
    createSubtask = vi.fn(() =>
      of({ key: 'CAD-496', listId: 'sprint-14', status: 'todo', subtasks: 0 }),
    );
    show = vi.fn(() => 't1');
    error = vi.fn(() => 't2');
    openTask = vi.fn(() => Promise.resolve(true));
    detailOpen = signal<boolean>(false);
    TestBed.configureTestingModule({
      imports: [TaskCreateDialog],
      providers: [
        {
          provide: TaskCreateApi,
          useValue: {
            destinations: () => of(destinations),
            space: () => of(space),
            templates: () => of([]),
            people: () =>
              of([
                { id: 'u1', name: 'Camille Martin', initials: 'CM', avatar: null },
                { id: 'u2', name: 'Inès Robert', initials: 'IR', avatar: null },
              ]),
            labels: () => of(['Front']),
            create,
            createSubtask,
          },
        },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
        { provide: CwToastService, useValue: { show, error } },
        { provide: TaskDetailOpener, useValue: { open: openTask, isOpen: detailOpen } },
      ],
    });
    fixture = TestBed.createComponent(TaskCreateDialog);
    await fixture.whenStable();
  });

  afterEach(() => {
    TestBed.inject(TaskCreate).close();
    (workspace.organization as ReturnType<typeof signal>).set({
      id: 'o1',
      slug: 'atelier-nord',
      name: 'Atelier Nord',
      initials: 'AN',
      role: 'owner',
      plan: 'team',
    });
  });

  it('closes and clears presets when the committed organization changes', async () => {
    const service: TaskCreate = TestBed.inject(TaskCreate);
    service.open({ listId: 'sprint-14', parentKey: 'CAD-482' });
    await fixture.whenStable();
    (workspace.organization as ReturnType<typeof signal>).set({
      id: 'o2',
      slug: 'other',
      name: 'Other',
      initials: 'OT',
      role: 'owner',
      plan: 'team',
    });
    await fixture.whenStable();
    expect(service.isOpen()).toBe(false);
    expect(service.options()).toEqual({});
  });

  it('ignores a creation response from an earlier opening', async () => {
    const response: Subject<CreatedTask> = new Subject<CreatedTask>();
    create.mockReturnValueOnce(response);
    const service: TaskCreate = TestBed.inject(TaskCreate);
    service.open();
    await fixture.whenStable();
    typeName('First draft');
    await fixture.whenStable();
    buttonNamed('Create the task')?.click();
    await fixture.whenStable();
    service.close();
    await fixture.whenStable();
    service.open();
    await fixture.whenStable();
    typeName('Second draft');
    response.next({ key: 'CAD-495', listId: 'backlog', status: 'todo', subtasks: 0 });
    response.complete();
    await fixture.whenStable();
    expect(service.isOpen()).toBe(true);
    expect(document.querySelector<HTMLInputElement>('#task-create-name')?.value).toBe(
      'Second draft',
    );
    expect(show).not.toHaveBeenCalled();
  });

  it('opens with N outside fields', async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', code: 'KeyN' }));
    await fixture.whenStable();

    expect(TestBed.inject(TaskCreate).isOpen()).toBe(true);
    expect(document.querySelector('[role="dialog"] h2')?.textContent.trim()).toBe('Create a task');
  });

  it('pins the 896 px window near the top with a bar header and a flush scrolling body', async () => {
    TestBed.inject(TaskCreate).open({ listId: 'sprint-14' });
    await fixture.whenStable();

    const dialog: CwDialog = fixture.debugElement.query(By.directive(CwDialog))
      .componentInstance as CwDialog;
    expect([dialog.size(), dialog.placement(), dialog.padding(), dialog.scrollable()]).toEqual([
      'xl',
      'top',
      'none',
      true,
    ]);
    const header: CwDialogHeader | undefined = getDebugNode(
      document.querySelector('[role="dialog"] cw-dialog-header'),
    )?.componentInstance as CwDialogHeader | undefined;
    expect(header?.variant()).toBe('bar');
    expect(document.querySelector('[role="dialog"] cw-dialog-header')?.className).toContain('px-5');
    expect(document.querySelector('[role="dialog"] cw-dialog-footer')?.className).toContain('px-5');
  });

  it('ignores N while a task detail is open', async () => {
    detailOpen.set(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', code: 'KeyN' }));
    await fixture.whenStable();

    expect(TestBed.inject(TaskCreate).isOpen()).toBe(false);
  });

  it('names the empty due date picker by its text, and a set one by label and date', async () => {
    const service: TaskCreate = TestBed.inject(TaskCreate);
    service.open({ listId: 'sprint-14' });
    await fixture.whenStable();
    const trigger: () => HTMLButtonElement | null = () =>
      document.querySelector<HTMLButtonElement>('[role="dialog"] cw-date-picker button');

    expect(trigger()?.getAttribute('aria-label')).toBeNull();
    expect(trigger()?.textContent.trim()).toBe('Due date');
    service.close();
    await fixture.whenStable();
    service.open({ listId: 'sprint-14', due: '2026-11-18' });
    await fixture.whenStable();

    expect(trigger()?.getAttribute('aria-label')).toMatch(/^Due date, .*18/u);
  });

  it('ignores N in an editable field and while the dialog is open', async () => {
    const input: HTMLInputElement = document.createElement('input');
    document.body.append(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', code: 'KeyN', bubbles: true }));
    await fixture.whenStable();
    const service: TaskCreate = TestBed.inject(TaskCreate);
    expect(service.isOpen()).toBe(false);
    input.remove();
    service.open({ listId: 'sprint-14', parentKey: 'CAD-482' });
    await fixture.whenStable();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', code: 'KeyN' }));
    await fixture.whenStable();
    expect(service.options()).toEqual({ listId: 'sprint-14', parentKey: 'CAD-482' });
  });

  it('closes an open people combobox before closing the dialog on Escape', async () => {
    const service: TaskCreate = TestBed.inject(TaskCreate);
    service.open();
    await fixture.whenStable();
    document
      .querySelector<HTMLButtonElement>('cw-task-people-picker button[role="combobox"]')
      ?.click();
    await fixture.whenStable();
    const field: HTMLInputElement | null = document.querySelector('input[role="combobox"]');
    expect(field).not.toBeNull();
    field?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }),
    );
    await fixture.whenStable();
    expect(service.isOpen()).toBe(true);
    expect(document.querySelector('input[role="combobox"]')).toBeNull();
  });

  it('creates the task in the preset list and offers `Open`', async () => {
    TestBed.inject(TaskCreate).open({ listId: 'sprint-14' });
    await fixture.whenStable();

    expect(
      document.querySelector('[data-testid="task-create-destination"]')?.textContent,
    ).toContain('Sprint 14');
    expect(document.querySelector('[data-testid="task-create-next-key"]')?.textContent.trim()).toBe(
      'CAD-495',
    );
    expect(buttonNamed('Create the task')?.disabled).toBe(true);
    typeName('Prepare the demo');
    const subtask: HTMLInputElement | null = document.querySelector('#task-create-subtask');
    if (!subtask) throw new Error('No subtask field');
    subtask.value = 'Slides';
    subtask.dispatchEvent(new Event('input'));
    subtask.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    buttonNamed('Create the task')?.click();
    await fixture.whenStable();

    expect(create).toHaveBeenCalledOnce();
    const [listId, draft, key]: [string, TaskDraft, string] = create.mock.calls[0];
    expect(listId).toBe('sprint-14');
    expect(key).toMatch(/^[0-9a-f-]{36}$/u);
    expect(draft).toMatchObject({
      name: 'Prepare the demo',
      status: 'todo',
      priority: 'moyenne',
      assigneeIds: ['u1'],
      subtasks: ['Slides'],
    });
    const [title, options]: [string, CwToastOptions?] = show.mock.calls[0];
    expect(title).toBe('Task CAD-495 created');
    expect(options?.description).toBe('Sprint 14 · To do · 1 subtask.');
    expect(options?.action?.label).toBe('Open');
    options?.action?.run();
    expect(openTask).toHaveBeenCalledWith('CAD-495');
    expect(TestBed.inject(TaskCreate).isOpen()).toBe(false);
  });

  it('creates with the priority and the assignees of the group it was opened from', async () => {
    TestBed.inject(TaskCreate).open({ listId: 'sprint-14', priority: 'urgente', assigneeIds: [] });
    await fixture.whenStable();
    expect(document.querySelector('[data-testid="task-create-next-key"]')).not.toBeNull();
    typeName('Fix the crash');
    await fixture.whenStable();
    buttonNamed('Create the task')?.click();
    await fixture.whenStable();

    expect(create.mock.calls[0][1]).toMatchObject({ priority: 'urgente', assigneeIds: [] });
  });

  it('keeps the dialog open with an empty name for `Create more tasks`', async () => {
    TestBed.inject(TaskCreate).open();
    await fixture.whenStable();
    document.querySelector<HTMLButtonElement>('#task-create-more')?.click();
    typeName('First');
    await fixture.whenStable();
    buttonNamed('Create the task')?.click();
    await fixture.whenStable();

    expect(create).toHaveBeenCalledWith('backlog', expect.anything(), expect.any(String));
    expect(TestBed.inject(TaskCreate).isOpen()).toBe(true);
    expect(document.querySelector<HTMLInputElement>('#task-create-name')?.value).toBe('');
    expect(document.querySelector('[role="dialog"] [role="alert"]')).toBeNull();
  });

  it('creates a subtask under its parent', async () => {
    TestBed.inject(TaskCreate).open({ parentKey: 'CAD-482', listId: 'sprint-14' });
    await fixture.whenStable();
    typeName('Review the flow');
    await fixture.whenStable();
    buttonNamed('Create the task')?.click();
    await fixture.whenStable();

    expect(createSubtask).toHaveBeenCalledWith(
      'CAD-482',
      expect.objectContaining({ subtasks: [] }),
      expect.any(String),
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('keeps the fields and reuses the Idempotency-Key when the creation fails', async () => {
    create.mockReturnValueOnce(throwError(() => new Error('503')));
    TestBed.inject(TaskCreate).open();
    await fixture.whenStable();
    typeName('Prepare the demo');
    await fixture.whenStable();
    buttonNamed('Create the task')?.click();
    await fixture.whenStable();

    expect(error).toHaveBeenCalledOnce();
    expect(TestBed.inject(TaskCreate).isOpen()).toBe(true);
    buttonNamed('Create the task')?.click();
    await fixture.whenStable();
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][2]).toBe(create.mock.calls[0][2]);
  });

  it('reuses the unresolved creation key after closing and reopening', async () => {
    create.mockReturnValueOnce(throwError(() => new Error('503')));
    const service: TaskCreate = TestBed.inject(TaskCreate);
    service.open();
    await fixture.whenStable();
    typeName('Prepare the demo');
    await fixture.whenStable();
    buttonNamed('Create the task')?.click();
    await fixture.whenStable();
    service.close();
    await fixture.whenStable();
    service.open();
    await fixture.whenStable();
    typeName('Prepare the demo');
    await fixture.whenStable();
    buttonNamed('Create the task')?.click();
    await fixture.whenStable();
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][2]).toBe(create.mock.calls[0][2]);
  });

  it.each([
    { status: 403, code: 'access.role-insufficient' },
    { status: 422, code: 'task.status-hidden' },
  ])(
    'shows a specific refusal for $code',
    async ({ status, code }: { status: number; code: string }) => {
      create.mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status, error: { code } })),
      );
      TestBed.inject(TaskCreate).open();
      await fixture.whenStable();
      typeName('Prepare the demo');
      await fixture.whenStable();
      buttonNamed('Create the task')?.click();
      await fixture.whenStable();
      expect(error).toHaveBeenCalledOnce();
      expect(error.mock.calls[0][1]?.description).not.toContain('server');
    },
  );

  it('opens without announcing the empty name, which only disables `Create the task`', async () => {
    TestBed.inject(TaskCreate).open({ listId: 'sprint-14' });
    await fixture.whenStable();

    expect(buttonNamed('Create the task')?.disabled).toBe(true);
    expect(document.querySelector('[role="dialog"] [role="alert"]')).toBeNull();
    const field: HTMLInputElement | null = document.querySelector('#task-create-name');
    field?.dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    const alerts: HTMLElement[] = Array.from(
      document.querySelectorAll<HTMLElement>('[role="dialog"] [role="alert"]'),
    );
    expect(alerts.map((alert: HTMLElement) => alert.textContent.trim())).toEqual([
      'Enter a name for the task.',
    ]);
    expect(document.querySelector('cw-dialog-footer [role="alert"]')).toBeNull();
  });

  it('keeps a name validation issue in the form', async () => {
    create.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { details: { issues: [{ path: 'name' }] } },
          }),
      ),
    );
    TestBed.inject(TaskCreate).open();
    await fixture.whenStable();
    typeName('Prepare the demo');
    await fixture.whenStable();
    buttonNamed('Create the task')?.click();
    await fixture.whenStable();
    expect(error).not.toHaveBeenCalled();
    expect(document.querySelector('#task-create-name ~ [role="alert"]')?.textContent).toBeTruthy();
    expect(document.querySelector('cw-dialog-footer [role="alert"]')).toBeNull();
  });

  it('shows no stale issue on a field edited while the creation ran, and says it was refused', async () => {
    let refuse: (error: unknown) => void = () => undefined;
    create.mockReturnValueOnce(
      new Observable<CreatedTask>((subscriber) => {
        refuse = (error: unknown): void => {
          subscriber.error(error);
        };
      }),
    );
    TestBed.inject(TaskCreate).open({ listId: 'sprint-14' });
    await fixture.whenStable();
    typeName('Prepare the demo');
    await fixture.whenStable();
    buttonNamed('Create the task')?.click();
    await fixture.whenStable();

    typeName('Prepare the Thursday demo');
    await fixture.whenStable();
    refuse(
      new HttpErrorResponse({ status: 422, error: { details: { issues: [{ path: 'name' }] } } }),
    );
    await fixture.whenStable();

    await expect.poll(() => error.mock.calls.length).toBe(1);
    expect(document.querySelector('#task-create-name ~ [role="alert"]')).toBeNull();
    expect(error.mock.calls[0][1]?.description).toBe(
      'The task could not be created. Check its details and try again.',
    );
  });

  it('drops a server issue for good once its field changes', async () => {
    create.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { details: { issues: [{ path: 'name' }] } },
          }),
      ),
    );
    TestBed.inject(TaskCreate).open({ listId: 'sprint-14' });
    await fixture.whenStable();
    typeName('Prepare the demo');
    await fixture.whenStable();
    buttonNamed('Create the task')?.click();
    await fixture.whenStable();
    expect(buttonNamed('Create the task')?.disabled).toBe(true);

    typeName('Prepare the Thursday demo');
    await fixture.whenStable();
    typeName('Prepare the demo');
    await fixture.whenStable();

    expect(buttonNamed('Create the task')?.disabled).toBe(false);
  });

  it('starts each opening without the issues a refused creation left', async () => {
    create.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { details: { issues: [{ path: 'status' }] } },
          }),
      ),
    );
    const service: TaskCreate = TestBed.inject(TaskCreate);
    service.open({ listId: 'sprint-14' });
    await fixture.whenStable();
    typeName('Prepare the demo');
    await fixture.whenStable();
    buttonNamed('Create the task')?.click();
    await fixture.whenStable();
    expect(document.querySelector('cw-dialog-footer [role="alert"]')?.textContent).toContain(
      'Check this information.',
    );

    service.close();
    await fixture.whenStable();
    service.open({ listId: 'sprint-14' });
    await fixture.whenStable();
    typeName('Prepare the demo');
    await fixture.whenStable();
    document.querySelector('#task-create-name')?.dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    expect(buttonNamed('Create the task')?.disabled).toBe(false);
    expect(document.querySelector('cw-dialog-footer [role="alert"]')).toBeNull();
  });

  it('keeps field and unmapped validation issues in the form', async () => {
    const issues: { path: string }[] = [
      'name',
      'description',
      'dueDate',
      'assigneeIds.0',
      'labels.0',
      'status',
      'unknown',
    ].map((path: string) => ({ path }));
    create.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 422, error: { details: { issues } } })),
    );
    TestBed.inject(TaskCreate).open();
    await fixture.whenStable();
    typeName('Prepare the demo');
    await fixture.whenStable();
    buttonNamed('Create the task')?.click();
    await fixture.whenStable();
    expect(error).not.toHaveBeenCalled();
    expect(document.querySelectorAll('cw-dialog-footer [role="alert"] p')).toHaveLength(6);
    expect(document.querySelector('#task-create-name ~ [role="alert"]')).not.toBeNull();
  });

  it('asks the reason before taking `Cancelled`', async () => {
    TestBed.inject(TaskCreate).open();
    await fixture.whenStable();
    const caret: HTMLButtonElement | undefined = Array.from(
      document.querySelectorAll<HTMLButtonElement>('cw-task-status-picker button'),
    ).at(-1);
    caret?.click();
    await fixture.whenStable();
    Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      .find((item: HTMLElement) => item.textContent.trim().startsWith('Cancelled'))
      ?.click();
    await fixture.whenStable();

    expect(document.body.textContent).toContain('Cancel CAD-495?');
    buttonNamed('Cancel the task')?.click();
    typeName('Duplicate of CAD-482');
    await fixture.whenStable();
    buttonNamed('Create the task')?.click();
    await fixture.whenStable();

    expect(create.mock.calls[0][1]).toMatchObject({
      status: 'cancelled',
      cancelReason: 'duplicate',
    });
  });
});
