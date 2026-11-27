import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { describe, expect, it, type Mock, vi } from 'vitest';

import type {
  GettingStartedItem,
  GettingStartedItemKey,
} from '../../../state/getting-started/getting-started-item.interface';
import { GettingStartedPanel } from './getting-started-panel.component';

/**
 * Constant ITEMS
 *
 * @description
 * The three items, the first task created.
 *
 * @type {readonly GettingStartedItem[]}
 */
const ITEMS: readonly GettingStartedItem[] = [
  { key: 'task', done: true },
  { key: 'invite', done: false },
  { key: 'board', done: false },
];

/**
 * Function render
 *
 * @description
 * Renders the panel.
 *
 * @param {readonly GettingStartedItem[]} items - The items.
 * @param {boolean} expanded - Whether the list shows.
 * @returns {ComponentFixture<GettingStartedPanel>} The panel.
 */
function render(
  items: readonly GettingStartedItem[] = ITEMS,
  expanded: boolean = true,
): ComponentFixture<GettingStartedPanel> {
  TestBed.configureTestingModule({
    imports: [GettingStartedPanel],
    providers: [provideCadenwayIcons()],
  });
  const fixture: ComponentFixture<GettingStartedPanel> =
    TestBed.createComponent(GettingStartedPanel);
  fixture.componentRef.setInput('items', items);
  fixture.componentRef.setInput('expanded', expanded);
  fixture.detectChanges();
  return fixture;
}

/**
 * Function find
 *
 * @description
 * Finds an element of the panel by `data-testid`.
 *
 * @param {ComponentFixture<GettingStartedPanel>} fixture - The panel.
 * @param {string} id - The test id.
 * @returns {HTMLElement | null} The element.
 */
function find(fixture: ComponentFixture<GettingStartedPanel>, id: string): HTMLElement | null {
  return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-testid="${id}"]`);
}

describe('GettingStartedPanel', () => {
  it('is a section named Getting started with the progress of its items', () => {
    const fixture: ComponentFixture<GettingStartedPanel> = render();

    const section: HTMLElement | null = find(fixture, 'getting-started-panel');
    expect(section?.tagName).toBe('SECTION');
    expect(section?.getAttribute('aria-label')).toBe('Getting started');
    expect(find(fixture, 'getting-started-counter')?.textContent.trim()).toBe('1 of 3');
    const bar: HTMLElement | null = find(fixture, 'getting-started-progress');
    expect(bar?.getAttribute('role')).toBe('progressbar');
    expect(bar?.getAttribute('aria-label')).toBe('Getting started');
    expect(bar?.getAttribute('aria-valuetext')).toBe('1 of 3');
  });

  it('names its buttons and tells the toggle state', () => {
    const fixture: ComponentFixture<GettingStartedPanel> = render();

    const toggle: HTMLElement | null = find(fixture, 'getting-started-toggle');
    expect(toggle?.getAttribute('aria-label')).toBe('Collapse the list');
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(find(fixture, 'getting-started-dismiss')?.getAttribute('aria-label')).toBe(
      'Hide “Getting started”',
    );
  });

  it('strikes the done items through and names them done', () => {
    const fixture: ComponentFixture<GettingStartedPanel> = render();

    const task: HTMLElement | null = find(fixture, 'getting-started-item-task');
    expect(task?.textContent.trim()).toBe('Create your first task');
    expect(task?.getAttribute('aria-label')).toBe('Create your first task (done)');
    expect(task?.querySelector('.line-through')).not.toBeNull();
    const invite: HTMLElement | null = find(fixture, 'getting-started-item-invite');
    expect(invite?.textContent.trim()).toBe('Invite a team member');
    expect(invite?.hasAttribute('aria-label')).toBe(false);
    expect(invite?.querySelector('.line-through')).toBeNull();
    expect(find(fixture, 'getting-started-item-board')?.textContent.trim()).toBe(
      'Try the Board view',
    );
    expect(find(fixture, 'getting-started-all-done')).toBeNull();
  });

  it('shows the header alone when collapsed', () => {
    const fixture: ComponentFixture<GettingStartedPanel> = render(ITEMS, false);

    expect(find(fixture, 'getting-started-item-task')).toBeNull();
    expect(find(fixture, 'getting-started-toggle')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('says everything is ready once every item is done', () => {
    const fixture: ComponentFixture<GettingStartedPanel> = render(
      ITEMS.map((item: GettingStartedItem): GettingStartedItem => ({ ...item, done: true })),
    );

    expect(find(fixture, 'getting-started-all-done')?.textContent.trim()).toBe(
      'All set. You can hide this list.',
    );
  });

  it('emits the toggle, the dismissal and the item pressed', () => {
    const fixture: ComponentFixture<GettingStartedPanel> = render();
    const toggled: Mock = vi.fn();
    const dismissed: Mock = vi.fn();
    const picked: Mock = vi.fn();
    fixture.componentInstance.toggled.subscribe(() => {
      toggled();
    });
    fixture.componentInstance.dismissed.subscribe(() => {
      dismissed();
    });
    fixture.componentInstance.picked.subscribe((key: GettingStartedItemKey) => {
      picked(key);
    });

    find(fixture, 'getting-started-toggle')?.click();
    find(fixture, 'getting-started-dismiss')?.click();
    find(fixture, 'getting-started-item-board')?.click();

    expect(toggled).toHaveBeenCalledTimes(1);
    expect(dismissed).toHaveBeenCalledTimes(1);
    expect(picked).toHaveBeenCalledWith('board');
  });
});
