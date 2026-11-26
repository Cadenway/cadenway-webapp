import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { beforeEach, describe, expect, it } from 'vitest';

import type { TaskApproval } from '../../../models/task-property/task-property.interface';
import { personOf } from '../../../utils/person/person.util';
import { TaskPropertyApprovers } from './task-property-approvers.component';

/**
 * Constant APPROVAL
 *
 * @description
 * A round where Inès approved and Hugo has not voted.
 *
 * @type {TaskApproval}
 */
const APPROVAL: TaskApproval = {
  taskVersion: 7,
  reviewers: [
    { userId: 'u2', decision: 'approved' },
    { userId: 'u3', decision: null },
  ],
};

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
    '[data-testid="task-property-approvers"]',
  );
  if (!found) throw new Error('No trigger');
  return found;
}

/**
 * Function items
 *
 * @description
 * The checkbox items of the open menu.
 *
 * @returns {HTMLElement[]} The items.
 */
function items(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]'));
}

describe('TaskPropertyApprovers', () => {
  let fixture: ComponentFixture<TaskPropertyApprovers>;
  let toggled: string[];

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
    fixture = TestBed.createComponent(TaskPropertyApprovers);
    toggled = [];
    fixture.componentInstance.toggled.subscribe((id: string) => toggled.push(id));
    fixture.componentRef.setInput('people', [
      personOf('u1', 'Camille Martin'),
      personOf('u2', 'Inès Robert'),
      personOf('u3', 'Hugo Durand'),
    ]);
    fixture.componentRef.setInput('currentUserId', 'u1');
    await fixture.whenStable();
  });

  it('offers Add approvers without a round', async () => {
    fixture.componentRef.setInput('approval', { taskVersion: 7, reviewers: [] });
    await fixture.whenStable();

    expect(trigger().textContent.trim()).toBe('Add approvers');
  });

  it('shows each vote and the approvals against the reviewers', async () => {
    fixture.componentRef.setInput('approval', APPROVAL);
    await fixture.whenStable();

    expect(trigger().textContent).toContain('1 of 2');
    expect(trigger().textContent).toContain('Inès Robert · Approved');
    expect(trigger().textContent).toContain('Hugo Durand · Waiting');
  });

  it('emits a toggle and keeps the last reviewer', async () => {
    fixture.componentRef.setInput('approval', APPROVAL);
    await fixture.whenStable();
    trigger().click();
    await fixture.whenStable();
    expect(document.body.textContent).toContain('Must approve before delivery');
    items()[0].click();
    expect(toggled).toEqual(['u1']);

    fixture.componentRef.setInput('approval', {
      taskVersion: 8,
      reviewers: [{ userId: 'u2', decision: null }],
    });
    await fixture.whenStable();
    expect(items()[1].getAttribute('aria-disabled')).toBe('true');
    expect(items()[2].getAttribute('aria-disabled')).toBeNull();
  });

  it('is inert while the round is read and when disabled', async () => {
    expect(trigger().disabled).toBe(true);
    fixture.componentRef.setInput('approval', APPROVAL);
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();
    expect(trigger().disabled).toBe(true);
  });
});
