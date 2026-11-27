import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type Observable, of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { TaskDetailOpener } from '@features/task';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceOrganization,
} from '@features/workspace/ports/workspace-context';

import { GoalsApi } from '../../data-access/services/goals-api/goals-api.service';
import type { MilestoneState } from '../../models/goal/goal.interface';
import { GoalMilestonesStore, MILESTONE_CONCURRENCY } from './goal-milestones.store';

/**
 * Constant ATELIER_NORD
 *
 * @description
 * The organization the workspace shows.
 *
 * @type {WorkspaceOrganization}
 */
const ATELIER_NORD: WorkspaceOrganization = {
  id: 'o1',
  slug: 'atelier-nord',
  name: 'Atelier Nord',
  initials: 'AN',
  role: 'owner',
  plan: 'team',
};

describe('GoalMilestonesStore', () => {
  let reads: Map<string, Subject<MilestoneState>>;
  let milestone: Mock<(key: string) => Observable<MilestoneState>>;
  let closed: Subject<string>;

  beforeEach(() => {
    reads = new Map<string, Subject<MilestoneState>>();
    milestone = vi.fn((key: string): Observable<MilestoneState> => {
      const read: Subject<MilestoneState> = new Subject<MilestoneState>();
      reads.set(key, read);
      return read;
    });
    closed = new Subject<string>();
    TestBed.configureTestingModule({
      providers: [
        GoalMilestonesStore,
        { provide: GoalsApi, useValue: { milestone } },
        { provide: WORKSPACE_CONTEXT, useValue: { organization: signal(ATELIER_NORD) } },
        { provide: TaskDetailOpener, useValue: { closed, changed: new Subject<string>() } },
      ],
    });
  });

  it('reads at most four milestone tasks at once', () => {
    const store: InstanceType<typeof GoalMilestonesStore> = TestBed.inject(GoalMilestonesStore);
    const keys: readonly string[] = ['CAD-1', 'CAD-2', 'CAD-3', 'CAD-4', 'CAD-5', 'CAD-6'];
    store.follow(signal(keys));
    TestBed.tick();

    expect(milestone).toHaveBeenCalledTimes(MILESTONE_CONCURRENCY);
    expect(store.milestones()['CAD-6']).toBe('unknown');
    reads.get('CAD-1')?.next({ key: 'CAD-1', dueDate: '2026-12-10' });
    reads.get('CAD-1')?.complete();

    expect(milestone).toHaveBeenCalledTimes(MILESTONE_CONCURRENCY + 1);
    expect(store.milestones()['CAD-1']).toEqual({ key: 'CAD-1', dueDate: '2026-12-10' });
  });

  it('cancels the reads in flight when the keys change and keeps what is known', () => {
    const store: InstanceType<typeof GoalMilestonesStore> = TestBed.inject(GoalMilestonesStore);
    const keys: WritableSignal<readonly string[]> = signal<readonly string[]>(['CAD-580']);
    store.follow(keys);
    TestBed.tick();
    const first: Subject<MilestoneState> | undefined = reads.get('CAD-580');
    first?.next('missing');
    first?.complete();

    keys.set(['CAD-580', 'CAD-581']);
    TestBed.tick();
    const pending: Subject<MilestoneState> | undefined = reads.get('CAD-581');
    expect(store.milestones()).toEqual({ 'CAD-580': 'missing', 'CAD-581': 'unknown' });

    keys.set(['CAD-580']);
    TestBed.tick();
    expect(pending?.observed).toBe(false);
    expect(store.milestones()).toEqual({ 'CAD-580': 'missing' });
  });

  it('reads them again when a task detail closes', () => {
    milestone.mockImplementation(() => of({ key: 'CAD-580', dueDate: null }));
    const store: InstanceType<typeof GoalMilestonesStore> = TestBed.inject(GoalMilestonesStore);
    store.follow(signal(['CAD-580']));
    TestBed.tick();

    closed.next('CAD-580');

    expect(milestone).toHaveBeenCalledTimes(2);
  });
});
