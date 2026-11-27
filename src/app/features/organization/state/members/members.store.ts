import {
  computed,
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
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { debounceTime, pipe, tap } from 'rxjs';

import { hasProblemCode } from '@core/api';
import { RealtimeConnection } from '@core/realtime';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { MembersApi } from '../../data-access/services/members-api/members-api.service';
import { memberRoleLabel } from '../../models/member/member-role-label.util';
import type {
  AssignableMemberRole,
  MemberPage,
  MemberPresence,
  MemberPresenceFilter,
  MemberQuery,
  MemberRole,
  MemberRoleCounts,
  MemberRoleFilter,
  MemberRow,
  OrganizationMember,
} from '../../models/member/member.interface';

/**
 * Constant MEMBERS_PAGE_SIZE
 *
 * @description
 * Members per page (`Organisation.dc.html` line 861, `PAGE_SIZE`).
 *
 * @type {number}
 */
export const MEMBERS_PAGE_SIZE: number = 8;

/**
 * Constant SEARCH_DEBOUNCE_MS
 *
 * @description
 * Pause after the last keystroke before the search is sent.
 *
 * @type {number}
 */
export const SEARCH_DEBOUNCE_MS: number = 250;

/**
 * Constant ROLES_OF
 *
 * @description
 * Roles the API keeps for each role tab; `Administrators` counts the owner.
 *
 * @type {Readonly<Record<MemberRoleFilter, readonly MemberRole[]>>}
 */
const ROLES_OF: Readonly<Record<MemberRoleFilter, readonly MemberRole[]>> = {
  all: [],
  admin: ['owner', 'admin'],
  member: ['member'],
  guest: ['guest'],
};

/**
 * Interface MembersRead
 *
 * @description
 * What the members resource reads: one page by cursor, or every matching member when the presence
 * filter, which the API does not offer, is on.
 */
interface MembersRead {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * Organization read, so that a switch reads again.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property query
   *
   * @description
   * Search and roles.
   *
   * @type {MemberQuery}
   * @readonly
   */
  readonly query: MemberQuery;

  /**
   * Property complete
   *
   * @description
   * Whether every matching member is read (presence filter on).
   *
   * @type {boolean}
   * @readonly
   */
  readonly complete: boolean;

  /**
   * Property cursor
   *
   * @description
   * Cursor of the page read; null for the first page and a complete read.
   *
   * @type {string | null}
   * @readonly
   */
  readonly cursor: string | null;
  // #endregion
}

/**
 * Interface MembersState
 *
 * @description
 * The filters, the page and the writes being sent.
 */
interface MembersState {
  // #region Properties
  /**
   * Property search
   *
   * @description
   * Text of the search field, shown at once.
   *
   * @type {string}
   */
  search: string;

  /**
   * Property role
   *
   * @description
   * Role tab.
   *
   * @type {MemberRoleFilter}
   */
  role: MemberRoleFilter;

  /**
   * Property presence
   *
   * @description
   * Presence tab.
   *
   * @type {MemberPresenceFilter}
   */
  presence: MemberPresenceFilter;

  /**
   * Property pageIndex
   *
   * @description
   * Zero-based page shown.
   *
   * @type {number}
   */
  pageIndex: number;

  /**
   * Property _query
   *
   * @description
   * Search sent, once the typing paused.
   *
   * @type {string}
   */
  _query: string;

  /**
   * Property _cursors
   *
   * @description
   * Cursor of each page reached so far (null for the first), so that `Previous` goes back.
   *
   * @type {readonly (string | null)[]}
   */
  _cursors: readonly (string | null)[];

  /**
   * Property _roles
   *
   * @description
   * Role shown while its change is sent, by member id.
   *
   * @type {Readonly<Record<string, AssignableMemberRole>>}
   */
  _roles: Readonly<Record<string, AssignableMemberRole>>;

  /**
   * Property _removing
   *
   * @description
   * Members hidden while their removal is sent.
   *
   * @type {readonly string[]}
   */
  _removing: readonly string[];

  /**
   * Property _shown
   *
   * @description
   * Whether a read resolved once: until then a failure is the page's and reaches the route's
   * error boundary; afterwards it is shown in place.
   *
   * @type {boolean}
   */
  _shown: boolean;
  // #endregion
}

/**
 * Interface MembersStoreInstance
 *
 * @description
 * The members section: filters, pages, live presence and the role and removal writes.
 */
export interface MembersStoreInstance {
  // #region Properties
  /**
   * Property search
   *
   * @description
   * Text of the search field.
   *
   * @type {Signal<string>}
   * @readonly
   */
  readonly search: Signal<string>;

  /**
   * Property role
   *
   * @description
   * Role tab.
   *
   * @type {Signal<MemberRoleFilter>}
   * @readonly
   */
  readonly role: Signal<MemberRoleFilter>;

  /**
   * Property presence
   *
   * @description
   * Presence tab.
   *
   * @type {Signal<MemberPresenceFilter>}
   * @readonly
   */
  readonly presence: Signal<MemberPresenceFilter>;

  /**
   * Property pageIndex
   *
   * @description
   * Zero-based page shown.
   *
   * @type {Signal<number>}
   * @readonly
   */
  readonly pageIndex: Signal<number>;

  /**
   * Property members
   *
   * @description
   * The read of the members, the page's primary read.
   *
   * @type {ResourceRef<MemberPage | undefined>}
   * @readonly
   */
  readonly members: ResourceRef<MemberPage | undefined>;

  /**
   * Property shown
   *
   * @description
   * Whether a read resolved once.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly shown: Signal<boolean>;

  /**
   * Property loading
   *
   * @description
   * Whether a read is under way.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly loading: Signal<boolean>;

  /**
   * Property failed
   *
   * @description
   * Whether the last read failed.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly failed: Signal<boolean>;

  /**
   * Property rows
   *
   * @description
   * Members of the page shown, with their pending role and live presence.
   *
   * @type {Signal<readonly MemberRow[]>}
   * @readonly
   */
  readonly rows: Signal<readonly MemberRow[]>;

  /**
   * Property total
   *
   * @description
   * Members matching every filter, on every page.
   *
   * @type {Signal<number>}
   * @readonly
   */
  readonly total: Signal<number>;

  /**
   * Property rangeFirst
   *
   * @description
   * One-based position of the first row shown; 0 without rows.
   *
   * @type {Signal<number>}
   * @readonly
   */
  readonly rangeFirst: Signal<number>;

  /**
   * Property rangeLast
   *
   * @description
   * One-based position of the last row shown; 0 without rows.
   *
   * @type {Signal<number>}
   * @readonly
   */
  readonly rangeLast: Signal<number>;

  /**
   * Property hasPrevious
   *
   * @description
   * Whether `Previous` has a page to open.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly hasPrevious: Signal<boolean>;

  /**
   * Property hasNext
   *
   * @description
   * Whether `Next` has a page to open.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly hasNext: Signal<boolean>;

  /**
   * Property counts
   *
   * @description
   * Members by role, whatever the filters, the writes being sent included; null before a read.
   *
   * @type {Signal<MemberRoleCounts | null>}
   * @readonly
   */
  readonly counts: Signal<MemberRoleCounts | null>;

  /**
   * Property onlineCount
   *
   * @description
   * Members online, away or not to be disturbed, from the realtime presence.
   *
   * @type {Signal<number>}
   * @readonly
   */
  readonly onlineCount: Signal<number>;

  /**
   * Property filtered
   *
   * @description
   * Whether a search or a tab other than `All` narrows the list.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly filtered: Signal<boolean>;

  /**
   * Property editable
   *
   * @description
   * Whether the person may change roles and remove members (owner or administrator).
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly editable: Signal<boolean>;
  // #endregion

  // #region Methods
  /**
   * Method setSearch
   *
   * @description
   * Shows the text at once and searches for it once the typing pauses, from the first page.
   *
   * @param {string} text - Text of the search field.
   */
  setSearch(text: string): void;

  /**
   * Method setRole
   *
   * @description
   * Picks a role tab and goes back to the first page.
   *
   * @param {MemberRoleFilter} role - The tab.
   */
  setRole(role: MemberRoleFilter): void;

  /**
   * Method setPresence
   *
   * @description
   * Picks a presence tab and goes back to the first page.
   *
   * @param {MemberPresenceFilter} presence - The tab.
   */
  setPresence(presence: MemberPresenceFilter): void;

  /**
   * Method clearFilters
   *
   * @description
   * Empties the search, picks `All` in both tabs and goes back to the first page.
   */
  clearFilters(): void;

  /**
   * Method next
   *
   * @description
   * Opens the next page, when there is one.
   */
  next(): void;

  /**
   * Method previous
   *
   * @description
   * Opens the previous page, when there is one.
   */
  previous(): void;

  /**
   * Method retry
   *
   * @description
   * Reads the current page again after a failure.
   */
  retry(): void;

  /**
   * Method changeRole
   *
   * @description
   * Shows the new role at once and sends it. Success shows `Role changed`; a refusal restores
   * the confirmed role and shows the failure toast. Ignored for the owner, the person's own row,
   * a member whose write is pending, the same role, or a person who may not write.
   *
   * @param {MemberRow} member - The member.
   * @param {AssignableMemberRole} role - The new role.
   * @returns {Promise<boolean>} Whether the change was confirmed.
   */
  changeRole(member: MemberRow, role: AssignableMemberRole): Promise<boolean>;

  /**
   * Method remove
   *
   * @description
   * Hides the member at once and removes them. Success shows `<name> removed`; a refusal shows
   * the member again with the failure toast. The server has no undo, so the toast has none.
   *
   * @param {MemberRow} member - The member.
   * @returns {Promise<boolean>} Whether the removal was confirmed.
   */
  remove(member: MemberRow): Promise<boolean>;
  // #endregion
}

/**
 * Function sameRead
 *
 * @description
 * Compares two reads, so that a page change under a presence filter reads nothing.
 *
 * @param {MembersRead} a - A read.
 * @param {MembersRead} b - Another read.
 * @returns {boolean} Whether they ask the same thing.
 */
function sameRead(a: MembersRead, b: MembersRead): boolean {
  return (
    a.organizationId === b.organizationId &&
    a.complete === b.complete &&
    a.cursor === b.cursor &&
    a.query.search === b.query.search &&
    a.query.roles.join() === b.query.roles.join()
  );
}

/**
 * Function online
 *
 * @description
 * Whether a presence counts as online (`Online` tab): online, away or do not disturb.
 *
 * @param {MemberPresence} presence - The presence.
 * @returns {boolean} Whether it is online.
 */
function online(presence: MemberPresence): boolean {
  return presence !== 'offline';
}

/**
 * Function shift
 *
 * @description
 * Adds a number of members to a role's count, never below zero.
 *
 * @param {MemberRoleCounts} counts - Counts by role.
 * @param {MemberRole} role - The role.
 * @param {number} delta - Members added (negative to remove).
 * @returns {MemberRoleCounts} The new counts.
 */
function shift(counts: MemberRoleCounts, role: MemberRole, delta: number): MemberRoleCounts {
  return { ...counts, [role]: Math.max(0, counts[role] + delta) };
}

/**
 * Function createMembersStore
 *
 * @description
 * Creates the members store.
 *
 * @returns {Type<MembersStoreInstance>} Injectable store constructor.
 */
function createMembersStore(): Type<MembersStoreInstance> {
  const initialState: MembersState = {
    search: '',
    role: 'all',
    presence: 'all',
    pageIndex: 0,
    _query: '',
    _cursors: [null],
    _roles: {},
    _removing: [],
    _shown: false,
  };
  return signalStore(
    withState(initialState),
    withProps((store) => {
      const api: MembersApi = inject(MembersApi);
      const workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);
      const read: Signal<MembersRead> = computed(
        (): MembersRead => {
          const complete: boolean = store.presence() !== 'all';
          return {
            organizationId: workspace.organization().id,
            query: { search: store._query().trim(), roles: ROLES_OF[store.role()] },
            complete,
            cursor: complete ? null : (store._cursors()[store.pageIndex()] ?? null),
          };
        },
        { equal: sameRead },
      );
      return {
        _api: api,
        _workspace: workspace,
        _toasts: inject(CwToastService),
        _realtime: inject(RealtimeConnection, { optional: true }),
        members: resource({
          params: (): MembersRead => read(),
          loader: ({
            params,
            abortSignal,
          }: {
            params: MembersRead;
            abortSignal: AbortSignal;
          }): Promise<MemberPage> =>
            params.complete
              ? api.all(params.query, abortSignal)
              : api.page(params.query, MEMBERS_PAGE_SIZE, params.cursor, abortSignal),
        }),
      };
    }),
    withComputed((store) => {
      const value: Signal<MemberPage | null> = computed((): MemberPage | null =>
        store.members.hasValue() ? store.members.value() : null,
      );
      const presenceOf: (memberId: string) => MemberPresence = (memberId: string): MemberPresence =>
        store._realtime?.presences().get(memberId) ?? 'offline';
      const matching: Signal<readonly MemberRow[]> = computed((): readonly MemberRow[] => {
        const page: MemberPage | null = value();
        if (page === null) return [];
        const roles: Readonly<Record<string, AssignableMemberRole>> = store._roles();
        const removing: ReadonlySet<string> = new Set<string>(store._removing());
        const userId: string = store._workspace.user().id;
        const rows: MemberRow[] = page.items
          .filter((member: OrganizationMember): boolean => !removing.has(member.id))
          .map((member: OrganizationMember): MemberRow => ({
            ...member,
            role: member.id in roles ? roles[member.id] : member.role,
            presence: presenceOf(member.id),
            me: member.userId === userId,
            pending: member.id in roles,
          }));
        const filter: MemberPresenceFilter = store.presence();
        if (filter === 'all') return rows;
        return rows.filter(
          (row: MemberRow): boolean => online(row.presence) === (filter === 'online'),
        );
      });
      const complete: Signal<boolean> = computed((): boolean => store.presence() !== 'all');
      const rows: Signal<readonly MemberRow[]> = computed((): readonly MemberRow[] => {
        if (!complete()) return matching();
        const start: number = store.pageIndex() * MEMBERS_PAGE_SIZE;
        return matching().slice(start, start + MEMBERS_PAGE_SIZE);
      });
      const total: Signal<number> = computed((): number => {
        const page: MemberPage | null = value();
        if (page === null) return 0;
        if (complete()) return matching().length;
        const removing: ReadonlySet<string> = new Set<string>(store._removing());
        const hidden: number = page.items.filter((member: OrganizationMember): boolean =>
          removing.has(member.id),
        ).length;
        return Math.max(0, page.total - hidden);
      });
      return {
        shown: computed((): boolean => store._shown()),
        loading: computed((): boolean => store.members.isLoading()),
        failed: computed((): boolean => store.members.status() === 'error'),
        rows,
        total,
        rangeFirst: computed((): number =>
          rows().length === 0 ? 0 : store.pageIndex() * MEMBERS_PAGE_SIZE + 1,
        ),
        rangeLast: computed((): number =>
          rows().length === 0 ? 0 : store.pageIndex() * MEMBERS_PAGE_SIZE + rows().length,
        ),
        hasPrevious: computed((): boolean => store.pageIndex() > 0),
        hasNext: computed((): boolean =>
          complete()
            ? (store.pageIndex() + 1) * MEMBERS_PAGE_SIZE < matching().length
            : value()?.nextCursor != null,
        ),
        counts: computed((): MemberRoleCounts | null => {
          const page: MemberPage | null = value();
          if (page === null) return null;
          const roles: Readonly<Record<string, AssignableMemberRole>> = store._roles();
          const removing: ReadonlySet<string> = new Set<string>(store._removing());
          let counts: MemberRoleCounts = page.counts;
          for (const member of page.items) {
            if (removing.has(member.id)) counts = shift(counts, member.role, -1);
            if (member.id in roles && !removing.has(member.id)) {
              counts = shift(shift(counts, member.role, -1), roles[member.id], 1);
            }
          }
          return counts;
        }),
        onlineCount: computed(
          (): number =>
            [...(store._realtime?.presences().values() ?? [])].filter(
              (presence: MemberPresence): boolean => online(presence),
            ).length,
        ),
        filtered: computed(
          (): boolean =>
            store.search().trim() !== '' || store.role() !== 'all' || store.presence() !== 'all',
        ),
        editable: computed((): boolean => store._workspace.can('admin')),
      };
    }),
    withMethods((store) => {
      const firstPage: Pick<MembersState, 'pageIndex' | '_cursors'> = {
        pageIndex: 0,
        _cursors: [null],
      };
      const settled: () => boolean = (): boolean =>
        store.members.hasValue() && !store.members.isLoading();
      const writable: (member: MemberRow) => boolean = (member: MemberRow): boolean =>
        store.editable() &&
        member.role !== 'owner' &&
        !member.me &&
        !(member.id in store._roles()) &&
        !store._removing().includes(member.id);
      const withoutRole: (memberId: string) => Readonly<Record<string, AssignableMemberRole>> = (
        memberId: string,
      ): Readonly<Record<string, AssignableMemberRole>> =>
        Object.fromEntries(
          Object.entries(store._roles()).filter(
            ([id]: [string, AssignableMemberRole]) => id !== memberId,
          ),
        );
      const sendSearch: (text: string) => void = rxMethod<string>(
        pipe(
          debounceTime(SEARCH_DEBOUNCE_MS),
          tap((text: string): void => {
            if (text !== store._query()) patchState(store, { _query: text, ...firstPage });
          }),
        ),
      );
      return {
        _onStatus: signalMethod<ResourceStatus>((status: ResourceStatus): void => {
          if (status === 'resolved' && !store._shown()) patchState(store, { _shown: true });
        }),

        setSearch(text: string): void {
          patchState(store, { search: text });
          sendSearch(text);
        },

        setRole(role: MemberRoleFilter): void {
          if (role !== store.role()) patchState(store, { role, ...firstPage });
        },

        setPresence(presence: MemberPresenceFilter): void {
          if (presence !== store.presence()) patchState(store, { presence, ...firstPage });
        },

        clearFilters(): void {
          patchState(store, { search: '', _query: '', role: 'all', presence: 'all', ...firstPage });
        },

        next(): void {
          if (!store.hasNext()) return;
          const index: number = store.pageIndex();
          if (store.presence() !== 'all') {
            patchState(store, { pageIndex: index + 1 });
            return;
          }
          const cursor: string | null = store.members.hasValue()
            ? store.members.value().nextCursor
            : null;
          if (cursor === null) return;
          patchState(store, {
            pageIndex: index + 1,
            _cursors: [...store._cursors().slice(0, index + 1), cursor],
          });
        },

        previous(): void {
          if (store.pageIndex() > 0) patchState(store, { pageIndex: store.pageIndex() - 1 });
        },

        retry(): void {
          store.members.reload();
        },

        async changeRole(member: MemberRow, role: AssignableMemberRole): Promise<boolean> {
          if (!writable(member) || member.role === role) return false;
          patchState(store, { _roles: { ...store._roles(), [member.id]: role } });
          try {
            const updated: OrganizationMember = await store._api.changeRole(member.id, role);
            if (settled()) {
              store.members.update(
                (page: MemberPage | undefined): MemberPage | undefined =>
                  page && {
                    ...page,
                    counts: shift(shift(page.counts, member.role, -1), updated.role, 1),
                    items: page.items.map((item: OrganizationMember): OrganizationMember =>
                      item.id === updated.id ? updated : item,
                    ),
                  },
              );
            }
            store._toasts.success($localize`:@@organization.members.role-changed:Role changed`, {
              description: $localize`:@@organization.members.role-changed-text:${member.name}:name: is now ${memberRoleLabel(updated.role)}:role:.`,
            });
            return true;
          } catch (error: unknown) {
            store._toasts.error(
              $localize`:@@organization.members.role-failed:The role could not be changed`,
              hasProblemCode(error, 'organization.seat-quota-exceeded')
                ? {
                    description: $localize`:@@organization.members.role-failed-seats:No seat is free: add some from Billing.`,
                  }
                : {},
            );
            return false;
          } finally {
            patchState(store, { _roles: withoutRole(member.id) });
          }
        },

        async remove(member: MemberRow): Promise<boolean> {
          if (!writable(member)) return false;
          patchState(store, { _removing: [...store._removing(), member.id] });
          try {
            await store._api.remove(member.id);
            if (settled()) {
              store.members.update(
                (page: MemberPage | undefined): MemberPage | undefined =>
                  page && {
                    ...page,
                    total: Math.max(0, page.total - 1),
                    counts: shift(page.counts, member.role, -1),
                    items: page.items.filter(
                      (item: OrganizationMember): boolean => item.id !== member.id,
                    ),
                  },
              );
            }
            store._toasts.success(
              $localize`:@@organization.members.removed:${member.name}:name: removed`,
              {
                description: $localize`:@@organization.members.removed-text:Their tasks stay assigned; a seat is freed.`,
              },
            );
            return true;
          } catch {
            store._toasts.error(
              $localize`:@@organization.members.remove-failed:The member could not be removed`,
            );
            return false;
          } finally {
            patchState(store, {
              _removing: store._removing().filter((id: string): boolean => id !== member.id),
            });
            if (store.rows().length === 0 && store.pageIndex() > 0) {
              patchState(store, { pageIndex: store.pageIndex() - 1 });
            }
          }
        },
      };
    }),
    withHooks({
      onInit(store): void {
        store._onStatus(store.members.status);
      },
    }),
  );
}

/**
 * Constant MembersStore
 *
 * @description
 * The members section's state, provided by `MembersPage`. Search and role filters are sent to
 * `listMembers` and paged by cursor, 8 per page, keeping the cursor of each page reached for
 * `Previous`. The presence filter, which the API does not offer, reads every matching member and
 * pages them in the browser against the live presence. Role changes and removals are optimistic:
 * the row changes at once, a refusal restores it and shows the failure toast, and a confirmation
 * writes the answer into the read.
 *
 * @type {Type<MembersStoreInstance>}
 */
export const MembersStore: Type<MembersStoreInstance> = createMembersStore();
