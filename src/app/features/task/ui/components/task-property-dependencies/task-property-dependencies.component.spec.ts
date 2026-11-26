import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { beforeEach, describe, expect, it } from 'vitest';

import type {
  TaskDependency,
  TaskDependencyTask,
} from '../../../models/task-property/task-property.interface';
import {
  type DependencyLink,
  type DependencySearch,
  TaskPropertyDependencies,
} from './task-property-dependencies.component';

/**
 * Constant DEPENDENCIES
 *
 * @description
 * CAD-482 blocks CAD-490 and is blocked by CAD-479, which is due after CAD-482 starts.
 *
 * @type {readonly TaskDependency[]}
 */
const DEPENDENCIES: readonly TaskDependency[] = [
  {
    id: 'd2',
    direction: 'blocks',
    task: { key: 'CAD-490', name: 'Release notes', status: 'todo', milestone: false, due: null },
  },
  {
    id: 'd1',
    direction: 'blocked-by',
    task: {
      key: 'CAD-479',
      name: 'Rate limit the sign-in',
      status: 'progress',
      milestone: false,
      due: '2026-11-10',
    },
  },
];

/**
 * Constant CANDIDATE
 *
 * @description
 * A task the dialog offers.
 *
 * @type {TaskDependencyTask}
 */
const CANDIDATE: TaskDependencyTask = {
  key: 'CAD-488',
  name: 'Workload gauges',
  status: 'todo',
  milestone: false,
  due: null,
};

describe('TaskPropertyDependencies', () => {
  let fixture: ComponentFixture<TaskPropertyDependencies>;
  let searched: DependencySearch[];
  let added: DependencyLink[];
  let removed: TaskDependency[];

  /**
   * Function host
   *
   * @description
   * The row's element.
   *
   * @returns {HTMLElement} The element.
   */
  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /**
   * Function openDialog
   *
   * @description
   * Opens `Add a dependency`.
   *
   * @returns {Promise<void>} Resolves once open.
   */
  async function openDialog(): Promise<void> {
    document
      .querySelector<HTMLButtonElement>('[data-testid="task-property-dependency-add"]')
      ?.click();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
    fixture = TestBed.createComponent(TaskPropertyDependencies);
    searched = [];
    added = [];
    removed = [];
    fixture.componentInstance.searched.subscribe((search: DependencySearch) =>
      searched.push(search),
    );
    fixture.componentInstance.added.subscribe((link: DependencyLink) => added.push(link));
    fixture.componentInstance.removed.subscribe((edge: TaskDependency) => removed.push(edge));
    fixture.componentRef.setInput('today', '2026-11-08');
    fixture.componentRef.setInput('dependencies', DEPENDENCIES);
    fixture.componentRef.setInput('anchor', { start: '2026-11-09', due: '2026-11-12' });
    await fixture.whenStable();
  });

  it('lists Blocked by before Blocks and warns about an open blocker', () => {
    const text: string = host().textContent;

    expect(text.indexOf('Blocked by')).toBeLessThan(text.indexOf('Blocks'));
    expect(text).toContain('CAD-479 · Rate limit the sign-in');
    expect(text).toContain('Starts before CAD-479 ends (Tue 10 Nov)');
  });

  it('emits the removed dependency', () => {
    host()
      .querySelector<HTMLButtonElement>('[aria-label="Remove the dependency with CAD-490"]')
      ?.click();

    expect(removed).toEqual([DEPENDENCIES[0]]);
  });

  it('searches at once on opening, debounced while typing, and adds a pick', async () => {
    await openDialog();
    expect(searched).toEqual([{ direction: 'blocked-by', text: '', delay: false }]);

    const field: HTMLInputElement | null = document.querySelector<HTMLInputElement>(
      'input[placeholder="Name or key"]',
    );
    if (!field) throw new Error('No search');
    field.value = 'gauge';
    field.dispatchEvent(new Event('input'));
    expect(searched.at(-1)).toEqual({ direction: 'blocked-by', text: 'gauge', delay: true });

    fixture.componentRef.setInput('candidates', [CANDIDATE]);
    await fixture.whenStable();
    Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
      .find((button: HTMLButtonElement) => button.textContent.includes('Workload gauges'))
      ?.click();
    expect(added).toEqual([{ task: CANDIDATE, direction: 'blocked-by' }]);
  });

  it('says that no task matches', async () => {
    await openDialog();

    expect(document.body.textContent).toContain('No task matches (loops are left out).');
  });

  it('hides the remove buttons and the addition when disabled', async () => {
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();

    expect(host().querySelector('[aria-label^="Remove the dependency"]')).toBeNull();
    expect(host().querySelector('[data-testid="task-property-dependency-add"]')).toBeNull();
  });
});
