import { computed, inject, resource, type Signal, type Type } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { auditTime, EMPTY, filter, type Observable } from 'rxjs';

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
import type { InboxRead } from '../../models/inbox-read/inbox-read.interface';
import { InboxReads } from '../../services/inbox-reads/inbox-reads.service';

/**
 * Constant NOTICE_AUDIT_MS
 *
 * @description
 * Window, in milliseconds, opened by the first notification notice of a burst; the page is read
 * once at its end, whatever other notices arrived within it.
 *
 * @type {number}
 */
export const NOTICE_AUDIT_MS: number = 300;

/**
 * Interface InboxDigestState
 *
 * @description
 * The organization the digest reads, the notifications it shows read before the page says so and
 * whether the running read started from a failure.
 */
interface InboxDigestState {
  // #region Properties
  /**
   * Property _organizationId
   *
   * @description
   * Organization whose notifications are read, or null before the workspace gives one.
   *
   * @type {string | null}
   * @readonly
   */
  readonly _organizationId: string | null;

  /**
   * Property _readIds
   *
   * @description
   * Notifications opened from the digest, while their write is pending or once it was recorded,
   * and those the popover recorded read; a page read before those writes still shows them read.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly _readIds: readonly string[];

  /**
   * Property _fromError
   *
   * @description
   * Whether the running read was sent while the last one had failed, so the failure stays shown
   * (with `Retry` busy) until it settles.
   *
   * @type {boolean}
   * @readonly
   */
  readonly _fromError: boolean;
  // #endregion
}

/**
 * Interface DigestLoads
 *
 * @description
 * How the next read of the page is sent and whether a refused passive read waits for verification.
 */
interface DigestLoads {
  // #region Properties
  /**
   * Property passive
   *
   * @description
   * Whether the next read was triggered in the background (a notice, a reconnection, an
   * organization switch), or null for the first read of an organization, which is active.
   *
   * @type {boolean | null}
   */
  passive: boolean | null;

  /**
   * Property queued
   *
   * @description
   * A read asked for while the page was loading or reloading, sent once it settles: whether it is
   * passive, or null when none is queued.
   *
   * @type {boolean | null}
   */
  queued: boolean | null;

  /**
   * Property refused
   *
   * @description
   * Whether the last passive read was refused because the workspace organization was changing or
   * stale, and waits for the next verified context.
   *
   * @type {boolean}
   */
  refused: boolean;
  // #endregion
}

/**
 * Interface InboxDigestStoreInstance
 *
 * @description
 * The first page of the signed-in person's notifications in the current organization.
 */
export interface InboxDigestStoreInstance {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * The notifications, the newest first, with those read in either inbox view shown read; empty
   * while loading and after a failure.
   *
   * @type {Signal<readonly InboxNotification[]>}
   * @readonly
   */
  readonly items: Signal<readonly InboxNotification[]>;

  /**
   * Property loading
   *
   * @description
   * Whether the page is read with nothing to show yet; a background refresh keeps the rows, and a
   * read sent after a failure keeps the failure.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly loading: Signal<boolean>;

  /**
   * Property failed
   *
   * @description
   * Whether the last read of the page failed; it stays true while a read sent after it runs.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly failed: Signal<boolean>;

  /**
   * Property retrying
   *
   * @description
   * Whether a read sent after a failure runs.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly retrying: Signal<boolean>;

  /**
   * Property empty
   *
   * @description
   * Whether the page was read and holds no notification.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly empty: Signal<boolean>;
  // #endregion

  // #region Methods
  /**
   * Method retry
   *
   * @description
   * Reads the page again, as an active request (`Retry`); nothing while a read runs.
   */
  retry(): void;

  /**
   * Method markRead
   *
   * @description
   * Shows a notification read at once, then records it and tells the popover; a refusal shows it
   * unread again.
   *
   * @param {InboxNotification} notification - The opened notification.
   * @returns {Promise<boolean>} Whether the gateway recorded it (true when it was already read).
   */
  markRead(notification: InboxNotification): Promise<boolean>;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * No organization, nothing opened and no failure yet.
 *
 * @type {InboxDigestState}
 */
const initialState: InboxDigestState = { _organizationId: null, _readIds: [], _fromError: false };

/**
 * Function contextRefused
 *
 * @description
 * Whether a read was refused because the workspace organization was changing or being verified.
 *
 * @param {unknown} error - The failure of the read.
 * @returns {boolean} Whether verification may let it through.
 */
function contextRefused(error: unknown): boolean {
  if (error instanceof OrganizationSwitchPendingError) return true;
  const problem: ApiProblem | null = readProblem(error);
  return problem?.status === 412 && problem.code === 'organization.context-changed';
}

/**
 * Function withIds
 *
 * @description
 * The given ids added to a list of ids, each once.
 *
 * @param {readonly string[]} ids - Current ids.
 * @param {readonly string[]} added - Ids to add.
 * @returns {readonly string[]} The union.
 */
function withIds(ids: readonly string[], added: readonly string[]): readonly string[] {
  return [...new Set<string>([...ids, ...added])];
}

/**
 * Function createInboxDigestStore
 *
 * @description
 * Creates the inbox digest store.
 *
 * @returns {Type<InboxDigestStoreInstance>} Injectable store constructor.
 */
function createInboxDigestStore(): Type<InboxDigestStoreInstance> {
  return signalStore(
    withState(initialState),
    withProps((store) => {
      const api: InboxApi = inject(InboxApi);
      const pin: OrganizationPin = inject(OrganizationPin);
      const workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);
      const loads: DigestLoads = { passive: null, queued: null, refused: false };
      let readOrganization: string | null = null;
      return {
        _api: api,
        _pin: pin,
        _loads: loads,
        _reads: inject(InboxReads),
        _workspace: workspace,
        _realtime: inject(RealtimeConnection, { optional: true }),
        _notifications: resource({
          params: (): { organizationId: string } | undefined => {
            const organizationId: string | null = store._organizationId();
            return organizationId === null ? undefined : { organizationId };
          },
          loader: async ({
            params,
          }: {
            params: { organizationId: string };
          }): Promise<InboxNotificationPage> => {
            const passive: boolean =
              loads.passive ??
              (readOrganization !== null && readOrganization !== params.organizationId);
            readOrganization = params.organizationId;
            loads.passive = null;
            const revision: number = pin.revision();
            try {
              const page: InboxNotificationPage = await api.notifications(passive);
              loads.refused = false;
              return page;
            } catch (error: unknown) {
              if (passive && contextRefused(error)) {
                // A context verified while the read ran lets it through now; otherwise the read
                // waits for the next verified context.
                if (
                  revision !== pin.revision() &&
                  pin.current() === params.organizationId &&
                  !pin.stale() &&
                  !pin.isSwitching()
                )
                  loads.queued = loads.queued ?? true;
                else loads.refused = true;
              }
              throw error;
            }
          },
        }),
      };
    }),
    withComputed((store) => {
      const retrying: Signal<boolean> = computed(
        (): boolean => store._fromError() && store._notifications.isLoading(),
      );
      return {
        retrying,
        items: computed((): readonly InboxNotification[] => {
          if (!store._notifications.hasValue()) return [];
          const read: ReadonlySet<string> = new Set<string>(store._readIds());
          return store._notifications
            .value()
            .items.map((item: InboxNotification) =>
              !item.read && read.has(item.id) ? { ...item, read: true } : item,
            );
        }),
        loading: computed(
          (): boolean =>
            store._notifications.isLoading() && !store._notifications.hasValue() && !retrying(),
        ),
        failed: computed((): boolean => store._notifications.status() === 'error' || retrying()),
        empty: computed(
          (): boolean =>
            store._notifications.hasValue() && store._notifications.value().items.length === 0,
        ),
      };
    }),
    withMethods((store) => {
      let generation: number = 0;
      const read: (passive: boolean) => void = (passive: boolean): void => {
        if (store._organizationId() === null) return;
        if (store._notifications.isLoading()) {
          store._loads.queued = (store._loads.queued ?? true) && passive;
          return;
        }
        if (store._notifications.status() === 'error') patchState(store, { _fromError: true });
        store._loads.passive = passive;
        store._notifications.reload();
      };
      return {
        _refresh(): void {
          read(true);
        },
        _settled: signalMethod<boolean>((loading: boolean): void => {
          if (loading) return;
          if (store._fromError()) patchState(store, { _fromError: false });
          if (store._loads.queued === null) return;
          const passive: boolean = store._loads.queued;
          store._loads.queued = null;
          read(passive);
        }),
        _verified(): void {
          if (!store._loads.refused || store._pin.current() !== store._organizationId()) return;
          store._loads.refused = false;
          read(true);
        },
        _readElsewhere(change: InboxRead): void {
          if (change.source === 'digest' || change.organizationId !== store._organizationId())
            return;
          const unread: string[] = change.all
            ? store
                .items()
                .filter((item: InboxNotification) => !item.read)
                .map((item: InboxNotification) => item.id)
            : [];
          patchState(store, { _readIds: withIds(store._readIds(), [...change.ids, ...unread]) });
          // A page in flight, or rows the popover did not list, may predate `Mark all as read`.
          if (change.all) read(true);
        },
        _followOrganization: signalMethod<string>((organizationId: string): void => {
          if (organizationId === store._organizationId()) return;
          generation += 1;
          store._loads.passive = null;
          store._loads.queued = null;
          store._loads.refused = false;
          patchState(store, { _organizationId: organizationId, _readIds: [], _fromError: false });
        }),
        retry(): void {
          if (store._notifications.isLoading()) return;
          read(false);
        },
        async markRead(notification: InboxNotification): Promise<boolean> {
          if (notification.read || store._readIds().includes(notification.id)) return true;
          const organizationId: string | null = store._organizationId();
          const started: number = generation;
          patchState(store, { _readIds: withIds(store._readIds(), [notification.id]) });
          try {
            await store._api.markRead(notification.id);
            if (started === generation && organizationId !== null) {
              store._reads.publish({
                organizationId,
                source: 'digest',
                ids: [notification.id],
                all: false,
              });
            }
            return true;
          } catch {
            if (started === generation) {
              patchState(store, {
                _readIds: store._readIds().filter((id: string) => id !== notification.id),
              });
            }
            return false;
          }
        },
      };
    }),
    withHooks({
      onInit(store): void {
        store._followOrganization(computed((): string => store._workspace.organization().id));
        store._settled(computed((): boolean => store._notifications.isLoading()));
        const notices: Observable<PersonalNotice> = store._realtime?.personalNotices ?? EMPTY;
        notices
          .pipe(
            filter((notice: PersonalNotice) => notice.type === 'notification.created.v1'),
            auditTime(NOTICE_AUDIT_MS),
            takeUntilDestroyed(),
          )
          .subscribe((): void => {
            store._refresh();
          });
        (store._realtime?.reconnected ?? EMPTY).pipe(takeUntilDestroyed()).subscribe((): void => {
          store._refresh();
        });
        store._pin.organizationVerified.pipe(takeUntilDestroyed()).subscribe((): void => {
          store._verified();
        });
        store._reads.changes.pipe(takeUntilDestroyed()).subscribe((change: InboxRead): void => {
          store._readElsewhere(change);
        });
      },
    }),
  );
}

/**
 * Constant InboxDigestStore
 *
 * @description
 * Component-scoped on `InboxDigest`, so it lives with the page that shows the digest (Home). It
 * reads the first page of the person's notifications (30, the newest first, read and unread) of
 * the workspace's organization: actively when the page opens and on `Retry`, passively on a
 * notification notice (`notification.created.v1`, once at the end of a 300 ms window opened by
 * the first notice of a burst), after a realtime reconnection (notices are not replayed) and after
 * an organization switch. A read asked for while another runs is sent once it settles. A switch
 * drops the previous organization's rows at once, and the results of writes sent before it are
 * ignored. A background refresh keeps the rows while it runs; a failed read is a state
 * (`failed`), never an empty page, and stays shown while a read sent after it runs (`retrying`).
 * A passive read refused while the workspace organization changes or is stale waits for the next
 * verified context; one refused by a context verified while it ran is sent again at once.
 * Opening a notification shows it read at once and records it; a refusal shows it unread again,
 * and a page read before the write settled still shows it read. Recorded reads go through
 * `InboxReads`: the digest publishes its own and shows the popover's read, reading the page again
 * after `Mark all as read`.
 *
 * @type {ReturnType<typeof createInboxDigestStore>}
 */
export const InboxDigestStore: ReturnType<typeof createInboxDigestStore> = createInboxDigestStore();
