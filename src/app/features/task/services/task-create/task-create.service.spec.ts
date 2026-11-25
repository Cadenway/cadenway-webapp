import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ShellOverlay } from '@shared/layout-slot';

import type { CreatedTask } from '../../models/task-create/task-create.interface';
import { TASK_CREATE_DIALOG, TaskCreate } from './task-create.service';

describe('TaskCreate', () => {
  it('opens the dialog with presets through the shell overlays', () => {
    const taskCreate: TaskCreate = TestBed.inject(TaskCreate);

    expect(taskCreate.open({ listId: 'sprint-14', status: 'progress' })).toBe(true);
    expect(taskCreate.isOpen()).toBe(true);
    expect(TestBed.inject(ShellOverlay).openId()).toBe(TASK_CREATE_DIALOG);
    expect(taskCreate.options()).toEqual({ listId: 'sprint-14', status: 'progress' });
    taskCreate.close();
    expect(taskCreate.isOpen()).toBe(false);
  });

  it('never opens over another shell overlay and keeps its presets then', () => {
    const taskCreate: TaskCreate = TestBed.inject(TaskCreate);
    TestBed.inject(ShellOverlay).open('search.command-palette');

    expect(taskCreate.open({ listId: 'backlog' })).toBe(false);
    expect(taskCreate.isOpen()).toBe(false);
    expect(taskCreate.options()).toEqual({});
  });

  it('announces the created tasks', () => {
    const taskCreate: TaskCreate = TestBed.inject(TaskCreate);
    const created: CreatedTask[] = [];
    taskCreate.created.subscribe((task: CreatedTask) => created.push(task));
    const task: CreatedTask = { key: 'CAD-495', listId: 'sprint-14', status: 'todo', subtasks: 0 };

    taskCreate.announce(task);

    expect(created).toEqual([task]);
  });
});
