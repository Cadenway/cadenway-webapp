import {
  computed,
  DestroyRef,
  DOCUMENT,
  inject,
  resource,
  type Signal,
  type Type,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CwToastService } from '@cadenway/ui/components/toast';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { EMPTY, fromEvent, merge } from 'rxjs';

import { OrganizationPin } from '@core/api';
import { RealtimeConnection } from '@core/realtime';

import {
  NAVIGATION_REFRESH,
  type NavigationRefreshPort,
} from '@features/spaces/ports/navigation-refresh';
import { TaskDetailOpener } from '@features/task';

import {
  TRASH_ALREADY_RESTORED,
  TRASH_AUTOMATION,
  TRASH_EMPTIED,
  TRASH_EMPTY_FAILED,
  TRASH_FORMER_MEMBER,
  TRASH_PURGED_TEXT,
  TRASH_TOAST_OPEN,
  TRASH_UNCONFIRMED,
  TRASH_UNCONFIRMED_TEXT,
  trashEmptiedText,
  trashGoneTitle,
  trashPurgedTitle,
  trashPurgeFailed,
  trashRestoredText,
  trashRestoredTitle,
  trashRestoreFailed,
} from '../../constants/trash-copy/trash-copy.constants';
import {
  isTrashEntryGone,
  isUncertainTrashWrite,
  TrashApi,
} from '../../data-access/services/trash-api/trash-api.service';
import type { TrashEntry } from '../../models/trash-entry/trash-entry.interface';
import type { TrashRestore } from '../../models/trash-restore/trash-restore.interface';
import type { TrashRow, TrashWrite } from '../../models/trash-row/trash-row.interface';

/**
 * Interface TrashSnapshot
 *
 * @description
 * One complete read of the trash, numbered in the order the reads started.
 */
interface TrashSnapshot {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * Organization the read was made for.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property seq
   *
   * @description
   * Rank of the read among the reads started by the store; a read never replaces one that started
   * after it.
   *
   * @type {number}
   * @readonly
   */
  readonly seq: number;

  /**
   * Property readAt
   *
   * @description
   * When the answer arrived, in milliseconds since the epoch; the days of the rows count from it.
   *
   * @type {number}
   * @readonly
   */
  readonly readAt: number;

  /**
   * Property entries
   *
   * @description
   * The entries the read found.
   *
   * @type {readonly TrashEntry[]}
   * @readonly
   */
  readonly entries: readonly TrashEntry[];
  // #endregion
}

/**
 * Type WriteOutcome
 *
 * @description
 * How a write ended for the page: applied (`done`), the entry already out of the trash (`gone`),
 * refused or found not applied (`refused`), or still unknown once the trash could not be read
 * again (`unknown`).
 *
 * @type {'done' | 'gone' | 'refused' | 'unknown'}
 */
type WriteOutcome = 'done' | 'gone' | 'refused' | 'unknown';

/**
 * Interface TrashState
 *
 * @description
 * What the store adds to the reads: the background reads, the writes confirmed and in flight.
 * All of it belongs to the current organization and starts over when it changes.
 */
interface TrashState {
  // #region Properties
  /**
   * Property _latest
   *
   * @description
   * The newest background read (on focus, on reconnection, after a write), or null.
   *
   * @type {TrashSnapshot | null}
   * @readonly
   */
  readonly _latest: TrashSnapshot | null;

  /**
   * Property _gone
   *
   * @description
   * Entries a confirmed write took out of the trash. An entry id never comes back (deleting the
   * task again makes a new entry), so a read that started before the write cannot show them again.
   *
   * @type {Readonly<Partial<Record<string, true>>>}
   * @readonly
   */
  readonly _gone: Readonly<Partial<Record<string, true>>>;

  /**
   * Property _emptiedAt
   *
   * @description
   * Rank of the last read started when an emptying was confirmed, or -1: every read up to it
   * started before the trash was emptied and shows no entry.
   *
   * @type {number}
   * @readonly
   */
  readonly _emptiedAt: number;

  /**
   * Property _pending
   *
   * @description
   * The write in flight on each entry.
   *
   * @type {Readonly<Partial<Record<string, TrashWrite>>>}
   * @readonly
   */
  readonly _pending: Readonly<Partial<Record<string, TrashWrite>>>;

  /**
   * Property _emptying
   *
   * @description
   * Whether `Empty the trash` is in flight.
   *
   * @type {boolean}
   * @readonly
   */
  readonly _emptying: boolean;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * No background read, no write.
 *
 * @type {TrashState}
 */
const initialState: TrashState = {
  _latest: null,
  _gone: {},
  _emptiedAt: -1,
  _pending: {},
  _emptying: false,
};

/**
 * Function without
 *
 * @description
 * A copy of a record without one key.
 *
 * @param {Readonly<Record<string, T>>} record - The record.
 * @param {string} key - The key to drop.
 * @returns {Record<string, T>} The copy.
 */
function without<T>(record: Readonly<Record<string, T>>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([id]: [string, T]) => id !== key));
}

/**
 * Function classify
 *
 * @description
 * Reads a failed write: `404 trash-entry.not-found` is `gone`, a lost answer (no status, a
 * timeout or a `5xx`) is `unknown`, anything else is a refusal.
 *
 * @param {unknown} error - The failure.
 * @returns {WriteOutcome} The outcome.
 */
function classify(error: unknown): WriteOutcome {
  if (isTrashEntryGone(error)) return 'gone';
  return isUncertainTrashWrite(error) ? 'unknown' : 'refused';
}

/**
 * Interface TrashStoreInstance
 *
 * @description
 * What the trash page reads and calls.
 */
export interface TrashStoreInstance {
  // #region Properties
  /**
   * Property loading
   *
   * @description
   * Whether the first read for the current organization is still running (the page skeleton).
   * Reading it after a failed primary read throws, which reaches the route's error boundary.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly loading: Signal<boolean>;

  /**
   * Property count
   *
   * @description
   * Entries shown.
   *
   * @type {Signal<number>}
   * @readonly
   */
  readonly count: Signal<number>;

  /**
   * Property readAt
   *
   * @description
   * When the shown entries were read, in milliseconds since the epoch, or 0 before; the rows'
   * days count from it.
   *
   * @type {Signal<number>}
   * @readonly
   */
  readonly readAt: Signal<number>;

  /**
   * Property rows
   *
   * @description
   * The entries, the most recently deleted first, with who deleted them and the write in flight.
   *
   * @type {Signal<readonly TrashRow[]>}
   * @readonly
   */
  readonly rows: Signal<readonly TrashRow[]>;

  /**
   * Property emptying
   *
   * @description
   * Whether `Empty the trash` is in flight.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly emptying: Signal<boolean>;

  /**
   * Property writing
   *
   * @description
   * Whether any write is in flight; `Empty the trash` waits for none.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly writing: Signal<boolean>;
  // #endregion

  // #region Methods
  /**
   * Method isPending
   *
   * @description
   * Whether a restore or a purge of the entry is in flight. Reactive in a template.
   *
   * @param {string} entryId - The trash entry.
   * @returns {boolean} Whether a write on it is in flight.
   */
  isPending(entryId: string): boolean;

  /**
   * Method restore
   *
   * @description
   * Restores an entry with its subtasks, then toasts `KEY restored` with `Open`, or
   * `Already restored` when it was no longer in the trash. Ignored while a write on it or the
   * emptying runs.
   *
   * @param {TrashEntry} entry - The entry.
   * @returns {Promise<void>} Settles once the outcome is shown.
   */
  restore(entry: TrashEntry): Promise<void>;

  /**
   * Method purge
   *
   * @description
   * Erases an entry for good, then toasts `KEY erased`. Ignored while a write on it or the
   * emptying runs.
   *
   * @param {TrashEntry} entry - The entry.
   * @returns {Promise<void>} Settles once the outcome is shown.
   */
  purge(entry: TrashEntry): Promise<void>;

  /**
   * Method empty
   *
   * @description
   * Takes every entry out of the trash, then toasts `Trash emptied`. Ignored while any write
   * runs.
   *
   * @returns {Promise<void>} Settles once the outcome is shown.
   */
  empty(): Promise<void>;
  // #endregion
}

/**
 * Function createTrashStore
 *
 * @description
 * Creates the page-scoped store of the trash.
 *
 * @returns {Type<TrashStoreInstance>} Injectable store constructor.
 */
function createTrashStore(): Type<TrashStoreInstance> {
  return signalStore(
    withState(initialState),
    withProps(() => {
      const api: TrashApi = inject(TrashApi);
      const pin: OrganizationPin = inject(OrganizationPin);
      const reads: { seq: number } = { seq: 0 };
      const organization: () => { organizationId: string } | undefined = () => {
        const organizationId: string | null = pin.current();
        return organizationId ? { organizationId } : undefined;
      };
      return {
        _api: api,
        _pin: pin,
        _reads: reads,
        _generation: { value: 0 },
        _toasts: inject(CwToastService),
        _navigation: inject<NavigationRefreshPort | null>(NAVIGATION_REFRESH, { optional: true }),
        _opener: inject(TaskDetailOpener),
        _window: inject(DOCUMENT).defaultView,
        _realtime: inject(RealtimeConnection, { optional: true }),
        _destroyRef: inject(DestroyRef),
        _primary: resource({
          params: organization,
          loader: async ({
            params,
            abortSignal,
          }: {
            params: { organizationId: string };
            abortSignal: AbortSignal;
          }): Promise<TrashSnapshot> => {
            reads.seq += 1;
            const seq: number = reads.seq;
            const entries: readonly TrashEntry[] = await api.entries({ signal: abortSignal });
            return { organizationId: params.organizationId, seq, readAt: Date.now(), entries };
          },
        }),
        _members: resource({
          params: organization,
          loader: ({ abortSignal }: { abortSignal: AbortSignal }) => api.members(abortSignal),
        }),
      };
    }),
    withComputed((store) => {
      const snapshot: Signal<TrashSnapshot | undefined> = computed(() => {
        const organizationId: string | null = store._pin.current();
        const primary: TrashSnapshot | undefined = store._primary.value();
        const latest: TrashSnapshot | null = store._latest();
        let newest: TrashSnapshot | undefined;
        for (const candidate of [primary, latest]) {
          if (candidate?.organizationId !== organizationId) continue;
          if (!newest || candidate.seq > newest.seq) newest = candidate;
        }
        return newest;
      });
      const visible: Signal<readonly TrashEntry[] | undefined> = computed(() => {
        const current: TrashSnapshot | undefined = snapshot();
        if (!current) return undefined;
        if (current.seq <= store._emptiedAt()) return [];
        const gone: Readonly<Partial<Record<string, true>>> = store._gone();
        return current.entries.filter((entry: TrashEntry) => !gone[entry.id]);
      });
      const names: Signal<ReadonlyMap<string, string> | null> = computed(() =>
        store._members.hasValue() ? store._members.value() : null,
      );
      const deletedBy: (entry: TrashEntry) => string | null = (entry: TrashEntry) => {
        if (entry.trashedBy.kind === 'automation') return TRASH_AUTOMATION;
        if (entry.trashedBy.kind !== 'user') return null;
        const directory: ReadonlyMap<string, string> | null = names();
        if (!directory) return null;
        return directory.get(entry.trashedBy.id) ?? TRASH_FORMER_MEMBER;
      };
      return {
        _visible: visible,
        loading: computed((): boolean => visible() === undefined),
        count: computed((): number => visible()?.length ?? 0),
        readAt: computed((): number => snapshot()?.readAt ?? 0),
        emptying: computed((): boolean => store._emptying()),
        writing: computed(
          (): boolean => store._emptying() || Object.keys(store._pending()).length > 0,
        ),
        rows: computed((): readonly TrashRow[] => {
          const pending: Readonly<Partial<Record<string, TrashWrite>>> = store._pending();
          return (visible() ?? []).map((entry: TrashEntry): TrashRow => ({
            entry,
            deletedBy: deletedBy(entry),
            pending: pending[entry.id] ?? null,
          }));
        }),
      };
    }),
    withMethods((store) => {
      const current: (generation: number) => boolean = (generation: number): boolean =>
        generation === store._generation.value;

      const settle: (entryId: string, gone: boolean) => void = (
        entryId: string,
        gone: boolean,
      ): void => {
        patchState(store, {
          _pending: without(store._pending(), entryId),
          ...(gone ? { _gone: { ...store._gone(), [entryId]: true as const } } : {}),
        });
      };

      const readAgain: (passive?: boolean) => Promise<TrashSnapshot | null> = async (
        passive: boolean = false,
      ): Promise<TrashSnapshot | null> => {
        const organizationId: string | null = store._pin.current();
        if (!organizationId) return null;
        const generation: number = store._generation.value;
        store._reads.seq += 1;
        const seq: number = store._reads.seq;
        try {
          const entries: readonly TrashEntry[] = await store._api.entries({ passive });
          if (!current(generation)) return null;
          const snapshot: TrashSnapshot = { organizationId, seq, readAt: Date.now(), entries };
          const latest: TrashSnapshot | null = store._latest();
          if (latest?.organizationId !== organizationId || latest.seq < seq) {
            patchState(store, { _latest: snapshot });
          }
          return snapshot;
        } catch {
          return null;
        }
      };

      // After a write without an answer, the trash read again decides: the entry still listed
      // means the write was not applied. Null when the organization changed meanwhile.
      const confirm: (
        entryIds: readonly string[],
        generation: number,
      ) => Promise<WriteOutcome | null> = async (
        entryIds: readonly string[],
        generation: number,
      ): Promise<WriteOutcome | null> => {
        const snapshot: TrashSnapshot | null = await readAgain();
        if (!current(generation)) return null;
        if (!snapshot) return 'unknown';
        const listed: boolean = snapshot.entries.some((entry: TrashEntry) =>
          entryIds.includes(entry.id),
        );
        return listed ? 'refused' : 'done';
      };

      const unconfirmed: () => void = (): void => {
        store._toasts.error(TRASH_UNCONFIRMED, { description: TRASH_UNCONFIRMED_TEXT });
      };

      const restored: (restore: TrashRestore) => void = (restore: TrashRestore): void => {
        store._toasts.success(trashRestoredTitle(restore.taskKey), {
          description: trashRestoredText(restore),
          action: {
            label: TRASH_TOAST_OPEN,
            run: (): void => {
              void store._opener.open(restore.taskKey, {
                key: restore.taskKey,
                name: restore.taskName,
                status: restore.status,
                milestone: false,
              });
            },
          },
        });
        store._navigation?.refresh();
      };

      return {
        isPending(entryId: string): boolean {
          return store._pending()[entryId] !== undefined;
        },

        async restore(entry: TrashEntry): Promise<void> {
          if (store._pending()[entry.id] || store._emptying()) return;
          const generation: number = store._generation.value;
          patchState(store, { _pending: { ...store._pending(), [entry.id]: 'restore' } });
          let outcome: WriteOutcome;
          let restore: TrashRestore | null = null;
          try {
            restore = await store._api.restore(entry.id);
            outcome = 'done';
          } catch (error: unknown) {
            outcome = classify(error);
          }
          if (!current(generation)) return;
          if (outcome === 'unknown') {
            const confirmed: WriteOutcome | null = await confirm([entry.id], generation);
            if (confirmed === null) return;
            outcome = confirmed;
          }
          settle(entry.id, outcome === 'done' || outcome === 'gone');
          switch (outcome) {
            case 'done':
              restored(
                restore ?? {
                  taskKey: entry.taskKey,
                  taskName: entry.taskName,
                  status: entry.status,
                  listName: entry.listName,
                  subtaskCount: entry.subtaskCount,
                  detached: false,
                },
              );
              if (restore) void readAgain();
              return;
            case 'gone':
              store._toasts.info(TRASH_ALREADY_RESTORED);
              store._navigation?.refresh();
              void readAgain();
              return;
            case 'refused':
              store._toasts.error(trashRestoreFailed(entry.taskKey));
              return;
            case 'unknown':
              unconfirmed();
              return;
          }
        },

        async purge(entry: TrashEntry): Promise<void> {
          if (store._pending()[entry.id] || store._emptying()) return;
          const generation: number = store._generation.value;
          patchState(store, { _pending: { ...store._pending(), [entry.id]: 'purge' } });
          let outcome: WriteOutcome;
          let answered: boolean = true;
          try {
            await store._api.purge(entry.id);
            outcome = 'done';
          } catch (error: unknown) {
            outcome = classify(error);
          }
          if (!current(generation)) return;
          if (outcome === 'unknown') {
            answered = false;
            const confirmed: WriteOutcome | null = await confirm([entry.id], generation);
            if (confirmed === null) return;
            outcome = confirmed;
          }
          settle(entry.id, outcome === 'done' || outcome === 'gone');
          switch (outcome) {
            case 'done':
              store._toasts.success(trashPurgedTitle(entry.taskKey), {
                description: TRASH_PURGED_TEXT,
              });
              store._navigation?.refreshCounts();
              if (answered) void readAgain();
              return;
            case 'gone':
              store._toasts.info(trashGoneTitle(entry.taskKey));
              store._navigation?.refreshCounts();
              void readAgain();
              return;
            case 'refused':
              store._toasts.error(trashPurgeFailed(entry.taskKey));
              return;
            case 'unknown':
              unconfirmed();
              return;
          }
        },

        async empty(): Promise<void> {
          if (store.writing()) return;
          const generation: number = store._generation.value;
          const shown: readonly string[] = (store._visible() ?? []).map(
            (entry: TrashEntry) => entry.id,
          );
          patchState(store, { _emptying: true });
          let outcome: WriteOutcome;
          let count: number = shown.length;
          try {
            count = await store._api.empty();
            outcome = 'done';
          } catch (error: unknown) {
            outcome = isUncertainTrashWrite(error) ? 'unknown' : 'refused';
          }
          if (!current(generation)) return;
          const answered: boolean = outcome === 'done';
          if (outcome === 'unknown') {
            const confirmed: WriteOutcome | null = await confirm(shown, generation);
            if (confirmed === null) return;
            outcome = confirmed;
          }
          if (outcome !== 'done') {
            patchState(store, { _emptying: false });
            if (outcome === 'refused') store._toasts.error(TRASH_EMPTY_FAILED);
            else unconfirmed();
            return;
          }
          patchState(store, {
            _emptying: false,
            _gone: {
              ...store._gone(),
              ...Object.fromEntries(shown.map((id: string) => [id, true as const])),
            },
            ...(answered ? { _emptiedAt: store._reads.seq } : {}),
          });
          store._toasts.success(TRASH_EMPTIED, { description: trashEmptiedText(count) });
          store._navigation?.refreshCounts();
          if (answered) void readAgain();
        },

        _readAgain(passive: boolean): void {
          if (store._primary.isLoading() || !store._primary.hasValue()) return;
          void readAgain(passive);
        },

        _reset(): void {
          store._generation.value += 1;
          patchState(store, initialState);
        },
      };
    }),
    withHooks({
      onInit(store): void {
        store._pin.organizationChanges.pipe(takeUntilDestroyed(store._destroyRef)).subscribe(() => {
          store._reset();
        });
        merge(
          store._window ? fromEvent(store._window, 'focus') : EMPTY,
          store._realtime?.reconnected ?? EMPTY,
        )
          .pipe(takeUntilDestroyed(store._destroyRef))
          .subscribe(() => {
            store._readAgain(true);
          });
        store._opener.closed.pipe(takeUntilDestroyed(store._destroyRef)).subscribe(() => {
          store._readAgain(false);
        });
      },
    }),
  );
}

/**
 * Constant TrashStore
 *
 * @description
 * The trash page of the current organization (`App.dc.html` lines 1965-1997 and 8371-8419),
 * page-scoped. Its primary read (`listTrash` to the last page) follows the pinned organization;
 * its failure reaches the route's error boundary through `rows`, `count` and `loading`. The
 * member directory names who deleted each entry; its failure only leaves the names out.
 *
 * The trash is read again on window focus, on realtime reconnection, when a task detail opened
 * from the page closes, and after each write. Reads are ranked by start: a read never replaces
 * one that started after it, and a confirmed restore, purge or emptying hides what a read started
 * before it still shows, so a confirmed write is never undone by an older answer.
 *
 * Each write is bound to the organization it started in: when it changes meanwhile, its answer
 * patches nothing and raises no toast. A write without an answer (no status, a timeout, a `5xx`)
 * is not taken as failed: the trash is read again and the entry's presence decides; when that read
 * fails too, `Could not confirm the change` says so and the entry stays. After a restore the
 * sidebar reads its spaces and lists again (`NAVIGATION_REFRESH.refresh`); after a purge or an
 * emptying only its counts (`refreshCounts`).
 *
 * @type {ReturnType<typeof createTrashStore>}
 */
export const TrashStore: ReturnType<typeof createTrashStore> = createTrashStore();
