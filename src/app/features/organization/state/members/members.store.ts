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
 * Constant PRESENCE_READ_LIMIT
 *
 * @description
 * Most members read for a presence filter, which the API does not offer.
 *
 * @type {number}
 */
export const PRESENCE_READ_LIMIT: number = 2000;

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
 * What the members resource reads: one page by cursor, or, with a presence filter, every member of
 * the role tab (the search is then applied in the browser).
 */
interface MembersRead {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * Organization read.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property query
   *
   * @description
   * Search (empty for a complete read) and roles.
   *
   * @type {MemberQuery}
   * @readonly
   */
  readonly query: MemberQuery;

  /**
   * Property complete
   *
   * @description
   * Whether every member of the role tab is read (presence filter on).
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

  /**
   * Property version
   *
   * @description
   * Read counter: raising it reads the same view again, even while a read is under way.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;
  // #endregion
}

/**
 * Interface MembersSnapshot
 *
 * @description
 * An answer of the members resource, with the read it answers and its issue order.
 */
interface MembersSnapshot {
  // #region Properties
  /**
   * Property read
   *
   * @description
   * The read answered.
   *
   * @type {MembersRead}
   * @readonly
   */
  readonly read: MembersRead;

  /**
   * Property seq
   *
   * @description
   * Issue order of the read: a later read has a greater number.
   *
   * @type {number}
   * @readonly
   */
  readonly seq: number;

  /**
   * Property page
   *
   * @description
   * The members read.
   *
   * @type {MemberPage}
   * @readonly
   */
  readonly page: MemberPage;
  // #endregion
}

/**
 * Interface ConfirmedWrite
 *
 * @description
 * A role change or a removal the API confirmed, applied to the reads issued before it settled.
 */
interface ConfirmedWrite {
  // #region Properties
  /**
   * Property memberId
   *
   * @description
   * The membership.
   *
   * @type {string}
   * @readonly
   */
  readonly memberId: string;

  /**
   * Property member
   *
   * @description
   * The membership as the API answered it; null for a removal.
   *
   * @type {OrganizationMember | null}
   * @readonly
   */
  readonly member: OrganizationMember | null;

  /**
   * Property at
   *
   * @description
   * Issue order of the last read issued when the write settled: a read with a greater number
   * already holds it.
   *
   * @type {number}
   * @readonly
   */
  readonly at: number;
  // #endregion
}

/**
 * Interface Applied
 *
 * @description
 * A snapshot with the confirmed and pending writes applied.
 */
interface Applied {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * Members shown.
   *
   * @type {readonly OrganizationMember[]}
   * @readonly
   */
  readonly items: readonly OrganizationMember[];

  /**
   * Property total
   *
   * @description
   * Members matching the read, on every page.
   *
   * @type {number}
   * @readonly
   */
  readonly total: number;

  /**
   * Property counts
   *
   * @description
   * Members by role.
   *
   * @type {MemberRoleCounts}
   * @readonly
   */
  readonly counts: MemberRoleCounts;

  /**
   * Property pending
   *
   * @description
   * Members whose write is being sent.
   *
   * @type {ReadonlySet<string>}
   * @readonly
   */
  readonly pending: ReadonlySet<string>;
  // #endregion
}

/**
 * Interface RangeView
 *
 * @description
 * The figures of the pagination line.
 */
interface RangeView {
  // #region Properties
  /**
   * Property first
   *
   * @description
   * One-based position of the first row shown; 0 without rows.
   *
   * @type {number}
   * @readonly
   */
  readonly first: number;

  /**
   * Property last
   *
   * @description
   * One-based position of the last row shown; 0 without rows.
   *
   * @type {number}
   * @readonly
   */
  readonly last: number;

  /**
   * Property total
   *
   * @description
   * Members matching every filter.
   *
   * @type {number}
   * @readonly
   */
  readonly total: number;
  // #endregion
}

/**
 * Interface MembersState
 *
 * @description
 * The filters, the page, the read counter and the writes being sent or awaiting a newer read.
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
   * Property _version
   *
   * @description
   * Read counter of `MembersRead.version`.
   *
   * @type {number}
   */
  _version: number;

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
   * Property _confirmed
   *
   * @description
   * Confirmed writes kept until a read issued after them lands.
   *
   * @type {readonly ConfirmedWrite[]}
   */
  _confirmed: readonly ConfirmedWrite[];

  /**
   * Property _stepBack
   *
   * @description
   * Whether a confirmed removal may leave the page empty: the first settled read without rows then
   * opens the previous page.
   *
   * @type {boolean}
   */
  _stepBack: boolean;

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

  /**
   * Property _last
   *
   * @description
   * The last answer of the current organization, kept while the next read is under way.
   *
   * @type {MembersSnapshot | null}
   */
  _last: MembersSnapshot | null;

  /**
   * Property _lastRange
   *
   * @description
   * The last figures of the pagination line, kept while the next read is under way.
   *
   * @type {RangeView}
   */
  _lastRange: RangeView;
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
   * @type {ResourceRef<MembersSnapshot | undefined>}
   * @readonly
   */
  readonly members: ResourceRef<MembersSnapshot | undefined>;

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
   * Property truncated
   *
   * @description
   * Whether a presence filter read stopped at `PRESENCE_READ_LIMIT` members.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly truncated: Signal<boolean>;

  /**
   * Property rows
   *
   * @description
   * Members of the page shown, with the writes applied and the live presence; while the same
   * view is read again, those of the previous answer.
   *
   * @type {Signal<readonly MemberRow[]>}
   * @readonly
   */
  readonly rows: Signal<readonly MemberRow[]>;

  /**
   * Property total
   *
   * @description
   * Members matching every filter, on every page; the last known one while a read is under way.
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
   * Members by role, whatever the filters, the writes included; the last known ones while a read
   * is under way, null before the first.
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
   * Shows the text at once and searches for it once the typing pauses, from the first page. With
   * a presence filter the search runs in the browser over the members read, without a new read.
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
   * Empties the search, picks `All` in both tabs and goes back to the first page; a search still
   * waiting for the pause is dropped.
   */
  clearFilters(): void;

  /**
   * Method next
   *
   * @description
   * Opens the next page, when the page shown has one.
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
   * Reads the current view again.
   */
  retry(): void;

  /**
   * Method changeRole
   *
   * @description
   * Shows the new role at once and sends it with the member's version. Success shows `Role
   * changed`; a refusal restores the confirmed role and shows the failure toast, and a version
   * mismatch reads the view again with a warning. Ignored for the owner, the person's own row, a
   * member whose write is pending, the same role, or a person who may not write. A change that
   * settles after an organization switch changes nothing and shows nothing.
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
 * Function viewKey
 *
 * @description
 * Identifies the view a read shows, whatever its counter.
 *
 * @param {MembersRead} read - The read.
 * @returns {string} The view's key.
 */
function viewKey(read: MembersRead): string {
  return JSON.stringify([
    read.organizationId,
    read.complete,
    read.cursor,
    read.query.search,
    read.query.roles,
  ]);
}

/**
 * Function sameRead
 *
 * @description
 * Compares two reads, so that a page change or a search under a presence filter reads nothing.
 *
 * @param {MembersRead} a - A read.
 * @param {MembersRead} b - Another read.
 * @returns {boolean} Whether they ask the same thing.
 */
function sameRead(a: MembersRead, b: MembersRead): boolean {
  return a.version === b.version && viewKey(a) === viewKey(b);
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
 * Function fold
 *
 * @description
 * Lowers a text and strips its accents, as the API's search compares names and addresses.
 *
 * @param {string} text - The text.
 * @returns {string} The folded text.
 */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/gu, '').toLowerCase();
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
  const filters: Pick<
    MembersState,
    'search' | 'role' | 'presence' | 'pageIndex' | '_query' | '_cursors'
  > = { search: '', role: 'all', presence: 'all', pageIndex: 0, _query: '', _cursors: [null] };
  const initialState: MembersState = {
    ...filters,
    _version: 0,
    _roles: {},
    _removing: [],
    _confirmed: [],
    _stepBack: false,
    _shown: false,
    _last: null,
    _lastRange: { first: 0, last: 0, total: 0 },
  };
  return signalStore(
    withState(initialState),
    withProps((store) => {
      const api: MembersApi = inject(MembersApi);
      const workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);
      const issued: { count: number } = { count: 0 };
      const read: Signal<MembersRead> = computed(
        (): MembersRead => {
          const complete: boolean = store.presence() !== 'all';
          return {
            organizationId: workspace.organization().id,
            query: {
              search: complete ? '' : store._query().trim(),
              roles: ROLES_OF[store.role()],
            },
            complete,
            cursor: complete ? null : (store._cursors()[store.pageIndex()] ?? null),
            version: store._version(),
          };
        },
        { equal: sameRead },
      );
      return {
        _api: api,
        _workspace: workspace,
        _toasts: inject(CwToastService),
        _realtime: inject(RealtimeConnection, { optional: true }),
        _issued: issued,
        _read: read,
        members: resource({
          params: (): MembersRead => read(),
          loader: async ({
            params,
            abortSignal,
          }: {
            params: MembersRead;
            abortSignal: AbortSignal;
          }): Promise<MembersSnapshot> => {
            issued.count += 1;
            const seq: number = issued.count;
            const page: MemberPage = params.complete
              ? await api.all(params.query, PRESENCE_READ_LIMIT, abortSignal)
              : await api.page(params.query, MEMBERS_PAGE_SIZE, params.cursor, abortSignal);
            return { read: params, seq, page };
          },
        }),
      };
    }),
    withComputed((store) => {
      const organizationId: () => string = () => store._workspace.organization().id;
      const current: Signal<MembersSnapshot | null> = computed((): MembersSnapshot | null => {
        if (!store.members.hasValue()) return null;
        const snapshot: MembersSnapshot = store.members.value();
        return snapshot.read.organizationId === organizationId() ? snapshot : null;
      });
      const known: Signal<MembersSnapshot | null> = computed((): MembersSnapshot | null => {
        const snapshot: MembersSnapshot | null = store._last();
        return snapshot?.read.organizationId === organizationId() ? snapshot : null;
      });
      const shownSnapshot: Signal<MembersSnapshot | null> = computed((): MembersSnapshot | null => {
        const fallback: MembersSnapshot | null = known();
        const snapshot: MembersSnapshot | null = current() ?? fallback;
        return snapshot !== null && viewKey(snapshot.read) === viewKey(store._read())
          ? snapshot
          : null;
      });
      const apply: (snapshot: MembersSnapshot) => Applied = (
        snapshot: MembersSnapshot,
      ): Applied => {
        const roles: Readonly<Record<string, AssignableMemberRole>> = store._roles();
        const removing: ReadonlySet<string> = new Set<string>(store._removing());
        const confirmed: ReadonlyMap<string, ConfirmedWrite> = new Map<string, ConfirmedWrite>(
          store
            ._confirmed()
            .filter((write: ConfirmedWrite): boolean => snapshot.seq <= write.at)
            .map((write: ConfirmedWrite): [string, ConfirmedWrite] => [write.memberId, write]),
        );
        let counts: MemberRoleCounts = snapshot.page.counts;
        let hidden: number = 0;
        const items: OrganizationMember[] = [];
        for (const item of snapshot.page.items) {
          const write: ConfirmedWrite | undefined = confirmed.get(item.id);
          const member: OrganizationMember | null =
            write === undefined ? item : write.member && { ...item, ...write.member };
          if (member === null || removing.has(item.id)) {
            counts = shift(counts, item.role, -1);
            hidden += 1;
            continue;
          }
          const role: MemberRole = item.id in roles ? roles[item.id] : member.role;
          if (role !== item.role) counts = shift(shift(counts, item.role, -1), role, 1);
          items.push(role === member.role ? member : { ...member, role });
        }
        return {
          items,
          total: Math.max(0, snapshot.page.total - hidden),
          counts,
          pending: new Set<string>([...Object.keys(roles), ...store._removing()]),
        };
      };
      const matching: Signal<readonly MemberRow[]> = computed((): readonly MemberRow[] => {
        const snapshot: MembersSnapshot | null = shownSnapshot();
        if (snapshot === null) return [];
        const applied: Applied = apply(snapshot);
        const userId: string = store._workspace.user().id;
        const presences: ReadonlyMap<string, MemberPresence> =
          store._realtime?.presences() ?? new Map<string, MemberPresence>();
        let rows: MemberRow[] = applied.items.map((member: OrganizationMember): MemberRow => ({
          ...member,
          presence: presences.get(member.id) ?? 'offline',
          me: member.userId === userId,
          pending: applied.pending.has(member.id),
        }));
        if (!snapshot.read.complete) return rows;
        const search: string = fold(store.search().trim());
        if (search !== '') {
          rows = rows.filter((row: MemberRow): boolean =>
            fold(`${row.name} ${row.email}`).includes(search),
          );
        }
        const wanted: boolean = store.presence() === 'online';
        return rows.filter((row: MemberRow): boolean => online(row.presence) === wanted);
      });
      const complete: Signal<boolean> = computed((): boolean => store._read().complete);
      const rows: Signal<readonly MemberRow[]> = computed((): readonly MemberRow[] => {
        if (!complete()) return matching();
        const start: number = store.pageIndex() * MEMBERS_PAGE_SIZE;
        return matching().slice(start, start + MEMBERS_PAGE_SIZE);
      });
      const freshRange: Signal<RangeView | null> = computed((): RangeView | null => {
        const snapshot: MembersSnapshot | null = shownSnapshot();
        if (snapshot === null) return null;
        const total: number = complete() ? matching().length : apply(snapshot).total;
        const count: number = rows().length;
        const first: number = count === 0 ? 0 : store.pageIndex() * MEMBERS_PAGE_SIZE + 1;
        return { first, last: count === 0 ? 0 : first + count - 1, total };
      });
      const range: Signal<RangeView> = computed(
        (): RangeView => freshRange() ?? store._lastRange(),
      );
      return {
        _current: current,
        _freshRange: freshRange,
        shown: computed((): boolean => store._shown()),
        loading: computed((): boolean => store.members.isLoading()),
        failed: computed((): boolean => store.members.status() === 'error'),
        truncated: computed((): boolean => current()?.page.truncated ?? false),
        rows,
        total: computed((): number => range().total),
        rangeFirst: computed((): number => range().first),
        rangeLast: computed((): number => range().last),
        hasPrevious: computed((): boolean => store.pageIndex() > 0),
        hasNext: computed((): boolean => {
          const snapshot: MembersSnapshot | null = current();
          if (snapshot === null || store.members.isLoading()) return false;
          return snapshot.read.complete
            ? (store.pageIndex() + 1) * MEMBERS_PAGE_SIZE < matching().length
            : snapshot.page.nextCursor !== null;
        }),
        counts: computed((): MemberRoleCounts | null => {
          const fallback: MembersSnapshot | null = known();
          const snapshot: MembersSnapshot | null = current() ?? fallback;
          return snapshot === null ? null : apply(snapshot).counts;
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
      let followed: string | null = null;
      const bump: () => void = (): void => {
        patchState(store, { _version: store._version() + 1 });
      };
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
            ([id]: [string, AssignableMemberRole]): boolean => id !== memberId,
          ),
        );
      const confirm: (write: Omit<ConfirmedWrite, 'at'>) => void = (
        write: Omit<ConfirmedWrite, 'at'>,
      ): void => {
        patchState(store, {
          _confirmed: [
            ...store
              ._confirmed()
              .filter((item: ConfirmedWrite): boolean => item.memberId !== write.memberId),
            { ...write, at: store._issued.count },
          ],
        });
      };
      // Once a read settles: drops the writes it already holds, reads again when a confirmed
      // write cannot be shown on the answer (member absent, moved out of the role tab, a removal
      // on a cursor page), and opens the previous page when a removal emptied this one.
      const reconcile: () => void = (): void => {
        const snapshot: MembersSnapshot | null = store._current();
        if (snapshot === null || store.members.isLoading()) return;
        const stale: readonly ConfirmedWrite[] = store
          ._confirmed()
          .filter((write: ConfirmedWrite): boolean => snapshot.seq <= write.at);
        if (stale.length !== store._confirmed().length) patchState(store, { _confirmed: stale });
        const roles: readonly MemberRole[] = snapshot.read.query.roles;
        const unshowable: boolean = stale.some((write: ConfirmedWrite): boolean => {
          const present: boolean = snapshot.page.items.some(
            (item: OrganizationMember): boolean => item.id === write.memberId,
          );
          if (!present) return true;
          if (write.member === null) return !snapshot.read.complete;
          return roles.length > 0 && !roles.includes(write.member.role);
        });
        if (unshowable) {
          bump();
          return;
        }
        if (!store._stepBack()) return;
        if (store.rows().length === 0 && store.pageIndex() > 0) {
          patchState(store, { pageIndex: store.pageIndex() - 1, _stepBack: false });
        } else if (store.rows().length > 0) {
          patchState(store, { _stepBack: false });
        }
      };
      const sendSearch: (text: string) => void = rxMethod<string>(
        pipe(
          debounceTime(SEARCH_DEBOUNCE_MS),
          tap((text: string): void => {
            if (text !== store.search() || text === store._query()) return;
            patchState(store, { _query: text, ...(store._read().complete ? {} : firstPage) });
          }),
        ),
      );
      return {
        _onRead: signalMethod<unknown>((): void => {
          const snapshot: MembersSnapshot | null = store._current();
          if (snapshot !== null && snapshot !== store._last()) {
            patchState(store, { _last: snapshot, _shown: true });
          }
          reconcile();
        }),

        _keepRange: signalMethod<RangeView | null>((fresh: RangeView | null): void => {
          if (fresh !== null) patchState(store, { _lastRange: fresh });
        }),

        _followOrganization: signalMethod<string>((organizationId: string): void => {
          if (followed !== null && followed !== organizationId) {
            patchState(store, {
              ...filters,
              _version: store._version() + 1,
              _roles: {},
              _removing: [],
              _confirmed: [],
              _stepBack: false,
              _last: null,
              _lastRange: { first: 0, last: 0, total: 0 },
            });
          }
          followed = organizationId;
        }),

        setSearch(text: string): void {
          if (store._read().complete) {
            patchState(store, { search: text, pageIndex: 0 });
          } else {
            patchState(store, { search: text });
          }
          sendSearch(text);
        },

        setRole(role: MemberRoleFilter): void {
          if (role !== store.role()) patchState(store, { role, ...firstPage });
        },

        setPresence(presence: MemberPresenceFilter): void {
          if (presence === store.presence()) return;
          patchState(store, { presence, _query: store.search(), ...firstPage });
        },

        clearFilters(): void {
          patchState(store, { ...filters });
        },

        next(): void {
          if (!store.hasNext()) return;
          const index: number = store.pageIndex();
          const snapshot: MembersSnapshot | null = store._current();
          if (snapshot === null) return;
          if (snapshot.read.complete) {
            patchState(store, { pageIndex: index + 1 });
            return;
          }
          patchState(store, {
            pageIndex: index + 1,
            _cursors: [...store._cursors().slice(0, index + 1), snapshot.page.nextCursor],
          });
        },

        previous(): void {
          if (store.pageIndex() > 0) patchState(store, { pageIndex: store.pageIndex() - 1 });
        },

        retry(): void {
          bump();
        },

        async changeRole(member: MemberRow, role: AssignableMemberRole): Promise<boolean> {
          if (!writable(member) || member.role === role) return false;
          const organization: string = store._workspace.organization().id;
          const moved: () => boolean = () => store._workspace.organization().id !== organization;
          patchState(store, { _roles: { ...store._roles(), [member.id]: role } });
          try {
            const updated: OrganizationMember = await store._api.changeRole(
              member.id,
              role,
              member.version,
            );
            if (moved()) return false;
            patchState(store, { _roles: withoutRole(member.id) });
            confirm({ memberId: member.id, member: updated });
            reconcile();
            store._toasts.success($localize`:@@organization.members.role-changed:Role changed`, {
              description: $localize`:@@organization.members.role-changed-text:${member.name}:name: is now ${memberRoleLabel(updated.role)}:role:.`,
            });
            return true;
          } catch (error: unknown) {
            if (moved()) return false;
            patchState(store, { _roles: withoutRole(member.id) });
            if (hasProblemCode(error, 'request.version-mismatch')) {
              bump();
              store._toasts.warning(
                $localize`:@@organization.members.role-stale:This member changed meanwhile`,
                {
                  description: $localize`:@@organization.members.role-stale-text:The list was read again: check the role and try again.`,
                },
              );
              return false;
            }
            store._toasts.error(
              $localize`:@@organization.members.role-failed:The role could not be changed`,
              hasProblemCode(error, 'organization.seat-quota-exceeded')
                ? {
                    description: $localize`:@@organization.members.role-failed-seats:No seat is free: add some from Billing.`,
                  }
                : {},
            );
            return false;
          }
        },

        async remove(member: MemberRow): Promise<boolean> {
          if (!writable(member)) return false;
          const organization: string = store._workspace.organization().id;
          const moved: () => boolean = () => store._workspace.organization().id !== organization;
          patchState(store, { _removing: [...store._removing(), member.id] });
          const drop: () => void = (): void => {
            patchState(store, {
              _removing: store._removing().filter((id: string): boolean => id !== member.id),
            });
          };
          try {
            await store._api.remove(member.id);
            if (moved()) return false;
            if (!store._read().complete) {
              patchState(store, { _cursors: store._cursors().slice(0, store.pageIndex() + 1) });
            }
            confirm({ memberId: member.id, member: null });
            drop();
            patchState(store, { _stepBack: true });
            reconcile();
            store._toasts.success(
              $localize`:@@organization.members.removed:${member.name}:name: removed`,
              {
                description: $localize`:@@organization.members.removed-text:Their tasks stay assigned; a seat is freed.`,
              },
            );
            return true;
          } catch {
            if (moved()) return false;
            drop();
            store._toasts.error(
              $localize`:@@organization.members.remove-failed:The member could not be removed`,
            );
            return false;
          }
        },
      };
    }),
    withHooks({
      onInit(store): void {
        store._onRead(computed((): unknown => [store._current(), store.members.isLoading()]));
        store._keepRange(store._freshRange);
        store._followOrganization(computed((): string => store._workspace.organization().id));
      },
    }),
  );
}

/**
 * Constant MembersStore
 *
 * @description
 * The members section's state, provided by `MembersPage` and tied to the workspace
 * organization: a switch resets the filters, the pages and the writes, and a write that settles
 * after it changes nothing. Search and role filters are sent to `listMembers` and paged by
 * cursor, 8 per page, keeping the cursor of each page reached for `Previous`. A presence filter,
 * which the API does not offer, reads every member of the role tab once (at most
 * `PRESENCE_READ_LIMIT`), then searches and pages them in the browser against the live presence.
 * Role changes and removals are optimistic; a confirmed write is applied to every read issued
 * before it settled, until a read issued after it lands, and the view is read again when the
 * answer shown cannot hold it. While a read is under way the counts and the range keep their last
 * values.
 *
 * @type {Type<MembersStoreInstance>}
 */
export const MembersStore: Type<MembersStoreInstance> = createMembersStore();
