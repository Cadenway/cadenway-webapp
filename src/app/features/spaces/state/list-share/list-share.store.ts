import {
  computed,
  inject,
  resource,
  type ResourceRef,
  type Signal,
  type Type,
} from '@angular/core';
import { CwToastService } from '@cadenway/ui/components/toast';
import {
  patchState,
  signalMethod,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { of } from 'rxjs';

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
 * Constant ORGANIZATION_KEY
 *
 * @description
 * Key of the switch's write queue, apart from the people's (account ids are UUIDs).
 *
 * @type {string}
 */
const ORGANIZATION_KEY: string = 'organization-access';

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
 * The open list and the changes made since its access was read.
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
   * Property roles
   *
   * @description
   * The role shown for each person changed since the read (null: removed), sent or confirmed.
   *
   * @type {Readonly<Record<string, ShareRole | null>>}
   * @readonly
   */
  readonly roles: Readonly<Record<string, ShareRole | null>>;

  /**
   * Property added
   *
   * @description
   * People given access since the read, in the order they were invited.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly added: readonly string[];

  /**
   * Property _organizationAccess
   *
   * @description
   * The switch as shown since it was turned, or null while it shows the read value.
   *
   * @type {boolean | null}
   * @readonly
   */
  readonly _organizationAccess: boolean | null;
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
   * Whether `Invite by email` shows: the caller may share and reads the member directory.
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
   * Follows the list the dialog is open on: another list reads its access again, null (closed)
   * forgets it, the same list (a new version of it) changes nothing.
   *
   * @param {Signal<ShareTarget | null> | ShareTarget | null} target - The open list.
   */
  follow(target: Signal<ShareTarget | null> | ShareTarget | null): void;

  /**
   * Method changeRole
   *
   * @description
   * Changes a person's role at once and sends it; a refusal puts back the confirmed role.
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
   * Removes a person's access at once (once `Remove access` is confirmed) and sends it; a
   * refusal shows the person again.
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
   * Turns the `Organization access` switch at once and sends it; a refusal turns it back.
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
    roles: {},
    added: [],
    _organizationAccess: null,
  };
  return signalStore(
    withState(initialState),
    withProps((store) => {
      const api: ListAccessApi = inject(ListAccessApi);
      return {
        _api: api,
        _toasts: inject(CwToastService),
        _listPage: inject(ListPageStore),
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
      };
    }),
    withComputed((store) => {
      const read: () => ListAccess | null = () =>
        store.access.hasValue() ? store.access.value() : null;
      const people: Signal<readonly SharePerson[]> = computed((): readonly SharePerson[] => {
        const access: ListAccess | null = read();
        if (access === null) return [];
        const roles: Readonly<Record<string, ShareRole | null>> = store.roles();
        const directory: ReadonlyMap<string, ShareDirectoryEntry> = new Map<
          string,
          ShareDirectoryEntry
        >((access.directory ?? []).map((entry: ShareDirectoryEntry) => [entry.userId, entry]));
        const granted: Set<string> = new Set<string>(
          access.grants.map((grant: ShareGrant): string => grant.userId),
        );
        const rows: SharePerson[] = [personOf(access.ownerId, 'owner', directory)];
        for (const grant of access.grants) {
          const role: ShareRole | null =
            grant.userId in roles ? (roles[grant.userId] ?? null) : grant.role;
          if (role !== null) rows.push(personOf(grant.userId, role, directory));
        }
        for (const userId of store.added()) {
          const role: ShareRole | null = roles[userId] ?? null;
          if (!granted.has(userId) && role !== null) {
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
        organizationAccess: computed(
          (): boolean => store._organizationAccess() ?? read()?.organizationAccess ?? true,
        ),
        canEdit: computed((): boolean => read()?.canEdit ?? false),
        canInvite: computed((): boolean => {
          const access: ListAccess | null = read();
          return access !== null && access.canEdit && access.directory !== null;
        }),
        privateSpace: computed((): boolean => read()?.privateSpace ?? false),
        _read: computed(read),
      };
    }),
    withMethods((store) => {
      const confirmed: Map<string, ShareRole | null> = new Map<string, ShareRole | null>();
      let confirmedOrganization: boolean | null = null;
      let session: number = 0;
      const queues: Map<string, Promise<unknown>> = new Map<string, Promise<unknown>>();
      const sequences: Map<string, number> = new Map<string, number>();
      const forget: () => void = (): void => {
        session += 1;
        confirmed.clear();
        confirmedOrganization = null;
        queues.clear();
        sequences.clear();
      };
      const readRole: (userId: string) => ShareRole | null = (userId: string): ShareRole | null => {
        if (confirmed.has(userId)) return confirmed.get(userId) ?? null;
        return (
          store._read()?.grants.find((grant: ShareGrant): boolean => grant.userId === userId)
            ?.role ?? null
        );
      };
      const acceptVersion: (listId: string, write: ShareWrite) => void = (
        listId: string,
        write: ShareWrite,
      ): void => {
        const list: TaskList | undefined = store._listPage.list.hasValue()
          ? store._listPage.list.value()
          : undefined;
        if (write.version !== null && list?.id === listId && write.version > list.version) {
          store._listPage.followListEdits(of({ ...list, version: write.version }));
        }
      };
      const enqueue: <T>(key: string, run: () => Promise<T>) => Promise<T> = <T>(
        key: string,
        run: () => Promise<T>,
      ): Promise<T> => {
        const next: Promise<T> = (queues.get(key) ?? Promise.resolve()).then(run, run);
        queues.set(key, next);
        return next;
      };
      const nextSequence: (key: string) => number = (key: string): number => {
        const sequence: number = (sequences.get(key) ?? 0) + 1;
        sequences.set(key, sequence);
        return sequence;
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
        const target: ShareTarget | null = store.target();
        const access: ListAccess | null = store._read();
        if (target === null || access === null || !access.canEdit || userId === access.ownerId) {
          return Promise.resolve(false);
        }
        const sequence: number = nextSequence(userId);
        const opened: number = session;
        const inRead: boolean = access.grants.some(
          (grant: ShareGrant): boolean => grant.userId === userId,
        );
        patchState(store, {
          roles: { ...store.roles(), [userId]: role },
          added:
            inRead || store.added().includes(userId) ? store.added() : [...store.added(), userId],
        });
        return enqueue(userId, async (): Promise<boolean> => {
          if (opened !== session) return false;
          try {
            const write: ShareWrite =
              role === null
                ? await store._api.removeRole(target.listId, userId)
                : await store._api.setRole(target.listId, userId, role);
            if (opened !== session) return true;
            confirmed.set(userId, role);
            acceptVersion(target.listId, write);
            store._listPage.members.reload();
            return true;
          } catch {
            if (opened !== session) return false;
            if (sequences.get(userId) === sequence) {
              patchState(store, { roles: { ...store.roles(), [userId]: readRole(userId) } });
            }
            store._toasts.error(failure);
            return false;
          }
        });
      };
      return {
        follow: signalMethod<ShareTarget | null>((target: ShareTarget | null): void => {
          if (sameTarget(store.target(), target)) return;
          forget();
          patchState(store, { ...initialState, target });
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
          const entry: ShareDirectoryEntry | undefined = access.directory?.find(
            (item: ShareDirectoryEntry): boolean => item.email.toLowerCase() === lower,
          );
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
          const target: ShareTarget | null = store.target();
          const access: ListAccess | null = store._read();
          if (target === null || !access?.canEdit) return Promise.resolve(false);
          const sequence: number = nextSequence(ORGANIZATION_KEY);
          const opened: number = session;
          patchState(store, { _organizationAccess: on });
          return enqueue(ORGANIZATION_KEY, async (): Promise<boolean> => {
            if (opened !== session) return false;
            try {
              const write: ShareWrite = await store._api.setOrganizationAccess(target.listId, on);
              if (opened !== session) return true;
              confirmedOrganization = on;
              acceptVersion(target.listId, write);
              return true;
            } catch {
              if (opened !== session) return false;
              if (sequences.get(ORGANIZATION_KEY) === sequence) {
                patchState(store, { _organizationAccess: confirmedOrganization });
              }
              store._toasts.error(
                $localize`:@@spaces.share.organization-failed:The organization access could not be changed`,
              );
              return false;
            }
          });
        },
      };
    }),
  );
}

/**
 * Constant ListShareStore
 *
 * @description
 * The `Share` dialog's people and switch (`App.dc.html` lines 2980-3016, 8830-8855), provided by
 * `cw-share-dialog`. It reads the list, its space (the owner and the visibility), every grant and
 * the member directory when the dialog opens on a list, and forgets them when it closes. Every
 * change shows at once: a role, a removal, a person invited, the switch. Writes of one person
 * (and of the switch) go one after the other; a refusal puts back the last confirmed value unless
 * a newer change of the same person is still on its way, with the failure toast. A recorded
 * change hands the list version the gateway answered to `ListPageStore` (`followListEdits`), so
 * the header's later writes send the current `If-Match`, and reads the header's members again.
 * Answers for a list the dialog left are dropped.
 *
 * @type {Type<ListShareStoreInstance>}
 */
export const ListShareStore: Type<ListShareStoreInstance> = createListShareStore();
