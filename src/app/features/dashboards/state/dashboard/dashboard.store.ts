import { DOCUMENT } from '@angular/common';
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
import { auditTime, EMPTY, filter, fromEvent, merge, type Observable } from 'rxjs';

import { RealtimeConnection } from '@core/realtime';
import { type Person, TaskDetailOpener, type TaskSummary } from '@features/task';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { DashboardApi } from '../../data-access/services/dashboard-api/dashboard-api.service';
import type {
  DashboardAssigneeLoad,
  DashboardWeeks,
  TeamDashboard,
} from '../../models/team-dashboard/team-dashboard.interface';
import type { WorkloadRow, WorkloadZone } from '../../models/workload-row/workload-row.interface';
import { callerTimeZone, todayIso } from '../../utils/calendar-week/calendar-week.util';

/**
 * Constant REFRESH_AUDIT_MS
 *
 * @description
 * Window, in milliseconds, opened by the first refresh trigger of a burst (a focus that also
 * makes the tab visible, a closed detail that also changed a task): one read at its end.
 *
 * @type {number}
 */
export const REFRESH_AUDIT_MS: number = 300;

/**
 * Constant NO_TASKS
 *
 * @description
 * The late tasks before the first answer, one stable reference for the row actions' `sync`.
 *
 * @type {readonly TaskSummary[]}
 */
const NO_TASKS: readonly TaskSummary[] = [];

/**
 * Interface DashboardRead
 *
 * @description
 * Identity of a dashboard read: the organization and the period.
 */
interface DashboardRead {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * The workspace's organization.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property weeks
   *
   * @description
   * The period.
   *
   * @type {DashboardWeeks}
   * @readonly
   */
  readonly weeks: DashboardWeeks;

  /**
   * Property key
   *
   * @description
   * Both, joined: the read's identity.
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;
  // #endregion
}

/**
 * Interface DashboardSnapshot
 *
 * @description
 * An answer with the read it answers.
 */
interface DashboardSnapshot extends DashboardRead {
  // #region Properties
  /**
   * Property dashboard
   *
   * @description
   * The dashboard read.
   *
   * @type {TeamDashboard}
   * @readonly
   */
  readonly dashboard: TeamDashboard;
  // #endregion
}

/**
 * Interface MembersSnapshot
 *
 * @description
 * The members of one organization.
 */
interface MembersSnapshot {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * The organization they belong to.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property people
   *
   * @description
   * Its members.
   *
   * @type {readonly Person[]}
   * @readonly
   */
  readonly people: readonly Person[];
  // #endregion
}

/**
 * Interface DashboardLoads
 *
 * @description
 * Bookkeeping of the reads, outside the state since no view depends on it.
 */
interface DashboardLoads {
  // #region Properties
  /**
   * Property passive
   *
   * @description
   * Whether the next read refreshes the page in the background.
   *
   * @type {boolean}
   */
  passive: boolean;

  /**
   * Property queued
   *
   * @description
   * Whether a refresh was asked while a read ran: it is sent once that read settles, so a write
   * settled meanwhile is seen.
   *
   * @type {boolean}
   */
  queued: boolean;

  /**
   * Property named
   *
   * @description
   * The sets of unknown user ids, per organization, for which the members were read again: each
   * set is asked once, so a former member never makes the page read the members in a loop.
   *
   * @type {Set<string>}
   * @readonly
   */
  readonly named: Set<string>;
  // #endregion
}

/**
 * Interface DashboardState
 *
 * @description
 * The period shown and the last answer kept.
 */
interface DashboardState {
  // #region Properties
  /**
   * Property weeks
   *
   * @description
   * The period asked for (`?weeks=`), 8 by default.
   *
   * @type {DashboardWeeks}
   * @readonly
   */
  readonly weeks: DashboardWeeks;

  /**
   * Property _snapshot
   *
   * @description
   * The last answer of the read then current, kept while another period loads.
   *
   * @type {DashboardSnapshot | null}
   * @readonly
   */
  readonly _snapshot: DashboardSnapshot | null;
  // #endregion
}

/**
 * Interface DashboardStoreInstance
 *
 * @description
 * The team dashboard the page shows.
 */
export interface DashboardStoreInstance {
  // #region Properties
  /**
   * Property weeks
   *
   * @description
   * The period asked for.
   *
   * @type {Signal<DashboardWeeks>}
   * @readonly
   */
  readonly weeks: Signal<DashboardWeeks>;

  /**
   * Property dashboard
   *
   * @description
   * The dashboard shown: the answer for the organization and the period, or the previous
   * period's while another loads; null before the organization's first answer.
   *
   * @type {Signal<TeamDashboard | null>}
   * @readonly
   */
  readonly dashboard: Signal<TeamDashboard | null>;

  /**
   * Property loading
   *
   * @description
   * Whether the page draws its skeleton: no answer for the organization yet; the members never
   * hold it back. Reading it throws the read's failure when no answer for the organization and the
   * period is shown, so the route's error boundary replaces the page; a background refresh that
   * fails keeps the answer shown.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly loading: Signal<boolean>;

  /**
   * Property stale
   *
   * @description
   * Whether the dashboard shown is the previous period's while the asked one loads.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly stale: Signal<boolean>;

  /**
   * Property people
   *
   * @description
   * The organization's members; empty when they could not be read.
   *
   * @type {Signal<readonly Person[]>}
   * @readonly
   */
  readonly people: Signal<readonly Person[]>;

  /**
   * Property lateTasks
   *
   * @description
   * The first ten late tasks of the dashboard shown.
   *
   * @type {Signal<readonly TaskSummary[]>}
   * @readonly
   */
  readonly lateTasks: Signal<readonly TaskSummary[]>;

  /**
   * Property hiddenLate
   *
   * @description
   * Late tasks past the ten the contract returns (gap G-D1).
   *
   * @type {Signal<number>}
   * @readonly
   */
  readonly hiddenLate: Signal<number>;

  /**
   * Property workload
   *
   * @description
   * Each assignee's load, the most loaded first, then by name.
   *
   * @type {Signal<readonly WorkloadRow[]>}
   * @readonly
   */
  readonly workload: Signal<readonly WorkloadRow[]>;
  // #endregion

  // #region Methods
  /**
   * Method follow
   *
   * @description
   * Follows the period of the address: another period reads the dashboard again and keeps the
   * shown one until it answers.
   *
   * @param {DashboardWeeks | Signal<DashboardWeeks>} weeks - The period.
   */
  follow(weeks: DashboardWeeks | Signal<DashboardWeeks>): void;

  /**
   * Method refresh
   *
   * @description
   * Reads the dashboard again in the background, keeping the shown one; asked while a read runs,
   * it is sent once that read settles. Members that could not be read are read again.
   */
  refresh(): void;

  /**
   * Method personOf
   *
   * @description
   * The member with this user id, or an unknown member (`?`) when the list does not name them.
   *
   * @param {string} userId - The user id.
   * @returns {Person} The person to draw.
   */
  personOf(userId: string): Person;
  // #endregion
}

/**
 * Function zoneOf
 *
 * @description
 * The zone of a load (`App.dc.html` lines 6688-6698): above the threshold is critical, from one
 * under it high.
 *
 * @param {number} count - Open tasks held.
 * @param {number} threshold - Open tasks one person can take on.
 * @returns {WorkloadZone} The zone.
 */
function zoneOf(count: number, threshold: number): WorkloadZone {
  if (count > threshold) return 'critical';
  return count >= threshold - 1 ? 'high' : 'normal';
}

/**
 * Function unknownPerson
 *
 * @description
 * An assignee the member list does not name (a former member, or a list the caller may not
 * read): `Unknown member`, drawn as `?`.
 *
 * @param {string} userId - The user id.
 * @returns {Person} The person to draw.
 */
function unknownPerson(userId: string): Person {
  return {
    id: userId,
    name: $localize`:@@dashboards.people.unknown:Unknown member`,
    initials: '?',
    avatar: null,
  };
}

/**
 * Function createDashboardStore
 *
 * @description
 * Creates the dashboard store.
 *
 * @returns {Type<DashboardStoreInstance>} Injectable store constructor.
 */
function createDashboardStore(): Type<DashboardStoreInstance> {
  return signalStore(
    withState<DashboardState>({ weeks: 8, _snapshot: null }),
    withProps((store) => {
      const api: DashboardApi = inject(DashboardApi);
      const workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);
      const loads: DashboardLoads = { passive: false, queued: false, named: new Set<string>() };
      const organizationId: Signal<string> = computed((): string => workspace.organization().id);
      const read: Signal<DashboardRead> = computed(
        (): DashboardRead => {
          const weeks: DashboardWeeks = store.weeks();
          return {
            organizationId: organizationId(),
            weeks,
            key: `${organizationId()}\u0000${String(weeks)}`,
          };
        },
        { equal: (a: DashboardRead, b: DashboardRead): boolean => a.key === b.key },
      );
      return {
        _loads: loads,
        _read: read,
        _organizationId: organizationId,
        _document: inject(DOCUMENT),
        _opener: inject(TaskDetailOpener),
        _realtime: inject(RealtimeConnection, { optional: true }),
        _dashboard: resource({
          params: (): DashboardRead => read(),
          loader: async ({
            params,
            abortSignal,
          }: {
            params: DashboardRead;
            abortSignal: AbortSignal;
          }): Promise<DashboardSnapshot> => {
            const passive: boolean = loads.passive;
            loads.passive = false;
            const dashboard: TeamDashboard = await api.dashboard(
              { today: todayIso(), timeZone: callerTimeZone(), weeks: params.weeks },
              passive,
              abortSignal,
            );
            return { ...params, dashboard };
          },
        }),
        _members: resource({
          params: (): { organizationId: string } => ({ organizationId: organizationId() }),
          loader: async ({
            params,
            abortSignal,
          }: {
            params: { organizationId: string };
            abortSignal: AbortSignal;
          }): Promise<MembersSnapshot> => ({
            organizationId: params.organizationId,
            people: await api.people(abortSignal),
          }),
        }),
      };
    }),
    withComputed((store) => {
      const shown: Signal<DashboardSnapshot | null> = computed((): DashboardSnapshot | null => {
        const snapshot: DashboardSnapshot | null = store._snapshot();
        return snapshot?.organizationId === store._organizationId() ? snapshot : null;
      });
      const dashboard: Signal<TeamDashboard | null> = computed(
        (): TeamDashboard | null => shown()?.dashboard ?? null,
      );
      const members: Signal<MembersSnapshot | null> = computed((): MembersSnapshot | null => {
        if (!store._members.hasValue()) return null;
        const snapshot: MembersSnapshot = store._members.value();
        return snapshot.organizationId === store._organizationId() ? snapshot : null;
      });
      const people: Signal<readonly Person[]> = computed(
        (): readonly Person[] => members()?.people ?? [],
      );
      const directory: Signal<ReadonlyMap<string, Person>> = computed(
        (): ReadonlyMap<string, Person> =>
          new Map<string, Person>(people().map((person: Person) => [person.id, person])),
      );
      return {
        dashboard,
        people,
        _directory: directory,
        loading: computed((): boolean => {
          if (shown()?.key !== store._read().key) store._dashboard.value();
          return shown() === null;
        }),
        _unknownIds: computed((): string => {
          const current: TeamDashboard | null = dashboard();
          if (!current || members() === null || store._members.isLoading()) return '';
          const named: ReadonlyMap<string, Person> = directory();
          const ids: Set<string> = new Set<string>([
            ...current.assignees.map((load: DashboardAssigneeLoad): string => load.userId),
            ...current.overdueTasks.flatMap(
              (task: TaskSummary): readonly string[] => task.assigneeIds,
            ),
          ]);
          return [...ids]
            .filter((id: string): boolean => !named.has(id))
            .sort()
            .join(',');
        }),
        stale: computed((): boolean => {
          const snapshot: DashboardSnapshot | null = shown();
          return snapshot !== null && snapshot.key !== store._read().key;
        }),
        lateTasks: computed((): readonly TaskSummary[] => dashboard()?.overdueTasks ?? NO_TASKS),
        hiddenLate: computed((): number => {
          const current: TeamDashboard | null = dashboard();
          return current ? Math.max(0, current.lateCount - current.overdueTasks.length) : 0;
        }),
      };
    }),
    withComputed((store) => ({
      workload: computed((): readonly WorkloadRow[] => {
        const current: TeamDashboard | null = store.dashboard();
        if (!current) return [];
        return current.assignees
          .map((load: DashboardAssigneeLoad): WorkloadRow => ({
            person: store._directory().get(load.userId) ?? unknownPerson(load.userId),
            count: load.openCount,
            zone: zoneOf(load.openCount, current.assigneeThreshold),
          }))
          .sort(
            (a: WorkloadRow, b: WorkloadRow): number =>
              b.count - a.count || a.person.name.localeCompare(b.person.name),
          );
      }),
    })),
    withMethods((store) => {
      const refresh: () => void = (): void => {
        if (store._members.error() !== undefined) store._members.reload();
        if (store._dashboard.isLoading()) {
          store._loads.queued = true;
          return;
        }
        store._loads.passive = true;
        if (!store._dashboard.reload()) store._loads.passive = false;
      };
      return {
        personOf(userId: string): Person {
          return store._directory().get(userId) ?? unknownPerson(userId);
        },
        refresh,
        follow: signalMethod<DashboardWeeks>((weeks: DashboardWeeks): void => {
          patchState(store, { weeks });
        }),
        _apply: signalMethod<DashboardSnapshot | undefined>(
          (snapshot: DashboardSnapshot | undefined): void => {
            if (snapshot?.key !== store._read().key) return;
            patchState(store, { _snapshot: snapshot });
          },
        ),
        _nameUnknown: signalMethod<string>((ids: string): void => {
          if (ids === '') return;
          const asked: string = `${store._organizationId()}\u0000${ids}`;
          if (store._loads.named.has(asked)) return;
          store._loads.named.add(asked);
          store._members.reload();
        }),
        _settled: signalMethod<boolean>((loading: boolean): void => {
          if (loading || !store._loads.queued) return;
          store._loads.queued = false;
          refresh();
        }),
      };
    }),
    withHooks({
      onInit(store): void {
        store._apply(
          computed((): DashboardSnapshot | undefined =>
            store._dashboard.hasValue() ? store._dashboard.value() : undefined,
          ),
        );
        store._settled(computed((): boolean => store._dashboard.isLoading()));
        store._nameUnknown(store._unknownIds);
        const view: Window | null = store._document.defaultView;
        const triggers: Observable<unknown>[] = [
          view ? fromEvent(view, 'focus') : EMPTY,
          fromEvent(store._document, 'visibilitychange').pipe(
            filter((): boolean => store._document.visibilityState === 'visible'),
          ),
          store._opener.closed,
          store._opener.changed,
          store._realtime?.reconnected ?? EMPTY,
        ];
        merge(...triggers)
          .pipe(auditTime(REFRESH_AUDIT_MS), takeUntilDestroyed())
          .subscribe((): void => {
            store.refresh();
          });
      },
    }),
  );
}

/**
 * Constant DashboardStore
 *
 * @description
 * Page-scoped on `DashboardPage`: the team dashboard of the workspace's organization for the
 * period of the address (`follow`), from `DashboardApi`, with the members that name its people.
 * The first read and a read for another period are active; another period keeps the shown
 * dashboard (`stale`) until it answers. A failed read with no answer shown for the organization
 * and the period throws from `loading`, so the route's error boundary shows the unavailable
 * state, whose `Retry` creates the page anew. `refresh` reads again in the background, as a
 * passive request, keeping the shown dashboard even when it fails; it runs on window focus, on
 * the tab becoming visible, when a task detail closes or changed a task, on a realtime
 * reconnection (no organization-wide notice exists, gap G-R2), once at the end of a 300 ms
 * burst, and when the page's own menu writes settle. A refresh asked while a read runs is sent
 * once it settles. Another organization drops the shown dashboard and members at once, and an
 * answer for an organization or period no longer current is never kept. The page never waits
 * for the members: their people read `Unknown member` until the members answer, then their
 * names, and a members read that fails or runs again never brings the skeleton back. A
 * dashboard naming user ids the members do not hold reads the members again, once per new set
 * of ids.
 *
 * @type {Type<DashboardStoreInstance>}
 */
export const DashboardStore: Type<DashboardStoreInstance> = createDashboardStore();
