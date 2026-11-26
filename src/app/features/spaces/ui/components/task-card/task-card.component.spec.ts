import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { beforeEach, describe, expect, it } from 'vitest';

import { personOf, type TaskSummary } from '@features/task';

import { TaskCard } from './task-card.component';

/**
 * Constant cad482
 *
 * @description
 * `CAD-482` of Sprint 14 (Atelier Nord): urgent, two labels, two of three subtasks closed,
 * assigned to Inès.
 *
 * @type {TaskSummary}
 */
const cad482: TaskSummary = {
  id: 'CAD-482',
  key: 'CAD-482',
  name: 'Redesign the SSO sign-in screen',
  status: 'progress',
  cancelReason: null,
  priority: 'urgente',
  assigneeIds: ['u-ines'],
  due: '2026-11-27',
  start: null,
  labels: ['Auth', 'Design'],
  subtasks: { closed: 2, total: 3 },
  checklist: { closed: 0, total: 0 },
  comments: null,
  parentKey: null,
  milestone: false,
  recurrence: 'none',
  listId: 'sprint-14',
  spaceId: 'product',
  version: 3,
};

describe('TaskCard', () => {
  let fixture: ComponentFixture<TaskCard>;

  /**
   * Function render
   *
   * @description
   * Renders the card of a task.
   *
   * @param {TaskSummary} task - The task.
   * @param {Record<string, unknown>} [inputs] - Other inputs.
   * @returns {HTMLButtonElement} The card's button.
   */
  function render(task: TaskSummary, inputs: Record<string, unknown> = {}): HTMLButtonElement {
    fixture = TestBed.createComponent(TaskCard);
    fixture.componentRef.setInput('task', task);
    fixture.componentRef.setInput('people', [
      personOf('u-ines', 'Inès Robert'),
      personOf('u-camille', 'Camille Martin'),
    ]);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
    const button: HTMLButtonElement | null = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLButtonElement>('button');
    if (!button) throw new Error('The card renders no button.');
    return button;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
  });

  it('shows the key, the priority, the name, the labels, the progress and the assignees', () => {
    const card: HTMLButtonElement = render(cad482);
    const text: string = card.textContent.replace(/\s+/g, ' ');

    expect(text).toContain('CAD-482');
    expect(text).toContain('Urgent');
    expect(text).toContain('Redesign the SSO sign-in screen');
    expect(text).toContain('Auth');
    expect(text).toContain('Design');
    expect(text).toContain('2/3');
    expect(card.querySelector('[title="Inès Robert"]')?.textContent.trim()).toBe('IR');
    expect(card.querySelector('[title="Camille Martin"]')).toBeNull();
  });

  it('falls back on the checklist and shows nothing without either', () => {
    expect(
      render({ ...cad482, subtasks: { closed: 0, total: 0 }, checklist: { closed: 1, total: 4 } })
        .textContent,
    ).toContain('1/4');
    expect(render({ ...cad482, subtasks: { closed: 0, total: 0 } }).textContent.includes('/')).toBe(
      false,
    );
  });

  it('strikes the name through once the shown status is cancelled', () => {
    const card: HTMLButtonElement = render(cad482, { status: 'cancelled' });
    const name: HTMLElement | undefined = [...card.querySelectorAll<HTMLElement>('span')]
      .filter((span: HTMLElement): boolean => span.textContent.trim() === cad482.name)
      .at(-1);

    expect(name?.classList.contains('line-through')).toBe(true);
  });

  it('emits the task when clicked', () => {
    const card: HTMLButtonElement = render(cad482);
    const opened: TaskSummary[] = [];
    fixture.componentInstance.opened.subscribe((task: TaskSummary) => opened.push(task));

    card.click();

    expect(opened).toEqual([cad482]);
  });

  it('shows the status, the name and the key on one line as a side panel item', () => {
    const item: HTMLButtonElement = render(cad482, { variant: 'item' });
    const text: string = item.textContent.replace(/\s+/g, ' ').trim();

    expect(text).toContain('Redesign the SSO sign-in screen');
    expect(text).toContain('CAD-482');
    expect(text).not.toContain('Urgent');
  });
});
