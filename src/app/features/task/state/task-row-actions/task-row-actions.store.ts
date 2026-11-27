import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, LOCALE_ID, type Signal, type Type } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { PriorityKey, StatusKey } from '@cadenway/contracts';
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
import { map, merge, type Observable, Subject } from 'rxjs';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { PRIORITY_LABELS } from '../../constants/task-copy/task-copy.constants';
import { TaskActionsApi } from '../../data-access/services/task-actions-api/task-actions-api.service';
import type { Person } from '../../models/person/person.interface';
import type {
  TaskBulkAction,
  TaskBulkEntry,
  TaskBulkOutcome,
} from '../../models/task-bulk/task-bulk.interface';
import type { TaskMoveTarget } from '../../models/task-move-target/task-move-target.interface';
import type { TaskCancellation } from '../../models/task-status-change/task-status-change.interface';
import type { TaskSummary } from '../../models/task-summary/task-summary.interface';
import { TaskDetailOpener } from '../../services/task-detail-opener/task-detail-opener.service';
import {
  type TaskLaneRead,
  type TaskRowWriteLaneInstance,
  TaskRowWriteLaneStore,
} from '../task-row-write-lane/task-row-write-lane.store';
import {
  type TaskStatusChangesInstance,
  TaskStatusChangesStore,
} from '../task-status-changes/task-status-changes.store';

/**
 * Constant REMINDER_HOUR
 *
 * @description
 * Hour of `Remind me tomorrow morning`, in the caller's time zone (`REM_PRESETS` of `App.dc.html`).
 *
 * @type {number}
 */
const REMINDER_HOUR: number = 9;

/**
 * Constant ROW_RECONCILE_DELAYS_MS
 *
 * @description
 * Waits, in milliseconds, before each read of a task whose write has no certain outcome, so a
 * request still running on the server has time to commit first (as Spaces' `RECONCILE_DELAY_MS`,
 * doubling). The task's next writes wait meanwhile; a read past the version sent settles the
 * write, and once the reads are spent with the task still at that version, the write is taken as
 * not applied: the next write goes at that version, so a late commit makes it refused and read
 * again rather than overwritten.
 *
 * @type {readonly number[]}
 */
export const ROW_RECONCILE_DELAYS_MS: readonly number[] = [2_000, 4_000, 8_000];

/**
 * Type RowFields
 *
 * @description
 * The fields of a task the menu's writes show at once, before the page reads the task again.
 *
 * @type {Partial<Pick<TaskSummary, 'priority' | 'assigneeIds' | 'listId'>>}
 */
type RowFields = Partial<Pick<TaskSummary, 'priority' | 'assigneeIds' | 'listId'>>;

/**
 * Interface ConfirmedFields
 *
 * @description
 * Values of a task the gateway confirmed (a write's answer or a read), shown over a copy of the
 * page older than their version.
 */
interface ConfirmedFields {
  // #region Properties
  /**
   * Property fields
   *
   * @description
   * The confirmed values.
   *
   * @type {RowFields}
   * @readonly
   */
  readonly fields: RowFields;

  /**
   * Property until
   *
   * @description
   * The version they were confirmed at; a page copy at this version or later replaces them.
   *
   * @type {number}
   * @readonly
   */
  readonly until: number;
  // #endregion
}

/**
 * Interface PendingFields
 *
 * @description
 * The values of one write still waiting for a certain outcome.
 */
interface PendingFields {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id of the write, so its settlement drops only its own values.
   *
   * @type {number}
   * @readonly
   */
  readonly id: number;

  /**
   * Property fields
   *
   * @description
   * The written values.
   *
   * @type {RowFields}
   * @readonly
   */
  readonly fields: RowFields;
  // #endregion
}

/**
 * Type WriteKind
 *
 * @description
 * How a write settles: `versioned` sets a target state (priority, assignee, list) whose returned
 * version is adopted; `trash` removes the task; `copy` creates another task and never holds its
 * source.
 *
 * @type {'versioned' | 'trash' | 'copy'}
 */
type WriteKind = 'versioned' | 'trash' | 'copy';

/**
 * Type Settlement
 *
 * @description
 * How a write of the menu ended: applied (with the gateway's entry, the version it was sent at
 * and the task as confirmed when it started), refused (`conflict` when a read found the task
 * past the version sent), settled by a read after an uncertain answer, or not sent.
 *
 * @type {object}
 */
type Settlement =
  | {
      readonly kind: 'applied';
      readonly entry: TaskBulkEntry;
      readonly outcome: TaskBulkOutcome;
      readonly sent: number;
      readonly before: TaskSummary;
    }
  | { readonly kind: 'refused'; readonly conflict: boolean }
  | { readonly kind: 'read-back'; readonly applied: boolean }
  | { readonly kind: 'uncertain' }
  | { readonly kind: 'not-sent' };

/**
 * Interface RowToast
 *
 * @description
 * The toast of an applied write and what its `Undo` or `Open` does.
 */
interface RowToast {
  // #region Properties
  /**
   * Property title
   *
   * @description
   * Title of the toast.
   *
   * @type {string}
   * @readonly
   */
  readonly title: string;

  /**
   * Property description
   *
   * @description
   * Second line of the toast.
   *
   * @type {string}
   * @readonly
   */
  readonly description: string;

  /**
   * Property undo
   *
   * @description
   * Puts back what the write changed, or null when it cannot be undone.
   *
   * @type {(() => void) | null}
   * @readonly
   */
  readonly undo: (() => void) | null;

  /**
   * Property open
   *
   * @description
   * Key of the copy the toast's `Open` opens instead of an `Undo`.
   *
   * @type {string | null | undefined}
   * @readonly
   */
  readonly open?: string | null;
  // #endregion
}

/**
 * Interface RowWrite
 *
 * @description
 * One write of the menu: the action, the values it shows at once and its toast.
 */
interface RowWrite {
  // #region Properties
  /**
   * Property kind
   *
   * @description
   * How the write settles.
   *
   * @type {WriteKind}
   * @readonly
   */
  readonly kind: WriteKind;

  /**
   * Property action
   *
   * @description
   * The action sent through `TaskActionsApi.bulk`.
   *
   * @type {TaskBulkAction}
   * @readonly
   */
  readonly action: TaskBulkAction;

  /**
   * Property fields
   *
   * @description
   * The values shown at once; dropped when the write is refused or not applied.
   *
   * @type {RowFields}
   * @readonly
   */
  readonly fields: RowFields;

  /**
   * Property expected
   *
   * @description
   * The version an `Undo` must still find the task at; absent to send at the newest known one.
   *
   * @type {number | undefined}
   * @readonly
   */
  readonly expected?: number;

  /**
   * Property toast
   *
   * @description
   * Builds the toast of the applied write; `undoable` tells whether the write was the task's only
   * change (returned version = sent + 1). Null for no toast (an `Undo`).
   *
   * @type {((applied: AppliedWrite) => RowToast) | null}
   * @readonly
   */
  readonly toast: ((applied: AppliedWrite) => RowToast) | null;

  /**
   * Property failure
   *
   * @description
   * Title of the toast of a refused write.
   *
   * @type {string}
   * @readonly
   */
  readonly failure: string;
  // #endregion
}

/**
 * Interface AppliedWrite
 *
 * @description
 * What a toast builder learns of an applied write.
 */
interface AppliedWrite {
  // #region Properties
  /**
   * Property entry
   *
   * @description
   * The gateway's entry for the task.
   *
   * @type {TaskBulkEntry}
   * @readonly
   */
  readonly entry: TaskBulkEntry;

  /**
   * Property outcome
   *
   * @description
   * The whole outcome (`affected` counts the subtasks of a deletion).
   *
   * @type {TaskBulkOutcome}
   * @readonly
   */
  readonly outcome: TaskBulkOutcome;

  /**
   * Property before
   *
   * @description
   * The task as confirmed when the write started: what an `Undo` puts back.
   *
   * @type {TaskSummary}
   * @readonly
   */
  readonly before: TaskSummary;

  /**
   * Property undoable
   *
   * @description
   * Whether an `Undo` is offered: the returned version follows the one sent (sent + 1).
   *
   * @type {boolean}
   * @readonly
   */
  readonly undoable: boolean;

  /**
   * Property organizationId
   *
   * @description
   * Organization the write was sent in; its `Undo` and `Open` do nothing in another.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;
  // #endregion
}

/**
 * Interface TaskRowActionsState
 *
 * @description
 * The deletion confirmation, the values shown over the page's copies and the deleted tasks.
 */
interface TaskRowActionsState {
  // #region Properties
  /**
   * Property deleteOpen
   *
   * @description
   * Whether the deletion confirmation is open.
   *
   * @type {boolean}
   * @readonly
   */
  readonly deleteOpen: boolean;

  /**
   * Property deleting
   *
   * @description
   * Whether the confirmed deletion is being sent.
   *
   * @type {boolean}
   * @readonly
   */
  readonly deleting: boolean;

  /**
   * Property _deleteTask
   *
   * @description
   * The task the confirmation asks about.
   *
   * @type {TaskSummary | null}
   * @readonly
   */
  readonly _deleteTask: TaskSummary | null;

  /**
   * Property _confirmed
   *
   * @description
   * Confirmed values by task key, with the version they hold until.
   *
   * @type {Readonly<Partial<Record<string, ConfirmedFields>>>}
   * @readonly
   */
  readonly _confirmed: Readonly<Partial<Record<string, ConfirmedFields>>>;

  /**
   * Property _pending
   *
   * @description
   * The values of the writes still waiting, by task key, oldest first.
   *
   * @type {Readonly<Partial<Record<string, readonly PendingFields[]>>>}
   * @readonly
   */
  readonly _pending: Readonly<Partial<Record<string, readonly PendingFields[]>>>;

  /**
   * Property _hidden
   *
   * @description
   * Keys of the tasks sent or moved to the trash, left out of the rows.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly _hidden: readonly string[];

  /**
   * Property _trashing
   *
   * @description
   * Keys of the hidden tasks whose deletion has no certain outcome yet: a page read never
   * releases them.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly _trashing: readonly string[];
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * Nothing written, the confirmation closed.
 *
 * @type {TaskRowActionsState}
 */
const initialState: TaskRowActionsState = {
  deleteOpen: false,
  deleting: false,
  _deleteTask: null,
  _confirmed: {},
  _pending: {},
  _hidden: [],
  _trashing: [],
};

/**
 * Function without
 *
 * @description
 * A record without one key.
 *
 * @param {Readonly<Partial<Record<string, T>>>} record - The record.
 * @param {string} key - The key to leave out.
 * @returns {Readonly<Partial<Record<string, T>>>} The record without it.
 */
function without<T>(
  record: Readonly<Partial<Record<string, T>>>,
  key: string,
): Readonly<Partial<Record<string, T>>> {
  return Object.fromEntries(
    Object.entries(record).filter(([other]: [string, unknown]): boolean => other !== key),
  );
}

/**
 * Function fieldsOf
 *
 * @description
 * The row fields of a task as read.
 *
 * @param {TaskSummary} task - The task.
 * @returns {RowFields} Its priority, assignees and list.
 */
function fieldsOf(task: TaskSummary): RowFields {
  return { priority: task.priority, assigneeIds: task.assigneeIds, listId: task.listId };
}

/**
 * Function holds
 *
 * @description
 * Whether a task read holds the values a write sets (assignees compared as sets).
 *
 * @param {TaskSummary} task - The task read.
 * @param {RowFields} fields - The written values.
 * @returns {boolean} Whether every value matches.
 */
function holds(task: TaskSummary, fields: RowFields): boolean {
  if (fields.priority !== undefined && task.priority !== fields.priority) return false;
  if (fields.listId !== undefined && task.listId !== fields.listId) return false;
  if (fields.assigneeIds !== undefined) {
    const read: ReadonlySet<string> = new Set(task.assigneeIds);
    return (
      read.size === fields.assigneeIds.length &&
      fields.assigneeIds.every((id: string): boolean => read.has(id))
    );
  }
  return true;
}

/**
 * Function pause
 *
 * @description
 * Resolves after a delay.
 *
 * @param {number} ms - The delay, in milliseconds.
 * @returns {Promise<void>} Resolves once it is spent.
 */
function pause(ms: number): Promise<void> {
  return new Promise<void>((resolve: () => void): void => {
    setTimeout(resolve, ms);
  });
}

/**
 * Interface TaskRowActionsStoreInstance
 *
 * @description
 * The writes of Task's `cw-task-menu` for rows that belong to no list page (Home, My tasks,
 * Dashboards).
 */
export interface TaskRowActionsStoreInstance {
  // #region Properties
  /**
   * Property changed
   *
   * @description
   * Emits the key of a task once one of its writes settled, applied, refused or uncertain, its
   * `Undo` and a restore included, and after each status write of the route's
   * `TaskStatusChangesStore`: the page reads its rows again.
   *
   * @type {Observable<string>}
   * @readonly
   */
  readonly changed: Observable<string>;

  /**
   * Property userId
   *
   * @description
   * The signed-in member, who reads `Name (me)` in the menu.
   *
   * @type {Signal<string>}
   * @readonly
   */
  readonly userId: Signal<string>;

  /**
   * Property cancelKeys
   *
   * @description
   * Keys the cancel reason dialog names while a `Cancelled` click waits for it, else null.
   *
   * @type {Signal<readonly string[] | null>}
   * @readonly
   */
  readonly cancelKeys: Signal<readonly string[] | null>;

  /**
   * Property deleteOpen
   *
   * @description
   * Whether the deletion confirmation is open.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly deleteOpen: Signal<boolean>;

  /**
   * Property deleting
   *
   * @description
   * Whether the confirmed deletion is being sent.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly deleting: Signal<boolean>;

  /**
   * Property deleteTitle
   *
   * @description
   * Title of the confirmation (`Delete “name”?`).
   *
   * @type {Signal<string>}
   * @readonly
   */
  readonly deleteTitle: Signal<string>;

  /**
   * Property deleteText
   *
   * @description
   * What the deletion does.
   *
   * @type {Signal<string>}
   * @readonly
   */
  readonly deleteText: Signal<string>;

  /**
   * Property deleteAction
   *
   * @description
   * The confirming action (`Delete the task`).
   *
   * @type {Signal<string>}
   * @readonly
   */
  readonly deleteAction: Signal<string>;

  /**
   * Property deleteItems
   *
   * @description
   * The task the confirmation lists (`CAD-482 · name`).
   *
   * @type {Signal<readonly string[]>}
   * @readonly
   */
  readonly deleteItems: Signal<readonly string[]>;
  // #endregion

  // #region Methods
  /**
   * Method sync
   *
   * @description
   * Follows the page's read of its tasks (a signal, or each read): drops the confirmed values a
   * copy at their version or later replaced, so they never come back, and shows again a deleted
   * task once a read no longer holds it (a restore made elsewhere then shows). A deletion
   * without a certain outcome stays hidden.
   *
   * @param {readonly TaskSummary[] | Signal<readonly TaskSummary[]>} tasks - The page's tasks.
   */
  sync(tasks: readonly TaskSummary[] | Signal<readonly TaskSummary[]>): void;

  /**
   * Method rows
   *
   * @description
   * The page's tasks as the writes show them: without the deleted tasks, each with the values its
   * writes set. Reactive.
   *
   * @param {readonly TaskSummary[]} tasks - The tasks as the page read them.
   * @returns {readonly TaskSummary[]} The rows to draw.
   */
  rows(tasks: readonly TaskSummary[]): readonly TaskSummary[];

  /**
   * Method displayedTask
   *
   * @description
   * One task as the writes show it (its status apart: `displayedStatus`): the confirmed values
   * over a copy older than them, then the values of the writes still waiting. Reactive.
   *
   * @param {TaskSummary} task - The page's copy.
   * @returns {TaskSummary} The task to draw.
   */
  displayedTask(task: TaskSummary): TaskSummary;

  /**
   * Method displayedStatus
   *
   * @description
   * The status the line and the menu show, a pending click included.
   *
   * @param {TaskSummary} task - The page's copy.
   * @returns {StatusKey} The status.
   */
  displayedStatus(task: TaskSummary): StatusKey;

  /**
   * Method open
   *
   * @description
   * Opens the task's detail over the page (`?task=<KEY>`), the line as the header's preview.
   *
   * @param {TaskSummary} task - The task.
   */
  open(task: TaskSummary): void;

  /**
   * Method setStatus
   *
   * @description
   * `Status` of the menu, through the route's `TaskStatusChangesStore` and the shared lane: shown
   * at once, sent 460 ms after the last click with its toast and `Undo`; `Cancelled` asks the
   * reason first (`cancelKeys`).
   *
   * @param {TaskSummary} task - The task.
   * @param {StatusKey} status - The status.
   */
  setStatus(task: TaskSummary, status: StatusKey): void;

  /**
   * Method confirmCancel
   *
   * @description
   * `Cancel the task` of the cancel reason dialog.
   *
   * @param {TaskCancellation} cancellation - Reason and note.
   */
  confirmCancel(cancellation: TaskCancellation): void;

  /**
   * Method keepCancel
   *
   * @description
   * `Keep the task`: closes the dialog without a change.
   */
  keepCancel(): void;

  /**
   * Method setPriority
   *
   * @description
   * `Priority` of the menu.
   *
   * @param {TaskSummary} task - The task.
   * @param {PriorityKey} priority - The priority.
   * @returns {Promise<void>} Resolves once settled.
   */
  setPriority(task: TaskSummary, priority: PriorityKey): Promise<void>;

  /**
   * Method toggleAssignee
   *
   * @description
   * `Assign` of the menu: assigns the person, or removes them when the task has them.
   *
   * @param {TaskSummary} task - The task.
   * @param {Person} person - The person.
   * @returns {Promise<void>} Resolves once settled.
   */
  toggleAssignee(task: TaskSummary, person: Person): Promise<void>;

  /**
   * Method moveTo
   *
   * @description
   * `Move to` of the menu.
   *
   * @param {TaskSummary} task - The task.
   * @param {TaskMoveTarget} target - The destination list.
   * @returns {Promise<void>} Resolves once settled.
   */
  moveTo(task: TaskSummary, target: TaskMoveTarget): Promise<void>;

  /**
   * Method remind
   *
   * @description
   * `Remind me tomorrow morning`: the caller's reminder tomorrow at 9, after the task's earlier
   * writes, never sent once the organization changed.
   *
   * @param {TaskSummary} task - The task.
   * @returns {Promise<void>} Resolves once reported.
   */
  remind(task: TaskSummary): Promise<void>;

  /**
   * Method duplicate
   *
   * @description
   * `Duplicate`: the toast names the copy and `Open` opens it.
   *
   * @param {TaskSummary} task - The task.
   * @returns {Promise<void>} Resolves once reported.
   */
  duplicate(task: TaskSummary): Promise<void>;

  /**
   * Method copyLink
   *
   * @description
   * `Copy the link`: the shareable address of the task (`<origin>/<slug>/t/<KEY>`).
   *
   * @param {TaskSummary} task - The task.
   * @returns {Promise<void>} Resolves once reported.
   */
  copyLink(task: TaskSummary): Promise<void>;

  /**
   * Method copyKey
   *
   * @description
   * `Copy the identifier`: the key of the task.
   *
   * @param {TaskSummary} task - The task.
   * @returns {Promise<void>} Resolves once reported.
   */
  copyKey(task: TaskSummary): Promise<void>;

  /**
   * Method askDelete
   *
   * @description
   * `Delete the task`: opens the confirmation.
   *
   * @param {TaskSummary} task - The task.
   */
  askDelete(task: TaskSummary): void;

  /**
   * Method setDeleteOpen
   *
   * @description
   * Follows the confirmation's `open` (its `Cancel` and Escape close it).
   *
   * @param {boolean} open - Whether it is open.
   */
  setDeleteOpen(open: boolean): void;

  /**
   * Method trash
   *
   * @description
   * Moves the confirmed task to the trash with its subtasks; the toast counts them and `Undo`
   * restores the trash entry.
   *
   * @returns {Promise<void>} Resolves once reported.
   */
  trash(): Promise<void>;
  // #endregion
}

/**
 * Function createTaskRowActionsStore
 *
 * @description
 * Creates the store of the menu's writes for rows outside a list.
 *
 * @returns {Type<TaskRowActionsStoreInstance>} Injectable store constructor.
 */
function createTaskRowActionsStore(): Type<TaskRowActionsStoreInstance> {
  return signalStore(
    withState(initialState),
    withProps(() => {
      const changes: Subject<string> = new Subject<string>();
      const statuses: TaskStatusChangesInstance = inject(TaskStatusChangesStore);
      inject(DestroyRef).onDestroy((): void => {
        changes.complete();
      });
      return {
        _changes: changes,
        _statuses: statuses,
        changed: merge(
          changes.asObservable(),
          statuses.completed.pipe(map(({ task }: { task: TaskSummary }): string => task.key)),
        ),
        _lane: inject<TaskRowWriteLaneInstance>(TaskRowWriteLaneStore),
        _api: inject(TaskActionsApi),
        _workspace: inject<WorkspaceContextPort>(WORKSPACE_CONTEXT),
        _toasts: inject(CwToastService),
        _taskDetail: inject(TaskDetailOpener),
        _document: inject(DOCUMENT),
        _locale: inject(LOCALE_ID),
        _destroyRef: inject(DestroyRef),
        _shownToasts: new Set<string>(),
        _writeIds: { next: 0 },
      };
    }),
    withComputed((store) => ({
      userId: (): string => store._workspace.user().id,
      cancelKeys: (): readonly string[] | null => store._statuses.cancelRequest()?.taskKeys ?? null,
      deleteTitle: (): string => {
        const name: string = store._deleteTask()?.name ?? '';
        return $localize`:@@task.row-actions.delete-title:Delete “${name}:name:”?`;
      },
      deleteText: (): string =>
        $localize`:@@task.row-actions.delete-text:It goes to the trash with its subtasks, where it stays 30 days.`,
      deleteAction: (): string => $localize`:@@task.row-actions.delete-action:Delete the task`,
      deleteItems: (): readonly string[] => {
        const task: TaskSummary | null = store._deleteTask();
        return task ? [`${task.key} · ${task.name}`] : [];
      },
    })),
    withMethods((store) => {
      const toasts: CwToastService = store._toasts;
      const lane: TaskRowWriteLaneInstance = store._lane;
      const organization: () => string = (): string => store._workspace.organization().id;
      const failure: string = $localize`:@@task.row-actions.failed:The task could not be changed`;
      const undoFailure: string = $localize`:@@task.row-actions.undo-failed:The change could not be undone`;

      const keepToast: (id: string) => void = (id: string): void => {
        const shown: ReadonlySet<string> = new Set(
          toasts.toasts().map((item: { readonly id: string }): string => item.id),
        );
        for (const kept of store._shownToasts)
          if (!shown.has(kept)) store._shownToasts.delete(kept);
        store._shownToasts.add(id);
      };

      const confirmedTask: (task: TaskSummary) => TaskSummary = (
        task: TaskSummary,
      ): TaskSummary => {
        const confirmed: ConfirmedFields | undefined = store._confirmed()[task.key];
        return confirmed && task.version < confirmed.until
          ? { ...task, ...confirmed.fields }
          : task;
      };

      const displayedTask: (task: TaskSummary) => TaskSummary = (
        task: TaskSummary,
      ): TaskSummary => {
        const pending: readonly PendingFields[] = store._pending()[task.key] ?? [];
        return pending.reduce(
          (shown: TaskSummary, write: PendingFields): TaskSummary => ({
            ...shown,
            ...write.fields,
          }),
          confirmedTask(task),
        );
      };

      const confirm: (key: string, fields: RowFields, until: number) => void = (
        key: string,
        fields: RowFields,
        until: number,
      ): void => {
        patchState(store, (state: TaskRowActionsState) => {
          const current: ConfirmedFields | undefined = state._confirmed[key];
          if (current && current.until > until) return {};
          return {
            _confirmed: {
              ...state._confirmed,
              [key]: { fields: { ...(current?.fields ?? {}), ...fields }, until },
            },
          };
        });
      };

      const hide: (key: string, trashing: boolean) => void = (
        key: string,
        trashing: boolean,
      ): void => {
        patchState(store, (state: TaskRowActionsState) => ({
          _hidden: state._hidden.includes(key) ? state._hidden : [...state._hidden, key],
          _trashing: trashing
            ? [...state._trashing.filter((other: string) => other !== key), key]
            : state._trashing.filter((other: string) => other !== key),
        }));
      };

      const show: (key: string) => void = (key: string): void => {
        patchState(store, (state: TaskRowActionsState) => ({
          _hidden: state._hidden.filter((other: string): boolean => other !== key),
          _trashing: state._trashing.filter((other: string): boolean => other !== key),
        }));
      };

      const open: (key: string, task?: TaskSummary) => void = (
        key: string,
        task?: TaskSummary,
      ): void => {
        void store._taskDetail.open(
          key,
          task
            ? {
                key: task.key,
                name: task.name,
                status: store._statuses.displayedStatus(task),
                milestone: task.milestone,
              }
            : undefined,
        );
      };

      const showToast: (message: RowToast, organizationId: string) => void = (
        message: RowToast,
        organizationId: string,
      ): void => {
        const copy: string | null = message.open ?? null;
        const undo: (() => void) | null = message.undo;
        const id: string = toasts.show(message.title, {
          description: message.description,
          ...(copy
            ? {
                action: {
                  label: $localize`:@@task.row-actions.open:Open`,
                  run: (): void => {
                    if (organization() === organizationId) open(copy);
                  },
                },
              }
            : undo
              ? { undo }
              : {}),
        });
        if (copy || undo) keepToast(id);
      };

      const settleUncertain: (
        key: string,
        write: RowWrite,
        sent: number,
        organizationId: string,
      ) => Promise<Settlement> = async (
        key: string,
        write: RowWrite,
        sent: number,
        organizationId: string,
      ): Promise<Settlement> => {
        for (const delay of ROW_RECONCILE_DELAYS_MS) {
          await pause(delay);
          if (organization() !== organizationId) return { kind: 'not-sent' };
          const read: TaskLaneRead = await lane.reconcile(key);
          if (read.kind === 'gone') return { kind: 'read-back', applied: write.kind === 'trash' };
          if (read.kind === 'read' && read.task.version > sent) {
            return {
              kind: 'read-back',
              applied: write.kind === 'versioned' && holds(read.task, write.fields),
            };
          }
        }
        return { kind: 'read-back', applied: false };
      };

      const send: (
        task: TaskSummary,
        write: RowWrite,
        version: number,
        organizationId: string,
      ) => Promise<Settlement> = async (
        task: TaskSummary,
        write: RowWrite,
        version: number,
        organizationId: string,
      ): Promise<Settlement> => {
        const key: string = task.key;
        if (organization() !== organizationId) return { kind: 'not-sent' };
        const sent: number = write.expected ?? version;
        const before: TaskSummary = confirmedTask(task);
        const outcome: TaskBulkOutcome = await store._api.bulk(
          [{ taskKey: key, version: sent }],
          write.action,
          (): boolean => organization() === organizationId,
        );
        if (outcome.notSent.length > 0) return { kind: 'not-sent' };
        if (outcome.done.length > 0) {
          const entry: TaskBulkEntry = outcome.done[0];
          if (write.kind === 'versioned') {
            if (entry.version === null) {
              await lane.reconcile(key);
            } else {
              confirm(key, write.fields, entry.version);
              lane.acceptVersion(entry.version, write.fields, key);
            }
          }
          return { kind: 'applied', entry, outcome, sent, before };
        }
        if (outcome.unknown.length > 0) {
          if (organization() === organizationId) {
            toasts.warning(
              $localize`:@@task.row-actions.unknown:The outcome is unknown. The task is being refreshed.`,
            );
          }
          if (write.kind === 'copy') return { kind: 'uncertain' };
          return settleUncertain(key, write, sent, organizationId);
        }
        const read: TaskLaneRead = await lane.reconcile(key);
        return { kind: 'refused', conflict: read.kind === 'read' && read.task.version > sent };
      };

      const perform: (task: TaskSummary, write: RowWrite) => Promise<Settlement> = async (
        task: TaskSummary,
        write: RowWrite,
      ): Promise<Settlement> => {
        const key: string = task.key;
        const organizationId: string = organization();
        const id: number = ++store._writeIds.next;
        patchState(store, (state: TaskRowActionsState) => ({
          _pending: {
            ...state._pending,
            [key]: [...(state._pending[key] ?? []), { id, fields: write.fields }],
          },
        }));
        let settlement: Settlement;
        try {
          settlement = await lane.write(
            key,
            (version: number): Promise<Settlement> => send(task, write, version, organizationId),
            task.version,
          );
        } catch {
          settlement = { kind: 'refused', conflict: false };
        }
        patchState(store, (state: TaskRowActionsState) => {
          const rest: readonly PendingFields[] = (state._pending[key] ?? []).filter(
            (pending: PendingFields): boolean => pending.id !== id,
          );
          return {
            _pending:
              rest.length > 0 ? { ...state._pending, [key]: rest } : without(state._pending, key),
          };
        });
        if (organization() !== organizationId || settlement.kind === 'not-sent') {
          return settlement;
        }
        store._changes.next(key);
        const live: boolean = !store._destroyRef.destroyed;
        switch (settlement.kind) {
          case 'applied': {
            if (!write.toast || !live) break;
            const { entry, outcome, sent, before }: Extract<Settlement, { kind: 'applied' }> =
              settlement;
            showToast(
              write.toast({
                entry,
                outcome,
                before,
                undoable: entry.version !== null && entry.version === sent + 1,
                organizationId,
              }),
              organizationId,
            );
            break;
          }
          case 'refused':
            if (settlement.conflict) {
              toasts.warning(
                $localize`:@@task.row-actions.conflict:${key}:key: changed elsewhere`,
                {
                  description: $localize`:@@task.row-actions.conflict-text:Its latest version is shown.`,
                },
              );
            } else {
              toasts.error(write.failure);
            }
            break;
          case 'read-back':
            if (!settlement.applied) toasts.error(write.failure);
            break;
          case 'uncertain':
            break;
        }
        return settlement;
      };

      const reverse: (
        task: TaskSummary,
        applied: AppliedWrite,
        action: TaskBulkAction,
        fields: RowFields,
      ) => void = (
        task: TaskSummary,
        applied: AppliedWrite,
        action: TaskBulkAction,
        fields: RowFields,
      ): void => {
        if (organization() !== applied.organizationId || applied.entry.version === null) return;
        void perform(task, {
          kind: 'versioned',
          action,
          fields,
          expected: applied.entry.version,
          toast: null,
          failure: undoFailure,
        });
      };

      const copy: (text: string, title: string) => Promise<void> = async (
        text: string,
        title: string,
      ): Promise<void> => {
        try {
          await store._document.defaultView?.navigator.clipboard.writeText(text);
          toasts.show(title, { description: text });
        } catch {
          toasts.error($localize`:@@task.row-actions.copy-failed:Could not copy`, {
            description: text,
          });
        }
      };

      const restore: (
        task: TaskSummary,
        entryId: string,
        organizationId: string,
      ) => Promise<void> = async (
        task: TaskSummary,
        entryId: string,
        organizationId: string,
      ): Promise<void> => {
        const key: string = task.key;
        if (organization() !== organizationId) return;
        const restored: boolean | null = await lane
          .write(
            key,
            async (): Promise<boolean | null> => {
              if (organization() !== organizationId) return null;
              try {
                await store._api.restore(entryId);
              } catch {
                return false;
              }
              await lane.reconcile(key);
              return true;
            },
            task.version,
          )
          .catch((): boolean => false);
        if (restored === null || organization() !== organizationId) return;
        show(key);
        store._changes.next(key);
        if (!restored) {
          toasts.error(
            $localize`:@@task.row-actions.restore-failed:The task could not be restored`,
          );
        }
      };

      const sync: (tasks: readonly TaskSummary[] | Signal<readonly TaskSummary[]>) => void =
        signalMethod<readonly TaskSummary[]>((tasks: readonly TaskSummary[]): void => {
          const read: ReadonlyMap<string, TaskSummary> = new Map(
            tasks.map((task: TaskSummary): [string, TaskSummary] => [task.key, task]),
          );
          patchState(store, (state: TaskRowActionsState) => ({
            _confirmed: Object.fromEntries(
              Object.entries(state._confirmed).filter(
                ([key, confirmed]: [string, ConfirmedFields | undefined]): boolean => {
                  const copyOf: TaskSummary | undefined = read.get(key);
                  return !copyOf || !confirmed || copyOf.version < confirmed.until;
                },
              ),
            ),
            _hidden: state._hidden.filter(
              (key: string): boolean => state._trashing.includes(key) || read.has(key),
            ),
          }));
        });

      return {
        sync,
        rows(tasks: readonly TaskSummary[]): readonly TaskSummary[] {
          const hidden: ReadonlySet<string> = new Set(store._hidden());
          return tasks
            .filter((task: TaskSummary): boolean => !hidden.has(task.key))
            .map(displayedTask);
        },
        displayedTask,
        displayedStatus(task: TaskSummary): StatusKey {
          return store._statuses.displayedStatus(task);
        },
        open(task: TaskSummary): void {
          open(task.key, task);
        },
        setStatus(task: TaskSummary, status: StatusKey): void {
          store._statuses.request(task, status);
        },
        confirmCancel(cancellation: TaskCancellation): void {
          store._statuses.confirmCancel(cancellation);
        },
        keepCancel(): void {
          store._statuses.keepTask();
        },
        async setPriority(task: TaskSummary, priority: PriorityKey): Promise<void> {
          if (displayedTask(task).priority === priority) return;
          const word: string = PRIORITY_LABELS[priority].toLocaleLowerCase(store._locale);
          const key: string = task.key;
          await perform(task, {
            kind: 'versioned',
            action: { type: 'priority', priority },
            fields: { priority },
            failure,
            toast: (applied: AppliedWrite): RowToast => ({
              title: $localize`:@@task.row-actions.priority-toast:${key}:key: · ${word}:priority: priority`,
              description: $localize`:@@task.row-actions.priority-changed:Priority changed.`,
              undo: applied.undoable
                ? (): void => {
                    const previous: PriorityKey = applied.before.priority;
                    reverse(
                      task,
                      applied,
                      { type: 'priority', priority: previous },
                      { priority: previous },
                    );
                  }
                : null,
            }),
          });
        },
        async toggleAssignee(task: TaskSummary, person: Person): Promise<void> {
          const assigned: readonly string[] = displayedTask(task).assigneeIds;
          const has: boolean = assigned.includes(person.id);
          const after: readonly string[] = has
            ? assigned.filter((id: string): boolean => id !== person.id)
            : [...assigned, person.id];
          const name: string = person.name;
          await perform(task, {
            kind: 'versioned',
            action: { type: has ? 'unassign' : 'assign', userId: person.id },
            fields: { assigneeIds: after },
            failure,
            toast: (applied: AppliedWrite): RowToast => ({
              title: has
                ? $localize`:@@task.row-actions.unassigned:${name}:name: removed`
                : $localize`:@@task.row-actions.assigned:${name}:name: assigned`,
              description: task.key,
              undo: applied.undoable
                ? (): void => {
                    reverse(
                      task,
                      applied,
                      { type: has ? 'assign' : 'unassign', userId: person.id },
                      { assigneeIds: applied.before.assigneeIds },
                    );
                  }
                : null,
            }),
          });
        },
        async moveTo(task: TaskSummary, target: TaskMoveTarget): Promise<void> {
          if (displayedTask(task).listId === target.listId) return;
          const key: string = task.key;
          const name: string = target.name;
          await perform(task, {
            kind: 'versioned',
            action: { type: 'move', listId: target.listId },
            fields: { listId: target.listId },
            failure,
            toast: (applied: AppliedWrite): RowToast => ({
              title: $localize`:@@task.row-actions.moved:${key}:key: moved`,
              description: $localize`:@@task.row-actions.moved-text:To ${name}:name:.`,
              undo: applied.undoable
                ? (): void => {
                    const previous: string = applied.before.listId;
                    reverse(
                      task,
                      applied,
                      { type: 'move', listId: previous },
                      { listId: previous },
                    );
                  }
                : null,
            }),
          });
        },
        async remind(task: TaskSummary): Promise<void> {
          const at: Date = new Date();
          at.setDate(at.getDate() + 1);
          at.setHours(REMINDER_HOUR, 0, 0, 0);
          const organizationId: string = organization();
          const key: string = task.key;
          const sent: boolean | null = await lane
            .write(
              key,
              async (): Promise<boolean | null> => {
                if (organization() !== organizationId) return null;
                try {
                  await store._api.remind(key, at);
                  return true;
                } catch {
                  return false;
                }
              },
              task.version,
            )
            .catch((): boolean => false);
          if (sent === null || organization() !== organizationId) return;
          if (!sent) {
            toasts.error(
              $localize`:@@task.row-actions.remind-failed:The reminder could not be set`,
            );
            return;
          }
          if (store._destroyRef.destroyed) return;
          const day: string = new Intl.DateTimeFormat(store._locale, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          }).format(at);
          const when: string = `${day.charAt(0).toLocaleUpperCase(store._locale)}${day.slice(1)}`;
          toasts.show($localize`:@@task.row-actions.reminded:Reminder set`, {
            description: $localize`:@@task.row-actions.reminded-text:${when}:date:, 9 AM · ${key}:key:`,
          });
        },
        async duplicate(task: TaskSummary): Promise<void> {
          await perform(task, {
            kind: 'copy',
            action: { type: 'duplicate' },
            fields: {},
            failure,
            toast: (applied: AppliedWrite): RowToast => ({
              title: $localize`:@@task.row-actions.duplicated:Task duplicated`,
              description: applied.entry.newTaskKey ?? '',
              undo: null,
              open: applied.entry.newTaskKey,
            }),
          });
        },
        async copyLink(task: TaskSummary): Promise<void> {
          const origin: string = store._document.defaultView?.location.origin ?? '';
          const slug: string = store._workspace.organization().slug;
          await copy(
            `${origin}/${slug}/t/${task.key}`,
            $localize`:@@task.row-actions.link-copied:Link copied`,
          );
        },
        async copyKey(task: TaskSummary): Promise<void> {
          await copy(task.key, $localize`:@@task.row-actions.key-copied:Identifier copied`);
        },
        askDelete(task: TaskSummary): void {
          patchState(store, { _deleteTask: task, deleteOpen: true });
        },
        setDeleteOpen(open: boolean): void {
          patchState(store, { deleteOpen: open });
        },
        async trash(): Promise<void> {
          const task: TaskSummary | null = store._deleteTask();
          if (!task || store.deleting()) return;
          const key: string = task.key;
          patchState(store, { deleting: true });
          hide(key, true);
          const settlement: Settlement = await perform(task, {
            kind: 'trash',
            action: { type: 'trash' },
            fields: {},
            failure: $localize`:@@task.row-actions.delete-failed:The task could not be deleted`,
            toast: (applied: AppliedWrite): RowToast => {
              const subtasks: number = Math.max(0, applied.outcome.affected - 1);
              const kept: string = $localize`:@@task.row-actions.deleted-text:Kept 30 days in the trash.`;
              const entryId: string | null = applied.entry.trashEntryId;
              return {
                title: $localize`:@@task.row-actions.deleted:${key}:key: deleted`,
                description:
                  subtasks === 0
                    ? kept
                    : subtasks === 1
                      ? $localize`:@@task.row-actions.deleted-subtask:With ${subtasks}:count: subtask. ${kept}:kept:`
                      : $localize`:@@task.row-actions.deleted-subtasks:With ${subtasks}:count: subtasks. ${kept}:kept:`,
                undo:
                  entryId === null
                    ? null
                    : (): void => {
                        void restore(task, entryId, applied.organizationId);
                      },
              };
            },
          });
          const trashed: boolean =
            settlement.kind === 'applied' ||
            (settlement.kind === 'read-back' && settlement.applied);
          if (trashed) hide(key, false);
          else show(key);
          patchState(store, { deleting: false, deleteOpen: false, _deleteTask: null });
        },
      };
    }),
    withHooks({
      onInit(store): void {
        store._lane.reads.pipe(takeUntilDestroyed()).subscribe((task: TaskSummary): void => {
          patchState(store, (state: TaskRowActionsState) => {
            const current: ConfirmedFields | undefined = state._confirmed[task.key];
            if (current && current.until > task.version) return {};
            return {
              _confirmed: {
                ...state._confirmed,
                [task.key]: { fields: fieldsOf(task), until: task.version },
              },
            };
          });
        });
      },
      onDestroy(store): void {
        for (const id of store._shownToasts) store._toasts.dismiss(id);
        store._shownToasts.clear();
      },
    }),
  );
}

/**
 * Constant TaskRowActionsStore
 *
 * @description
 * The writes of Task's `cw-task-menu` for rows that belong to no list page (Home, My tasks,
 * Dashboards), page-scoped: the route provides `TASK_ROW_ACTIONS_PROVIDERS`, so it shares one
 * write lane per task (`TaskRowWriteLaneStore`) with the route's `TaskStatusChangesStore`, whose
 * status writes it uses and whose cancel reason dialog it exposes (`cancelKeys`).
 *
 * Priority, assignees, `Move to`, `Duplicate` and the confirmed deletion go through
 * `TaskActionsApi.bulk`, the reminder through `TaskActionsApi.remind`, each after the task's
 * earlier writes and never sent once the organization changed. Every write carries the newest
 * known version (the page's copy, or the version the lane last sent at, returned or read): a
 * refusal reads the task back, and one found past the version sent was a conflict
 * (`changed elsewhere`, its values shown); a returned version is adopted only at known + 1.
 *
 * Values show at once: the confirmed ones (a write's answer, a read back) over a page copy
 * older than their version, then each waiting write's own; a refusal drops only its write's
 * values. A write without a certain outcome keeps its values and holds the task's next writes
 * while the task is read back after `ROW_RECONCILE_DELAYS_MS`; it settles once a read is past the
 * version sent, or, the reads spent, is taken as not applied. `Undo` is offered only when the
 * returned version is the one sent + 1 (the write was the task's only change), puts back the
 * values confirmed when the write started, and is sent against the returned version. A deletion
 * hides the row at once; its `Undo` restores the trash entry; a refused deletion or restore shows
 * the row again. Each settled write emits `changed`, as does each status write. A write answered
 * once the organization changed reports nothing; one answered after the page was left reports
 * only what failed; leaving the page dismisses its `Undo` and `Open` toasts.
 *
 * @type {Type<TaskRowActionsStoreInstance>}
 */
export const TaskRowActionsStore: Type<TaskRowActionsStoreInstance> = createTaskRowActionsStore();
