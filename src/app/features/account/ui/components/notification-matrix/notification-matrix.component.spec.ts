import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type {
  NotificationChannelChange,
  NotificationMatrix as NotificationMatrixValue,
} from '../../../models/notification-preferences/notification-preferences.interface';
import { NotificationMatrix } from './notification-matrix.component';

/**
 * Constant channels
 *
 * @description
 * Camille Martin's matrix: comments and status changes in the app only.
 *
 * @type {NotificationMatrixValue}
 */
const channels: NotificationMatrixValue = {
  mention: { inApp: true, email: true, mobile: true },
  assignment: { inApp: true, email: true, mobile: true },
  comment: { inApp: true, email: false, mobile: false },
  statusChange: { inApp: true, email: false, mobile: false },
  dueDate: { inApp: true, email: true, mobile: true },
  access: { inApp: true, email: true, mobile: false },
  billing: { inApp: true, email: true, mobile: false },
};

describe('NotificationMatrix', () => {
  let fixture: ComponentFixture<NotificationMatrix>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
    fixture = TestBed.createComponent(NotificationMatrix);
    fixture.componentRef.setInput('channels', channels);
    fixture.componentRef.setInput('mentionHandle', 'camille');
    fixture.detectChanges();
  });

  /**
   * Function box
   *
   * @description
   * Finds a box by its accessible name.
   *
   * @param {string} name - The name.
   * @returns {HTMLElement} The box.
   */
  function box(name: string): HTMLElement {
    const found: HTMLElement | null = (fixture.nativeElement as HTMLElement).querySelector(
      `[role="checkbox"][aria-label="${name}"]`,
    );
    if (!found) throw new Error(`No box "${name}"`);
    return found;
  }

  it('lists the seven events in the mockup order, with their hints', () => {
    const rows: HTMLElement[] = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="notification-row"]'),
    );
    expect(
      rows.map((row: HTMLElement) =>
        Array.from(row.querySelectorAll('th span span'), (part: Element) =>
          part.textContent.trim(),
        ),
      ),
    ).toEqual([
      ['Mentions', '@camille in a comment or a description'],
      ['Assignments', 'A task is assigned to you or taken off you'],
      ['Comments', 'On the tasks you follow'],
      ['Status changes', 'On the tasks you follow'],
      ['Due dates', 'The day before and on the due date'],
      ['Invitations and access', 'New organization, new role'],
      ['Billing', 'Invoices, payments, quotas (owners)'],
    ]);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('table')?.getAttribute('aria-label'),
    ).toBe('Notifications by channel');
  });

  it('names and ticks each box from the matrix', () => {
    expect(box('Mentions in the app').getAttribute('aria-checked')).toBe('true');
    expect(box('Comments by email').getAttribute('aria-checked')).toBe('false');
    expect(box('Billing on mobile').getAttribute('aria-checked')).toBe('false');
    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll('[role="checkbox"]'),
    ).toHaveLength(21);
  });

  it('labels each box with its channel name, which toggles it when tapped', () => {
    const changed: Mock<(change: NotificationChannelChange) => void> = vi.fn();
    fixture.componentInstance.channelChanged.subscribe(changed);
    const email: HTMLElement = box('Comments by email');
    const label: HTMLLabelElement | null = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLLabelElement>(`label[for="${email.id}"]`);

    expect(email.id).not.toBe('');
    expect(label?.textContent.trim()).toBe('Email');
    label?.click();

    expect(changed).toHaveBeenCalledWith({
      kind: 'channel',
      event: 'comment',
      channel: 'email',
      enabled: true,
    });
    expect(email.getAttribute('aria-label')).toBe('Comments by email');
  });

  it('emits the box ticked or cleared', () => {
    const changed: Mock<(change: NotificationChannelChange) => void> = vi.fn();
    fixture.componentInstance.channelChanged.subscribe(changed);

    box('Comments by email').click();
    box('Mentions on mobile').click();

    expect(
      changed.mock.calls.map(
        ([change]: [NotificationChannelChange]): NotificationChannelChange => change,
      ),
    ).toEqual([
      { kind: 'channel', event: 'comment', channel: 'email', enabled: true },
      { kind: 'channel', event: 'mention', channel: 'mobile', enabled: false },
    ]);
  });
});
