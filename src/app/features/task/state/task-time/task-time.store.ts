import { DOCUMENT } from '@angular/common';
import { computed, inject, type Signal, type Type } from '@angular/core';
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
import { CwToastService } from '@cadenway/ui/components/toast';

import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { TaskTimeApi } from '../../data-access/services/task-time-api/task-time-api.service';
import type { TaskDetailTask } from '../../models/task-detail/task-detail.interface';
import type {
  TaskTimeDraft,
  TaskTimeEntry,
  TaskTimeLog,
} from '../../models/task-time/task-time.interface';
import { formatMinutes, localDay } from '../../utils/task-property/task-property.util';
import { TaskDetailStore } from '../task-detail/task-detail.store';

/**
 * Constant MAX_ENTRY_MINUTES
 *
 * @description
 * Longest entry the gateway records (`WorkLogMinutes`): a day.
 *
 * @type {number}
 */
export const MAX_ENTRY_MINUTES: number = 1440;

/**
 * Constant TIMER_STORAGE_PREFIX
 *
 * @description
 * Prefix of the device storage key of a running timer, followed by the organization and the
 * task key. The API has no running timer, so it lives on the device.
 *
 * @type {string}
 */
export const TIMER_STORAGE_PREFIX: string = 'cadenway-task-timer';

/**
 * Constant TIMER_STOP_SUFFIX
 *
 * @description
 * Suffix of the device storage key, after the timer's own key, of a timer stop sent and not
 * confirmed yet: it outlives the detail, so a stop whose answer was lost is sent again with the
 * same entry and `Idempotency-Key` after a reopen or a reload.
 *
 * @type {string}
 */
export const TIMER_STOP_SUFFIX: string = 'stop';

/**
 * Constant LOG_READ_ATTEMPTS
 *
 * @description
 * Reads of the entries made in a row while writes keep confirming during each of them.
 *
 * @type {number}
 */
const LOG_READ_ATTEMPTS: number = 3;

/**
 * Interface TaskTimerStop
 *
 * @description
 * A timer stop the gateway has not confirmed: the entry frozen at the first stop and the key it
 * is sent under.
 */
interface TaskTimerStop {
  // #region Properties
  /**
   * Property startedAt
   *
   * @description
   * Start of the timer it stops (epoch milliseconds); a stop of another start is ignored.
   *
   * @type {number}
   * @readonly
   */
  readonly startedAt: number;

  /**
   * Property minutes
   *
   * @description
   * Minutes of the entry, between 1 and 1,440.
   *
   * @type {number}
   * @readonly
   */
  readonly minutes: number;

  /**
   * Property workDate
   *
   * @description
   * Local day of the work (`YYYY-MM-DD`).
   *
   * @type {string}
   * @readonly
   */
  readonly workDate: string;

  /**
   * Property note
   *
   * @description
   * Note of the entry.
   *
   * @type {string}
   * @readonly
   */
  readonly note: string;

  /**
   * Property idempotencyKey
   *
   * @description
   * The key the entry is sent under.
   *
   * @type {string}
   * @readonly
   */
  readonly idempotencyKey: string;
  // #endregion
}

/**
 * Interface TaskTimeAttempt
 *
 * @description
 * An entry sent to a task and not confirmed yet: sending the same entry again reuses its
 * `Idempotency-Key`, so a write the gateway applied without answering is not recorded twice.
 */
interface TaskTimeAttempt {
  // #region Properties
  /**
   * Property taskKey
   *
   * @description
   * The task the entry is recorded on.
   *
   * @type {string}
   * @readonly
   */
  readonly taskKey: string;

  /**
   * Property minutes
   *
   * @description
   * Minutes of the entry, between 1 and 1,440.
   *
   * @type {number}
   * @readonly
   */
  readonly minutes: number;

  /**
   * Property note
   *
   * @description
   * Note of the entry.
   *
   * @type {string}
   * @readonly
   */
  readonly note: string;

  /**
   * Property workDate
   *
   * @description
   * Local day of the work (`YYYY-MM-DD`).
   *
   * @type {string}
   * @readonly
   */
  readonly workDate: string;

  /**
   * Property idempotencyKey
   *
   * @description
   * The key the entry is sent under.
   *
   * @type {string}
   * @readonly
   */
  readonly idempotencyKey: string;
  // #endregion
}

/**
 * Interface TaskTimeState
 *
 * @description
 * The time recorded on the open task and its running timer.
 */
interface TaskTimeState {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Key of the task the entries were read for.
   *
   * @type {string | null}
   * @readonly
   */
  readonly key: string | null;

  /**
   * Property log
   *
   * @description
   * The entries and their total, null until read.
   *
   * @type {TaskTimeLog | null}
   * @readonly
   */
  readonly log: TaskTimeLog | null;

  /**
   * Property failed
   *
   * @description
   * Whether reading the entries failed.
   *
   * @type {boolean}
   * @readonly
   */
  readonly failed: boolean;

  /**
   * Property pending
   *
   * @description
   * Whether an entry is being recorded.
   *
   * @type {boolean}
   * @readonly
   */
  readonly pending: boolean;

  /**
   * Property timerStartedAt
   *
   * @description
   * When the timer of the task started (epoch milliseconds), or null.
   *
   * @type {number | null}
   * @readonly
   */
  readonly timerStartedAt: number | null;

  /**
   * Property timerStop
   *
   * @description
   * The timer stop the gateway has not confirmed (its entry and key, frozen at the first stop and
   * kept in the device storage so that stopping again, even after a reopen, sends the same entry
   * under the same key), or null.
   *
   * @type {TaskTimerStop | null}
   * @readonly
   */
  readonly timerStop: TaskTimerStop | null;
  // #endregion
}

/**
 * Interface TaskTimeStoreInstance
 *
 * @description
 * Public API of `TaskTimeStore`.
 */
export interface TaskTimeStoreInstance {
  // #region Properties
  /**
   * Property log
   *
   * @description
   * The entries and their total, null until read.
   *
   * @type {Signal<TaskTimeLog | null>}
   * @readonly
   */
  readonly log: Signal<TaskTimeLog | null>;

  /**
   * Property failed
   *
   * @description
   * Whether reading the entries failed (`Retry` calls `reload`).
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly failed: Signal<boolean>;

  /**
   * Property pending
   *
   * @description
   * Whether an entry is being recorded.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly pending: Signal<boolean>;

  /**
   * Property timerStartedAt
   *
   * @description
   * When the task's timer started (epoch milliseconds), or null when it is stopped.
   *
   * @type {Signal<number | null>}
   * @readonly
   */
  readonly timerStartedAt: Signal<number | null>;

  /**
   * Property totalMinutes
   *
   * @description
   * Minutes recorded on the task (0 until read).
   *
   * @type {Signal<number>}
   * @readonly
   */
  readonly totalMinutes: Signal<number>;
  // #endregion

  // #region Methods
  /**
   * Method reload
   *
   * @description
   * Reads the entries again.
   *
   * @returns {Promise<void>} Resolves once read.
   */
  reload(): Promise<void>;

  /**
   * Method add
   *
   * @description
   * Records time for today; the toast `{d} added to {key}` gives the new total (against the
   * estimate) and offers `Undo`, which deletes the entry from that task even once another task
   * is open. After a failure, recording the same entry again reuses its `Idempotency-Key`.
   *
   * @param {TaskTimeDraft} draft - Minutes and note; minutes are kept between 1 and 1,440.
   * @returns {Promise<boolean>} Whether it was recorded.
   */
  add(draft: TaskTimeDraft): Promise<boolean>;

  /**
   * Method remove
   *
   * @description
   * Deletes an entry at once (the caller confirmed it); a refusal puts it back. The toast
   * `Entry deleted` offers `Undo`, which records the same time, day and note again on that task,
   * even once another task is open (the shown entries change only while it is still open).
   *
   * @param {TaskTimeEntry} entry - The entry.
   * @returns {Promise<boolean>} Whether it was deleted.
   */
  remove(entry: TaskTimeEntry): Promise<boolean>;

  /**
   * Method startTimer
   *
   * @description
   * Starts the task's timer on this device (kept across reloads in the device storage).
   */
  startTimer(): void;

  /**
   * Method stopTimer
   *
   * @description
   * Records the elapsed time rounded to the minute, one minute at least, with the note `Timer`,
   * and stops the timer once the gateway confirms the entry. A refused write keeps the timer
   * running; stopping again sends the entry of the first stop under the same `Idempotency-Key`.
   *
   * @param {number} now - The current instant (epoch milliseconds).
   * @returns {Promise<boolean>} Whether the time was recorded.
   */
  stopTimer(now: number): Promise<boolean>;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * Nothing read, no timer.
 *
 * @type {TaskTimeState}
 */
const initialState: TaskTimeState = {
  key: null,
  log: null,
  failed: false,
  pending: false,
  timerStartedAt: null,
  timerStop: null,
};

/**
 * Function createTaskTimeStore
 *
 * @description
 * Builds the time store of the properties panel.
 *
 * @returns {Type<TaskTimeStoreInstance>} Injectable store constructor.
 */
function createTaskTimeStore(): Type<TaskTimeStoreInstance> {
  return signalStore(
    withState(initialState),
    withProps(() => ({
      _detail: inject(TaskDetailStore),
      _api: inject(TaskTimeApi),
      _toasts: inject(CwToastService),
      _workspace: inject(WORKSPACE_CONTEXT),
      _storage: ((): Storage | null => {
        try {
          return inject(DOCUMENT).defaultView?.localStorage ?? null;
        } catch {
          return null;
        }
      })(),
    })),
    withComputed((store) => ({
      totalMinutes: computed((): number => store.log()?.totalMinutes ?? 0),
    })),
    withMethods((store) => {
      const current: (key: string) => boolean = (key: string): boolean =>
        store._detail.taskKey() === key && store.key() === key;

      const storageKey: (key: string) => string = (key: string): string =>
        `${TIMER_STORAGE_PREFIX}.${store._workspace.organization().id}.${key}`;

      const readTimer: (key: string) => number | null = (key: string): number | null => {
        try {
          const value: string | null = store._storage?.getItem(storageKey(key)) ?? null;
          const startedAt: number = Number(value);
          return value !== null && Number.isFinite(startedAt) && startedAt > 0 ? startedAt : null;
        } catch {
          return null;
        }
      };

      const writeTimer: (key: string, startedAt: number | null) => void = (
        key: string,
        startedAt: number | null,
      ): void => {
        try {
          if (startedAt === null) store._storage?.removeItem(storageKey(key));
          else store._storage?.setItem(storageKey(key), String(startedAt));
        } catch {
          return;
        }
      };

      const readStop: (key: string, startedAt: number | null) => TaskTimerStop | null = (
        key: string,
        startedAt: number | null,
      ): TaskTimerStop | null => {
        if (startedAt === null) return null;
        try {
          const value: string | null =
            store._storage?.getItem(`${storageKey(key)}.${TIMER_STOP_SUFFIX}`) ?? null;
          const stop: Partial<TaskTimerStop> | null =
            value === null ? null : (JSON.parse(value) as Partial<TaskTimerStop>);
          const valid: boolean =
            stop?.startedAt === startedAt &&
            typeof stop.minutes === 'number' &&
            typeof stop.workDate === 'string' &&
            typeof stop.note === 'string' &&
            typeof stop.idempotencyKey === 'string';
          return valid ? (stop as TaskTimerStop) : null;
        } catch {
          return null;
        }
      };

      const writeStop: (key: string, stop: TaskTimerStop | null) => void = (
        key: string,
        stop: TaskTimerStop | null,
      ): void => {
        try {
          const name: string = `${storageKey(key)}.${TIMER_STOP_SUFFIX}`;
          if (stop === null) store._storage?.removeItem(name);
          else store._storage?.setItem(name, JSON.stringify(stop));
        } catch {
          return;
        }
      };

      const confirmedWrites: Map<string, number> = new Map<string, number>();

      const confirmWrite: (key: string) => void = (key: string): void => {
        confirmedWrites.set(key, (confirmedWrites.get(key) ?? 0) + 1);
      };

      const readLog: (key: string) => Promise<void> = async (key: string): Promise<void> => {
        patchState(store, { failed: false });
        try {
          for (let attempt: number = 1; attempt <= LOG_READ_ATTEMPTS; attempt++) {
            const before: number = confirmedWrites.get(key) ?? 0;
            const log: TaskTimeLog = await store._api.log(key);
            if (!current(key)) return;
            if ((confirmedWrites.get(key) ?? 0) === before) {
              patchState(store, { log, failed: false });
              return;
            }
          }
        } catch {
          if (current(key)) patchState(store, { failed: true });
        }
      };

      const failedToast: () => void = (): void => {
        store._toasts.error(
          $localize`:@@task.properties.time-failed:Could not change the time spent`,
          {
            description: $localize`:@@task.properties.failed-text:The server did not answer. Try again in a moment.`,
          },
        );
      };

      let attempt: TaskTimeAttempt | null = null;

      const attemptKey: (
        key: string,
        minutes: number,
        note: string,
        workDate: string,
      ) => TaskTimeAttempt = (
        key: string,
        minutes: number,
        note: string,
        workDate: string,
      ): TaskTimeAttempt => {
        const same: boolean =
          attempt?.taskKey === key &&
          attempt.minutes === minutes &&
          attempt.note === note &&
          attempt.workDate === workDate;
        if (!same || attempt === null) {
          attempt = { taskKey: key, minutes, note, workDate, idempotencyKey: crypto.randomUUID() };
        }
        return attempt;
      };

      const record: (
        key: string,
        draft: TaskTimeDraft,
        workDate: string,
        idempotencyKey?: string,
      ) => Promise<TaskTimeEntry | null> = async (
        key: string,
        draft: TaskTimeDraft,
        workDate: string,
        idempotencyKey?: string,
      ): Promise<TaskTimeEntry | null> => {
        const minutes: number = Math.min(MAX_ENTRY_MINUTES, Math.max(1, Math.round(draft.minutes)));
        const sent: TaskTimeAttempt | null =
          idempotencyKey === undefined ? attemptKey(key, minutes, draft.note, workDate) : null;
        if (current(key)) patchState(store, { pending: true });
        try {
          const entry: TaskTimeEntry = await store._api.record(
            key,
            { minutes, note: draft.note },
            workDate,
            idempotencyKey ?? sent?.idempotencyKey ?? crypto.randomUUID(),
          );
          if (sent !== null && attempt === sent) attempt = null;
          confirmWrite(key);
          if (!current(key)) return entry;
          const log: TaskTimeLog = store.log() ?? { entries: [], totalMinutes: 0 };
          patchState(store, {
            pending: false,
            log: {
              entries: [
                entry,
                ...log.entries.filter((item: TaskTimeEntry) => item.id !== entry.id),
              ],
              totalMinutes: log.totalMinutes + entry.minutes,
            },
          });
          return entry;
        } catch {
          if (current(key)) patchState(store, { pending: false });
          failedToast();
          return null;
        }
      };

      const erase: (key: string, entry: TaskTimeEntry) => Promise<boolean> = async (
        key: string,
        entry: TaskTimeEntry,
      ): Promise<boolean> => {
        const shown: boolean = current(key);
        const before: TaskTimeLog | null = shown ? store.log() : null;
        if (before) {
          patchState(store, {
            log: {
              entries: before.entries.filter((item: TaskTimeEntry) => item.id !== entry.id),
              totalMinutes: Math.max(0, before.totalMinutes - entry.minutes),
            },
          });
        }
        try {
          await store._api.remove(key, entry.id);
          confirmWrite(key);
          return true;
        } catch {
          if (before && current(key)) patchState(store, { log: before });
          failedToast();
          return false;
        }
      };

      const add: (
        key: string,
        draft: TaskTimeDraft,
        workDate: string,
        idempotencyKey?: string,
      ) => Promise<TaskTimeEntry | null> = async (
        key: string,
        draft: TaskTimeDraft,
        workDate: string,
        idempotencyKey?: string,
      ): Promise<TaskTimeEntry | null> => {
        const entry: TaskTimeEntry | null = await record(key, draft, workDate, idempotencyKey);
        if (!entry || !current(key)) return entry;
        const task: TaskDetailTask | null = store._detail.task();
        const total: string = formatMinutes(store.totalMinutes());
        const estimate: number | null = task?.estimateMinutes ?? null;
        store._toasts.show(
          $localize`:@@task.properties.time-added:${formatMinutes(entry.minutes)}:duration: added to ${key}:key:`,
          {
            description: estimate
              ? $localize`:@@task.properties.time-total-estimate:Total: ${total}:total: of ${formatMinutes(estimate)}:estimate: estimated`
              : $localize`:@@task.properties.time-total:Total: ${total}:total:`,
            undo: (): void => {
              void erase(key, entry);
            },
          },
        );
        return entry;
      };

      return {
        _load(key: string | null): void {
          if (key === store.key()) return;
          const startedAt: number | null = key ? readTimer(key) : null;
          patchState(store, {
            ...initialState,
            key,
            timerStartedAt: startedAt,
            timerStop: key ? readStop(key, startedAt) : null,
          });
          if (key !== null) void readLog(key);
        },

        async reload(): Promise<void> {
          const key: string | null = store.key();
          if (key !== null) await readLog(key);
        },

        async add(draft: TaskTimeDraft): Promise<boolean> {
          const key: string | null = store.key();
          if (key === null) return false;
          return (await add(key, draft, localDay(new Date()))) !== null;
        },

        async remove(entry: TaskTimeEntry): Promise<boolean> {
          const key: string | null = store.key();
          if (key === null) return false;
          const removed: boolean = await erase(key, entry);
          if (!removed) return false;
          store._toasts.show($localize`:@@task.properties.entry-deleted:Entry deleted`, {
            description: $localize`:@@task.properties.entry-deleted-text:${formatMinutes(entry.minutes)}:duration: removed from ${key}:key:`,
            undo: (): void => {
              void record(key, { minutes: entry.minutes, note: entry.note }, entry.workDate);
            },
          });
          return true;
        },

        startTimer(): void {
          const key: string | null = store.key();
          if (key === null || store.timerStartedAt() !== null) return;
          const startedAt: number = Date.now();
          writeTimer(key, startedAt);
          writeStop(key, null);
          patchState(store, { timerStartedAt: startedAt, timerStop: null });
        },

        async stopTimer(now: number): Promise<boolean> {
          const key: string | null = store.key();
          const startedAt: number | null = store.timerStartedAt();
          if (key === null || startedAt === null || store.pending()) return false;
          const stop: TaskTimerStop = store.timerStop() ??
            readStop(key, startedAt) ?? {
              startedAt,
              minutes: Math.min(
                MAX_ENTRY_MINUTES,
                Math.max(1, Math.round((now - startedAt) / 60_000)),
              ),
              workDate: localDay(new Date(now)),
              note: $localize`:@@task.properties.timer-note:Timer`,
              idempotencyKey: crypto.randomUUID(),
            };
          writeStop(key, stop);
          patchState(store, { timerStop: stop });
          const entry: TaskTimeEntry | null = await add(
            key,
            { minutes: stop.minutes, note: stop.note },
            stop.workDate,
            stop.idempotencyKey,
          );
          if (entry === null) return false;
          if (readTimer(key) === startedAt) {
            writeTimer(key, null);
            writeStop(key, null);
          }
          if (current(key) && store.timerStartedAt() === startedAt) {
            patchState(store, { timerStartedAt: null, timerStop: null });
          }
          return true;
        },
      };
    }),
    withMethods((store) => ({
      _follow: signalMethod<string | null>((key: string | null): void => {
        store._load(key);
      }),
    })),
    withHooks({
      onInit(store): void {
        store._follow(
          computed((): string | null => (store._detail.ready() ? store._detail.taskKey() : null)),
        );
      },
    }),
  );
}

/**
 * Constant TaskTimeStore
 *
 * @description
 * The time spent on the open task, provided by the properties panel: its entries (newest first)
 * and total, an entry recorded for today with an `Idempotency-Key` and a toast whose `Undo`
 * deletes it, an entry deleted with a toast whose `Undo` records it again (a new entry: the API
 * has no restore), and the timer. The API keeps no running timer, so the start instant lives in
 * the device storage per organization and task (`TIMER_STORAGE_PREFIX`), read when the task
 * opens; a storage the browser refuses leaves the timer in memory only. Stopping records the
 * elapsed minutes, one at least, with the note `Timer`, and clears the timer only once the entry
 * is confirmed (the stop sent, its entry and key, waits in the device storage next to the start,
 * so stopping again after a reopen or a reload sends the same entry under the same key); a read
 * of the entries that began before a confirmed write is dropped and made again; a write sent again after a failure reuses its `Idempotency-Key`. `Undo` acts on
 * the task its toast names, whichever task is open by then. It follows the open task of
 * `TaskDetailStore`. Recording time does not change the task version.
 *
 * @type {Type<TaskTimeStoreInstance>}
 */
export const TaskTimeStore: Type<TaskTimeStoreInstance> = createTaskTimeStore();
