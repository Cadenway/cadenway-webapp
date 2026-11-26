import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { beforeEach, describe, expect, it } from 'vitest';

import type { TaskListOption } from '../../dialogs/task-list-picker-dialog/task-list-picker-dialog.component';
import { TaskPropertyList } from './task-property-list.component';

/**
 * Constant LISTS
 *
 * @description
 * Lists of Atelier Nord's Product space.
 *
 * @type {readonly TaskListOption[]}
 */
const LISTS: readonly TaskListOption[] = [
  { id: 'sprint-14', name: 'Sprint 14', spaceName: 'Product', icon: 'list' },
  { id: 'backlog', name: 'Backlog', spaceName: 'Product', icon: 'list' },
];

/**
 * Function trigger
 *
 * @description
 * The row's trigger.
 *
 * @returns {HTMLButtonElement} The trigger.
 */
function trigger(): HTMLButtonElement {
  const found: HTMLButtonElement | null = document.querySelector<HTMLButtonElement>(
    '[data-testid="task-property-list"]',
  );
  if (!found) throw new Error('No trigger');
  return found;
}

describe('TaskPropertyList', () => {
  let fixture: ComponentFixture<TaskPropertyList>;
  let picked: TaskListOption[];

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
    fixture = TestBed.createComponent(TaskPropertyList);
    picked = [];
    fixture.componentInstance.picked.subscribe((list: TaskListOption) => picked.push(list));
    fixture.componentRef.setInput('listName', 'Sprint 14');
    fixture.componentRef.setInput('spaceName', 'Product');
    fixture.componentRef.setInput('currentListId', 'sprint-14');
    fixture.componentRef.setInput('lists', LISTS);
    await fixture.whenStable();
  });

  it('shows the list and its space', () => {
    expect(trigger().textContent).toContain('Sprint 14');
    expect(trigger().textContent).toContain('Product');
  });

  it('emits another list, not the current one', async () => {
    trigger().click();
    await fixture.whenStable();
    const items: HTMLElement[] = Array.from(
      document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    );
    expect(items[0].getAttribute('aria-current')).not.toBeNull();
    items[0].click();
    expect(picked).toEqual([]);

    trigger().click();
    await fixture.whenStable();
    document.querySelectorAll<HTMLElement>('[role="menuitem"]')[1].click();
    expect(picked).toEqual([LISTS[1]]);
  });

  it('is inert without lists or when disabled', async () => {
    fixture.componentRef.setInput('lists', []);
    await fixture.whenStable();
    expect(trigger().disabled).toBe(true);

    fixture.componentRef.setInput('lists', LISTS);
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();
    expect(trigger().disabled).toBe(true);
  });
});
