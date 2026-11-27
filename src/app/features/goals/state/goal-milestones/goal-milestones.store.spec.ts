import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type Observable, of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { TaskDetailOpener } from '@features/task';

import { GoalsApi } from '../../data-access/services/goals-api/goals-api.service';
import type { MilestoneState } from '../../models/goal/goal.interface';
import { GoalMilestonesStore, MILESTONE_CONCURRENCY } from './goal-milestones.store';

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

  it('reads only the task whose detail closed, and only the new keys of a set', () => {
    milestone.mockImplementation((key: string) => of({ key, dueDate: null }));
    const store: InstanceType<typeof GoalMilestonesStore> = TestBed.inject(GoalMilestonesStore);
    const keys: WritableSignal<readonly string[]> = signal<readonly string[]>([
      'CAD-580',
      'CAD-581',
    ]);
    store.follow(keys);
    TestBed.tick();
    milestone.mockClear();

    closed.next('CAD-581');
    closed.next('CAD-999');
    expect(milestone.mock.calls).toEqual([['CAD-581']]);

    milestone.mockClear();
    keys.set(['CAD-580', 'CAD-581', 'CAD-582']);
    TestBed.tick();
    expect(milestone.mock.calls).toEqual([['CAD-582']]);
  });

  it('settles a task with its newest read only', () => {
    const store: InstanceType<typeof GoalMilestonesStore> = TestBed.inject(GoalMilestonesStore);
    store.follow(signal(['CAD-580']));
    TestBed.tick();
    const older: Subject<MilestoneState> | undefined = reads.get('CAD-580');

    closed.next('CAD-580');
    const newer: Subject<MilestoneState> | undefined = reads.get('CAD-580');
    expect(older?.observed).toBe(false);
    newer?.next({ key: 'CAD-580', dueDate: '2026-12-20' });
    older?.next({ key: 'CAD-580', dueDate: '2026-11-01' });

    expect(store.milestones()['CAD-580']).toEqual({ key: 'CAD-580', dueDate: '2026-12-20' });
  });
});
