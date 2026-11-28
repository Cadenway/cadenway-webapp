import { signal, type WritableSignal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import { EMPTY, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { RealtimeConnection } from '@core/realtime';
import { PRESENCE, type PresenceStatus } from '@features/account/ports/presence';
import { TaskDetailOpener } from '@features/task';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { InboxApi } from '../../../data-access/services/inbox-api/inbox-api.service';
import type { InboxNotificationPage } from '../../../models/inbox-notification/inbox-notification.interface';
import type { InboxReminderPage } from '../../../models/inbox-reminder/inbox-reminder.interface';
import { InboxRailItem } from './inbox-rail-item.component';

/**
 * Constant workspace
 *
 * @description
 * Atelier Nord, the mockup's organization, as the workspace port shows it.
 *
 * @type {WorkspaceContextPort}
 */
const workspace: WorkspaceContextPort = {
  user: signal({
    id: 'u1',
    name: 'Camille Martin',
    firstName: 'Camille',
    displayName: null,
    email: 'camille.martin@ateliernord.fr',
    initials: 'CM',
  }),
  organization: signal({
    id: 'o1',
    slug: 'atelier-nord',
    name: 'Atelier Nord',
    initials: 'AN',
    role: 'owner',
    plan: 'team',
  }),
  role: signal('owner'),
  can: () => true,
};

/**
 * Function page
 *
 * @description
 * One unread mention of the mockup.
 *
 * @returns {InboxNotificationPage} The page.
 */
function page(): InboxNotificationPage {
  return {
    unreadCount: 1,
    items: [
      {
        id: 'n1',
        kind: 'mention',
        actorName: 'Inès Robert',
        actorInitials: 'IR',
        taskKey: 'CAD-482',
        taskName: 'Review of the SSO flow',
        excerpt: null,
        status: null,
        createdAt: new Date(Date.now() - 12.5 * 60_000).toISOString(),
        read: false,
      },
    ],
  };
}

/**
 * Function reminderPage
 *
 * @description
 * Two pending reminders of the mockup.
 *
 * @returns {InboxReminderPage} The page.
 */
function reminderPage(): InboxReminderPage {
  return {
    pendingCount: 2,
    items: [
      {
        id: 'r0',
        taskKey: 'CAD-479',
        taskName: 'Notify the support team',
        remindAt: '2026-11-08T08:00:00Z',
        note: null,
      },
      {
        id: 'r1',
        taskKey: 'CAD-488',
        taskName: 'Mockups',
        remindAt: '2099-11-08T14:00:00Z',
        note: null,
      },
    ],
  };
}

describe('InboxRailItem', () => {
  let status: WritableSignal<PresenceStatus>;
  let notifications: Mock<() => Promise<InboxNotificationPage>>;
  let navigate: Mock<(commands: readonly unknown[]) => Promise<boolean>>;
  let openTask: Mock<(taskKey: string) => Promise<boolean>>;
  let markRead: Mock<() => Promise<void>>;
  let complete: Mock<() => Promise<void>>;
  let error: Mock;
  let fixture: ComponentFixture<InboxRailItem>;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 9, 12, 0, 0));
    status = signal<PresenceStatus>('online');
    notifications = vi.fn(() => Promise.resolve(page()));
    navigate = vi.fn(() => Promise.resolve(true));
    openTask = vi.fn(() => Promise.resolve(true));
    markRead = vi.fn(() => Promise.resolve());
    complete = vi.fn(() => Promise.resolve());
    error = vi.fn();
    TestBed.configureTestingModule({
      imports: [InboxRailItem],
      providers: [
        {
          provide: InboxApi,
          useValue: {
            unreadCount: () => of(1),
            notifications,
            pendingReminders: () => Promise.resolve(reminderPage()),
            markAllRead: () => Promise.resolve(0),
            markRead,
            complete,
          },
        },
        { provide: PRESENCE, useValue: { ownStatus: status, setPresence: vi.fn() } },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
        { provide: Router, useValue: { navigate } },
        { provide: TaskDetailOpener, useValue: { open: openTask } },
        { provide: CwToastService, useValue: { error, success: vi.fn() } },
        provideCadenwayIcons(),
      ],
    });
    fixture = TestBed.createComponent(InboxRailItem);
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Function trigger
   *
   * @description
   * The rail item.
   *
   * @returns {HTMLButtonElement} The item.
   */
  function trigger(): HTMLButtonElement {
    const button: HTMLButtonElement | null = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="inbox-rail-item"]',
    );
    if (!button) throw new Error('No inbox item');
    return button;
  }

  /**
   * Function openPopover
   *
   * @description
   * Opens the popover and waits for the notifications.
   *
   * @returns {Promise<HTMLElement>} The popover content.
   */
  async function openPopover(): Promise<HTMLElement> {
    trigger().click();
    return vi.waitFor((): HTMLElement => {
      fixture.detectChanges();
      const content: HTMLElement | null = document.querySelector('[data-testid="inbox-popover"]');
      if (!content?.querySelector('[data-testid="notification-row"], cw-empty')) {
        throw new Error('The popover is not loaded yet');
      }
      return content;
    });
  }

  it('shows the unread count on the rail, except in do-not-disturb', async () => {
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(trigger().textContent).toContain('1 unread');
    });
    status.set('do-not-disturb');
    await fixture.whenStable();

    expect(trigger().textContent).not.toContain('1 unread');
  });

  it('adds the due reminders to the badge, which a completed reminder leaves', async () => {
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(trigger().getAttribute('aria-label')).toBe('Inbox, 1 unread, 1 overdue reminders');
      expect(trigger().textContent.trim().endsWith('2')).toBe(true);
    });

    await openPopover();
    Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
      .find((tab: HTMLButtonElement) => tab.textContent.includes('Reminders'))
      ?.click();
    await fixture.whenStable();
    document
      .querySelector<HTMLButtonElement>(
        '[data-testid="reminder-row"] button[aria-label="Mark the reminder of CAD-479 as done"]',
      )
      ?.click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(trigger().getAttribute('aria-label')).toBe('Inbox, 1 unread');
    });
    expect(trigger().textContent.trim().endsWith('1')).toBe(true);
  });

  it('lists the notifications, marks them all read and clears the unread count', async () => {
    const content: HTMLElement = await openPopover();
    expect(content.textContent).toContain('Inès Robert');
    expect(content.textContent).toContain('mentioned you');
    expect(content.textContent).toContain('12 min');

    const markAll: HTMLButtonElement | undefined = Array.from(
      content.querySelectorAll('button'),
    ).find((button: HTMLButtonElement) => button.textContent.includes('Mark all as read'));
    markAll?.click();
    await fixture.whenStable();

    expect(content.querySelector('[aria-label="Unread"]')).toBeNull();
    expect(markAll?.disabled).toBe(true);
    expect(document.activeElement?.hasAttribute('data-inbox-heading')).toBe(true);
    expect(trigger().textContent).not.toContain('1 unread');
    expect(trigger().textContent).toContain('0 unread, 1 overdue reminders');
  });

  it('opens the detail of the task of a notification over the page', async () => {
    const content: HTMLElement = await openPopover();

    content.querySelector<HTMLButtonElement>('[data-testid="notification-row"]')?.click();

    expect(openTask).toHaveBeenCalledWith('CAD-482');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('reports a refused read of an opened notification', async () => {
    markRead.mockRejectedValueOnce(new Error('unavailable'));
    const content: HTMLElement = await openPopover();

    content.querySelector<HTMLButtonElement>('[data-testid="notification-row"]')?.click();

    await vi.waitFor(() => {
      expect(error).toHaveBeenCalledWith(
        'The notification could not be marked as read',
        expect.anything(),
      );
    });
  });

  it('moves focus to the next reminder, then to the tab, as they are completed', async () => {
    await openPopover();
    Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
      .find((tab: HTMLButtonElement) => tab.textContent.includes('Reminders'))
      ?.click();
    await fixture.whenStable();
    const done: () => HTMLButtonElement | undefined = (): HTMLButtonElement | undefined =>
      document.querySelector<HTMLButtonElement>(
        '[data-testid="reminder-row"] button[aria-label^="Mark the reminder"]',
      ) ?? undefined;

    done()?.click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(
        document.activeElement?.closest('[data-testid="reminder-row"]')?.textContent,
      ).toContain('CAD-488');
    });

    done()?.click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(document.activeElement?.hasAttribute('data-inbox-reminders-tab')).toBe(true);
    });
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it('shows the do-not-disturb notice', async () => {
    status.set('do-not-disturb');
    const content: HTMLElement = await openPopover();

    expect(content.textContent).toContain('Do not disturb: notifications paused');
  });

  it('offers Retry after a failed read, which reads again', async () => {
    notifications.mockRejectedValueOnce(new Error('unavailable'));
    trigger().click();
    let retry: HTMLButtonElement | undefined;
    await vi.waitFor(() => {
      fixture.detectChanges();
      retry = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
        (button: HTMLButtonElement) => button.textContent.trim() === 'Retry',
      );
      expect(retry).toBeDefined();
    });
    expect(document.body.textContent).toContain('The notifications could not be loaded');

    retry?.click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(document.querySelector('[data-testid="notification-row"]')).not.toBeNull();
    });
    expect(notifications).toHaveBeenCalledTimes(2);
  });
});

describe('InboxRailItem while realtime first connects', () => {
  it('reads the reminders at once when the popover opens during the wait, behind the skeleton', async () => {
    const pendingReminders: Mock<() => Promise<InboxReminderPage>> = vi.fn(
      () => new Promise<InboxReminderPage>(() => undefined),
    );
    TestBed.configureTestingModule({
      imports: [InboxRailItem],
      providers: [
        {
          provide: InboxApi,
          useValue: {
            unreadCount: () => of(1),
            notifications: () => Promise.resolve(page()),
            pendingReminders,
            markAllRead: () => Promise.resolve(0),
            markRead: vi.fn(),
            complete: vi.fn(),
          },
        },
        {
          provide: RealtimeConnection,
          useValue: {
            status: signal('connecting'),
            personalNotices: EMPTY,
            reconnected: EMPTY,
          },
        },
        {
          provide: PRESENCE,
          useValue: { ownStatus: signal<PresenceStatus>('online'), setPresence: vi.fn() },
        },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: TaskDetailOpener, useValue: { open: vi.fn() } },
        { provide: CwToastService, useValue: { error: vi.fn(), success: vi.fn() } },
        provideCadenwayIcons(),
      ],
    });
    const fixture: ComponentFixture<InboxRailItem> = TestBed.createComponent(InboxRailItem);
    await fixture.whenStable();
    expect(pendingReminders).not.toHaveBeenCalled();

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-testid="inbox-rail-item"]')
      ?.click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(document.querySelector('[role="tab"]')).not.toBeNull();
    });
    Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
      .find((tab: HTMLButtonElement) => tab.textContent.includes('Reminders'))
      ?.click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(document.querySelector('[data-testid="inbox-reminders-loading"]')).not.toBeNull();
    });
    expect(pendingReminders).toHaveBeenCalledTimes(1);
  });
});
