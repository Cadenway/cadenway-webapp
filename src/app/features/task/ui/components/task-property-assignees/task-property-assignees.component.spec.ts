import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Person } from '../../../models/person/person.interface';
import { personOf } from '../../../utils/person/person.util';
import { TaskPropertyAssignees } from './task-property-assignees.component';

/**
 * Constant PEOPLE
 *
 * @description
 * The members of Atelier Nord.
 *
 * @type {readonly Person[]}
 */
const PEOPLE: readonly Person[] = [
  personOf('u1', 'Camille Martin'),
  personOf('u2', 'Inès Robert'),
  personOf('u3', 'Hugo Durand'),
  personOf('u4', 'Léa Petit'),
  personOf('u5', 'Noé Bernard'),
  personOf('u6', 'Zoé Lambert'),
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
    '[data-testid="task-property-assignees"]',
  );
  if (!found) throw new Error('No trigger');
  return found;
}

describe('TaskPropertyAssignees', () => {
  let fixture: ComponentFixture<TaskPropertyAssignees>;
  let toggled: string[];

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
    fixture = TestBed.createComponent(TaskPropertyAssignees);
    toggled = [];
    fixture.componentInstance.toggled.subscribe((id: string) => toggled.push(id));
    fixture.componentRef.setInput('people', PEOPLE);
    fixture.componentRef.setInput('currentUserId', 'u1');
    await fixture.whenStable();
  });

  it('shows Empty without assignees', () => {
    expect(trigger().textContent.trim()).toBe('Empty');
  });

  it('draws five initials and +N titled with the other names', async () => {
    fixture.componentRef.setInput('assigneeIds', ['u1', 'u2', 'u3', 'u4', 'u5', 'u6']);
    await fixture.whenStable();

    expect(trigger().textContent).toContain('CM');
    expect(trigger().textContent).toContain('+1');
    expect(trigger().querySelector('[title="Zoé Lambert"]')).not.toBeNull();
    expect(trigger().textContent).toContain('Camille Martin, Inès Robert, Hugo Durand');
  });

  it('lists the people with (me) and emits the ticked account', async () => {
    fixture.componentRef.setInput('assigneeIds', ['u2']);
    await fixture.whenStable();
    trigger().click();
    await fixture.whenStable();
    const items: HTMLElement[] = Array.from(
      document.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]'),
    );

    expect(items[0].textContent).toContain('Camille Martin (me)');
    expect(items[1].getAttribute('aria-checked')).toBe('true');
    items[2].click();
    expect(toggled).toEqual(['u3']);
  });

  it('offers Retry after a failed read of the people', async () => {
    const retried: number[] = [];
    fixture.componentInstance.retried.subscribe(() => retried.push(1));
    fixture.componentRef.setInput('failed', true);
    await fixture.whenStable();
    trigger().click();
    await fixture.whenStable();
    const retry: HTMLElement | undefined = Array.from(
      document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ).find((item: HTMLElement) => item.textContent.trim() === 'Retry');

    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not load this information.',
    );
    retry?.click();
    expect(retried).toHaveLength(1);
  });

  it('is read-only when disabled', async () => {
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();

    expect(trigger().disabled).toBe(true);
  });
});
