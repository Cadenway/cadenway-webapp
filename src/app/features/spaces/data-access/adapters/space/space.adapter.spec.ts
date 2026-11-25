import type { Favorite as FavoriteDto, Space as SpaceDto, TaskList } from '@cadenway/api-client';
import { describe, expect, it } from 'vitest';

import {
  toFavorite,
  toLookColor,
  toLookIcon,
  toMilestonePage,
  toSpace,
  toTaskList,
} from './space.adapter';

/**
 * Constant produit
 *
 * @description
 * The mockup's « Produit » space, as the gateway answers it.
 *
 * @type {SpaceDto}
 */
const produit: SpaceDto = {
  id: 'sp-produit',
  name: 'Produit',
  prefix: 'CAD',
  description: null,
  icon: 'rocket',
  color: 'violet',
  visibility: 'private',
  owner: { userId: 'u-camille' },
  statuses: {
    triage: { category: 'open', name: null, hidden: true },
    backlog: { category: 'open', name: null, hidden: false },
    todo: { category: 'open', name: 'À démarrer', hidden: false },
    progress: { category: 'open', name: null, hidden: false },
    review: { category: 'open', name: null, hidden: false },
    testing: { category: 'open', name: null, hidden: false },
    waiting: { category: 'open', name: null, hidden: false },
    blocked: { category: 'open', name: null, hidden: false },
    done: { category: 'closed', name: null, hidden: false },
    cancelled: { category: 'closed', name: null, hidden: false },
  },
  nextKey: 'CAD-500',
  createdAt: '2026-01-01T00:00:00Z',
  version: 3,
} as unknown as SpaceDto;

/**
 * Constant sprint14
 *
 * @description
 * The mockup's « Sprint 14 », as the gateway answers it.
 *
 * @type {TaskList}
 */
const sprint14: TaskList = {
  id: 'l-sprint14',
  spaceId: 'sp-produit',
  name: 'Sprint 14',
  icon: null,
  color: 'unknown-future',
  sprint: { startDate: '2026-11-03', endDate: '2026-11-17', goal: 'Livrer la connexion SSO' },
  createdAt: '2026-11-01T00:00:00Z',
  version: 4,
  callerRole: 'comment',
};

describe('space adapter', () => {
  it('maps a private space with its statuses in workflow order', () => {
    const space: ReturnType<typeof toSpace> = toSpace(produit);

    expect(space.private).toBe(true);
    expect(space.icon).toBe('rocket');
    expect(space.color).toBe('violet');
    expect(space.statuses.map((status) => status.key)).toEqual([
      'triage',
      'backlog',
      'todo',
      'progress',
      'review',
      'testing',
      'waiting',
      'blocked',
      'done',
      'cancelled',
    ]);
    expect(space.statuses[0]).toEqual({ key: 'triage', name: null, hidden: true });
    expect(space.statuses[2]?.name).toBe('À démarrer');
  });

  it('maps a sprint, reads an unknown color as gris and a non-edit role as read only', () => {
    const list: ReturnType<typeof toTaskList> = toTaskList(sprint14);

    expect(list.color).toBe('gris');
    expect(list.sprint?.startDate).toBe('2026-11-03');
    expect(list.canEdit).toBe(false);
    expect(list.archived).toBe(false);
    expect(
      toTaskList({ ...sprint14, callerRole: 'edit', archivedAt: '2026-11-20T00:00:00Z' }),
    ).toMatchObject({
      canEdit: true,
      archived: true,
    });
  });

  it('drops unknown look values', () => {
    expect(toLookIcon('dragon')).toBeNull();
    expect(toLookIcon(null)).toBeNull();
    expect(toLookColor(undefined)).toBe('gris');
  });

  it('maps milestones and favorites, leaving unknown favorite kinds out', () => {
    const page: ReturnType<typeof toMilestonePage> = toMilestonePage({
      total: 1,
      nextCursor: null,
      items: [
        {
          key: 'CAD-490',
          name: 'Démo client',
          status: 'unknown',
          listId: 'l-sprint14',
          dueDate: '2026-11-20',
          milestone: true,
        },
      ],
    } as never);
    const favorite: FavoriteDto = {
      id: 'f1',
      kind: 'saved-view',
      targetId: 'sv-bugs',
      target: { name: 'Bugs critiques', href: '/v1/x', listId: 'l-bugs' },
      createdAt: '2026-11-01T00:00:00Z',
      version: 1,
    };

    expect(page.items[0]).toEqual({
      key: 'CAD-490',
      name: 'Démo client',
      status: 'todo',
      listId: 'l-sprint14',
      dueDate: '2026-11-20',
    });
    expect(toFavorite(favorite)).toEqual({
      id: 'f1',
      kind: 'saved-view',
      targetId: 'sv-bugs',
      name: 'Bugs critiques',
      listId: 'l-bugs',
    });
    expect(toFavorite({ ...favorite, kind: 'document' })).toBeNull();
  });
});
