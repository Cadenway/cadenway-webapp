# Inbox

## Purpose

The inbox popover opened from the rail: notifications and reminders, unread counts, mark as read,
snooze and complete. It owns the rail entry and its badge. Notification preferences belong to
Account; the full inbox of the home screen belongs to Home.

## Routes

None.

## Public entry points

| Entry point | Consumers |
| ----------- | --------- |
| `providers` | workspace |

`providers` publishes `withInbox()` (`railNavigation`, order 10).

## Dependencies

- `@cadenway/api-client`: `InboxService` (`getInboxUnreadCount`, `listInboxNotifications`,
  `markInboxNotificationsRead`, `markInboxNotificationRead`) and `RemindersService`
  (`listReminders`, `snoozeReminder`, `completeReminder`) through `data-access/`.
- Account's `ports/presence` (do-not-disturb), Workspace's `ports/workspace-context`.
- `@cadenway/ui` (`app-rail`, `button`, `empty`, `popover`, `skeleton`, `tabs`, `toast`) and
  `@cadenway/icons`.

## Invariants

- `InboxStore` is provided by the rail item. The unread count is read at once, every 60 seconds and
  when the window regains focus; a failed poll keeps the last count. The notifications and the
  reminders are read at each opening of the popover; a failed read shows an inline « Réessayer ».
- The badge is hidden at zero and while the person's presence is « Ne pas déranger », and the popover
  then shows « Ne pas déranger : notifications en pause ».
- « Tout marquer comme lu », opening a notification, « demain matin » (9 h tomorrow, local time) and
  « Marquer comme fait » are optimistic: a refusal restores the list and the count and shows an error
  toast. Successful reminder actions confirm with the mockup's toasts.
- Opening a notification or a reminder opens `/<slug>/t/<key>`, which renders the 404 until step 5.
- Known gaps: realtime personal notices are not pushed by the gateway yet, hence the polling; the
  mockup also adds overdue reminders to the badge, which needs the reminders read with every poll and
  is left out.

## Copy not taken word for word from the mockup

| Unit                                                                          | Reason                                                              |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `inbox.notifications-empty`, `inbox.notifications-empty-text`                 | The mockup draws no empty notification list.                        |
| `inbox.notifications-failed`, `inbox.reminders-failed`, `inbox.retry`         | The mockup draws no failed read.                                    |
| `inbox.verb.other`, `inbox.verb.status-changed`                               | Contract categories the mockup does not draw.                       |
| `inbox.mark-all-failed`, `inbox.reminder.*-failed`, `inbox.write-failed-text` | The mockup draws no refused write.                                  |
| `inbox.time.*`                                                                | Built from the mockup's samples (« 12 min », « Lun. 9 nov., 9 h »). |
