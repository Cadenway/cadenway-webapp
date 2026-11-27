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
  TRASH_NOT_READY_TEXT,
  TRASH_PURGED_TEXT,
  TRASH_TOAST_OPEN,
  TRASH_UNCONFIRMED,
  TRASH_UNCONFIRMED_TEXT,
  trashEmptiedText,
  trashGoneTitle,
  trashNotReadyTitle,
  trashPurgedTitle,
  trashPurgeFailed,
  trashRestoredText,
  trashRestoredTitle,
  trashRestoreFailed,
} from '../../constants/trash-copy/trash-copy.constants';
import {
  isTrashEntryGone,
  isTrashEntryNotReady,
  isTrashWriteNotSent,
  isUncertainTrashWrite,
  TrashApi,
} from '../../data-access/services/trash-api/trash-api.service';
import type { TrashEntry } from '../../models/trash-entry/trash-entry.interface';
import type { TrashListing } from '../../models/trash-listing/trash-listing.interface';
import type { TrashRestore } from '../../models/trash-restore/trash-restore.interface';
import type { TrashRow, TrashWrite } from '../../models/trash-row/trash-row.interface';
import { TRASH_RECONCILE_DELAYS } from './trash-reconcile-delays.token';

/**
 * Interface TrashSnapshot
 *
 * @description
 * One read of the trash, numbered in the order the reads started.
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
   * Property epoch
   *
   * @description
   * Organization epoch the read was made in; a read from an earlier epoch is never shown.
   *
   * @type {number}
   * @readonly
   */
  readonly epoch: number;

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
   * The entries the read listed, up to its cap.
   *
   * @type {readonly TrashEntry[]}
   * @readonly
   */
  readonly entries: readonly TrashEntry[];

  /**
   * Property total
   *
   * @description
   * Entries the trash held, listed or not.
   *
   * @type {number}
   * @readonly
   */
  readonly total: number;
  // #endregion
}

/**
 * Type WriteOutcome
 *
 * @description
 * How a write answered: applied (`done`), no entry for the caller (`gone`, a `404`), the list
 * still being deleted (`not-ready`), refused (`refused`), blocked before it left by an
 * organization switch (`not-sent`), or without an answer (`unknown`).
 *
 * @type {'done' | 'gone' | 'not-ready' | 'refused' | 'not-sent' | 'unknown'}
 */
type WriteOutcome = 'done' | 'gone' | 'not-ready' | 'refused' | 'not-sent' | 'unknown';

/**
 * Type Verdict
 *
 * @description
 * What the reads after a write without an answer found: the expected change (`applied`), or no
 * proof either way (`unconfirmed`); null once the organization or the page changed.
 *
 * @type {'applied' | 'unconfirmed' | null}
 */
type Verdict = 'applied' | 'unconfirmed' | null;

/**
 * Type ToastTone
 *
 * @description
 * The `CwToastService` methods the store uses.
 *
 * @type {'success' | 'info' | 'warning' | 'error'}
 */
type ToastTone = 'success' | 'info' | 'warning' | 'error';

/**
 * Interface ReadLane
 *
 * @description
 * The single-flight lane of the store's own reads: one read runs, at most one more waits for it.
 */
interface ReadLane {
  // #region Properties
  /**
   * Property running
   *
   * @description
   * The read in flight, or null.
   *
   * @type {Promise<TrashSnapshot | null> | null}
   */
  running: Promise<TrashSnapshot | null> | null;

  /**
   * Property queued
   *
   * @description
   * The read that starts once the running one ends, shared by every caller meanwhile, or null.
   *
   * @type {Promise<TrashSnapshot | null> | null}
   */
  queued: Promise<TrashSnapshot | null> | null;

  /**
   * Property queuedPassive
   *
   * @description
   * Whether the queued read is passive: only when every caller asked for a passive one.
   *
   * @type {boolean}
   */
  queuedPassive: boolean;

  /**
   * Property controller
   *
   * @description
   * Aborts the reads of the current organization epoch, on an organization change and on destroy.
   *
   * @type {AbortController}
   */
  controller: AbortController;
  // #endregion
}

/**
 * Interface TrashState
 *
 * @description
 * The organization epoch, the background reads and the writes confirmed and in flight. All but
 * the epoch belong to the current organization and start over when it changes.
 */
interface TrashState {
  // #region Properties
  /**
   * Property epoch
   *
   * @description
   * Rises on each organization change (A, then B, then A again gives three epochs). A dialog opened
   * in an epoch confirms only in that epoch.
   *
   * @type {number}
   * @readonly
   */
  readonly epoch: number;

  /**
   * Property _latest
   *
   * @description
   * The newest of the store's own reads (on focus, on reconnection, after a write), or null.
   *
   * @type {TrashSnapshot | null}
   * @readonly
   */
  readonly _latest: TrashSnapshot | null;

  /**
   * Property _gone
   *
   * @description
   * Entries a write confirmed with a success took out of the trash. An entry id never comes back
   * (deleting the task again makes a new entry), so a read that started before the write cannot
   * show them again. A `404` or a read's absence never pins an entry here: the reads decide.
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
   * The write in flight on each entry, kept until its outcome is known or given up.
   *
   * @type {Readonly<Partial<Record<string, TrashWrite>>>}
   * @readonly
   */
  readonly _pending: Readonly<Partial<Record<string, TrashWrite>>>;

  /**
   * Property _emptying
   *
   * @description
   * Whether `Empty the trash` is in flight or being confirmed.
   *
   * @type {boolean}
   * @readonly
   */
  readonly _emptying: boolean;
  // #endregion
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
   * Property epoch
   *
   * @description
   * The organization epoch; the page binds each confirmation dialog to the epoch it opened in.
   *
   * @type {Signal<number>}
   * @readonly
   */
  readonly epoch: Signal<number>;

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
   * Entries in the trash: those shown and those past the read's cap.
   *
   * @type {Signal<number>}
   * @readonly
   */
  readonly count: Signal<number>;

  /**
   * Property hiddenCount
   *
   * @description
   * Entries in the trash past the read's cap, which the page does not list.
   *
   * @type {Signal<number>}
   * @readonly
   */
  readonly hiddenCount: Signal<number>;

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
   * Whether `Empty the trash` is in flight or being confirmed.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly emptying: Signal<boolean>;

  /**
   * Property writing
   *
   * @description
   * Whether any write is in flight or being confirmed; `Empty the trash` waits for none.
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
   * Whether a restore or a purge of the entry is in flight or being confirmed. Reactive in a
   * template.
   *
   * @param {string} entryId - The trash entry.
   * @returns {boolean} Whether a write on it is in flight.
   */
  isPending(entryId: string): boolean;

  /**
   * Method restore
   *
   * @description
   * Restores an entry with its subtasks, then toasts the outcome. Ignored while a write on it or
   * the emptying runs.
   *
   * @param {TrashEntry} entry - The entry.
   * @returns {Promise<void>} Settles once the outcome is shown.
   */
  restore(entry: TrashEntry): Promise<void>;

  /**
   * Method purge
   *
   * @description
   * Erases an entry for good, then toasts the outcome. Ignored while a write on it or the
   * emptying runs, and when the organization epoch is no longer the given one.
   *
   * @param {TrashEntry} entry - The entry.
   * @param {number} epoch - The epoch the confirmation opened in.
   * @returns {Promise<void>} Settles once the outcome is shown.
   */
  purge(entry: TrashEntry, epoch: number): Promise<void>;

  /**
   * Method empty
   *
   * @description
   * Takes every entry out of the trash, then toasts the outcome. Ignored while any write runs, and
   * when the organization epoch is no longer the given one.
   *
   * @param {number} epoch - The epoch the confirmation opened in.
   * @returns {Promise<void>} Settles once the outcome is shown.
   */
  empty(epoch: number): Promise<void>;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * The first epoch, no read of the store's own, no write.
 *
 * @type {TrashState}
 */
const initialState: TrashState = {
  epoch: 0,
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
 * @param {Readonly<Partial<Record<string, T>>>} record - The record.
 * @param {string} key - The key to drop.
 * @returns {Partial<Record<string, T>>} The copy.
 */
function without<T>(
  record: Readonly<Partial<Record<string, T>>>,
  key: string,
): Partial<Record<string, T>> {
  return Object.fromEntries(
    Object.entries(record).filter(([id]: [string, T | undefined]) => id !== key),
  );
}

/**
 * Function classify
 *
 * @description
 * Reads a failed write. A write blocked by an organization switch never left; a lost answer (no
 * status, a timeout, a `408` or a `5xx`) is unknown; a `404 trash-entry.not-found` and a
 * `409 trash-entry.not-restorable-yet` are named; anything else is a refusal.
 *
 * @param {unknown} error - The failure.
 * @returns {WriteOutcome} The outcome.
 */
function classify(error: unknown): WriteOutcome {
  if (isTrashWriteNotSent(error)) return 'not-sent';
  if (isTrashEntryGone(error)) return 'gone';
  if (isTrashEntryNotReady(error)) return 'not-ready';
  return isUncertainTrashWrite(error) ? 'unknown' : 'refused';
}

/**
 * Function listed
 *
 * @description
 * Whether a read may still hold an entry: it lists it, or it stopped at its cap before reaching
 * entries as old as it, so its absence proves nothing.
 *
 * @param {TrashSnapshot} snapshot - The read.
 * @param {TrashEntry} entry - The entry.
 * @returns {boolean} Whether the entry may still be in the trash.
 */
function listed(snapshot: TrashSnapshot, entry: TrashEntry): boolean {
  if (snapshot.entries.some((item: TrashEntry) => item.id === entry.id)) return true;
  if (snapshot.total <= snapshot.entries.length) return false;
  const oldest: TrashEntry | undefined = snapshot.entries.at(-1);
  return !oldest || Date.parse(entry.trashedAt) <= Date.parse(oldest.trashedAt);
}

/**
 * Function pause
 *
 * @description
 * Waits a delay.
 *
 * @param {number} ms - Delay, in milliseconds.
 * @returns {Promise<void>} Resolves after it.
 */
function pause(ms: number): Promise<void> {
  return new Promise<void>((resolve: () => void) => {
    setTimeout(resolve, ms);
  });
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
    withProps((store) => {
      const api: TrashApi = inject(TrashApi);
      const pin: OrganizationPin = inject(OrganizationPin);
      const reads: { seq: number } = { seq: 0 };
      const organization: () => { organizationId: string; epoch: number } | undefined = () => {
        const organizationId: string | null = pin.current();
        return organizationId ? { organizationId, epoch: store.epoch() } : undefined;
      };
      const lane: ReadLane = {
        running: null,
        queued: null,
        queuedPassive: true,
        controller: new AbortController(),
      };
      return {
        _api: api,
        _pin: pin,
        _reads: reads,
        _lane: lane,
        _shownToasts: new Set<string>(),
        _delays: inject(TRASH_RECONCILE_DELAYS),
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
            params: { organizationId: string; epoch: number };
            abortSignal: AbortSignal;
          }): Promise<TrashSnapshot> => {
            reads.seq += 1;
            const seq: number = reads.seq;
            const listing: TrashListing = await api.entries({ signal: abortSignal });
            return {
              organizationId: params.organizationId,
              epoch: params.epoch,
              seq,
              readAt: Date.now(),
              entries: listing.entries,
              total: listing.total,
            };
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
        const epoch: number = store.epoch();
        const primary: TrashSnapshot | undefined = store._primary.value();
        const latest: TrashSnapshot | null = store._latest();
        let newest: TrashSnapshot | undefined;
        for (const candidate of [primary, latest]) {
          if (candidate?.organizationId !== organizationId || candidate.epoch !== epoch) continue;
          if (!newest || candidate.seq > newest.seq) newest = candidate;
        }
        return newest;
      });
      const emptied: Signal<boolean> = computed(
        (): boolean => (snapshot()?.seq ?? Infinity) <= store._emptiedAt(),
      );
      const visible: Signal<readonly TrashEntry[] | undefined> = computed(() => {
        const current: TrashSnapshot | undefined = snapshot();
        if (!current) return undefined;
        if (emptied()) return [];
        const gone: Readonly<Partial<Record<string, true>>> = store._gone();
        return current.entries.filter((entry: TrashEntry) => gone[entry.id] === undefined);
      });
      const hidden: Signal<number> = computed((): number => {
        const current: TrashSnapshot | undefined = snapshot();
        if (!current || emptied()) return 0;
        return Math.max(0, current.total - current.entries.length);
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
        count: computed((): number => (visible()?.length ?? 0) + hidden()),
        hiddenCount: hidden,
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
      // A write's answer applies only in the organization and epoch it started in, on a live page.
      const current: (epoch: number, organizationId: string) => boolean = (
        epoch: number,
        organizationId: string,
      ): boolean =>
        !store._destroyRef.destroyed &&
        epoch === store.epoch() &&
        store._pin.current() === organizationId;

      const show: (
        tone: ToastTone,
        title: string,
        options?: Parameters<CwToastService['show']>[1],
      ) => void = (tone, title, options): void => {
        const live: ReadonlySet<string> = new Set(
          store._toasts.toasts().map((item: { readonly id: string }): string => item.id),
        );
        for (const kept of store._shownToasts) if (!live.has(kept)) store._shownToasts.delete(kept);
        store._shownToasts.add(
          options ? store._toasts[tone](title, options) : store._toasts[tone](title),
        );
      };

      const dismissToasts: () => void = (): void => {
        for (const id of store._shownToasts) store._toasts.dismiss(id);
        store._shownToasts.clear();
      };

      const settle: (entryId: string, gone: boolean) => void = (
        entryId: string,
        gone: boolean,
      ): void => {
        patchState(store, {
          _pending: without(store._pending(), entryId),
          ...(gone ? { _gone: { ...store._gone(), [entryId]: true as const } } : {}),
        });
      };

      const run: (passive: boolean) => Promise<TrashSnapshot | null> = async (
        passive: boolean,
      ): Promise<TrashSnapshot | null> => {
        const organizationId: string | null = store._pin.current();
        if (!organizationId) return null;
        const epoch: number = store.epoch();
        store._reads.seq += 1;
        const seq: number = store._reads.seq;
        try {
          const listing: TrashListing = await store._api.entries({
            passive,
            signal: store._lane.controller.signal,
          });
          if (!current(epoch, organizationId)) return null;
          const snapshot: TrashSnapshot = {
            organizationId,
            epoch,
            seq,
            readAt: Date.now(),
            entries: listing.entries,
            total: listing.total,
          };
          const latest: TrashSnapshot | null = store._latest();
          if (latest?.epoch !== epoch || latest.seq < seq) patchState(store, { _latest: snapshot });
          return snapshot;
        } catch {
          return null;
        }
      };

      // Single flight: while a read runs, every caller shares one read queued after it, which
      // started after their call, so its answer is fresh for each of them.
      const read: (passive: boolean) => Promise<TrashSnapshot | null> = (
        passive: boolean,
      ): Promise<TrashSnapshot | null> => {
        const lane: ReadLane = store._lane;
        if (lane.running === null) {
          const started: Promise<TrashSnapshot | null> = run(passive).finally(() => {
            if (lane.running === started) lane.running = null;
          });
          lane.running = started;
          return started;
        }
        if (lane.queued === null) {
          lane.queuedPassive = passive;
          const next: Promise<TrashSnapshot | null> = lane.running.then(() => {
            if (lane.queued === next) lane.queued = null;
            return read(lane.queuedPassive);
          });
          lane.queued = next;
          return next;
        }
        lane.queuedPassive &&= passive;
        return lane.queued;
      };

      // After a write without an answer, the trash is read again after each delay until a read
      // shows the expected change; one read right after the failure would prove nothing.
      const reconcile: (
        applied: (snapshot: TrashSnapshot) => boolean,
        epoch: number,
        organizationId: string,
      ) => Promise<Verdict> = async (applied, epoch, organizationId): Promise<Verdict> => {
        for (const delay of store._delays) {
          await pause(delay);
          if (!current(epoch, organizationId)) return null;
          const snapshot: TrashSnapshot | null = await read(false);
          if (!current(epoch, organizationId)) return null;
          if (snapshot && applied(snapshot)) return 'applied';
        }
        return 'unconfirmed';
      };

      const unconfirmed: () => void = (): void => {
        show('warning', TRASH_UNCONFIRMED, { description: TRASH_UNCONFIRMED_TEXT });
      };

      const restored: (restore: TrashRestore, epoch: number, organizationId: string) => void = (
        restore: TrashRestore,
        epoch: number,
        organizationId: string,
      ): void => {
        show('success', trashRestoredTitle(restore.taskKey), {
          description: trashRestoredText(restore),
          action: {
            label: TRASH_TOAST_OPEN,
            run: (): void => {
              if (!current(epoch, organizationId)) return;
              void store._opener.open(restore.taskKey, {
                key: restore.taskKey,
                name: restore.taskName,
                status: restore.status,
                milestone: false,
              });
            },
          },
        });
      };

      return {
        isPending(entryId: string): boolean {
          return store._pending()[entryId] !== undefined;
        },

        async restore(entry: TrashEntry): Promise<void> {
          const organizationId: string | null = store._pin.current();
          if (!organizationId || store._pending()[entry.id] || store._emptying()) return;
          const epoch: number = store.epoch();
          patchState(store, { _pending: { ...store._pending(), [entry.id]: 'restore' } });
          let outcome: WriteOutcome;
          let restore: TrashRestore | null = null;
          try {
            restore = await store._api.restore(entry.id);
            outcome = 'done';
          } catch (error: unknown) {
            outcome = classify(error);
          }
          if (!current(epoch, organizationId)) return;
          switch (outcome) {
            case 'done':
              settle(entry.id, true);
              if (restore) restored(restore, epoch, organizationId);
              store._navigation?.refresh();
              void read(false);
              return;
            case 'gone':
              await read(false);
              if (!current(epoch, organizationId)) return;
              settle(entry.id, false);
              show('info', TRASH_ALREADY_RESTORED);
              store._navigation?.refresh();
              return;
            case 'not-ready':
              settle(entry.id, false);
              show('warning', trashNotReadyTitle(entry.taskKey), {
                description: TRASH_NOT_READY_TEXT,
              });
              return;
            case 'refused':
              settle(entry.id, false);
              show('error', trashRestoreFailed(entry.taskKey));
              return;
            case 'not-sent':
              settle(entry.id, false);
              return;
            case 'unknown': {
              const verdict: Verdict = await reconcile(
                (snapshot: TrashSnapshot) => !listed(snapshot, entry),
                epoch,
                organizationId,
              );
              if (verdict === null) return;
              settle(entry.id, false);
              if (verdict === 'applied') {
                show('info', trashGoneTitle(entry.taskKey));
                store._navigation?.refresh();
              } else unconfirmed();
              return;
            }
          }
        },

        async purge(entry: TrashEntry, expected: number): Promise<void> {
          const organizationId: string | null = store._pin.current();
          if (!organizationId || expected !== store.epoch()) return;
          if (store._pending()[entry.id] || store._emptying()) return;
          const epoch: number = store.epoch();
          patchState(store, { _pending: { ...store._pending(), [entry.id]: 'purge' } });
          let outcome: WriteOutcome;
          try {
            await store._api.purge(entry.id);
            outcome = 'done';
          } catch (error: unknown) {
            outcome = classify(error);
          }
          if (!current(epoch, organizationId)) return;
          switch (outcome) {
            case 'done':
              settle(entry.id, true);
              show('success', trashPurgedTitle(entry.taskKey), { description: TRASH_PURGED_TEXT });
              store._navigation?.refreshCounts();
              void read(false);
              return;
            case 'gone':
              await read(false);
              if (!current(epoch, organizationId)) return;
              settle(entry.id, false);
              show('info', trashGoneTitle(entry.taskKey));
              store._navigation?.refreshCounts();
              return;
            case 'not-sent':
              settle(entry.id, false);
              return;
            case 'unknown': {
              const verdict: Verdict = await reconcile(
                (snapshot: TrashSnapshot) => !listed(snapshot, entry),
                epoch,
                organizationId,
              );
              if (verdict === null) return;
              settle(entry.id, false);
              if (verdict === 'applied') {
                show('info', trashGoneTitle(entry.taskKey));
                store._navigation?.refreshCounts();
              } else unconfirmed();
              return;
            }
            default:
              settle(entry.id, false);
              show('error', trashPurgeFailed(entry.taskKey));
              return;
          }
        },

        async empty(expected: number): Promise<void> {
          const organizationId: string | null = store._pin.current();
          if (!organizationId || expected !== store.epoch() || store.writing()) return;
          const epoch: number = store.epoch();
          const shown: readonly TrashEntry[] = store._visible() ?? [];
          patchState(store, { _emptying: true });
          let outcome: WriteOutcome;
          let count: number = shown.length;
          try {
            count = await store._api.empty();
            outcome = 'done';
          } catch (error: unknown) {
            outcome = classify(error);
          }
          if (!current(epoch, organizationId)) return;
          if (outcome === 'done') {
            patchState(store, {
              _emptying: false,
              _gone: {
                ...store._gone(),
                ...Object.fromEntries(shown.map((entry: TrashEntry) => [entry.id, true as const])),
              },
              _emptiedAt: store._reads.seq,
            });
            show('success', TRASH_EMPTIED, { description: trashEmptiedText(count) });
            store._navigation?.refreshCounts();
            void read(false);
            return;
          }
          if (outcome === 'unknown') {
            // With nothing shown to look for, only an empty trash proves the emptying.
            const verdict: Verdict = await reconcile(
              (snapshot: TrashSnapshot) =>
                shown.length === 0
                  ? snapshot.total === 0
                  : shown.every((entry: TrashEntry) => !listed(snapshot, entry)),
              epoch,
              organizationId,
            );
            if (verdict === null) return;
            patchState(store, { _emptying: false });
            if (verdict === 'applied') {
              show('success', TRASH_EMPTIED, { description: trashEmptiedText(shown.length) });
              store._navigation?.refreshCounts();
            } else unconfirmed();
            return;
          }
          patchState(store, { _emptying: false });
          if (outcome !== 'not-sent') show('error', TRASH_EMPTY_FAILED);
        },

        _readAgain(passive: boolean): void {
          if (store._primary.isLoading() || !store._primary.hasValue()) return;
          void read(passive);
        },

        _reset(): void {
          store._lane.controller.abort();
          store._lane.controller = new AbortController();
          store._lane.running = null;
          store._lane.queued = null;
          dismissToasts();
          patchState(store, { ...initialState, epoch: store.epoch() + 1 });
        },

        _dispose(): void {
          store._lane.controller.abort();
          dismissToasts();
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
      onDestroy(store): void {
        store._dispose();
      },
    }),
  );
}

/**
 * Constant TrashStore
 *
 * @description
 * The trash page of the current organization (`App.dc.html` lines 1965-1997 and 8371-8419),
 * page-scoped. Its primary read (`listTrash`, up to 1,000 entries) follows the pinned organization
 * and its epoch; its failure reaches the route's error boundary through `rows`, `count` and
 * `loading`. The member directory names who deleted each entry; its failure only leaves the names
 * out.
 *
 * The store's own reads (on window focus, on realtime reconnection, when a task detail closes over
 * the page, after each write) run one at a time with one more queued, and abort on an organization
 * change and on destroy. Reads are ranked by start: a read never replaces one that started after
 * it, and a write confirmed by a success hides what an older read still shows.
 *
 * Each write is bound to the organization and the epoch it started in, on a live page: otherwise
 * its answer patches nothing and raises no toast. A write blocked by an organization switch is
 * dropped silently. A write without an answer (no status, a timeout, a `5xx`) keeps its entry
 * pending while the trash is read again after 2, 4 and 8 seconds: the expected absence gives a
 * neutral `KEY is no longer in the trash` (or `Trash emptied`), and no proof gives
 * `Could not confirm the change` and frees the entry. A `404` never hides an entry by itself: the
 * read that follows decides. A restore asks `reportNotReady`, so a list still being deleted
 * answers `KEY cannot be restored yet`. After a restore the sidebar reads its spaces and lists
 * again (`NAVIGATION_REFRESH.refresh`); after a purge or an emptying only its counts
 * (`refreshCounts`). The page's toasts are dismissed on an organization change and on destroy.
 *
 * @type {ReturnType<typeof createTrashStore>}
 */
export const TrashStore: ReturnType<typeof createTrashStore> = createTrashStore();
