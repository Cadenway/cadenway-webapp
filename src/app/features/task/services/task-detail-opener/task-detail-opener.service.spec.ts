import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { TaskDetailOpener } from './task-detail-opener.service';

/**
 * Component ListViewStub
 *
 * @description
 * Stands for the page under the detail.
 */
@Component({ selector: 'cw-list-view-stub', template: '' })
class ListViewStub {}

describe('TaskDetailOpener', () => {
  let opener: TaskDetailOpener;
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'atelier-nord/l/:listId/list', component: ListViewStub }]),
      ],
    });
    router = TestBed.inject(Router);
    opener = TestBed.inject(TaskDetailOpener);
    await router.navigateByUrl('/atelier-nord/l/sprint-14/list?group=status');
  });

  it('merges the task into the address and keeps the requested tab out of it', async () => {
    await opener.open('CAD-482', undefined, { tab: 'subtasks' });

    expect(router.url).toBe('/atelier-nord/l/sprint-14/list?group=status&task=CAD-482');
    expect(opener.taskKey()).toBe('CAD-482');
  });

  it('hands the requested tab to the column once, for that task only', async () => {
    await opener.open('CAD-482', undefined, { tab: 'subtasks' });

    expect(opener.takeTab('CAD-470')).toBeNull();
    expect(opener.takeTab('CAD-482')).toBe('subtasks');
    expect(opener.takeTab('CAD-482')).toBeNull();
  });

  it('forgets the tab when another task opens without one or the detail closes', async () => {
    await opener.open('CAD-482', undefined, { tab: 'subtasks' });
    await opener.open('CAD-482');
    expect(opener.takeTab('CAD-482')).toBeNull();

    await opener.open('CAD-482', undefined, { tab: 'comments' });
    await opener.close();
    expect(opener.takeTab('CAD-482')).toBeNull();
    expect(router.url).toBe('/atelier-nord/l/sprint-14/list?group=status');
  });

  it('opens nothing for a value that is not a task key, and removes it on close', async () => {
    for (const value of ['cad-482', 'CAD-0', 'C-1', 'CAD-482/../x', '%3Cscript%3E', ' ']) {
      await router.navigateByUrl(`/atelier-nord/l/sprint-14/list?task=${value}`);
      expect(opener.taskKey()).toBeNull();
    }

    await opener.close();
    expect(router.url).toBe('/atelier-nord/l/sprint-14/list');

    await router.navigateByUrl('/atelier-nord/l/sprint-14/list?task=OPS-12');
    expect(opener.taskKey()).toBe('OPS-12');
  });
});
