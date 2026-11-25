import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { StatusKey } from '@cadenway/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import type { StatusOption } from '../../../models/status-option/status-option.interface';
import { defaultStatusOptions } from '../../../utils/task-status/task-status.util';
import { TaskStatusPicker } from './task-status-picker.component';

/**
 * Interface Rendered
 *
 * @description
 * A rendered picker and what it emitted.
 */
interface Rendered {
  // #region Properties
  /**
   * Property fixture
   *
   * @description
   * The fixture.
   *
   * @type {ComponentFixture<TaskStatusPicker>}
   * @readonly
   */
  readonly fixture: ComponentFixture<TaskStatusPicker>;

  /**
   * Property emitted
   *
   * @description
   * Statuses emitted so far.
   *
   * @type {StatusKey[]}
   * @readonly
   */
  readonly emitted: StatusKey[];
  // #endregion
}

/**
 * Function render
 *
 * @description
 * Renders the picker and records what it emits.
 *
 * @param {StatusKey} status - Shown status.
 * @param {boolean} [milestone] - Whether the task is a milestone.
 * @param {readonly StatusOption[]} [options] - Statuses of the space.
 * @returns {Promise<Rendered>} The fixture and the emitted statuses.
 */
async function render(
  status: StatusKey,
  milestone: boolean = false,
  options: readonly StatusOption[] = [],
): Promise<Rendered> {
  const fixture: ComponentFixture<TaskStatusPicker> = TestBed.createComponent(TaskStatusPicker);
  const emitted: StatusKey[] = [];
  fixture.componentInstance.statusChanged.subscribe((value: StatusKey) => emitted.push(value));
  fixture.componentRef.setInput('status', status);
  fixture.componentRef.setInput('milestone', milestone);
  fixture.componentRef.setInput('options', options);
  await fixture.whenStable();
  return { fixture, emitted };
}

/**
 * Function menuItems
 *
 * @description
 * Texts of the open status menu's items.
 *
 * @returns {string[]} The texts.
 */
function menuItems(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).map(
    (item: HTMLElement) => item.textContent.trim(),
  );
}

describe('TaskStatusPicker', () => {
  afterEach(() => {
    document.body.querySelectorAll('.cdk-overlay-container').forEach((node: Element) => {
      node.remove();
    });
  });

  it('moves to the next status from its main part', async () => {
    const { fixture, emitted }: Rendered = await render('todo');
    const main: HTMLButtonElement | null = (fixture.nativeElement as HTMLElement).querySelector(
      'button',
    );

    expect(main?.getAttribute('aria-label')).toBe('Statut : À faire. Passer à « En cours »');
    main?.click();

    expect(emitted).toEqual(['progress']);
  });

  it('groups the visible statuses by category and emits the chosen one', async () => {
    const options: readonly StatusOption[] = defaultStatusOptions().map((option: StatusOption) =>
      option.key === 'waiting' ? { ...option, hidden: true } : option,
    );
    const { fixture, emitted }: Rendered = await render('todo', false, options);
    const caret: HTMLButtonElement | null = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]:last-of-type');
    caret?.click();
    await fixture.whenStable();

    expect(document.body.textContent).toContain('Non commencé');
    expect(document.body.textContent).toContain('Fermé');
    expect(menuItems().some((text: string) => text.startsWith('En attente'))).toBe(false);
    Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      .find((item: HTMLElement) => item.textContent.trim().startsWith('Bloqué'))
      ?.click();

    expect(emitted).toEqual(['blocked']);
  });

  it('offers a milestone its four statuses only', async () => {
    const { fixture }: Rendered = await render('todo', true);
    const caret: HTMLButtonElement | null = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]:last-of-type');
    caret?.click();
    await fixture.whenStable();

    expect(menuItems()).toHaveLength(4);
    expect(document.body.textContent).toContain('À venir');
    expect(document.body.textContent).toContain('Atteint');
  });

  it('names the milestone action for upcoming and reached milestones', async () => {
    const upcoming: Rendered = await render('todo', true);
    expect(
      (upcoming.fixture.nativeElement as HTMLElement)
        .querySelector('button')
        ?.getAttribute('aria-label'),
    ).toBe('Marquer le jalon comme atteint');
    upcoming.fixture.componentRef.setInput('status', 'done');
    await upcoming.fixture.whenStable();
    expect(
      (upcoming.fixture.nativeElement as HTMLElement)
        .querySelector('button')
        ?.getAttribute('aria-label'),
    ).toBe('Changer le statut du jalon');
  });
});
