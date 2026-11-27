import { Component, signal, type WritableSignal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwMenu, CwMenuItem } from '@cadenway/ui/components/menu';
import { beforeEach, describe, expect, it } from 'vitest';

import type { TaskSummary } from '@features/task';

import type { HomePriorityRow } from '../../../models/home-rows/home-rows.interface';
import { HomePriorities } from './home-priorities.component';

/**
 * Function row
 *
 * @description
 * A priority of Camille Martin in `Sprint 14`.
 *
 * @param {string} key - Its key.
 * @param {string} name - Its name.
 * @returns {HomePriorityRow} The line.
 */
function row(key: string, name: string): HomePriorityRow {
  const task: TaskSummary = {
    id: key,
    key,
    name,
    status: 'todo',
    cancelReason: null,
    priority: 'haute',
    assigneeIds: ['u-camille'],
    due: '2026-11-12',
    start: null,
    labels: [],
    subtasks: { closed: 0, total: 0 },
    checklist: { closed: 0, total: 0 },
    comments: null,
    parentKey: null,
    milestone: false,
    recurrence: 'none',
    listId: 'l-sprint-14',
    spaceId: 'sp-product',
    version: 3,
  };
  return { task, status: 'todo', listName: 'Sprint 14' };
}

/**
 * Component PrioritiesHost
 *
 * @description
 * Hosts `cw-home-priorities` with a menu and records its outputs.
 */
@Component({
  imports: [CwMenu, CwMenuItem, HomePriorities],
  template: `
    <cw-menu #menu ariaLabel="Task"><button cwMenuItem type="button">Open</button></cw-menu>
    <cw-home-priorities
      [rows]="rows()"
      allLink="/atelier-nord/my-tasks"
      [menu]="menu"
      (opened)="opened.push($event.key)"
      (menuOpened)="menus.push($event.key)"
    />
  `,
})
class PrioritiesHost {
  // #region Properties
  /**
   * Property rows
   *
   * @description
   * The lines given.
   *
   * @type {WritableSignal<readonly HomePriorityRow[]>}
   * @readonly
   */
  public readonly rows: WritableSignal<readonly HomePriorityRow[]> = signal<
    readonly HomePriorityRow[]
  >([row('CAD-470', 'Fix the login redirect'), row('CAD-482', 'Review of the SSO flow')]);

  /**
   * Property opened
   *
   * @description
   * The keys of the opened lines.
   *
   * @type {string[]}
   * @readonly
   */
  public readonly opened: string[] = [];

  /**
   * Property menus
   *
   * @description
   * The keys of the lines that opened the menu.
   *
   * @type {string[]}
   * @readonly
   */
  public readonly menus: string[] = [];
  // #endregion
}

describe('HomePriorities', () => {
  let fixture: ComponentFixture<PrioritiesHost>;
  let host: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideCadenwayIcons()] });
    fixture = TestBed.createComponent(PrioritiesHost);
    await fixture.whenStable();
    host = fixture.nativeElement as HTMLElement;
  });

  it('lists the priorities with their key and list, and links to all my tasks', () => {
    expect(host.querySelector('h2')?.textContent.trim()).toBe('My priorities');
    const lines: readonly string[] = Array.from(host.querySelectorAll('cw-task-line')).map(
      (line: Element) => line.textContent.replace(/\s+/gu, ' ').trim(),
    );
    expect(lines[0]).toContain('Fix the login redirect');
    expect(lines[0]).toContain('CAD-470 · Sprint 14');
    const all: HTMLAnchorElement | null = host.querySelector('a');
    expect(all?.textContent.trim()).toBe('See all my tasks');
    expect(all?.getAttribute('href')).toBe('/atelier-nord/my-tasks');
  });

  it('opens a line and says which line opened the menu', async () => {
    host.querySelector<HTMLButtonElement>('cw-task-line button')?.click();
    Array.from(host.querySelectorAll('li[tabindex]'))
      .at(1)
      ?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 8, clientY: 8 }));
    await fixture.whenStable();

    expect(fixture.componentInstance.opened).toEqual(['CAD-470']);
    expect(fixture.componentInstance.menus).toEqual(['CAD-482']);
  });

  it('hands the focus an item receives to its line', () => {
    const item: HTMLElement | null = host.querySelector('li[tabindex="-1"]');
    item?.focus();

    expect(document.activeElement).toBe(item?.querySelector('button'));
  });

  it('shows the empty paragraph when nothing is assigned', async () => {
    fixture.componentInstance.rows.set([]);
    await fixture.whenStable();

    expect(host.querySelector('cw-task-line')).toBeNull();
    expect(host.querySelector('[data-testid="home-priorities-empty"]')?.textContent.trim()).toBe(
      'Nothing is assigned to you. A good moment to move the backlog forward.',
    );
  });
});
