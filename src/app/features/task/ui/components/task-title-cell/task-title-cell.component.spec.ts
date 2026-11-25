import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { StatusKey } from '@cadenway/contracts';
import { describe, expect, it } from 'vitest';

import type { TaskSummary } from '../../../models/task-summary/task-summary.interface';
import { TaskTitleCell } from './task-title-cell.component';

/**
 * Constant task
 *
 * @description
 * CAD-482 with 3 subtasks, one done, repeating every week, a subtask of CAD-470.
 *
 * @type {TaskSummary}
 */
const task: TaskSummary = {
  id: 'CAD-482',
  key: 'CAD-482',
  name: 'Refondre l’écran de connexion SSO',
  status: 'todo',
  cancelReason: null,
  priority: 'haute',
  assigneeIds: [],
  due: null,
  start: null,
  labels: [],
  subtasks: { closed: 1, total: 3 },
  checklist: { closed: 2, total: 4 },
  comments: 5,
  parentKey: 'CAD-470',
  milestone: false,
  recurrence: 'weekly',
  listId: 'sprint-14',
  spaceId: 'produit',
  version: 1,
};

/**
 * Function render
 *
 * @description
 * Renders the cell.
 *
 * @param {TaskSummary} value - Task to show.
 * @param {boolean} [showParent] - Whether the parent hint shows.
 * @returns {Promise<ComponentFixture<TaskTitleCell>>} The fixture.
 */
async function render(
  value: TaskSummary,
  showParent: boolean = false,
): Promise<ComponentFixture<TaskTitleCell>> {
  const fixture: ComponentFixture<TaskTitleCell> = TestBed.createComponent(TaskTitleCell);
  fixture.componentRef.setInput('task', value);
  fixture.componentRef.setInput('showParent', showParent);
  await fixture.whenStable();
  return fixture;
}

describe('TaskTitleCell', () => {
  it('shows the name, the key, the subtask progress and the comment count', async () => {
    const host: HTMLElement = (await render(task)).nativeElement as HTMLElement;

    expect(host.textContent).toContain('Refondre l’écran de connexion SSO');
    expect(host.textContent).toContain('CAD-482');
    expect(host.textContent).toContain('1/3');
    expect(host.textContent).not.toContain('2/4');
    expect(host.textContent).toContain('5');
    expect(host.textContent).not.toContain('CAD-470');
  });

  it('shows the checklist without subtasks and the parent hint when asked', async () => {
    const host: HTMLElement = (
      await render({ ...task, subtasks: { closed: 0, total: 0 }, comments: null }, true)
    ).nativeElement as HTMLElement;

    expect(host.textContent).toContain('2/4');
    expect(host.textContent).toContain('CAD-470');
  });

  it('emits the next status from the icon and opens from the name', async () => {
    const fixture: ComponentFixture<TaskTitleCell> = await render(task);
    const statuses: (StatusKey | null)[] = [];
    let opened: number = 0;
    fixture.componentInstance.statusClicked.subscribe((status: StatusKey | null) =>
      statuses.push(status),
    );
    fixture.componentInstance.opened.subscribe(() => (opened += 1));
    const [statusButton, nameButton]: HTMLButtonElement[] = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    );

    statusButton.click();
    nameButton.click();

    expect(statuses).toEqual(['progress']);
    expect(opened).toBe(1);
  });

  it('shows the displayed status rather than the saved one', async () => {
    const fixture: ComponentFixture<TaskTitleCell> = await render(task);
    const statuses: (StatusKey | null)[] = [];
    fixture.componentInstance.statusClicked.subscribe((status: StatusKey | null) =>
      statuses.push(status),
    );
    fixture.componentRef.setInput('status', 'done');
    await fixture.whenStable();

    (fixture.nativeElement as HTMLElement).querySelector('button')?.click();

    expect(statuses).toEqual([null]);
  });
});
