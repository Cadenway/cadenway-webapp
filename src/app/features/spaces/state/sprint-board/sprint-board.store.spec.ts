import { TestBed } from '@angular/core/testing';
import { CwToastService } from '@cadenway/ui/components/toast';
import { of, Subject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SprintBoardApi } from '../../data-access/services/sprint-board/sprint-board.service';
import type {
  BoardCard,
  BoardColumn,
  BoardLocation,
} from '../../models/sprint-board/sprint-board.model';
import { SprintBoardStore } from './sprint-board.store';

/**
 * Constant location
 *
 * @description
 * The fixture sprint belongs to the caller's resolved organization and permits edits.
 *
 * @type {BoardLocation}
 */
const location: BoardLocation = {
  organizationId: 'org-a',
  spaceId: 'products',
  listId: 'sprint-14',
  mayEdit: true,
};

/**
 * Constant sso
 *
 * @description
 * The existing card and write version when the user opens the sprint board.
 *
 * @type {BoardCard}
 */
const sso: BoardCard = {
  key: 'CAD-482',
  name: 'Refondre l’écran de connexion SSO',
  status: 'progress',
  version: 12,
  milestone: false,
  priority: 'haute',
  dueDate: '2026-11-12',
  labels: ['Auth', 'Front'],
  subtaskCounts: { total: 3, closed: 1 },
};

/**
 * Constant columns
 *
 * @description
 * Three visible status groups before any card movement.
 *
 * @type {readonly BoardColumn[]}
 */
const columns: readonly BoardColumn[] = [
  {
    status: 'todo',
    label: 'À faire',
    cards: [],
    count: 0,
    hasPreviousPage: false,
    nextCursor: null,
  },
  {
    status: 'progress',
    label: 'En cours',
    cards: [sso],
    count: 1,
    hasPreviousPage: false,
    nextCursor: null,
  },
  {
    status: 'review',
    label: 'En revue',
    cards: [],
    count: 0,
    hasPreviousPage: false,
    nextCursor: null,
  },
];

describe('SprintBoardStore', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('replaces an unsent move and serializes edits while its versioned write is in flight', async () => {
    vi.useFakeTimers();
    const response: Subject<BoardCard> = new Subject<BoardCard>();
    const changeStatus: ReturnType<typeof vi.fn<SprintBoardApi['changeStatus']>> = vi.fn<
      SprintBoardApi['changeStatus']
    >(() => response);
    const toast: Pick<CwToastService, 'success' | 'dismiss'> = {
      success: vi.fn(() => 'fixture-toast'),
      dismiss: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        SprintBoardStore,
        { provide: SprintBoardApi, useValue: { load: () => of(columns), changeStatus } },
        { provide: CwToastService, useValue: toast },
      ],
    });
    const store: InstanceType<typeof SprintBoardStore> = TestBed.inject(SprintBoardStore);
    store.connect(location);
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();

    store.move(sso.key, 'todo');
    await vi.advanceTimersByTimeAsync(200);
    store.move(sso.key, 'review');
    expect(store.columns().find((column) => column.status === 'progress')?.cards).toEqual([sso]);
    expect(store.moves()[sso.key]?.status).toBe('review');

    await vi.advanceTimersByTimeAsync(459);
    expect(changeStatus).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(store.columns().find((column) => column.status === 'review')?.cards).toEqual([
      { ...sso, status: 'review' },
    ]);

    store.move(sso.key, 'todo');
    expect(changeStatus).toHaveBeenCalledExactlyOnceWith(location, sso, 'review');
    response.next({ ...sso, status: 'review', version: 13 });
    response.complete();
    await Promise.resolve();
    expect(store.moves()[sso.key]).toBeUndefined();
    expect(toast.success).toHaveBeenCalledOnce();
  });
});
