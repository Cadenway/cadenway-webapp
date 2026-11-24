import { signal, type WritableSignal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { PRESENCE, type PresenceStatus } from '@features/account/ports/presence';
import type { WorkspaceContextPort } from '@features/workspace/ports/workspace-context';

import { InboxApi } from '../../../data-access/services/inbox-api/inbox-api.service';
import type { InboxNotificationPage } from '../../../models/inbox-notification/inbox-notification.interface';
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
        taskName: 'Relecture du parcours SSO',
        excerpt: null,
        status: null,
        createdAt: new Date(Date.now() - 12.5 * 60_000).toISOString(),
        read: false,
      },
    ],
  };
}

describe('InboxRailItem', () => {
  let status: WritableSignal<PresenceStatus>;
  let notifications: Mock<() => Promise<InboxNotificationPage>>;
  let navigate: Mock<(commands: readonly unknown[]) => Promise<boolean>>;
  let fixture: ComponentFixture<InboxRailItem>;

  beforeEach(async () => {
    status = signal<PresenceStatus>('online');
    notifications = vi.fn(() => Promise.resolve(page()));
    navigate = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      imports: [InboxRailItem],
      providers: [
        {
          provide: InboxApi,
          useValue: {
            unreadCount: () => of(1),
            notifications,
            pendingReminders: () => Promise.resolve({ items: [], pendingCount: 0 }),
            markAllRead: () => Promise.resolve(0),
            markRead: () => Promise.resolve(),
          },
        },
        { provide: PRESENCE, useValue: { ownStatus: status, setPresence: vi.fn() } },
        { provide: Router, useValue: { navigate } },
        { provide: CwToastService, useValue: { error: vi.fn(), success: vi.fn() } },
        provideCadenwayIcons(),
      ],
    });
    fixture = TestBed.createComponent(InboxRailItem);
    fixture.componentRef.setInput('workspace', workspace);
    await fixture.whenStable();
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
      expect(trigger().textContent).toContain('1 non lues');
    });
    status.set('do-not-disturb');
    await fixture.whenStable();

    expect(trigger().textContent).not.toContain('1 non lues');
  });

  it('lists the notifications, marks them all read and clears the badge', async () => {
    const content: HTMLElement = await openPopover();
    expect(content.textContent).toContain('Inès Robert');
    expect(content.textContent).toContain('vous a mentionnée');
    expect(content.textContent).toContain('12 min');

    const markAll: HTMLButtonElement | undefined = Array.from(
      content.querySelectorAll('button'),
    ).find((button: HTMLButtonElement) => button.textContent.includes('Tout marquer comme lu'));
    markAll?.click();
    await fixture.whenStable();

    expect(content.querySelector('[aria-label="Non lu"]')).toBeNull();
    expect(markAll?.disabled).toBe(true);
    expect(trigger().textContent).not.toContain('1 non lues');
  });

  it('opens the task of a notification', async () => {
    const content: HTMLElement = await openPopover();

    content.querySelector<HTMLButtonElement>('[data-testid="notification-row"]')?.click();

    expect(navigate).toHaveBeenCalledWith(['/', 'atelier-nord', 't', 'CAD-482']);
  });

  it('shows the do-not-disturb notice', async () => {
    status.set('do-not-disturb');
    const content: HTMLElement = await openPopover();

    expect(content.textContent).toContain('Ne pas déranger : notifications en pause');
  });

  it('offers Réessayer after a failed read, which reads again', async () => {
    notifications.mockRejectedValueOnce(new Error('unavailable'));
    trigger().click();
    let retry: HTMLButtonElement | undefined;
    await vi.waitFor(() => {
      fixture.detectChanges();
      retry = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
        (button: HTMLButtonElement) => button.textContent.trim() === 'Réessayer',
      );
      expect(retry).toBeDefined();
    });
    expect(document.body.textContent).toContain('Impossible de charger les notifications');

    retry?.click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(document.querySelector('[data-testid="notification-row"]')).not.toBeNull();
    });
    expect(notifications).toHaveBeenCalledTimes(2);
  });
});
