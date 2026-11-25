import {
  computed,
  DestroyRef,
  DOCUMENT,
  inject,
  resource,
  type ResourceRef,
  type Signal,
  type Type,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  patchState,
  signalMethod,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  auditTime,
  catchError,
  debounceTime,
  defer,
  distinctUntilChanged,
  filter,
  groupBy,
  EMPTY,
  fromEvent,
  merge,
  mergeMap,
  of,
  retry,
  type Observable,
  pipe,
  Subject,
  switchMap,
  tap,
  timer,
} from 'rxjs';

import {
  OrganizationPin,
  OrganizationSwitchPendingError,
  readProblem,
  type ApiProblem,
} from '@core/api';
import { RealtimeConnection, type PersonalNotice } from '@core/realtime';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { InboxApi } from '../../data-access/services/inbox-api/inbox-api.service';
import type {
  InboxNotification,
  InboxNotificationPage,
} from '../../models/inbox-notification/inbox-notification.interface';
import type {
  InboxReminder,
  InboxReminderPage,
} from '../../models/inbox-reminder/inbox-reminder.interface';

/**
 * Constant POLL_MS
 *
 * @description
 * Interval of the unread badge polling, in milliseconds. It stays at one minute even while
 * realtime is connected: personal notices only flow once the gateway enables them, which the
 * client cannot observe.
 *
 * @type {number}
 */
export const POLL_MS: number = 60_000;

/**
 * Constant LOAD_ATTEMPTS
 *
 * @description
 * Times a notifications load is sent again when a write changed the inbox while it ran, before its
 * answer is kept anyway.
 *
 * @type {number}
 */
const LOAD_ATTEMPTS: number = 3;

/**
 * Interface InboxState
 *
 * @description
 * The unread badge, the organization it counts, the popover's openings and the write version.
 */
interface InboxState {
  // #region Properties
  /**
   * Property unreadCount
   *
   * @description
   * Unread notifications, or null before the first answer for the current organization.
   *
   * @type {number | null}
   * @readonly
   */
  readonly unreadCount: number | null;

  /**
   * Property _organizationId
   *
   * @description
   * Organization the badge and the lists belong to.
   *
   * @type {string | null}
   * @readonly
   */
  readonly _organizationId: string | null;

  /**
   * Property _openings
   *
   * @description
   * Openings of the popover in this organization; each one reads the lists again, none is read
   * before the first.
   *
   * @type {number}
   * @readonly
   */
  readonly _openings: number;

  /**
   * Property _isOpen
   *
   * @description
   * Whether the inbox popover currently displays its lists.
   *
   * @type {boolean}
   * @readonly
   */
  readonly _isOpen: boolean;

  /**
   * Property _version
   *
   * @description
   * Bumped when a write starts or settles; a poll answer or a notifications load that began before
   * the last bump is out of date.
   *
   * @type {number}
   * @readonly
   */
  readonly _version: number;

  /**
   * Property _badgeVersion
   *
   * @description
   * Identifies a badge answer newer than an in-flight notifications list.
   *
   * @type {number}
   * @readonly
   */
  readonly _badgeVersion: number;
  // #endregion
}

/**
 * Interface ReadClaim
 *
 * @description
 * The notifications a pending read write shows read.
 */
interface ReadClaim {
  // #region Properties
  /**
   * Property ids
   *
   * @description
   * Notifications the write marked read in the list.
   *
   * @type {ReadonlySet<string>}
   * @readonly
   */
  readonly ids: ReadonlySet<string>;

  /**
   * Property all
   *
   * @description
   * Whether the write is « Tout marquer comme lu », which also covers notifications off the list.
   *
   * @type {boolean}
   * @readonly
   */
  readonly all: boolean;
  // #endregion
}

/**
 * Interface InboxStoreInstance
 *
 * @description
 * The inbox badge and popover of the current organization: unread count, notifications,
 * reminders and their writes.
 */
interface InboxStoreInstance {
  // #region Properties
  /**
   * Property unreadCount
   *
   * @description
   * Unread notifications, or null before the first answer.
   *
   * @type {Signal<number | null>}
   * @readonly
   */
  readonly unreadCount: Signal<number | null>;

  /**
   * Property notifications
   *
   * @description
   * The newest notifications; idle until the popover opens.
   *
   * @type {ResourceRef<InboxNotificationPage | undefined>}
   * @readonly
   */
  readonly notifications: ResourceRef<InboxNotificationPage | undefined>;

  /**
   * Property reminders
   *
   * @description
   * The pending reminders for the current organization.
   *
   * @type {ResourceRef<InboxReminderPage | undefined>}
   * @readonly
   */
  readonly reminders: ResourceRef<InboxReminderPage | undefined>;

  /**
   * Property pendingCount
   *
   * @description
   * Pending reminders, or zero before they are read.
   *
   * @type {Signal<number>}
   * @readonly
   */
  readonly pendingCount: Signal<number>;
  // #endregion

  // #region Methods
  /**
   * Method open
   *
   * @description
   * Reads the notifications and the reminders, as the popover opens.
   */
  open(): void;

  /**
   * Method close
   *
   * @description
   * Marks the popover closed so notification notices only refresh the badge.
   */
  close(): void;

  /**
   * Method markAllRead
   *
   * @description
   * Shows every notification read at once, then records it; a refusal restores what no other
   * write also marked read.
   *
   * @returns {Promise<boolean>} Whether the gateway recorded it (true when the organization changed meanwhile).
   */
  markAllRead(): Promise<boolean>;

  /**
   * Method markRead
   *
   * @description
   * Shows a notification read at once, then records it; a refusal restores it unless another
   * write also marked it read.
   *
   * @param {InboxNotification} notification - A notification.
   * @returns {Promise<boolean>} Whether the gateway recorded it (true when it was already read or the organization changed meanwhile).
   */
  markRead(notification: InboxNotification): Promise<boolean>;

  /**
   * Method snooze
   *
   * @description
   * Moves a reminder to a later instant at once, then records it; a refusal restores that
   * reminder's time.
   *
   * @param {InboxReminder} reminder - A pending reminder.
   * @param {string} remindAt - New instant, as ISO 8601.
   * @returns {Promise<boolean>} Whether the gateway recorded it.
   */
  snooze(reminder: InboxReminder, remindAt: string): Promise<boolean>;

  /**
   * Method complete
   *
   * @description
   * Removes a reminder from the list at once, then marks it done; a refusal puts it back.
   *
   * @param {InboxReminder} reminder - A pending reminder.
   * @returns {Promise<boolean>} Whether the gateway recorded it.
   */
  complete(reminder: InboxReminder): Promise<boolean>;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * No organization, count or opening yet.
 *
 * @type {InboxState}
 */
const initialState: InboxState = {
  unreadCount: null,
  _organizationId: null,
  _openings: 0,
  _isOpen: false,
  _version: 0,
  _badgeVersion: 0,
};

/**
 * Function byDueTime
 *
 * @description
 * Orders reminders as the gateway does: the soonest first.
 *
 * @param {InboxReminder} first - A reminder.
 * @param {InboxReminder} second - Another reminder.
 * @returns {number} Their order.
 */
function byDueTime(first: InboxReminder, second: InboxReminder): number {
  return Date.parse(first.remindAt) - Date.parse(second.remindAt);
}

/**
 * Function withRead
 *
 * @description
 * A page whose given notifications are read or unread.
 *
 * @param {InboxNotificationPage} page - Current page.
 * @param {ReadonlySet<string>} ids - Notifications to change.
 * @param {boolean} read - Their new state.
 * @param {number} unreadCount - The page's new unread count.
 * @returns {InboxNotificationPage} The changed page.
 */
function withRead(
  page: InboxNotificationPage,
  ids: ReadonlySet<string>,
  read: boolean,
  unreadCount: number,
): InboxNotificationPage {
  return {
    unreadCount,
    items: page.items.map((item: InboxNotification) =>
      ids.has(item.id) ? { ...item, read } : item,
    ),
  };
}

/**
 * Function createInboxStore
 *
 * @description
 * Creates the inbox store.
 *
 * @returns {Type<InboxStoreInstance>} Injectable store constructor.
 */
function createInboxStore(): Type<InboxStoreInstance> {
  return signalStore(
    withState(initialState),
    withProps((store) => {
      const api: InboxApi = inject(InboxApi);
      const reloadKinds: { notifications: boolean | null; reminders: boolean | null } = {
        notifications: null,
        reminders: null,
      };
      const pin: OrganizationPin = inject(OrganizationPin);
      const refused: {
        badge: boolean;
        notifications: boolean;
        reminders: boolean;
        retriedRevision: Record<'badge' | 'notifications' | 'reminders', number>;
        connectedSkip: Record<'badge' | 'notifications' | 'reminders', number>;
      } = {
        badge: false,
        notifications: false,
        reminders: false,
        retriedRevision: { badge: -1, notifications: -1, reminders: -1 },
        connectedSkip: { badge: -1, notifications: -1, reminders: -1 },
      };
      const recordRefusal: (
        kind: 'badge' | 'notifications' | 'reminders',
        error: unknown,
        revision: number,
      ) => void = (
        kind: 'badge' | 'notifications' | 'reminders',
        error: unknown,
        revision: number,
      ): void => {
        const problem: ApiProblem | null = readProblem(error);
        if (
          (error instanceof OrganizationSwitchPendingError ||
            (problem?.status === 412 && problem.code === 'organization.context-changed')) &&
          revision === pin.revision() &&
          revision !== refused.retriedRevision[kind]
        )
          refused[kind] = true;
      };
      let notificationsOrganization: string | null = null;
      let remindersOrganization: string | null = null;
      const workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);
      const opened: () => { organizationId: string } | undefined = () => {
        const organizationId: string | null = store._organizationId();
        return store._openings() > 0 && organizationId !== null ? { organizationId } : undefined;
      };
      return {
        _api: api,
        _workspace: workspace,
        _pin: pin,
        _refused: refused,
        _recordRefusal: recordRefusal,
        _window: inject(DOCUMENT).defaultView,
        _realtime: inject(RealtimeConnection, { optional: true }),
        _destroyRef: inject(DestroyRef),
        _refreshBadge: new Subject<void>(),
        _reloadKinds: reloadKinds,
        notifications: resource({
          params: opened,
          loader: async ({
            params,
          }: {
            params: { organizationId: string };
          }): Promise<InboxNotificationPage> => {
            const passive: boolean =
              reloadKinds.notifications ??
              (notificationsOrganization !== null &&
                notificationsOrganization !== params.organizationId);
            notificationsOrganization = params.organizationId;
            reloadKinds.notifications = null;
            const revision: number = pin.revision();
            let page: InboxNotificationPage | undefined;
            for (let attempt: number = 0; attempt < LOAD_ATTEMPTS; attempt += 1) {
              const version: number = store._version();
              const badgeVersion: number = store._badgeVersion();
              try {
                page = await api.notifications(passive);
              } catch (error: unknown) {
                if (passive) recordRefusal('notifications', error, revision);
                throw error;
              }
              if (version !== store._version()) continue;
              if (
                params.organizationId === store._organizationId() &&
                badgeVersion === store._badgeVersion()
              ) {
                patchState(store, { unreadCount: page.unreadCount });
              }
              return page;
            }
            if (page === undefined) throw new Error('The notifications were not read.');
            return page;
          },
        }),
        reminders: resource({
          params: (): { organizationId: string } | undefined => {
            const organizationId: string | null = store._organizationId();
            return organizationId ? { organizationId } : undefined;
          },
          loader: ({
            params,
          }: {
            params: { organizationId: string };
          }): Promise<InboxReminderPage> => {
            const passive: boolean =
              remindersOrganization !== params.organizationId || (reloadKinds.reminders ?? false);
            remindersOrganization = params.organizationId;
            reloadKinds.reminders = null;
            const revision: number = pin.revision();
            return api.pendingReminders(passive).catch((error: unknown) => {
              if (passive) recordRefusal('reminders', error, revision);
              throw error;
            });
          },
        }),
      };
    }),
    withComputed((store) => ({
      pendingCount: (): number =>
        store.reminders.hasValue() ? store.reminders.value().pendingCount : 0,
    })),
    withMethods((store) => {
      let claims: Map<number, ReadClaim> = new Map<number, ReadClaim>();
      let confirmedIds: Set<string> = new Set<string>();
      let confirmedAll: boolean = false;
      let sequence: number = 0;
      let organizationVersion: number = 0;
      let reminderWrites: number = 0;
      let reminderRefreshPending: boolean | null = null;
      let notificationRefreshPending: boolean = false;
      let recoveryBadgePending: boolean = false;
      let recoveryNotificationsPending: boolean = false;
      let notificationReloadQueued: boolean | null = null;
      let reminderReloadQueued: boolean | null = null;

      const reloadNotifications: (passive?: boolean) => void = (passive: boolean = false): void => {
        if (store.notifications.isLoading())
          notificationReloadQueued = (notificationReloadQueued ?? true) && passive;
        else {
          store._reloadKinds.notifications = passive;
          store.notifications.reload();
        }
      };
      const reloadReminders: (passive?: boolean) => void = (passive: boolean = false): void => {
        if (store.reminders.isLoading())
          reminderReloadQueued = (reminderReloadQueued ?? true) && passive;
        else {
          store._reloadKinds.reminders = passive;
          store.reminders.reload();
        }
      };

      const refreshNotifications: () => void = (): void => {
        if (claims.size > 0) {
          notificationRefreshPending = true;
          return;
        }
        store._refreshBadge.next();
        if (store._isOpen()) reloadNotifications(true);
      };

      const refreshReminders: (passive?: boolean) => void = (passive: boolean = true): void => {
        if (reminderWrites > 0) {
          reminderRefreshPending = (reminderRefreshPending ?? true) && passive;
          return;
        }
        reloadReminders(passive);
      };

      const bump: () => void = (): void => {
        patchState(store, { _version: store._version() + 1 });
      };
      const sameOrganization: (organizationId: string | null) => boolean = (
        organizationId: string | null,
      ): boolean => organizationId === store._organizationId();
      const protectedRead: (id: string) => boolean = (id: string): boolean =>
        confirmedIds.has(id) || [...claims.values()].some((claim: ReadClaim) => claim.ids.has(id));
      const currentPage: () => InboxNotificationPage | undefined = () =>
        store.notifications.hasValue() ? store.notifications.value() : undefined;

      // Shows notifications read, sends the write and, on a refusal, restores only the
      // notifications no other write covers, adding their count back to the current count.
      const readWrite: (
        ids: ReadonlySet<string>,
        all: boolean,
        offList: number,
        send: () => Promise<number | null>,
      ) => Promise<boolean> = async (ids, all, offList, send) => {
        const organizationId: string | null = store._organizationId();
        const organizationAtStart: number = organizationVersion;
        const id: number = (sequence += 1);
        claims.set(id, { ids, all });
        bump();
        const page: InboxNotificationPage | undefined = currentPage();
        const before: number = store.unreadCount() ?? page?.unreadCount ?? 0;
        const after: number = all ? 0 : Math.max(0, before - ids.size);
        if (page) store.notifications.set(withRead(page, ids, true, after));
        patchState(store, { unreadCount: after });
        try {
          const confirmed: number | null = await send();
          if (!sameOrganization(organizationId)) return true;
          claims.delete(id);
          for (const read of ids) confirmedIds.add(read);
          if (all) confirmedAll = true;
          if (confirmed !== null && claims.size === 0)
            patchState(store, { unreadCount: confirmed });
          bump();
          return true;
        } catch {
          if (!sameOrganization(organizationId)) return false;
          claims.delete(id);
          bump();
          const restored: Set<string> = new Set<string>(
            [...ids].filter((read: string) => !protectedRead(read)),
          );
          const otherAll: boolean =
            confirmedAll || [...claims.values()].some((claim: ReadClaim) => claim.all);
          const added: number = restored.size + (all && !otherAll ? offList : 0);
          const count: number = (store.unreadCount() ?? 0) + added;
          const now: InboxNotificationPage | undefined = currentPage();
          if (now) store.notifications.set(withRead(now, restored, false, count));
          patchState(store, { unreadCount: count });
          return false;
        } finally {
          if (
            organizationAtStart === organizationVersion &&
            claims.size === 0 &&
            !notificationRefreshPending
          ) {
            if (recoveryBadgePending) store._refreshBadge.next();
            if (recoveryNotificationsPending && store._isOpen()) reloadNotifications(true);
            recoveryBadgePending = false;
            recoveryNotificationsPending = false;
          }
          if (
            organizationAtStart === organizationVersion &&
            claims.size === 0 &&
            notificationRefreshPending
          ) {
            notificationRefreshPending = false;
            recoveryBadgePending = false;
            recoveryNotificationsPending = false;
            refreshNotifications();
          }
        }
      };

      // Applies an optimistic change to the reminders and sends the write; a refusal undoes only
      // that change, on the current list.
      const reminderWrite: (
        change: (page: InboxReminderPage) => InboxReminderPage,
        undo: (page: InboxReminderPage) => InboxReminderPage,
        send: () => Promise<unknown>,
      ) => Promise<boolean> = async (change, undo, send) => {
        if (!store.reminders.hasValue()) return false;
        const organizationId: string | null = store._organizationId();
        const organizationAtStart: number = organizationVersion;
        reminderWrites++;
        store.reminders.set(change(store.reminders.value()));
        try {
          await send();
          return true;
        } catch {
          if (sameOrganization(organizationId) && store.reminders.hasValue()) {
            store.reminders.set(undo(store.reminders.value()));
          }
          return false;
        } finally {
          if (organizationAtStart === organizationVersion) {
            reminderWrites--;
            if (reminderWrites === 0 && reminderRefreshPending !== null) {
              const passive: boolean = reminderRefreshPending;
              reminderRefreshPending = null;
              refreshReminders(passive);
            }
          }
        }
      };

      return {
        _drainReloads: signalMethod<{ notifications: boolean; reminders: boolean }>(
          (loading): void => {
            if (!loading.notifications && notificationReloadQueued !== null) {
              const passive: boolean = notificationReloadQueued;
              notificationReloadQueued = null;
              if (store._isOpen()) reloadNotifications(passive);
            }
            if (!loading.reminders && reminderReloadQueued !== null) {
              const passive: boolean = reminderReloadQueued;
              reminderReloadQueued = null;
              reloadReminders(passive);
            }
          },
        ),
        _notice(notice: PersonalNotice): void {
          if (notice.type === 'notification.created.v1') {
            refreshNotifications();
            return;
          }
          const organizationAtStart: number = organizationVersion;
          defer(() =>
            organizationAtStart === organizationVersion
              ? store._api.reminder(notice.reminderId)
              : EMPTY,
          )
            .pipe(
              retry({ count: 1, delay: 1000 }),
              catchError(() => of(null)),
              takeUntilDestroyed(store._destroyRef),
            )
            .subscribe(() => {
              if (organizationAtStart === organizationVersion) refreshReminders();
            });
        },
        _verified(): void {
          const refused: typeof store._refused = store._refused;
          if (!refused.badge && !refused.notifications && !refused.reminders) return;
          for (const kind of ['badge', 'notifications', 'reminders'] as const) {
            if (refused[kind]) {
              refused.retriedRevision[kind] = store._pin.revision();
              if (
                (kind === 'badge' || store._isOpen()) &&
                (store._realtime?.status() === 'connecting' ||
                  store._realtime?.status() === 'reconnecting')
              )
                refused.connectedSkip[kind] = store._pin.revision();
            }
          }
          if (claims.size > 0) {
            recoveryBadgePending ||= refused.badge;
            recoveryNotificationsPending ||= refused.notifications;
          } else {
            if (refused.badge) store._refreshBadge.next();
            if (refused.notifications && store._isOpen()) reloadNotifications(true);
          }
          if (refused.reminders && store._isOpen()) refreshReminders();
          refused.badge = false;
          refused.notifications = false;
          refused.reminders = false;
        },
        _connected(): void {
          store._refused.badge = false;
          store._refused.notifications = false;
          store._refused.reminders = false;
          const revision: number = store._pin.revision();
          if (store._refused.connectedSkip.reminders !== revision) refreshReminders();
          store._refused.connectedSkip.reminders = -1;
          const skipNotifications: boolean =
            store._refused.connectedSkip.notifications === revision;
          store._refused.connectedSkip.notifications = -1;
          if (!store._isOpen() || skipNotifications) return;
          if (claims.size > 0) notificationRefreshPending = true;
          else reloadNotifications(true);
        },
        _poll: rxMethod<{ organizationId: string; connected: boolean }>(
          pipe(
            switchMap(
              ({ organizationId, connected }: { organizationId: string; connected: boolean }) => {
                const skip: boolean =
                  connected && store._refused.connectedSkip.badge === store._pin.revision();
                if (connected) store._refused.connectedSkip.badge = -1;
                const triggers: Observable<unknown>[] = [
                  timer(skip ? POLL_MS : 0, POLL_MS),
                  store._refreshBadge,
                ];
                if (store._window) triggers.push(fromEvent(store._window, 'focus'));
                return merge(...triggers).pipe(
                  switchMap(() => {
                    const version: number = store._version();
                    const revision: number = store._pin.revision();
                    return store._api.unreadCount().pipe(
                      catchError((error: unknown) => {
                        store._recordRefusal('badge', error, revision);
                        return EMPTY;
                      }),
                      tap((unreadCount: number) => {
                        if (
                          sameOrganization(organizationId) &&
                          version === store._version() &&
                          claims.size === 0
                        ) {
                          patchState(store, {
                            unreadCount,
                            _badgeVersion: store._badgeVersion() + 1,
                          });
                        }
                      }),
                    );
                  }),
                );
              },
            ),
          ),
        ),
        _followOrganization: signalMethod<string>((organizationId: string): void => {
          if (sameOrganization(organizationId)) return;
          organizationVersion++;
          reminderWrites = 0;
          reminderRefreshPending = null;
          notificationRefreshPending = false;
          recoveryBadgePending = false;
          recoveryNotificationsPending = false;
          store._refused.badge = false;
          store._refused.notifications = false;
          store._refused.reminders = false;
          store._refused.retriedRevision = { badge: -1, notifications: -1, reminders: -1 };
          store._refused.connectedSkip = { badge: -1, notifications: -1, reminders: -1 };
          notificationReloadQueued = null;
          reminderReloadQueued = null;
          store._reloadKinds.notifications = null;
          store._reloadKinds.reminders = null;
          claims = new Map<number, ReadClaim>();
          confirmedIds = new Set<string>();
          confirmedAll = false;
          patchState(store, {
            _organizationId: organizationId,
            unreadCount: null,
            _openings: store._isOpen() ? 1 : 0,
            _version: store._version() + 1,
          });
        }),
        open(): void {
          const previouslyOpened: boolean = store._openings() > 0;
          if (!previouslyOpened) store._reloadKinds.notifications = false;
          patchState(store, { _openings: 1, _isOpen: true });
          if (previouslyOpened) reloadNotifications();
          refreshReminders(false);
        },
        close(): void {
          patchState(store, { _isOpen: false });
        },
        markAllRead(): Promise<boolean> {
          const page: InboxNotificationPage | undefined = currentPage();
          const visible: readonly InboxNotification[] = page?.items ?? [];
          const unread: number = visible.filter((item: InboxNotification) => !item.read).length;
          const covered: Set<string> = new Set<string>(
            visible
              .filter(
                (item: InboxNotification) =>
                  !item.read ||
                  [...claims.values()].some((claim: ReadClaim) => claim.ids.has(item.id)),
              )
              .map((item: InboxNotification) => item.id),
          );
          const before: number = store.unreadCount() ?? page?.unreadCount ?? 0;
          return readWrite(covered, true, Math.max(0, before - unread), () =>
            store._api.markAllRead(),
          );
        },
        markRead(notification: InboxNotification): Promise<boolean> {
          if (notification.read) return Promise.resolve(true);
          return readWrite(new Set([notification.id]), false, 0, async (): Promise<null> => {
            await store._api.markRead(notification.id);
            return null;
          });
        },
        snooze(reminder: InboxReminder, remindAt: string): Promise<boolean> {
          const moved: (page: InboxReminderPage, from: string, to: string) => InboxReminderPage = (
            page: InboxReminderPage,
            from: string,
            to: string,
          ): InboxReminderPage => ({
            ...page,
            items: page.items
              .map((item: InboxReminder) =>
                item.id === reminder.id && item.remindAt === from
                  ? { ...item, remindAt: to }
                  : item,
              )
              .sort(byDueTime),
          });
          return reminderWrite(
            (page: InboxReminderPage) => moved(page, reminder.remindAt, remindAt),
            (page: InboxReminderPage) => moved(page, remindAt, reminder.remindAt),
            () => store._api.snooze(reminder.id, remindAt),
          );
        },
        complete(reminder: InboxReminder): Promise<boolean> {
          return reminderWrite(
            (page: InboxReminderPage) => ({
              items: page.items.filter((item: InboxReminder) => item.id !== reminder.id),
              pendingCount: Math.max(0, page.pendingCount - 1),
            }),
            (page: InboxReminderPage) =>
              page.items.some((item: InboxReminder) => item.id === reminder.id)
                ? page
                : {
                    items: [...page.items, reminder].sort(byDueTime),
                    pendingCount: page.pendingCount + 1,
                  },
            () => store._api.complete(reminder.id),
          );
        },
      };
    }),
    withHooks({
      onInit(store): void {
        const organizationId: Signal<string> = computed(
          (): string => store._workspace.organization().id,
        );
        store._drainReloads(
          computed(() => ({
            notifications: store.notifications.isLoading(),
            reminders: store.reminders.isLoading(),
          })),
        );
        store._followOrganization(organizationId);
        const status: Observable<string> = store._realtime
          ? toObservable(store._realtime.status).pipe(distinctUntilChanged())
          : of('disabled');
        store._poll(
          computed(() => ({
            organizationId: organizationId(),
            connected: store._realtime?.status() === 'connected',
          })),
        );
        status
          .pipe(
            filter((value: string) => value === 'connected'),
            takeUntilDestroyed(),
          )
          .subscribe(() => {
            store._connected();
          });
        store._pin.organizationVerified.pipe(takeUntilDestroyed()).subscribe(() => {
          if (store._pin.current() === store._organizationId()) store._verified();
        });
        const personalNotices: Observable<PersonalNotice> =
          store._realtime?.personalNotices ?? EMPTY;
        toObservable(organizationId)
          .pipe(
            switchMap(() =>
              personalNotices.pipe(
                groupBy(
                  (notice: PersonalNotice) =>
                    notice.type === 'notification.created.v1' ? notice.type : notice.reminderId,
                  {
                    duration: (group) => group.pipe(debounceTime(1000)),
                  },
                ),
                mergeMap((group) => group.pipe(auditTime(300))),
              ),
            ),
            takeUntilDestroyed(),
          )
          .subscribe((notice: PersonalNotice) => {
            store._notice(notice);
          });
      },
    }),
  );
}

/**
 * Constant InboxStore
 *
 * @description
 * The inbox of the rail, provided by its rail item so it lives with the shell. Everything is keyed
 * on the workspace's organization: a committed switch clears the count and the lists at once and
 * restarts the poll, and any answer or write result of the previous organization is ignored. The
 * unread count is refreshed by notices, reconnects, focus and a one-minute poll; the
 * notifications and reminders are refreshed on opening. Every write bumps a
 * version, so a poll answer or a notifications load that began before it is dropped. Writes are
 * optimistic; a refusal restores only what that write changed and no other write covers, on the
 * current state. A failed read keeps its resource error for the popover's inline « Réessayer ».
 *
 * @type {ReturnType<typeof createInboxStore>}
 */
export const InboxStore: ReturnType<typeof createInboxStore> = createInboxStore();
