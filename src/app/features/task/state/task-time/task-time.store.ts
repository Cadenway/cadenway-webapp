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
   * estimate) and offers `Undo`, which deletes the entry.
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
   * `Entry deleted` offers `Undo`, which records the same time, day and note again.
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
   * Stops the timer and records the elapsed time rounded to the minute, one minute at least,
   * with the note `Timer`.
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

      const readLog: (key: string) => Promise<void> = async (key: string): Promise<void> => {
        patchState(store, { failed: false });
        try {
          const log: TaskTimeLog = await store._api.log(key);
          if (current(key)) patchState(store, { log, failed: false });
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

      const record: (
        key: string,
        draft: TaskTimeDraft,
        workDate: string,
      ) => Promise<TaskTimeEntry | null> = async (
        key: string,
        draft: TaskTimeDraft,
        workDate: string,
      ): Promise<TaskTimeEntry | null> => {
        const minutes: number = Math.min(MAX_ENTRY_MINUTES, Math.max(1, Math.round(draft.minutes)));
        patchState(store, { pending: true });
        try {
          const entry: TaskTimeEntry = await store._api.record(
            key,
            { minutes, note: draft.note },
            workDate,
            crypto.randomUUID(),
          );
          if (!current(key)) return null;
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
          if (!current(key)) return null;
          patchState(store, { pending: false });
          failedToast();
          return null;
        }
      };

      const erase: (key: string, entry: TaskTimeEntry) => Promise<boolean> = async (
        key: string,
        entry: TaskTimeEntry,
      ): Promise<boolean> => {
        const before: TaskTimeLog | null = store.log();
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
          return true;
        } catch {
          if (!current(key)) return false;
          patchState(store, { log: before });
          failedToast();
          return false;
        }
      };

      const add: (draft: TaskTimeDraft) => Promise<boolean> = async (
        draft: TaskTimeDraft,
      ): Promise<boolean> => {
        const key: string | null = store.key();
        if (key === null) return false;
        const entry: TaskTimeEntry | null = await record(key, draft, localDay(new Date()));
        if (!entry) return false;
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
              if (current(key)) void erase(key, entry);
            },
          },
        );
        return true;
      };

      return {
        _load(key: string | null): void {
          if (key === store.key()) return;
          patchState(store, { ...initialState, key, timerStartedAt: key ? readTimer(key) : null });
          if (key !== null) void readLog(key);
        },

        async reload(): Promise<void> {
          const key: string | null = store.key();
          if (key !== null) await readLog(key);
        },

        add,

        async remove(entry: TaskTimeEntry): Promise<boolean> {
          const key: string | null = store.key();
          if (key === null) return false;
          const removed: boolean = await erase(key, entry);
          if (!removed) return false;
          store._toasts.show($localize`:@@task.properties.entry-deleted:Entry deleted`, {
            description: $localize`:@@task.properties.entry-deleted-text:${formatMinutes(entry.minutes)}:duration: removed from ${key}:key:`,
            undo: (): void => {
              if (current(key)) {
                void record(key, { minutes: entry.minutes, note: entry.note }, entry.workDate);
              }
            },
          });
          return true;
        },

        startTimer(): void {
          const key: string | null = store.key();
          if (key === null || store.timerStartedAt() !== null) return;
          const startedAt: number = Date.now();
          writeTimer(key, startedAt);
          patchState(store, { timerStartedAt: startedAt });
        },

        async stopTimer(now: number): Promise<boolean> {
          const key: string | null = store.key();
          const startedAt: number | null = store.timerStartedAt();
          if (key === null || startedAt === null) return false;
          writeTimer(key, null);
          patchState(store, { timerStartedAt: null });
          const minutes: number = Math.max(1, Math.round((now - startedAt) / 60_000));
          return add({
            minutes,
            note: $localize`:@@task.properties.timer-note:Timer`,
          });
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
 * elapsed minutes, one at least, with the note `Timer`. It follows the open task of
 * `TaskDetailStore`. Recording time does not change the task version.
 *
 * @type {Type<TaskTimeStoreInstance>}
 */
export const TaskTimeStore: Type<TaskTimeStoreInstance> = createTaskTimeStore();
