import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CwToastService, type CwToastOptions } from '@cadenway/ui/components/toast';
import { type Observable, of, throwError } from 'rxjs';
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
 * Backlog and Sprint 14 of the Produit space.
 *
 * @type {readonly ListDestination[]}
 */
const destinations: readonly ListDestination[] = [
  {
    listId: 'backlog',
    listName: 'Backlog',
    spaceId: 'produit',
    spaceName: 'Produit',
    sprintEnd: null,
  },
  {
    listId: 'sprint-14',
    listName: 'Sprint 14',
    spaceId: 'produit',
    spaceName: 'Produit',
    sprintEnd: '2026-11-17',
  },
];

/**
 * Constant space
 *
 * @description
 * Produit, whose next key is CAD-495.
 *
 * @type {SpaceSetup}
 */
const space: SpaceSetup = {
  spaceId: 'produit',
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
  let navigate: Mock<(commands: readonly unknown[]) => Promise<boolean>>;
  let fixture: ComponentFixture<TaskCreateDialog>;

  beforeEach(async () => {
    create = vi.fn(() => of({ key: 'CAD-495', listId: 'sprint-14', status: 'todo', subtasks: 1 }));
    createSubtask = vi.fn(() =>
      of({ key: 'CAD-496', listId: 'sprint-14', status: 'todo', subtasks: 0 }),
    );
    show = vi.fn(() => 't1');
    error = vi.fn(() => 't2');
    navigate = vi.fn(() => Promise.resolve(true));
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
        { provide: Router, useValue: { navigate } },
      ],
    });
    fixture = TestBed.createComponent(TaskCreateDialog);
    await fixture.whenStable();
  });

  afterEach(() => {
    TestBed.inject(TaskCreate).close();
  });

  it('opens with N outside fields', async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', code: 'KeyN' }));
    await fixture.whenStable();

    expect(TestBed.inject(TaskCreate).isOpen()).toBe(true);
    expect(document.querySelector('[role="dialog"] h2')?.textContent.trim()).toBe(
      'Créer une tâche',
    );
  });

  it('creates the task in the preset list and offers « Ouvrir »', async () => {
    TestBed.inject(TaskCreate).open({ listId: 'sprint-14' });
    await fixture.whenStable();

    expect(
      document.querySelector('[data-testid="task-create-destination"]')?.textContent,
    ).toContain('Sprint 14');
    expect(document.querySelector('[data-testid="task-create-next-key"]')?.textContent.trim()).toBe(
      'CAD-495',
    );
    expect(buttonNamed('Créer la tâche')?.disabled).toBe(true);
    typeName('Préparer la démo');
    const subtask: HTMLInputElement | null = document.querySelector('#task-create-subtask');
    if (!subtask) throw new Error('No subtask field');
    subtask.value = 'Slides';
    subtask.dispatchEvent(new Event('input'));
    subtask.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    buttonNamed('Créer la tâche')?.click();
    await fixture.whenStable();

    expect(create).toHaveBeenCalledOnce();
    const [listId, draft, key]: [string, TaskDraft, string] = create.mock.calls[0];
    expect(listId).toBe('sprint-14');
    expect(key).toMatch(/^[0-9a-f-]{36}$/u);
    expect(draft).toMatchObject({
      name: 'Préparer la démo',
      status: 'todo',
      priority: 'moyenne',
      assigneeIds: ['u1'],
      subtasks: ['Slides'],
    });
    const [title, options]: [string, CwToastOptions?] = show.mock.calls[0];
    expect(title).toBe('Tâche CAD-495 créée');
    expect(options?.description).toBe('Sprint 14 · À faire · 1 sous-tâche.');
    expect(options?.action?.label).toBe('Ouvrir');
    options?.action?.run();
    expect(navigate).toHaveBeenCalledWith(['/', 'atelier-nord', 't', 'CAD-495']);
    expect(TestBed.inject(TaskCreate).isOpen()).toBe(false);
  });

  it('keeps the dialog open with an empty name for « Créer d’autres tâches »', async () => {
    TestBed.inject(TaskCreate).open();
    await fixture.whenStable();
    document.querySelector<HTMLButtonElement>('#task-create-more')?.click();
    typeName('Première');
    await fixture.whenStable();
    buttonNamed('Créer la tâche')?.click();
    await fixture.whenStable();

    expect(create).toHaveBeenCalledWith('backlog', expect.anything(), expect.any(String));
    expect(TestBed.inject(TaskCreate).isOpen()).toBe(true);
    expect(document.querySelector<HTMLInputElement>('#task-create-name')?.value).toBe('');
  });

  it('creates a subtask under its parent', async () => {
    TestBed.inject(TaskCreate).open({ parentKey: 'CAD-482' });
    await fixture.whenStable();
    typeName('Relire le parcours');
    await fixture.whenStable();
    buttonNamed('Créer la tâche')?.click();
    await fixture.whenStable();

    expect(createSubtask).toHaveBeenCalledWith(
      'CAD-482',
      expect.objectContaining({ subtasks: [] }),
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('keeps the fields and reuses the Idempotency-Key when the creation fails', async () => {
    create.mockReturnValueOnce(throwError(() => new Error('503')));
    TestBed.inject(TaskCreate).open();
    await fixture.whenStable();
    typeName('Préparer la démo');
    await fixture.whenStable();
    buttonNamed('Créer la tâche')?.click();
    await fixture.whenStable();

    expect(error).toHaveBeenCalledOnce();
    expect(TestBed.inject(TaskCreate).isOpen()).toBe(true);
    buttonNamed('Créer la tâche')?.click();
    await fixture.whenStable();
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][2]).toBe(create.mock.calls[0][2]);
  });

  it('asks the reason before taking « Annulé »', async () => {
    TestBed.inject(TaskCreate).open();
    await fixture.whenStable();
    const caret: HTMLButtonElement | undefined = Array.from(
      document.querySelectorAll<HTMLButtonElement>('cw-task-status-picker button'),
    ).at(-1);
    caret?.click();
    await fixture.whenStable();
    Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      .find((item: HTMLElement) => item.textContent.trim().startsWith('Annulé'))
      ?.click();
    await fixture.whenStable();

    expect(document.body.textContent).toContain('Annuler CAD-495 ?');
    buttonNamed('Annuler la tâche')?.click();
    typeName('Doublon de CAD-482');
    await fixture.whenStable();
    buttonNamed('Créer la tâche')?.click();
    await fixture.whenStable();

    expect(create.mock.calls[0][1]).toMatchObject({
      status: 'cancelled',
      cancelReason: 'duplicate',
    });
  });
});
