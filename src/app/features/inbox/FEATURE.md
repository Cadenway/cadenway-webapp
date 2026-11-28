# Inbox

## Purpose

The inbox popover opened from the rail: notifications and reminders, unread counts, mark as read,
snooze and complete. It owns the rail entry and its badge, and the notification digest that Home
shows under its `Mentions and activity` heading. Notification preferences belong to Account; the
home screen, that heading and its layout belong to Home.

## Routes

None.

## Public entry points

| Entry point | Consumers |
| ----------- | --------- |
| `.`         | home      |
| `providers` | workspace |

`providers` publishes `withInbox()` (`railNavigation`, order 10).

`.` publishes `InboxDigest` (`cw-inbox-digest`, no inputs or outputs): the first page of
notifications in `NotificationRow`, for Home's `Mentions and activity`. It provides its own
`InboxDigestStore`; its host needs `WORKSPACE_CONTEXT`, `TaskDetailOpener`, the shell's toaster
and, when realtime is on, `RealtimeConnection`.

## Dependencies

- `@cadenway/api-client`: `InboxService` (`getInboxUnreadCount`, `listInboxNotifications`,
  `markInboxNotificationsRead`, `markInboxNotificationRead`) and `RemindersService`
  (`getReminder`, `listReminders`, `snoozeReminder`, `completeReminder`) through `data-access/`.
- `@core/realtime` for personal invalidations and reconnection.
- Account's `ports/presence` (do-not-disturb), Workspace's `ports/workspace-context`, Task's `.`
  entry (`TaskDetailOpener`).
- `@cadenway/ui` (`app-rail`, `button`, `empty`, `popover`, `skeleton`, `tabs`, `toast`) and
  `@cadenway/icons`.

## Invariants

- `InboxDigestStore` is provided by `InboxDigest` (component scope, so it dies with the page) and
  keyed on the workspace's organization; a switch drops the previous rows at once, and the reads,
  refusals and write results of an earlier organization change nothing, even after switching back
  (a stale write failure is not reported). Only the last read changes the retry state. It reads
  the first page (30 notifications, read and unread) actively on opening and on `Retry`, and
  passively on a `notification.created.v1` notice (once, at the end of a 300 ms window opened by the first notice
  of a burst), after a realtime reconnection and after a switch. A read asked for while another
  loads or reloads is sent once it settles. A passive read refused while the organization changes
  or is stale waits for the next verified context, in every stale period; one refused by a context
  verified while it ran is sent again at once. A background refresh keeps the rows; a failed read
  shows the inline error (an alert) with `Retry`, never the empty state, and keeps it with `Retry`
  busy while the next read runs; when rows replace it, focus that fell to the body moves to the
  digest's container. Opening a row is optimistic: the row shows read while its write is pending,
  and once recorded it shows read only on pages whose read started before that, so a later page is
  the server's word. A refusal drops only that pending claim and shows the inbox's error toast,
  unless a read the popover recorded covers the row.
- The rail's popover and the home screen's digest share no state; `InboxReads` (`services/`, root)
  relays the reads the gateway recorded, tagged with their organization and view. The digest shows
  the ids the popover recorded at once, like its own recorded reads; `Mark all as read` is never
  applied beyond those ids but reconciled by a fresh read, so a notification created meanwhile
  stays unread. A read recorded by the digest refreshes the badge and the open popover list.
- `InboxStore` is provided by the rail item and keyed on the workspace's organization. A committed
  organization switch clears the count and the lists at once and restarts the poll; any answer or
  write result that belongs to the previous organization is ignored.
- The unread count is read at once, on window focus, on every transition to connected and every
  minute, connected or not, because notices only flow once the gateway enables them; a failed read
  keeps the last count. A notification notice
  refreshes the badge and the open notification list. A due-reminder notice first revalidates the
  reminder with `getReminder`; a failed read is retried once before refreshing the reminders list.
  The badge and reminders are read after reconnect because notices are not replayed. Personal notices require `REALTIME_PERSONAL_NOTICES_ENABLED` on the gateway.
  Reminders are read on load, and both lists are refreshed on opening; failed list reads show an
  inline `Retry`. Verification retries passive reads refused by an organization mismatch or local fence, once per
  verified revision, even while realtime reconnects. A later connection skips those retries, and
  pending writes settle before their reads resume.
- Every write bumps a version: a poll answer or a notifications load that began before it is
  dropped (a load is sent again, up to three times), so a stale badge never comes back after
  `Mark all as read`.
- `Mark all as read`, opening a notification, `Postpone to tomorrow morning` (9:00 tomorrow, local
  time) and `Mark as done` are optimistic. A refusal restores, on the current state, only the
  notifications and the count that write changed and no other pending or confirmed write covers,
  or only that reminder, and shows the inbox's error toast. Successful reminder actions confirm
  with the mockup's toasts.
- Focus: when a completed reminder's row disappears it moves to the row taking its place, or to the
  `Reminders` tab; when `Mark all as read` becomes disabled it moves to the popover heading.
- The badge counts the unread notifications plus the listed pending reminders already due, checked
  every minute (only the first page of 30 reminders, the soonest first, is read). The rail item is
  highlighted while the popover is open, through its `aria-expanded` state.
- The badge is hidden at zero and while the person's presence is `Do not disturb`, and the popover
  then shows `Do not disturb: notifications paused` (only for `do-not-disturb`; an unknown
  presence shows nothing).
- Opening a notification or a reminder opens the task's detail over the current page (Task's
  `TaskDetailOpener`, `?task=<key>`).
- The inbox automatic loads, badge polling and realtime refreshes are passive and wait for workspace verification
  when stale; opening and Retry are active.

## Copy not taken word for word from the mockup

| Unit                                                                                                                                           | Reason                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `inbox.rail.badge-overdue`                                                                                                                     | The mockup gives its badge no spoken text; built from `unread` and `late`.                                                        |
| `inbox.verb.status-changed`, `inbox.verb.other`                                                                                                | Contract cases the mockup does not draw: a status change without a status, and the `due-date`, `access` and `billing` categories. |
| `inbox.notifications-empty`, `inbox.notifications-empty-text`                                                                                  | The mockup draws no empty notification list.                                                                                      |
| `inbox.notifications-failed`, `inbox.reminders-failed`, `inbox.retry`                                                                          | The mockup draws no failed read.                                                                                                  |
| `inbox.mark-all-failed`, `inbox.mark-read-failed`, `inbox.reminder.snooze-failed`, `inbox.reminder.complete-failed`, `inbox.write-failed-text` | The mockup draws no refused write.                                                                                                |
| `inbox.digest.loading`                                                                                                                         | The mockup gives the home screen's mentions no loading label; built on its `Loading …` skeleton labels.                           |
| `inbox.time.tomorrow`, `inbox.time.at-time`                                                                                                    | Built on the mockup's `Today, 9:00` for tomorrow and for minutes.                                                                 |
| `inbox.tab-notifications-count`, `inbox.tab-reminders-count`                                                                                   | Spoken counts of the tabs (`cwTab` `countLabel`), which the mockup shows as bare numbers.                                         |

The extracted catalog only holds messages the application reaches, so `inbox.digest.loading` enters
`messages.json`, and its French text `messages.fr.json`, in the change where Home mounts
`cw-inbox-digest`.
