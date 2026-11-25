import { describe, expect, it } from 'vitest';

import type { TaskDraft } from '../../../models/task-create/task-create.interface';
import {
  toListDestination,
  toSubtaskCreation,
  toTaskCreation,
  toTaskTemplateOption,
} from './task-create.adapter';

/**
 * Constant draft
 *
 * @description
 * A task drafted in Sprint 14 with two subtasks and a checklist from the Bug template.
 *
 * @type {TaskDraft}
 */
const draft: TaskDraft = {
  name: 'Bug : export CSV vide',
  description: '',
  status: 'todo',
  cancelReason: null,
  cancelNote: '',
  priority: 'haute',
  assigneeIds: ['u1'],
  due: '2026-11-12',
  labels: ['Bug'],
  subtasks: ['Reproduire', 'Corriger'],
  checklist: ['Reproduit en local'],
};

describe('task create adapters', () => {
  it('sends the draft and leaves out the empty description', () => {
    expect(toTaskCreation(draft)).toEqual({
      name: 'Bug : export CSV vide',
      status: 'todo',
      priority: 'haute',
      assigneeIds: ['u1'],
      dueDate: '2026-11-12',
      labels: ['Bug'],
      subtasks: [{ name: 'Reproduire' }, { name: 'Corriger' }],
      checklist: [{ text: 'Reproduit en local' }],
    });
  });

  it('sends the cancel reason only with the cancelled status, and a blank note as null', () => {
    expect(
      toTaskCreation({ ...draft, status: 'cancelled', cancelReason: 'duplicate' }),
    ).toMatchObject({ status: 'cancelled', cancelReason: 'duplicate', cancelNote: null });
    expect(toTaskCreation({ ...draft, cancelReason: 'duplicate' })).not.toHaveProperty(
      'cancelReason',
    );
  });

  it('creates a subtask alone, without drafted subtasks or checklist', () => {
    const body: ReturnType<typeof toSubtaskCreation> = toSubtaskCreation({
      ...draft,
      description: 'Contexte',
    });

    expect(body).toEqual({
      name: 'Bug : export CSV vide',
      description: 'Contexte',
      status: 'todo',
      priority: 'haute',
      assigneeIds: ['u1'],
      dueDate: '2026-11-12',
      labels: ['Bug'],
    });
  });

  it('names a destination by its space and keeps the end of its sprint', () => {
    expect(
      toListDestination(
        {
          id: 'produit',
          name: 'Produit',
          prefix: 'CAD',
          description: null,
          icon: null,
          color: 'violet',
          visibility: 'organization',
          owner: { userId: 'u1' },
          statuses: {} as never,
          nextKey: 'CAD-495',
          createdAt: '2026-11-01T10:00:00Z',
          version: 1,
        },
        {
          id: 'sprint-14',
          spaceId: 'produit',
          name: 'Sprint 14',
          icon: null,
          color: 'violet',
          sprint: { startDate: '2026-11-03', endDate: '2026-11-17', goal: null },
          createdAt: '2026-11-03T10:00:00Z',
          version: 1,
        },
      ),
    ).toEqual({
      listId: 'sprint-14',
      listName: 'Sprint 14',
      spaceId: 'produit',
      spaceName: 'Produit',
      sprintEnd: '2026-11-17',
    });
  });

  it('maps a saved template with an empty description', () => {
    expect(
      toTaskTemplateOption({
        id: 'tpl-bug',
        spaceId: 'produit',
        name: 'Bug',
        title: 'Bug : ',
        description: null,
        priority: 'haute',
        labels: ['Bug'],
        checklist: ['Reproduit en local'],
        subtasks: [],
        createdAt: '2026-11-01T10:00:00Z',
        version: 1,
      }),
    ).toEqual({
      id: 'tpl-bug',
      name: 'Bug',
      title: 'Bug : ',
      description: '',
      priority: 'haute',
      labels: ['Bug'],
      checklist: ['Reproduit en local'],
      subtasks: [],
    });
  });
});
