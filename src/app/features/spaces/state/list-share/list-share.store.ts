import {
  computed,
  DestroyRef,
  inject,
  resource,
  type ResourceRef,
  type ResourceStatus,
  type Signal,
  type Type,
} from '@angular/core';
import { CwToastService } from '@cadenway/ui/components/toast';
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
import { Subject } from 'rxjs';

import { ListAccessApi } from '../../data-access/services/list-access-api/list-access-api.service';
import type {
  ListAccess,
  ShareDirectoryEntry,
  ShareGrant,
  ShareInviteOutcome,
  SharePerson,
  ShareRole,
  ShareWrite,
} from '../../models/list-share/list-share.interface';
import type { TaskList } from '../../models/task-list/task-list.interface';
import { ListPageStore } from '../list-page/list-page.store';

/**
 * Constant SHARE_EMAIL_PATTERN
 *
 * @description
 * A complete address for `Invite by email`: something, `@`, a domain with a dot, as the mockup
 * checks it (`App.dc.html` line 8836); anything else is `Incomplete address: add the domain.`.
 *
 * @type {RegExp}
 */
export const SHARE_EMAIL_PATTERN: RegExp = /.+@.+\..+/u;

/**
 * Constant ORGANIZATION_SUBJECT
 *
 * @description
 * Subject of the switch's write queue, apart from the people's (account ids are UUIDs).
 *
 * @type {string}
 */
const ORGANIZATION_SUBJECT: string = '#organization';

/**
 * Interface ShareTarget
 *
 * @description
 * The list the dialog is open on.
 */
export interface ShareTarget {
  // #region Properties
  /**
   * Property listId
   *
   * @description
   * The list.
   *
   * @type {string}
   * @readonly
   */
  readonly listId: string;

  /**
   * Property spaceId
   *
   * @description
   * Its space.
   *
   * @type {string}
   * @readonly
   */
  readonly spaceId: string;
  // #endregion
}

/**
 * Interface ListShareState
 *
 * @description
 * The open list and the changes not yet covered by a read, keyed by list and subject
 * (`<listId>/<userId>`), so that they survive the dialog closing and another list opening.
 */
interface ListShareState {
  // #region Properties
  /**
   * Property target
   *
   * @description
   * The list the dialog is open on, or null while closed.
   *
   * @type {ShareTarget | null}
   * @readonly
   */
  readonly target: ShareTarget | null;

  /**
   * Property _roles
   *
   * @description
   * The role shown for each person changed since the last read (null: removed), sent, queued or
   * confirmed, by `<listId>/<userId>`.
   *
   * @type {Readonly<Record<string, ShareRole | null>>}
   * @readonly
   */
  readonly _roles: Readonly<Record<string, ShareRole | null>>;

  /**
   * Property _added
   *
   * @description
   * The `<listId>/<userId>` of the people given access since the last read, in invitation order.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly _added: readonly string[];

  /**
   * Property _organizationAccess
   *
   * @description
   * The switch as shown since it was turned, by list.
   *
   * @type {Readonly<Record<string, boolean>>}
   * @readonly
   */
  readonly _organizationAccess: Readonly<Record<string, boolean>>;
  // #endregion
}

/**
 * Interface ListShareStoreInstance
 *
 * @description
 * Public API of `ListShareStore`.
 */
export interface ListShareStoreInstance {
  // #region Properties
  /**
   * Property access
   *
   * @description
   * The read of who has access: loading, failed (the inline error) or read.
   *
   * @type {ResourceRef<ListAccess | undefined>}
   * @readonly
   */
  readonly access: ResourceRef<ListAccess | undefined>;

  /**
   * Property directory
   *
   * @description
   * The member directory, read with the access: null when the caller may not read it (no names,
   * no invitation); a failed read is its own inline error with `Retry`.
   *
   * @type {ResourceRef<readonly ShareDirectoryEntry[] | null | undefined>}
   * @readonly
   */
  readonly directory: ResourceRef<readonly ShareDirectoryEntry[] | null | undefined>;

  /**
   * Property people
   *
   * @description
   * `People with access`: the owner first, then the grants in the order access was given, then
   * the people invited from the dialog, with the roles as changed.
   *
   * @type {Signal<readonly SharePerson[]>}
   * @readonly
   */
  readonly people: Signal<readonly SharePerson[]>;

  /**
   * Property guestCount
   *
   * @description
   * Guests among `people`, for the guest sum.
   *
   * @type {Signal<number>}
   * @readonly
   */
  readonly guestCount: Signal<number>;

  /**
   * Property organizationAccess
   *
   * @description
   * The `Organization access` switch as shown.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly organizationAccess: Signal<boolean>;

  /**
   * Property canEdit
   *
   * @description
   * Whether the caller may change the list's access (`edit` on it).
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly canEdit: Signal<boolean>;

  /**
   * Property canInvite
   *
   * @description
   * Whether `Invite by email` shows: the caller may share and has read the member directory.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly canInvite: Signal<boolean>;

  /**
   * Property privateSpace
   *
   * @description
   * Whether the list's space is private, where the switch changes nothing.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly privateSpace: Signal<boolean>;
  // #endregion

  // #region Methods
  /**
   * Method follow
   *
   * @description
   * Follows the list the dialog is open on: another list (or an opening) reads its access and
   * the directory again, null (closed) leaves them; the same list (a new version of it) changes
   * nothing. Changes still on their way keep showing over the new read.
   *
   * @param {Signal<ShareTarget | null> | ShareTarget | null} target - The open list.
   */
  follow(target: Signal<ShareTarget | null> | ShareTarget | null): void;

  /**
   * Method changeRole
   *
   * @description
   * Changes a person's role at once and sends it after the earlier changes of that person; a
   * refusal puts back the confirmed role.
   *
   * @param {string} userId - The person, not the owner.
   * @param {ShareRole} role - The role.
   * @returns {Promise<boolean>} Whether the gateway recorded it.
   */
  changeRole(userId: string, role: ShareRole): Promise<boolean>;

  /**
   * Method remove
   *
   * @description
   * Removes a person's grant at once (once `Remove access` is confirmed) and sends it; a refusal
   * shows the person again.
   *
   * @param {string} userId - The person, not the owner.
   * @returns {Promise<boolean>} Whether the gateway recorded it.
   */
  remove(userId: string): Promise<boolean>;

  /**
   * Method invite
   *
   * @description
   * `Invite`: gives the role to the member or guest of the organization with this address, shown
   * at once; `Invitation sent` follows the gateway's answer.
   *
   * @param {string} email - The typed address.
   * @param {ShareRole} role - The role chosen beside it.
   * @returns {ShareInviteOutcome} What became of the address.
   */
  invite(email: string, role: ShareRole): ShareInviteOutcome;

  /**
   * Method setOrganizationAccess
   *
   * @description
   * Turns the `Organization access` switch at once and sends it after its earlier turns; a
   * refusal turns it back.
   *
   * @param {boolean} on - The switch.
   * @returns {Promise<boolean>} Whether the gateway recorded it.
   */
  setOrganizationAccess(on: boolean): Promise<boolean>;
  // #endregion
}

/**
 * Function sameTarget
 *
 * @description
 * Whether two targets name the same list.
 *
 * @param {ShareTarget | null} a - A target.
 * @param {ShareTarget | null} b - Another.
 * @returns {boolean} True when both are null or name the same list.
 */
function sameTarget(a: ShareTarget | null, b: ShareTarget | null): boolean {
  return a === null || b === null ? a === b : a.listId === b.listId;
}

/**
 * Function keyOf
 *
 * @description
 * The key of a subject (a person, or the switch) of a list.
 *
 * @param {string} listId - The list.
 * @param {string} subject - The person's account, or `ORGANIZATION_SUBJECT`.
 * @returns {string} `<listId>/<subject>`.
 */
function keyOf(listId: string, subject: string): string {
  return `${listId}/${subject}`;
}

/**
 * Function withoutList
 *
 * @description
 * A record without the entries of a list.
 *
 * @param {Readonly<Record<string, T>>} record - Entries by `<listId>/<subject>` or by list.
 * @param {string} listId - The list.
 * @returns {Record<string, T>} The other entries.
 */
function withoutList<T>(record: Readonly<Record<string, T>>, listId: string): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).filter(
      ([key]: [string, T]): boolean => key !== listId && !key.startsWith(`${listId}/`),
    ),
  );
}

/**
 * Function personOf
 *
 * @description
 * A row of `People with access`, named from the directory when it lists the person.
 *
 * @param {string} userId - The person.
 * @param {ShareRole | 'owner'} role - Their role.
 * @param {ReadonlyMap<string, ShareDirectoryEntry>} directory - The directory by account.
 * @returns {SharePerson} The row.
 */
function personOf(
  userId: string,
  role: ShareRole | 'owner',
  directory: ReadonlyMap<string, ShareDirectoryEntry>,
): SharePerson {
  const entry: ShareDirectoryEntry | undefined = directory.get(userId);
  return {
    userId,
    name: entry?.name ?? null,
    email: entry?.email ?? null,
    guest: entry?.guest ?? false,
    role,
  };
}

/**
 * Function createListShareStore
 *
 * @description
 * Builds the share dialog's store.
 *
 * @returns {Type<ListShareStoreInstance>} Injectable store constructor.
 */
function createListShareStore(): Type<ListShareStoreInstance> {
  const initialState: ListShareState = {
    target: null,
    _roles: {},
    _added: [],
    _organizationAccess: {},
  };
  return signalStore(
    withState(initialState),
    withProps((store) => {
      const api: ListAccessApi = inject(ListAccessApi);
      return {
        _api: api,
        _toasts: inject(CwToastService),
        _listPage: inject(ListPageStore),
        _destroyRef: inject(DestroyRef),
        _versions: new Subject<TaskList>(),
        access: resource({
          params: () => store.target() ?? undefined,
          loader: ({
            params,
            abortSignal,
          }: {
            params: ShareTarget;
            abortSignal: AbortSignal;
          }): Promise<ListAccess> => api.read(params.listId, params.spaceId, abortSignal),
        }),
        directory: resource({
          params: () => {
            const target: ShareTarget | null = store.target();
            return target ? { listId: target.listId } : undefined;
          },
          loader: ({
            abortSignal,
          }: {
            abortSignal: AbortSignal;
          }): Promise<readonly ShareDirectoryEntry[] | null> => api.directory(abortSignal),
        }),
      };
    }),
    withComputed((store) => {
      const read: () => ListAccess | null = () =>
        store.access.hasValue() ? store.access.value() : null;
      const entries: () => readonly ShareDirectoryEntry[] | null = () =>
        store.directory.hasValue() ? store.directory.value() : null;
      const people: Signal<readonly SharePerson[]> = computed((): readonly SharePerson[] => {
        const access: ListAccess | null = read();
        if (access === null) return [];
        const roles: Readonly<Record<string, ShareRole | null>> = store._roles();
        const directory: ReadonlyMap<string, ShareDirectoryEntry> = new Map<
          string,
          ShareDirectoryEntry
        >((entries() ?? []).map((entry: ShareDirectoryEntry) => [entry.userId, entry]));
        const granted: Set<string> = new Set<string>(
          access.grants.map((grant: ShareGrant): string => grant.userId),
        );
        const rows: SharePerson[] = [personOf(access.ownerId, 'owner', directory)];
        for (const grant of access.grants) {
          const key: string = keyOf(access.listId, grant.userId);
          const role: ShareRole | null = key in roles ? (roles[key] ?? null) : grant.role;
          if (role !== null) rows.push(personOf(grant.userId, role, directory));
        }
        const prefix: string = keyOf(access.listId, '');
        for (const key of store._added()) {
          const userId: string = key.slice(prefix.length);
          const role: ShareRole | null = roles[key] ?? null;
          if (key.startsWith(prefix) && !granted.has(userId) && role !== null) {
            rows.push(personOf(userId, role, directory));
          }
        }
        return rows;
      });
      return {
        people,
        guestCount: computed(
          (): number => people().filter((person: SharePerson): boolean => person.guest).length,
        ),
        organizationAccess: computed((): boolean => {
          const access: ListAccess | null = read();
          if (access === null) return true;
          return store._organizationAccess()[access.listId] ?? access.organizationAccess;
        }),
        canEdit: computed((): boolean => read()?.canEdit ?? false),
        canInvite: computed((): boolean => (read()?.canEdit ?? false) && entries() !== null),
        privateSpace: computed((): boolean => read()?.privateSpace ?? false),
        _read: computed(read),
        _entries: computed(entries),
      };
    }),
    withMethods((store) => {
      // Every accepted change is sent, one after the other per list and subject, even once the
      // dialog is closed or shows another list: the store lives with the list page, which keeps
      // the dialog once it was opened. Only the shown state waits for a read.
      const queues: Map<string, Promise<unknown>> = new Map<string, Promise<unknown>>();
      // The last value the gateway confirmed (or the read gave) of each changed subject.
      const confirmed: Map<string, ShareRole | boolean | null> = new Map<
        string,
        ShareRole | boolean | null
      >();
      // The newest change of each subject: an older refusal does not undo a newer change.
      const sequences: Map<string, number> = new Map<string, number>();
      // Changes accepted and not ended, by list.
      const running: Map<string, number> = new Map<string, number>();
      // Lists whose access was being read when their last change ended: read once more after.
      const reloadQueued: Set<string> = new Set<string>();
      const shows: (listId: string) => boolean = (listId: string): boolean =>
        !store._destroyRef.destroyed && store.target()?.listId === listId;
      // The changes of a list are covered by a read begun after they all ended: the read shows.
      const drop: (listId: string) => void = (listId: string): void => {
        for (const key of [...confirmed.keys()]) {
          if (key.startsWith(keyOf(listId, ''))) confirmed.delete(key);
        }
        patchState(store, {
          _roles: withoutList(store._roles(), listId),
          _added: store._added().filter((key: string): boolean => !key.startsWith(`${listId}/`)),
          _organizationAccess: withoutList(store._organizationAccess(), listId),
        });
      };
      const settle: (listId: string) => void = (listId: string): void => {
        const left: number = (running.get(listId) ?? 1) - 1;
        if (left > 0) {
          running.set(listId, left);
          return;
        }
        running.delete(listId);
        if (!shows(listId)) return;
        if (!store.access.reload() && store.access.isLoading()) reloadQueued.add(listId);
      };
      const acceptVersion: (listId: string, write: ShareWrite) => void = (
        listId: string,
        write: ShareWrite,
      ): void => {
        const list: TaskList | undefined = store._listPage.list.hasValue()
          ? store._listPage.list.value()
          : undefined;
        if (write.version !== null && list?.id === listId && write.version > list.version) {
          store._versions.next({ ...list, version: write.version });
        }
      };
      const enqueue: (
        listId: string,
        subject: string,
        send: () => Promise<ShareWrite>,
        failure: string,
        rollback: () => void,
      ) => Promise<boolean> = (
        listId: string,
        subject: string,
        send: () => Promise<ShareWrite>,
        failure: string,
        rollback: () => void,
      ): Promise<boolean> => {
        const key: string = keyOf(listId, subject);
        const sequence: number = (sequences.get(key) ?? 0) + 1;
        sequences.set(key, sequence);
        running.set(listId, (running.get(listId) ?? 0) + 1);
        const run: () => Promise<boolean> = async (): Promise<boolean> => {
          try {
            const write: ShareWrite = await send();
            acceptVersion(listId, write);
            return true;
          } catch {
            if (sequences.get(key) === sequence) rollback();
            store._toasts.error(failure);
            return false;
          } finally {
            settle(listId);
          }
        };
        const next: Promise<boolean> = (queues.get(key) ?? Promise.resolve()).then(run, run);
        queues.set(key, next);
        return next;
      };
      const writeRole: (
        userId: string,
        role: ShareRole | null,
        failure: string,
      ) => Promise<boolean> = (
        userId: string,
        role: ShareRole | null,
        failure: string,
      ): Promise<boolean> => {
        const access: ListAccess | null = store._read();
        if (access === null || !access.canEdit || userId === access.ownerId) {
          return Promise.resolve(false);
        }
        const listId: string = access.listId;
        const key: string = keyOf(listId, userId);
        const inRead: boolean = access.grants.some(
          (grant: ShareGrant): boolean => grant.userId === userId,
        );
        if (!confirmed.has(key)) {
          confirmed.set(
            key,
            access.grants.find((grant: ShareGrant): boolean => grant.userId === userId)?.role ??
              null,
          );
        }
        patchState(store, {
          _roles: { ...store._roles(), [key]: role },
          _added:
            inRead || store._added().includes(key) ? store._added() : [...store._added(), key],
        });
        return enqueue(
          listId,
          userId,
          async (): Promise<ShareWrite> => {
            const write: ShareWrite =
              role === null
                ? await store._api.removeRole(listId, userId)
                : await store._api.setRole(listId, userId, role);
            confirmed.set(key, role);
            store._listPage.members.reload();
            return write;
          },
          failure,
          (): void => {
            const before: ShareRole | boolean | null = confirmed.get(key) ?? null;
            patchState(store, {
              _roles: { ...store._roles(), [key]: typeof before === 'string' ? before : null },
            });
          },
        );
      };
      return {
        _onRead: signalMethod<ResourceStatus>((status: ResourceStatus): void => {
          const access: ListAccess | null = status === 'resolved' ? store._read() : null;
          if (access === null || running.has(access.listId)) return;
          if (reloadQueued.delete(access.listId)) {
            store.access.reload();
            return;
          }
          drop(access.listId);
        }),

        follow: signalMethod<ShareTarget | null>((target: ShareTarget | null): void => {
          if (!sameTarget(store.target(), target)) patchState(store, { target });
        }),

        changeRole(userId: string, role: ShareRole): Promise<boolean> {
          return writeRole(
            userId,
            role,
            $localize`:@@spaces.share.role-failed:The access could not be changed`,
          );
        },

        remove(userId: string): Promise<boolean> {
          return writeRole(
            userId,
            null,
            $localize`:@@spaces.share.remove-failed:The access could not be removed`,
          );
        },

        invite(email: string, role: ShareRole): ShareInviteOutcome {
          const address: string = email.trim();
          const access: ListAccess | null = store._read();
          if (address === '' || !access?.canEdit) return 'ignored';
          if (!SHARE_EMAIL_PATTERN.test(address)) return 'invalid';
          const lower: string = address.toLowerCase();
          const entry: ShareDirectoryEntry | undefined = store
            ._entries()
            ?.find((item: ShareDirectoryEntry): boolean => item.email.toLowerCase() === lower);
          if (entry === undefined) return 'unknown';
          if (entry.userId === access.ownerId) return 'owner';
          void writeRole(
            entry.userId,
            role,
            $localize`:@@spaces.share.invite-failed:The person could not be invited`,
          ).then((sent: boolean): void => {
            if (!sent) return;
            const description: string = {
              edit: $localize`:@@spaces.share.invited-edit:${entry.email}:email: can now edit the list.`,
              comment: $localize`:@@spaces.share.invited-comment:${entry.email}:email: can now comment on the list.`,
              view: $localize`:@@spaces.share.invited-view:${entry.email}:email: can now view the list.`,
            }[role];
            store._toasts.show($localize`:@@spaces.share.invited:Invitation sent`, {
              description,
            });
          });
          return 'sent';
        },

        setOrganizationAccess(on: boolean): Promise<boolean> {
          const access: ListAccess | null = store._read();
          if (!access?.canEdit) return Promise.resolve(false);
          const listId: string = access.listId;
          const key: string = keyOf(listId, ORGANIZATION_SUBJECT);
          if (!confirmed.has(key)) confirmed.set(key, access.organizationAccess);
          patchState(store, {
            _organizationAccess: { ...store._organizationAccess(), [listId]: on },
          });
          return enqueue(
            listId,
            ORGANIZATION_SUBJECT,
            async (): Promise<ShareWrite> => {
              const write: ShareWrite = await store._api.setOrganizationAccess(listId, on);
              confirmed.set(key, on);
              return write;
            },
            $localize`:@@spaces.share.organization-failed:The organization access could not be changed`,
            (): void => {
              const before: ShareRole | boolean | null = confirmed.get(key) ?? null;
              patchState(store, {
                _organizationAccess: {
                  ...store._organizationAccess(),
                  [listId]: before === true,
                },
              });
            },
          );
        },
      };
    }),
    withHooks({
      onInit(store): void {
        store._listPage.followListEdits(store._versions);
        store._onRead(store.access.status);
      },
    }),
  );
}

/**
 * Constant ListShareStore
 *
 * @description
 * The `Share` dialog's people and switch (`App.dc.html` lines 2980-3016, 8830-8855), provided by
 * `cw-share-dialog`, which the list page keeps once opened: the store lives with the list page.
 * It reads the list, its space (the owner and the visibility) and every grant, and the member
 * directory apart, each time the dialog opens on a list.
 *
 * Every change shows at once: a role, a removal, a person invited, the switch. The changes of one
 * list and subject (a person, or the switch) are sent one after the other, whether the dialog is
 * open, closed or reopened: a reopened dialog shows the changes still on their way over its read,
 * and its new changes wait behind them. A refusal puts back the last confirmed value, unless a
 * newer change of the same subject is still on its way, and always shows its failure toast. Every
 * recorded change hands the list version the gateway answered to `ListPageStore`
 * (`followListEdits`, while the list page shows that list), so that the header's later writes
 * send the current `If-Match`; a grant change also reads the header's members again. Once the
 * last change of a list ends, its access is read again if the dialog shows it, and the read
 * replaces the changes it covers.
 *
 * @type {Type<ListShareStoreInstance>}
 */
export const ListShareStore: Type<ListShareStoreInstance> = createListShareStore();
