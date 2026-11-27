import { Component, signal, type WritableSignal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwMenu, CwMenuItem } from '@cadenway/ui/components/menu';
import { describe, expect, it } from 'vitest';

import type { TaskSummary } from '@features/task';

import type { MyTaskRow } from '../../../models/my-tasks-group/my-tasks-group.interface';
import { MyTasksGroup } from './my-tasks-group.component';

/**
 * Function row
 *
 * @description
 * A line of Atelier Nord's `Sprint 14`.
 *
 * @param {string} key - The task's key.
 * @returns {MyTaskRow} The line.
 */
function row(key: string): MyTaskRow {
  const task: TaskSummary = {
    id: key,
    key,
    name: 'Review of the SSO flow',
    status: 'todo',
    cancelReason: null,
    priority: 'haute',
    assigneeIds: ['u-camille'],
    due: '2026-11-10',
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
  return { task, status: 'progress', listName: 'Sprint 14' };
}

/**
 * Component GroupHost
 *
 * @description
 * A page rendering one group with a menu, recording what the group emits.
 */
@Component({
  selector: 'cw-group-host',
  imports: [CwMenu, CwMenuItem, MyTasksGroup],
  template: `
    <cw-my-tasks-group
      label="Late"
      [late]="true"
      [rows]="rows"
      [menu]="menu"
      (opened)="opened.set($event.key)"
      (menuOpened)="menuFor.set($event.key)"
    />
    <cw-menu #menu ariaLabel="Task">
      <button cwMenuItem type="button">Open</button>
    </cw-menu>
  `,
})
class GroupHost {
  // #region Properties
  /**
   * Property rows
   *
   * @description
   * The lines shown.
   *
   * @type {readonly MyTaskRow[]}
   * @readonly
   */
  protected readonly rows: readonly MyTaskRow[] = [row('CAD-470'), row('CAD-482')];

  /**
   * Property opened
   *
   * @description
   * Key of the last opened line.
   *
   * @type {WritableSignal<string | null>}
   * @readonly
   */
  public readonly opened: WritableSignal<string | null> = signal<string | null>(null);

  /**
   * Property menuFor
   *
   * @description
   * Key of the last line that opened the menu.
   *
   * @type {WritableSignal<string | null>}
   * @readonly
   */
  public readonly menuFor: WritableSignal<string | null> = signal<string | null>(null);
  // #endregion
}

describe('MyTasksGroup', () => {
  /**
   * Function render
   *
   * @description
   * Renders the host.
   *
   * @returns {ComponentFixture<GroupHost>} The fixture.
   */
  function render(): ComponentFixture<GroupHost> {
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
    const fixture: ComponentFixture<GroupHost> = TestBed.createComponent(GroupHost);
    fixture.detectChanges();
    return fixture;
  }

  it('names its section, counts its lines and paints the late heading grenat', () => {
    const element: HTMLElement = render().nativeElement as HTMLElement;

    const section: HTMLElement | null = element.querySelector('section');
    expect(section?.getAttribute('aria-label')).toBe('Late');
    const heading: HTMLElement | null = element.querySelector('h2');
    expect(heading?.textContent.replace(/\s+/gu, ' ').trim()).toBe('Late, 2');
    expect(heading?.classList.contains('text-grenat-text')).toBe(true);
    expect(element.querySelectorAll('li cw-task-line')).toHaveLength(2);
  });

  it('opens a line and names the line that opened the menu', () => {
    const fixture: ComponentFixture<GroupHost> = render();
    const element: HTMLElement = fixture.nativeElement as HTMLElement;
    const lines: NodeListOf<HTMLElement> = element.querySelectorAll('li');

    lines[0].querySelector('button')?.click();
    lines[1].dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, clientX: 4, clientY: 4 }),
    );

    expect(fixture.componentInstance.opened()).toBe('CAD-470');
    expect(fixture.componentInstance.menuFor()).toBe('CAD-482');
  });

  it('gives the focus back to the line after a menu opened with a right click closes', async () => {
    const fixture: ComponentFixture<GroupHost> = render();
    const element: HTMLElement = fixture.nativeElement as HTMLElement;
    const item: HTMLElement = element.querySelectorAll<HTMLElement>('li')[1];

    item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 4, clientY: 4 }));
    fixture.detectChanges();
    await fixture.whenStable();
    const focused: Element | null = document.activeElement;
    expect(item.contains(focused)).toBe(false);
    (focused ?? document.body).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(item.querySelector('button'));
  });
});
