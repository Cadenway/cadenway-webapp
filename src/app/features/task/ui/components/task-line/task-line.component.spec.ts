import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { StatusKey } from '@cadenway/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Person } from '../../../models/person/person.interface';
import type { TaskSummary } from '../../../models/task-summary/task-summary.interface';
import { personOf } from '../../../utils/person/person.util';
import { TaskLine, type TaskLineVariant } from './task-line.component';

/**
 * Constant task
 *
 * @description
 * CAD-482 of Sprint 14 in Atelier Nord, urgent and due on 5 November, three days before the
 * mockup's today.
 *
 * @type {TaskSummary}
 */
const task: TaskSummary = {
  id: 'CAD-482',
  key: 'CAD-482',
  name: 'Redesign the SSO sign-in screen',
  status: 'progress',
  cancelReason: null,
  priority: 'urgente',
  assigneeIds: ['u-claire', 'u-ines'],
  due: '2026-11-05',
  start: null,
  labels: [],
  subtasks: { closed: 0, total: 0 },
  checklist: { closed: 0, total: 0 },
  comments: null,
  parentKey: null,
  milestone: false,
  recurrence: 'none',
  listId: 'sprint-14',
  spaceId: 'product',
  version: 3,
};

/**
 * Constant people
 *
 * @description
 * The two assignees of CAD-482.
 *
 * @type {readonly Person[]}
 */
const people: readonly Person[] = [
  personOf('u-claire', 'Claire Martin'),
  personOf('u-ines', 'Inès Roy'),
];

/**
 * Interface LineInputs
 *
 * @description
 * The inputs a spec sets besides the task.
 */
interface LineInputs {
  // #region Properties
  /**
   * Property variant
   *
   * @description
   * Variant of the line.
   *
   * @type {TaskLineVariant | undefined}
   * @readonly
   */
  readonly variant?: TaskLineVariant;

  /**
   * Property status
   *
   * @description
   * Status shown over the task's own.
   *
   * @type {StatusKey | null | undefined}
   * @readonly
   */
  readonly status?: StatusKey | null;
  // #endregion
}

/**
 * Function render
 *
 * @description
 * Renders a line of CAD-482 in `Sprint 14`.
 *
 * @param {TaskSummary} value - The task.
 * @param {LineInputs} [inputs] - Variant and shown status.
 * @returns {Promise<ComponentFixture<TaskLine>>} The fixture.
 */
async function render(
  value: TaskSummary,
  inputs: LineInputs = {},
): Promise<ComponentFixture<TaskLine>> {
  const fixture: ComponentFixture<TaskLine> = TestBed.createComponent(TaskLine);
  fixture.componentRef.setInput('task', value);
  fixture.componentRef.setInput('listName', 'Sprint 14');
  fixture.componentRef.setInput('people', people);
  if (inputs.variant) fixture.componentRef.setInput('variant', inputs.variant);
  if (inputs.status !== undefined) fixture.componentRef.setInput('status', inputs.status);
  await fixture.whenStable();
  return fixture;
}

/**
 * Function buttonOf
 *
 * @description
 * The line's single button.
 *
 * @param {ComponentFixture<TaskLine>} fixture - The fixture.
 * @returns {HTMLButtonElement} The button.
 */
function buttonOf(fixture: ComponentFixture<TaskLine>): HTMLButtonElement {
  const button: HTMLButtonElement | null = (fixture.nativeElement as HTMLElement).querySelector(
    'button',
  );
  if (!button) throw new Error('The line has no button');
  return button;
}

describe('TaskLine', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 8, 10));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the row of My tasks: status, name, key, list, late due date and priority', async () => {
    const button: HTMLButtonElement = buttonOf(await render(task));
    const text: string = button.textContent;

    expect(text).toContain('In progress');
    expect(text).toContain('Redesign the SSO sign-in screen');
    expect(text).toContain('CAD-482');
    expect(text).toContain('Sprint 14');
    expect(text).toContain('5 Nov');
    expect(text).toContain('(late)');
    expect(text).toContain('Urgent');
    expect(button.querySelector('[data-testid="task-line-priority"]')?.className).toContain(
      'text-destructive',
    );
  });

  it('emits the task once when the line is clicked, its status icon included', async () => {
    const fixture: ComponentFixture<TaskLine> = await render(task);
    const opened: TaskSummary[] = [];
    fixture.componentInstance.opened.subscribe((value: TaskSummary) => opened.push(value));

    const icon: HTMLElement | null = buttonOf(fixture).querySelector('cw-status-icon');
    icon?.click();

    expect(opened).toEqual([task]);
  });

  it('shows the pending status and strikes the name through once cancelled', async () => {
    const fixture: ComponentFixture<TaskLine> = await render(task, { status: 'cancelled' });
    const name: HTMLElement | null = buttonOf(fixture).querySelector(
      '[data-testid="task-line-name"]',
    );

    expect(buttonOf(fixture).textContent).toContain('Cancelled');
    expect(name?.className).toContain('line-through');
    expect(buttonOf(fixture).textContent).not.toContain('(late)');
  });

  it('puts the key and the list under the name in the priority variant', async () => {
    const text: string = buttonOf(await render(task, { variant: 'priority' })).textContent;

    expect(text.replace(/\s+/g, ' ')).toContain('CAD-482 · Sprint 14');
    expect(text).toContain('Urgent');
  });

  it('shows the assignees instead of the key and the priority in the late variant', async () => {
    const button: HTMLButtonElement = buttonOf(await render(task, { variant: 'late' }));

    expect(button.textContent).toContain('CM');
    expect(button.textContent).toContain('Claire Martin, Inès Roy');
    expect(button.textContent).not.toContain('CAD-482');
    expect(button.querySelector('[data-testid="task-line-priority"]')).toBeNull();
  });
});
