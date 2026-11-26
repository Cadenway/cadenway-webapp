import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Person } from '../../../models/person/person.interface';
import type { TaskApprovalRound } from '../../../models/task-detail-sections/task-detail-sections.interface';
import { TaskApprovalCard } from './task-approval-card.component';

/**
 * Constant ROUND
 *
 * @description
 * Camille Martin asked Hugo Dubois (approved) and herself (waiting) to approve CAD-482.
 *
 * @type {TaskApprovalRound}
 */
const ROUND: TaskApprovalRound = {
  id: 'r1',
  requesterId: 'u1',
  requestedAt: '2026-11-06T09:00:00Z',
  status: 'pending',
  reviews: [
    { userId: 'u2', decision: 'approved' },
    { userId: 'u1', decision: null },
  ],
};

/**
 * Constant PEOPLE
 *
 * @description
 * The members of Atelier Nord.
 *
 * @type {ReadonlyMap<string, Person>}
 */
const PEOPLE: ReadonlyMap<string, Person> = new Map<string, Person>([
  ['u1', { id: 'u1', name: 'Camille Martin', initials: 'CM', avatar: null }],
  ['u2', { id: 'u2', name: 'Hugo Dubois', initials: 'HD', avatar: null }],
]);

/**
 * Function button
 *
 * @description
 * A button of the card by its text.
 *
 * @param {HTMLElement} host - The card.
 * @param {string} text - Its text.
 * @returns {HTMLButtonElement | undefined} The button.
 */
function button(host: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(
    (element: HTMLButtonElement) => element.textContent.trim() === text,
  );
}

describe('TaskApprovalCard', () => {
  let fixture: ComponentFixture<TaskApprovalCard>;
  let host: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
    fixture = TestBed.createComponent(TaskApprovalCard);
    fixture.componentRef.setInput('round', ROUND);
    fixture.componentRef.setInput('people', PEOPLE);
    fixture.componentRef.setInput('meId', 'u1');
    await fixture.whenStable();
    host = fixture.nativeElement as HTMLElement;
  });

  it('lists the reviewers with their state and the count', () => {
    expect(host.textContent).toContain('Approval requested');
    expect(host.textContent).toContain('1 of 2');
    expect(host.textContent).toContain('Camille Martin (me)');
    expect(
      host.querySelector('[data-testid="task-approval-bar"]')?.getAttribute('aria-label'),
    ).toBe('1 approval of 2');
  });

  it('pluralizes the approvals and the change requests as the mockup does', async () => {
    fixture.componentRef.setInput('round', {
      ...ROUND,
      reviews: [
        { userId: 'u2', decision: 'approved' },
        { userId: 'u1', decision: 'approved' },
        { userId: 'u3', decision: null },
      ],
    });
    await fixture.whenStable();
    const bar: () => string | null | undefined = () =>
      host.querySelector('[data-testid="task-approval-bar"]')?.getAttribute('aria-label');

    expect(bar()).toBe('2 approvals of 3');
    expect(host.textContent).toContain('2 approvals of 3');

    fixture.componentRef.setInput('round', {
      ...ROUND,
      status: 'changes-requested',
      reviews: [
        { userId: 'u2', decision: 'changes-requested' },
        { userId: 'u1', decision: 'changes-requested' },
        { userId: 'u3', decision: 'approved' },
      ],
    });
    await fixture.whenStable();
    expect(bar()).toBe('1 approval of 3, 2 change requests');

    fixture.componentRef.setInput('round', {
      ...ROUND,
      status: 'changes-requested',
      reviews: [
        { userId: 'u2', decision: 'changes-requested' },
        { userId: 'u1', decision: null },
      ],
    });
    await fixture.whenStable();
    expect(bar()).toBe('0 approval of 2, 1 change request');
  });

  it('sends a change request only once it is written', async () => {
    const reasons: string[] = [];
    fixture.componentInstance.changesRequested.subscribe((reason: string) => reasons.push(reason));

    button(host, 'Request changes')?.click();
    await fixture.whenStable();
    expect(button(host, 'Send the request')?.disabled).toBe(true);

    const field: HTMLTextAreaElement | null = host.querySelector('textarea');
    if (field) {
      field.value = ' Use a semicolon ';
      field.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();
    button(host, 'Send the request')?.click();

    expect(reasons).toEqual(['Use a semicolon']);
  });

  it('offers to withdraw a recorded vote, and no vote without edit rights', async () => {
    fixture.componentRef.setInput('round', {
      ...ROUND,
      reviews: [{ userId: 'u1', decision: 'approved' }],
    });
    await fixture.whenStable();
    expect(host.textContent).toContain('You approved this task.');
    expect(button(host, 'Withdraw my review')).toBeDefined();

    fixture.componentRef.setInput('round', ROUND);
    fixture.componentRef.setInput('canEdit', false);
    await fixture.whenStable();
    expect(button(host, 'Approve')).toBeUndefined();
  });
});
