import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { ReminderChoice } from '../task-reminder-menu/task-reminder-menu.component';
import { TaskDetailHeader } from './task-detail-header.component';

describe('TaskDetailHeader', () => {
  let fixture: ComponentFixture<TaskDetailHeader>;

  /**
   * Function button
   *
   * @description
   * A button of the page by its accessible name or test id.
   *
   * @param {string} selector - A CSS selector.
   * @returns {HTMLButtonElement} The button.
   */
  function button(selector: string): HTMLButtonElement {
    const found: HTMLButtonElement | null = document.querySelector<HTMLButtonElement>(selector);
    if (!found) throw new Error(`No ${selector}`);
    return found;
  }

  /**
   * Function menuItems
   *
   * @description
   * The labels of the open menu's items, in order.
   *
   * @returns {string[]} The labels.
   */
  function menuItems(): string[] {
    return Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).map(
      (item: HTMLElement) => item.textContent.trim(),
    );
  }

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 8, 10, 0, 0));
    TestBed.configureTestingModule({
      imports: [TaskDetailHeader],
      providers: [provideCadenwayIcons()],
    });
    fixture = TestBed.createComponent(TaskDetailHeader);
    fixture.componentRef.setInput('header', {
      key: 'CAD-482',
      name: 'Redesign the SSO sign-in screen',
      status: 'cancelled',
      milestone: false,
    });
    fixture.componentRef.setInput('statusLabel', 'Cancelled');
    fixture.componentRef.setInput('cancelReason', 'duplicate');
    fixture.componentRef.setInput('cancelNote', 'replaced by CAD-490');
    fixture.componentRef.setInput('ready', true);
    fixture.componentRef.setInput('canEdit', true);
    fixture.componentRef.setInput('watchers', { total: 3, following: false });
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the key, the status and the cancellation', () => {
    const text: string = (fixture.nativeElement as HTMLElement).textContent;

    expect(text).toContain('CAD-482');
    expect(text).toContain('Cancelled');
    expect(text).toContain('Cancelled: Duplicate · replaced by CAD-490');
  });

  it('saves a changed title on change and puts a blank one back', () => {
    const renamed: string[] = [];
    fixture.componentInstance.renamed.subscribe((name: string) => renamed.push(name));
    const title: HTMLInputElement | null = (fixture.nativeElement as HTMLElement).querySelector(
      '#task-detail-title',
    );
    if (!title) throw new Error('No title');

    title.value = '  Redesign the SSO screen  ';
    title.dispatchEvent(new Event('change'));
    title.value = '   ';
    title.dispatchEvent(new Event('change'));

    expect(renamed).toEqual(['Redesign the SSO screen']);
    expect(title.value).toBe('Redesign the SSO sign-in screen');
  });

  it('names the follow toggle with the count and emits it', async () => {
    const toggled: Mock = vi.fn();
    fixture.componentInstance.watchToggled.subscribe(toggled);
    const watch: HTMLButtonElement = button('[data-testid="task-detail-watch"]');

    expect(watch.getAttribute('aria-label')).toBe('Follow this task (3 followers)');
    expect(watch.getAttribute('aria-pressed')).toBe('false');
    watch.click();
    expect(toggled).toHaveBeenCalledOnce();

    fixture.componentRef.setInput('watchers', { total: 4, following: true });
    await fixture.whenStable();
    expect(watch.getAttribute('aria-label')).toBe('Stop following this task (4 followers)');
    expect(watch.getAttribute('aria-pressed')).toBe('true');
  });

  it('lists the actions of a top-level task in the mockup order', async () => {
    button('[data-testid="task-detail-more"]').click();
    await fixture.whenStable();

    expect(menuItems()).toEqual([
      'Copy the identifier',
      'Duplicate',
      'Move to…',
      'Archive',
      'Save as a template',
      'Convert to a subtask of…',
      'Delete',
    ]);
  });

  it('offers to move a subtask to another task or to detach it', async () => {
    fixture.componentRef.setInput('parent', { key: 'CAD-470', name: 'Sign-in', status: 'todo' });
    await fixture.whenStable();
    const detached: Mock = vi.fn();
    fixture.componentInstance.detached.subscribe(detached);

    button('[data-testid="task-detail-more"]').click();
    await fixture.whenStable();

    expect(menuItems()).toContain('Move to another task…');
    const detach: HTMLElement | undefined = Array.from(
      document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ).find((item: HTMLElement) => item.textContent.includes('Detach from CAD-470'));
    detach?.click();
    expect(detached).toHaveBeenCalledOnce();
  });

  it('disables the actions until the detail is read', async () => {
    fixture.componentRef.setInput('ready', false);
    await fixture.whenStable();

    expect(button('[data-testid="task-detail-more"]').disabled).toBe(true);
    expect(button('[data-testid="task-detail-watch"]').disabled).toBe(true);
    expect(button('[data-testid="task-detail-reminder"]').disabled).toBe(true);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('#task-detail-title')
        ?.readOnly,
    ).toBe(true);
    expect(button('[data-testid="task-detail-copy-link"]').disabled).toBe(false);
  });

  it('schedules a preset reminder with the note typed so far', async () => {
    const scheduled: ReminderChoice[] = [];
    fixture.componentInstance.reminderScheduled.subscribe((choice: ReminderChoice) =>
      scheduled.push(choice),
    );
    const reminder: HTMLButtonElement = button('[data-testid="task-detail-reminder"]');
    expect(reminder.getAttribute('aria-label')).toBe('Remind me of this task');

    reminder.click();
    await fixture.whenStable();
    const note: HTMLInputElement | null = document.querySelector('#task-reminder-note');
    if (!note) throw new Error('No note field');
    note.value = 'Follow up on the mockups';
    note.dispatchEvent(new Event('change'));
    const tomorrow: HTMLButtonElement | undefined = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '[data-testid="task-detail-reminder-popover"] button',
      ),
    ).find((item: HTMLButtonElement) => item.textContent.includes('Tomorrow morning'));
    tomorrow?.click();

    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].at).toEqual(new Date(2026, 10, 9, 9, 0, 0));
    expect(scheduled[0].when).toBe('Tomorrow, 9:00');
    expect(scheduled[0].note).toBe('Follow up on the mockups');
  });

  it('refuses a past custom time and names a pending reminder', async () => {
    fixture.componentRef.setInput('reminder', {
      id: 'r1',
      at: new Date(2026, 10, 9, 9, 0, 0).toISOString(),
      note: '',
      fired: false,
    });
    await fixture.whenStable();
    const reminder: HTMLButtonElement = button('[data-testid="task-detail-reminder"]');
    expect(reminder.getAttribute('aria-label')).toBe('Reminder: Tomorrow, 9:00');

    reminder.click();
    await fixture.whenStable();
    const popover: () => HTMLElement = () => {
      const found: HTMLElement | null = document.querySelector(
        '[data-testid="task-detail-reminder-popover"]',
      );
      if (!found) throw new Error('No popover');
      return found;
    };
    const buttons: () => HTMLButtonElement[] = () =>
      Array.from(popover().querySelectorAll<HTMLButtonElement>('button'));
    buttons()
      .find((item: HTMLButtonElement) => item.textContent.includes('Choose a date and a time'))
      ?.click();
    await fixture.whenStable();
    buttons()
      .find((item: HTMLButtonElement) => item.textContent.trim() === 'Today')
      ?.click();
    buttons()
      .find((item: HTMLButtonElement) => item.textContent.trim() === '9:00')
      ?.click();
    await fixture.whenStable();

    expect(popover().textContent).toContain('This time has already passed.');
    expect(
      buttons().find((item: HTMLButtonElement) => item.textContent.includes('Schedule'))?.disabled,
    ).toBe(true);
    expect(popover().textContent).toContain('Delete the reminder');
  });

  it('shows the failed reads of the followers and of the reminder with Retry', async () => {
    const retried: string[] = [];
    fixture.componentInstance.watchersRetried.subscribe(() => retried.push('watchers'));
    fixture.componentInstance.reminderRetried.subscribe(() => retried.push('reminder'));
    fixture.componentRef.setInput('watchers', null);
    fixture.componentRef.setInput('watchersFailed', true);
    fixture.componentRef.setInput('reminderFailed', true);
    await fixture.whenStable();

    const alerts: string[] = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="alert"]'),
    ).map((alert: HTMLElement) => alert.textContent.replace(/\s+/gu, ' ').trim());
    expect(alerts).toEqual([
      'The followers could not be loaded.Retry',
      'The reminder could not be loaded.Retry',
    ]);
    button('[data-testid="task-detail-watchers-retry"]').click();
    button('[data-testid="task-detail-reminder-retry"]').click();
    expect(retried).toEqual(['watchers', 'reminder']);

    fixture.componentRef.setInput('watchersFailed', false);
    fixture.componentRef.setInput('reminderFailed', false);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).toBeNull();
  });
});
