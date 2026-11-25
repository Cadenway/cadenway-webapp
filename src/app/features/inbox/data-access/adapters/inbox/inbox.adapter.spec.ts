import { describe, expect, it } from 'vitest';

import { initialsOf, toInboxNotificationPage, toInboxReminderPage } from './inbox.adapter';

describe('inbox adapters', () => {
  it('maps a notification with or without an actor and a task', () => {
    expect(
      toInboxNotificationPage({
        items: [
          {
            id: 'n1',
            kind: 'mention',
            actor: { userId: 'u2', name: 'Inès Robert' },
            task: { taskKey: 'CAD-482', name: 'Review of the SSO flow' },
            excerpt: '@Camille tu peux relire ?',
            status: null,
            createdAt: '2026-11-08T08:48:00Z',
            readAt: null,
            archivedAt: null,
            version: 1,
          },
          {
            id: 'n2',
            kind: 'billing',
            actor: null,
            task: null,
            excerpt: null,
            status: null,
            createdAt: '2026-11-07T08:48:00Z',
            readAt: '2026-11-07T09:00:00Z',
            archivedAt: null,
            version: 2,
          },
        ],
        nextCursor: null,
        unreadCount: 1,
      }),
    ).toEqual({
      unreadCount: 1,
      items: [
        {
          id: 'n1',
          kind: 'mention',
          actorName: 'Inès Robert',
          actorInitials: 'IR',
          taskKey: 'CAD-482',
          taskName: 'Review of the SSO flow',
          excerpt: '@Camille tu peux relire ?',
          status: null,
          createdAt: '2026-11-08T08:48:00Z',
          read: false,
        },
        {
          id: 'n2',
          kind: 'billing',
          actorName: null,
          actorInitials: '',
          taskKey: null,
          taskName: null,
          excerpt: null,
          status: null,
          createdAt: '2026-11-07T08:48:00Z',
          read: true,
        },
      ],
    });
  });

  it('maps the pending reminders', () => {
    expect(
      toInboxReminderPage({
        items: [
          {
            id: 'r1',
            taskKey: 'CAD-488',
            taskName: 'Mockups',
            remindAt: '2026-11-08T14:00:00Z',
            note: 'Follow up with Léa about the mockups',
            firedAt: null,
            completedAt: null,
            version: 1,
          },
        ],
        nextCursor: null,
        pendingCount: 1,
      }),
    ).toEqual({
      pendingCount: 1,
      items: [
        {
          id: 'r1',
          taskKey: 'CAD-488',
          taskName: 'Mockups',
          remindAt: '2026-11-08T14:00:00Z',
          note: 'Follow up with Léa about the mockups',
        },
      ],
    });
  });

  it('derives initials from a name', () => {
    expect(initialsOf('Léa Petit')).toBe('LP');
    expect(initialsOf('Inès')).toBe('IN');
    expect(initialsOf('  ')).toBe('');
  });
});
