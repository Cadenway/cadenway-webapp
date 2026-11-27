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

/**
 * Constant NOTICE_AUDIT_MS
 *
 * @description
 * Window, in milliseconds, in which a burst of notification notices reads the page only once,
 * after its last notice.
 *
 * @type {number}
 */
export const NOTICE_AUDIT_MS: number = 300;

/**
 * Interface InboxDigestState
 *
 * @description
 * The organization the digest reads and the notifications it shows read before the server says so.
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
   * Notifications opened from the digest, while their write is pending or once it was recorded; a
   * page read before the write still shows them read.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly _readIds: readonly string[];
  // #endregion
}

/**
 * Interface DigestLoads
 *
 * @description
 * How the next read of the page is sent and what a refused passive read waits for.
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
   * A read asked for while the page was loading, sent once it settles: whether it is passive, or
   * null when none is queued.
   *
   * @type {boolean | null}
   */
  queued: boolean | null;

  /**
   * Property refused
   *
   * @description
   * Whether a passive read was refused because the workspace organization was being verified.
   *
   * @type {boolean}
   */
  refused: boolean;

  /**
   * Property retriedRevision
   *
   * @description
   * Pin revision whose verification already read the page again, so a refusal of that revision
   * is not retried twice.
   *
   * @type {number}
   */
  retriedRevision: number;
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
   * The notifications, the newest first, with those opened here shown read; empty while loading
   * and after a failure.
   *
   * @type {Signal<readonly InboxNotification[]>}
   * @readonly
   */
  readonly items: Signal<readonly InboxNotification[]>;

  /**
   * Property loading
   *
   * @description
   * Whether the page is read with nothing to show yet; a background refresh keeps the rows.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly loading: Signal<boolean>;

  /**
   * Property failed
   *
   * @description
   * Whether the last read of the page failed.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly failed: Signal<boolean>;

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
   * Reads the page again, as an active request (`Retry`).
   */
  retry(): void;

  /**
   * Method markRead
   *
   * @description
   * Shows a notification read at once, then records it; a refusal shows it unread again.
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
 * No organization and nothing opened yet.
 *
 * @type {InboxDigestState}
 */
const initialState: InboxDigestState = { _organizationId: null, _readIds: [] };

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
      const loads: DigestLoads = {
        passive: null,
        queued: null,
        refused: false,
        retriedRevision: -1,
      };
      let readOrganization: string | null = null;
      return {
        _api: api,
        _pin: pin,
        _loads: loads,
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
              return await api.notifications(passive);
            } catch (error: unknown) {
              if (
                passive &&
                contextRefused(error) &&
                revision === pin.revision() &&
                revision !== loads.retriedRevision
              )
                loads.refused = true;
              throw error;
            }
          },
        }),
      };
    }),
    withComputed((store) => ({
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
        (): boolean => store._notifications.isLoading() && !store._notifications.hasValue(),
      ),
      failed: computed((): boolean => store._notifications.status() === 'error'),
      empty: computed(
        (): boolean =>
          store._notifications.hasValue() && store._notifications.value().items.length === 0,
      ),
    })),
    withMethods((store) => {
      const read: (passive: boolean) => void = (passive: boolean): void => {
        if (store._organizationId() === null) return;
        if (store._notifications.status() === 'loading') {
          store._loads.queued = (store._loads.queued ?? true) && passive;
          return;
        }
        store._loads.passive = passive;
        store._notifications.reload();
      };
      return {
        _refresh(): void {
          read(true);
        },
        _drainQueued: signalMethod<boolean>((loading: boolean): void => {
          if (loading || store._loads.queued === null) return;
          const passive: boolean = store._loads.queued;
          store._loads.queued = null;
          read(passive);
        }),
        _verified(): void {
          if (!store._loads.refused || store._pin.current() !== store._organizationId()) return;
          store._loads.refused = false;
          store._loads.retriedRevision = store._pin.revision();
          read(true);
        },
        _followOrganization: signalMethod<string>((organizationId: string): void => {
          if (organizationId === store._organizationId()) return;
          store._loads.passive = null;
          store._loads.queued = null;
          store._loads.refused = false;
          store._loads.retriedRevision = -1;
          patchState(store, { _organizationId: organizationId, _readIds: [] });
        }),
        retry(): void {
          read(false);
        },
        async markRead(notification: InboxNotification): Promise<boolean> {
          if (notification.read || store._readIds().includes(notification.id)) return true;
          const organizationId: string | null = store._organizationId();
          patchState(store, { _readIds: [...store._readIds(), notification.id] });
          try {
            await store._api.markRead(notification.id);
            return true;
          } catch {
            if (organizationId === store._organizationId()) {
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
        store._drainQueued(computed((): boolean => store._notifications.status() === 'loading'));
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
 * notification notice (`notification.created.v1`, once per 300 ms burst), after a realtime
 * reconnection (notices are not replayed) and after an organization switch. A switch drops the
 * previous organization's rows at once. A background refresh keeps the rows while it runs; a
 * failed read is a state (`failed`), never an empty page. A passive read refused while the
 * workspace organization is verified is sent again once verified, once per verification.
 * Opening a notification shows it read at once and records it; a refusal shows it unread again,
 * and a page read before the write settled still shows it read.
 *
 * @type {ReturnType<typeof createInboxDigestStore>}
 */
export const InboxDigestStore: ReturnType<typeof createInboxDigestStore> = createInboxDigestStore();
