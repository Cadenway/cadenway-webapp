import { Component, signal, type WritableSignal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { PriorityKey, StatusKey } from '@cadenway/contracts';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwContextMenuTriggerFor } from '@cadenway/ui/components/context-menu';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { defaultStatusOptions, type Person, personOf, type TaskSummary } from '@features/task';

import type { MoveTarget } from '../../../models/view-task-write/view-task-write.interface';
import { TaskMenu } from './task-menu.component';

/**
 * Function task
 *
 * @description
 * A task of Sprint 14 in the `Product` space of Atelier Nord.
 *
 * @param {string} key - Task key.
 * @param {string} name - Task name.
 * @param {Partial<TaskSummary>} [rest] - Other members.
 * @returns {TaskSummary} The task.
 */
function task(key: string, name: string, rest: Partial<TaskSummary> = {}): TaskSummary {
  return {
    id: key,
    key,
    name,
    status: 'todo',
    cancelReason: null,
    priority: 'haute',
    assigneeIds: [],
    due: null,
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
    ...rest,
  };
}

/**
 * Constant lists
 *
 * @description
 * Two lists of the `Product` space the tasks may move to.
 *
 * @type {readonly MoveTarget[]}
 */
const lists: readonly MoveTarget[] = [
  {
    listId: 'sprint-14',
    name: 'Sprint 14',
    spaceName: 'Product',
    icon: 'phosphorLightningBold',
    tone: '',
  },
  {
    listId: 'backlog',
    name: 'Backlog',
    spaceName: 'Product',
    icon: 'phosphorListBulletsBold',
    tone: '',
  },
];

/**
 * Component TaskMenuHost
 *
 * @description
 * Opens the task menu from a button, as a view's triggers do, and records what it emits.
 */
@Component({
  imports: [CwContextMenuTriggerFor, TaskMenu],
  template: `
    <button type="button" [cwContextMenuTriggerFor]="menu.menu()">Task</button>
    <cw-task-menu
      #menu
      [tasks]="tasks()"
      [status]="status()"
      [statuses]="statuses"
      [people]="people"
      userId="u-camille"
      [lists]="lists"
      (openRequested)="events.push('open ' + $event.key)"
      (statusPicked)="events.push('status ' + $event)"
      (priorityPicked)="events.push('priority ' + $event)"
      (assigneeToggled)="events.push('assignee ' + $event)"
      (moved)="events.push('move ' + $event)"
      (remindRequested)="events.push('remind')"
      (duplicateRequested)="events.push('duplicate')"
      (copyLinkRequested)="events.push('link')"
      (copyKeyRequested)="events.push('key')"
      (deleteRequested)="events.push('delete')"
    />
  `,
})
class TaskMenuHost {
  // #region Properties
  /**
   * Property tasks
   *
   * @description
   * The tasks of the menu.
   *
   * @type {WritableSignal<readonly TaskSummary[]>}
   * @readonly
   */
  public readonly tasks: WritableSignal<readonly TaskSummary[]> = signal<readonly TaskSummary[]>(
    [],
  );

  /**
   * Property status
   *
   * @description
   * The status the tasks show.
   *
   * @type {WritableSignal<StatusKey | null>}
   * @readonly
   */
  public readonly status: WritableSignal<StatusKey | null> = signal<StatusKey | null>('todo');

  /**
   * Property statuses
   *
   * @description
   * The default statuses.
   *
   * @type {ReturnType<typeof defaultStatusOptions>}
   * @readonly
   */
  public readonly statuses: ReturnType<typeof defaultStatusOptions> = defaultStatusOptions();

  /**
   * Property people
   *
   * @description
   * Camille (the signed-in member) and Inès.
   *
   * @type {readonly Person[]}
   * @readonly
   */
  public readonly people: readonly Person[] = [
    personOf('u-camille', 'Camille Martin'),
    personOf('u-ines', 'Inès Robert'),
  ];

  /**
   * Property lists
   *
   * @description
   * The lists offered under `Move to`.
   *
   * @type {readonly MoveTarget[]}
   * @readonly
   */
  public readonly lists: readonly MoveTarget[] = lists;

  /**
   * Property events
   *
   * @description
   * What the menu emitted, in order.
   *
   * @type {string[]}
   * @readonly
   */
  public readonly events: string[] = [];
  // #endregion
}

describe('TaskMenu', () => {
  let fixture: ComponentFixture<TaskMenuHost>;

  /**
   * Function settle
   *
   * @description
   * Runs change detection until the menus are stable.
   *
   * @returns {Promise<void>} Resolves once settled.
   */
  async function settle(): Promise<void> {
    for (let round: number = 0; round < 3; round++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
  }

  /**
   * Function items
   *
   * @description
   * The texts of the menu items shown, in the document (menus render in an overlay).
   *
   * @returns {string[]} The texts.
   */
  function items(): string[] {
    return [
      ...document.querySelectorAll<HTMLElement>(
        '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]',
      ),
    ].map((element: HTMLElement): string => element.textContent.trim().replace(/\s+/g, ' '));
  }

  /**
   * Function item
   *
   * @description
   * The menu item whose text holds a label (a person's initials come first).
   *
   * @param {string} label - The label.
   * @returns {HTMLElement} The item; the test fails without it.
   */
  function item(label: string): HTMLElement {
    const found: HTMLElement | undefined = [
      ...document.querySelectorAll<HTMLElement>(
        '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]',
      ),
    ].find((element: HTMLElement): boolean => element.textContent.includes(label));
    if (!found) throw new Error(`No menu item holds ${label}.`);
    return found;
  }

  /**
   * Function open
   *
   * @description
   * Opens the menu for tasks with a right click on the trigger.
   *
   * @param {readonly TaskSummary[]} tasks - The tasks of the menu.
   * @returns {Promise<void>} Resolves once the menu shows.
   */
  async function open(tasks: readonly TaskSummary[]): Promise<void> {
    fixture.componentInstance.tasks.set(tasks);
    await settle();
    (fixture.nativeElement as HTMLElement)
      .querySelector('button')
      ?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await settle();
  }

  /**
   * Function openSubmenu
   *
   * @description
   * Opens a submenu of the open menu.
   *
   * @param {string} label - The item that opens it.
   * @returns {Promise<void>} Resolves once the submenu shows.
   */
  async function openSubmenu(label: string): Promise<void> {
    item(label).click();
    await settle();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
    fixture = TestBed.createComponent(TaskMenuHost);
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('names one task and offers to open, copy, duplicate and delete it', async () => {
    await open([task('CAD-482', 'Redesign the SSO sign-in screen')]);

    expect(document.body.textContent).toContain('CAD-482 · Redesign the SSO sign-in screen');
    expect(items()).toEqual(
      expect.arrayContaining([
        'OpenEnter',
        'Status',
        'Priority',
        'Assign',
        'Move to',
        'Remind me tomorrow morning',
        'Duplicate',
        'Copy the link',
        'Copy the identifier',
        'Delete the task',
      ]),
    );
    item('Open').click();
    await settle();
    await open([task('CAD-482', 'Redesign the SSO sign-in screen')]);
    item('Delete the task').click();
    await settle();

    expect(fixture.componentInstance.events).toEqual(['open CAD-482', 'delete']);
  });

  it('acts on a selection of several tasks without Open', async () => {
    await open([task('CAD-482', 'Sign-in'), task('CAD-483', 'Quotas')]);

    expect(document.body.textContent).toContain('2 tasks selected');
    expect(items()).not.toContain('OpenEnter');
    expect(items()).toEqual(
      expect.arrayContaining(['Remind me of these tasks tomorrow morning', 'Delete the 2 tasks']),
    );
  });

  it('offers the statuses by category with hints and emits the one picked', async () => {
    await open([task('CAD-482', 'Sign-in')]);
    await openSubmenu('Status');

    expect(document.body.textContent).toContain('Not started');
    expect(document.body.textContent).toContain('Active');
    expect(document.body.textContent).toContain('Closed');
    item('In progress').click();
    await settle();

    expect(fixture.componentInstance.events).toEqual(['status progress']);
  });

  it("offers a milestone's four statuses only", async () => {
    await open([task('CAD-490', 'Beta release', { milestone: true })]);
    await openSubmenu('Status');

    expect(items().filter((text: string) => text.startsWith('In progress'))).toEqual([]);
    expect(items()).toEqual(expect.arrayContaining(['ReachedThe due date is kept']));
  });

  it('ticks the person every task has, names the signed-in member and emits a toggle', async () => {
    await open([
      task('CAD-482', 'Sign-in', { assigneeIds: ['u-ines'] }),
      task('CAD-483', 'Quotas', { assigneeIds: ['u-ines', 'u-camille'] }),
    ]);
    await openSubmenu('Assign');

    expect(item('Inès Robert').getAttribute('aria-checked')).toBe('true');
    expect(item('Camille Martin (me)').getAttribute('aria-checked')).toBe('false');
    item('Camille Martin (me)').click();
    await settle();

    expect(fixture.componentInstance.events).toEqual(['assignee u-camille']);
  });

  it('leaves out of Move to the list every task already sits in', async () => {
    await open([task('CAD-482', 'Sign-in')]);
    await openSubmenu('Move to');

    expect(items().some((text: string) => text.startsWith('Sprint 14'))).toBe(false);
    item('Backlog').click();
    await settle();

    expect(fixture.componentInstance.events).toEqual(['move backlog']);
  });

  it('ticks the shared priority and emits the one picked', async () => {
    await open([task('CAD-482', 'Sign-in', { priority: 'urgente' as PriorityKey })]);
    await openSubmenu('Priority');

    item('Low').click();
    await settle();

    expect(fixture.componentInstance.events).toEqual(['priority basse']);
  });
});
