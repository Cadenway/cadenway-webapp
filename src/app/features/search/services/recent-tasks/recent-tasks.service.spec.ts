import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';

import type { TaskSearchResult } from '../../models/search-result/search-result.interface';
import { RecentTasks } from './recent-tasks.service';

/**
 * Function task
 *
 * @description
 * A task of the mockup's Sprint 14.
 *
 * @param {string} key - Task key.
 * @returns {TaskSearchResult} The task.
 */
function task(key: string): TaskSearchResult {
  return { kind: 'task', key, name: `Tâche ${key}`, status: 'todo' };
}

describe('RecentTasks', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('keeps the last five tasks of an organization, the latest first, without duplicates', () => {
    const recent: RecentTasks = TestBed.inject(RecentTasks);
    for (const key of ['CAD-1', 'CAD-2', 'CAD-3', 'CAD-4', 'CAD-5', 'CAD-6', 'CAD-3']) {
      recent.remember('org-1', task(key));
    }

    expect(recent.list('org-1').map((entry: TaskSearchResult) => entry.key)).toEqual([
      'CAD-3',
      'CAD-6',
      'CAD-5',
      'CAD-4',
      'CAD-2',
    ]);
    expect(recent.list('org-2')).toEqual([]);
  });

  it('ignores a corrupt history', () => {
    localStorage.setItem('cadenway-recent-tasks:org-1', '[{"kind":"task","key":1},"x"');
    expect(TestBed.inject(RecentTasks).list('org-1')).toEqual([]);
    localStorage.setItem(
      'cadenway-recent-tasks:org-1',
      JSON.stringify([task('CAD-1'), { kind: 'task', key: 'CAD-2', name: 'x', status: 'nope' }]),
    );
    expect(TestBed.inject(RecentTasks).list('org-1')).toEqual([task('CAD-1')]);
  });
});
