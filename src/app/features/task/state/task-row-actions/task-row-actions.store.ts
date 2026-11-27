import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, LOCALE_ID, type Signal, type Type } from '@angular/core';
import type { PriorityKey, StatusKey } from '@cadenway/contracts';
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
  TaskBulkSelection,
} from '../../models/task-bulk/task-bulk.interface';
import type { TaskMoveTarget } from '../../models/task-move-target/task-move-target.interface';
import type { TaskCancellation } from '../../models/task-status-change/task-status-change.interface';
import type { TaskSummary } from '../../models/task-summary/task-summary.interface';
import { TaskDetailOpener } from '../../services/task-detail-opener/task-detail-opener.service';
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
 * Type RowFields
 *
 * @description
 * The fields of a task the menu's writes show at once, before the page reads the task again.
 *
 * @type {Partial<Pick<TaskSummary, 'priority' | 'assigneeIds' | 'listId'>>}
 */
type RowFields = Partial<Pick<TaskSummary, 'priority' | 'assigneeIds' | 'listId'>>;

/**
 * Interface RowPatch
 *
 * @description
 * What the menu's writes of one task show over the page's copy of it.
 */
interface RowPatch {
  // #region Properties
  /**
   * Property fields
   *
   * @description
   * The written values, the latest write winning.
   *
   * @type {RowFields}
   * @readonly
   */
  readonly fields: RowFields;

  /**
   * Property writes
   *
   * @description
   * Writes of the task still waiting for their answer; the patch shows while any is.
   *
   * @type {number}
   * @readonly
   */
  readonly writes: number;

  /**
   * Property until
   *
   * @description
   * The newest version a confirmed write returned: the patch shows over a copy of the task older
   * than it, null when no write returned one.
   *
   * @type {number | null}
   * @readonly
   */
  readonly until: number | null;
  // #endregion
}

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
   * The values shown at once, rolled back when the write is refused.
   *
   * @type {RowFields}
   * @readonly
   */
  readonly fields: RowFields;

  /**
   * Property version
   *
   * @description
   * The version the task must still be at (an `Undo`); absent to apply the action to the task as
   * it is.
   *
   * @type {number | undefined}
   * @readonly
   */
  readonly version?: number;

  /**
   * Property toast
   *
   * @description
   * Builds the toast of the applied write from the gateway's entry; null for no toast (an `Undo`).
   *
   * @type {((entry: TaskBulkEntry, outcome: TaskBulkOutcome) => RowToast) | null}
   * @readonly
   */
  readonly toast: ((entry: TaskBulkEntry, outcome: TaskBulkOutcome) => RowToast) | null;

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
 * Interface TaskRowActionsState
 *
 * @description
 * The deletion confirmation, the values shown at once and the tasks moved to the trash.
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
   * Property _patches
   *
   * @description
   * The values the writes show, by task key.
   *
   * @type {Readonly<Partial<Record<string, RowPatch>>>}
   * @readonly
   */
  readonly _patches: Readonly<Partial<Record<string, RowPatch>>>;

  /**
   * Property _hidden
   *
   * @description
   * Keys of the tasks sent or moved to the trash, left out of the rows until restored.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly _hidden: readonly string[];
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
  _patches: {},
  _hidden: [],
};

/**
 * Function startPatch
 *
 * @description
 * Shows the values of a write that is being sent.
 *
 * @param {Readonly<Partial<Record<string, RowPatch>>>} patches - The patches.
 * @param {string} key - Task key.
 * @param {RowFields} fields - The written values.
 * @returns {Readonly<Partial<Record<string, RowPatch>>>} The new patches.
 */
function startPatch(
  patches: Readonly<Partial<Record<string, RowPatch>>>,
  key: string,
  fields: RowFields,
): Readonly<Partial<Record<string, RowPatch>>> {
  const patch: RowPatch = patches[key] ?? { fields: {}, writes: 0, until: null };
  return {
    ...patches,
    [key]: { ...patch, fields: { ...patch.fields, ...fields }, writes: patch.writes + 1 },
  };
}

/**
 * Function settlePatch
 *
 * @description
 * Settles one write of a task: an applied write keeps its values until a copy of the task reaches
 * the version it returned; a write without a certain outcome or refused drops the values it set
 * (a later write's values stay). The patch goes once no write waits and nothing holds it.
 *
 * @param {Readonly<Partial<Record<string, RowPatch>>>} patches - The patches.
 * @param {string} key - Task key.
 * @param {RowFields} fields - The values the write set.
 * @param {number | null} version - The version the applied write returned, null otherwise.
 * @returns {Readonly<Partial<Record<string, RowPatch>>>} The new patches.
 */
function settlePatch(
  patches: Readonly<Partial<Record<string, RowPatch>>>,
  key: string,
  fields: RowFields,
  version: number | null,
): Readonly<Partial<Record<string, RowPatch>>> {
  const patch: RowPatch | undefined = patches[key];
  if (!patch) return patches;
  let kept: RowFields = patch.fields;
  if (version === null) {
    kept = Object.fromEntries(
      Object.entries(patch.fields).filter(
        ([field, value]: [string, unknown]): boolean => fields[field as keyof RowFields] !== value,
      ),
    );
  }
  const writes: number = patch.writes - 1;
  const until: number | null = version === null ? patch.until : Math.max(patch.until ?? 0, version);
  const rest: Readonly<Partial<Record<string, RowPatch>>> = Object.fromEntries(
    Object.entries(patches).filter(([other]: [string, unknown]): boolean => other !== key),
  );
  if (writes === 0 && (until === null || Object.keys(kept).length === 0)) return rest;
  return { ...rest, [key]: { fields: kept, writes, until } };
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
   * `Undo` included, and after each status write of the route's `TaskStatusChangesStore`: the page
   * reads its rows again.
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
   * Method rows
   *
   * @description
   * The page's tasks as the writes show them: without the tasks sent to the trash, each with the
   * values its writes set until the page's copy reaches the version they returned. Reactive.
   *
   * @param {readonly TaskSummary[]} tasks - The tasks as the page read them.
   * @returns {readonly TaskSummary[]} The rows to draw.
   */
  rows(tasks: readonly TaskSummary[]): readonly TaskSummary[];

  /**
   * Method displayedTask
   *
   * @description
   * One task as the writes show it (its status apart: `displayedStatus`). Reactive.
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
   * `Status` of the menu, through the route's `TaskStatusChangesStore`: shown at once, sent 460 ms
   * after the last click with its toast and `Undo`; `Cancelled` asks the reason first
   * (`cancelKeys`).
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
   */
  setPriority(task: TaskSummary, priority: PriorityKey): void;

  /**
   * Method toggleAssignee
   *
   * @description
   * `Assign` of the menu: assigns the person, or removes them when the task has them.
   *
   * @param {TaskSummary} task - The task.
   * @param {Person} person - The person.
   */
  toggleAssignee(task: TaskSummary, person: Person): void;

  /**
   * Method moveTo
   *
   * @description
   * `Move to` of the menu.
   *
   * @param {TaskSummary} task - The task.
   * @param {TaskMoveTarget} target - The destination list.
   */
  moveTo(task: TaskSummary, target: TaskMoveTarget): void;

  /**
   * Method remind
   *
   * @description
   * `Remind me tomorrow morning`: the caller's reminder tomorrow at 9.
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
        _api: inject(TaskActionsApi),
        _workspace: inject<WorkspaceContextPort>(WORKSPACE_CONTEXT),
        _toasts: inject(CwToastService),
        _taskDetail: inject(TaskDetailOpener),
        _document: inject(DOCUMENT),
        _locale: inject(LOCALE_ID),
        _destroyRef: inject(DestroyRef),
        _undoToasts: new Set<string>(),
        _queues: new Map<string, Promise<unknown>>(),
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
      const organization: () => string = (): string => store._workspace.organization().id;

      const enqueue: <T>(key: string, run: () => Promise<T>) => Promise<T> = <T>(
        key: string,
        run: () => Promise<T>,
      ): Promise<T> => {
        const previous: Promise<unknown> = store._queues.get(key) ?? Promise.resolve();
        const next: Promise<T> = previous.then(run, run);
        const tail: Promise<unknown> = next.catch((): undefined => undefined);
        store._queues.set(key, tail);
        void tail.then((): void => {
          if (store._queues.get(key) === tail) store._queues.delete(key);
        });
        return next;
      };

      const keepUndoToast: (id: string) => void = (id: string): void => {
        const shown: ReadonlySet<string> = new Set(
          toasts.toasts().map((item: { readonly id: string }): string => item.id),
        );
        for (const kept of store._undoToasts) if (!shown.has(kept)) store._undoToasts.delete(kept);
        store._undoToasts.add(id);
      };

      const displayedTask: (task: TaskSummary) => TaskSummary = (
        task: TaskSummary,
      ): TaskSummary => {
        const patch: RowPatch | undefined = store._patches()[task.key];
        if (!patch) return task;
        return patch.writes > 0 || (patch.until !== null && task.version < patch.until)
          ? { ...task, ...patch.fields }
          : task;
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

      const showToast: (message: RowToast) => void = (message: RowToast): void => {
        const copy: string | null = message.open ?? null;
        const undo: (() => void) | null = message.undo;
        const id: string = toasts.show(message.title, {
          description: message.description,
          ...(copy
            ? {
                action: {
                  label: $localize`:@@task.row-actions.open:Open`,
                  run: (): void => {
                    open(copy);
                  },
                },
              }
            : undo
              ? { undo }
              : {}),
        });
        if (!copy && undo) keepUndoToast(id);
      };

      const perform: (task: TaskSummary, write: RowWrite) => Promise<TaskBulkEntry | null> = async (
        task: TaskSummary,
        write: RowWrite,
      ): Promise<TaskBulkEntry | null> => {
        const key: string = task.key;
        const organizationId: string = organization();
        patchState(store, (state: TaskRowActionsState) => ({
          _patches: startPatch(state._patches, key, write.fields),
        }));
        const selection: TaskBulkSelection =
          write.version === undefined ? { taskKey: key } : { taskKey: key, version: write.version };
        const outcome: TaskBulkOutcome = await enqueue(key, () =>
          store._api.bulk(
            [selection],
            write.action,
            (): boolean => organization() === organizationId,
          ),
        );
        const entry: TaskBulkEntry | null = outcome.done.length > 0 ? outcome.done[0] : null;
        patchState(store, (state: TaskRowActionsState) => ({
          _patches: settlePatch(state._patches, key, write.fields, entry ? entry.version : null),
        }));
        if (organization() !== organizationId || outcome.notSent.length > 0) return null;
        store._changes.next(key);
        if (outcome.unknown.length > 0) {
          toasts.warning(
            $localize`:@@task.row-actions.unknown:The outcome is unknown. The task is being refreshed.`,
          );
          return null;
        }
        if (!entry) {
          toasts.error(write.failure);
          return null;
        }
        if (write.toast && !store._destroyRef.destroyed) showToast(write.toast(entry, outcome));
        return entry;
      };

      const undoFailure: string = $localize`:@@task.row-actions.undo-failed:The change could not be undone`;

      const reverse: (task: TaskSummary, write: Omit<RowWrite, 'toast' | 'failure'>) => void = (
        task: TaskSummary,
        write: Omit<RowWrite, 'toast' | 'failure'>,
      ): void => {
        void perform(task, { ...write, toast: null, failure: undoFailure });
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

      const restore: (key: string, entryId: string) => Promise<void> = async (
        key: string,
        entryId: string,
      ): Promise<void> => {
        const organizationId: string = organization();
        try {
          await enqueue(key, () => store._api.restore(entryId));
        } catch {
          if (organization() !== organizationId) return;
          toasts.error(
            $localize`:@@task.row-actions.restore-failed:The task could not be restored`,
          );
          return;
        }
        if (organization() !== organizationId) return;
        patchState(store, (state: TaskRowActionsState) => ({
          _hidden: state._hidden.filter((hidden: string): boolean => hidden !== key),
        }));
        store._changes.next(key);
      };

      return {
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
        setPriority(task: TaskSummary, priority: PriorityKey): void {
          const shown: TaskSummary = displayedTask(task);
          const before: PriorityKey = shown.priority;
          if (before === priority) return;
          const word: string = PRIORITY_LABELS[priority].toLocaleLowerCase(store._locale);
          const key: string = task.key;
          void perform(task, {
            action: { type: 'priority', priority },
            fields: { priority },
            failure: $localize`:@@task.row-actions.failed:The task could not be changed`,
            toast: (entry: TaskBulkEntry): RowToast => ({
              title: $localize`:@@task.row-actions.priority-toast:${key}:key: · ${word}:priority: priority`,
              description: $localize`:@@task.row-actions.priority-changed:Priority changed.`,
              undo:
                entry.version === null
                  ? null
                  : (): void => {
                      reverse(task, {
                        action: { type: 'priority', priority: before },
                        fields: { priority: before },
                        version: entry.version ?? undefined,
                      });
                    },
            }),
          });
        },
        toggleAssignee(task: TaskSummary, person: Person): void {
          const assigned: readonly string[] = displayedTask(task).assigneeIds;
          const has: boolean = assigned.includes(person.id);
          const after: readonly string[] = has
            ? assigned.filter((id: string): boolean => id !== person.id)
            : [...assigned, person.id];
          const name: string = person.name;
          void perform(task, {
            action: { type: has ? 'unassign' : 'assign', userId: person.id },
            fields: { assigneeIds: after },
            failure: $localize`:@@task.row-actions.failed:The task could not be changed`,
            toast: (entry: TaskBulkEntry): RowToast => ({
              title: has
                ? $localize`:@@task.row-actions.unassigned:${name}:name: removed`
                : $localize`:@@task.row-actions.assigned:${name}:name: assigned`,
              description: task.key,
              undo:
                entry.version === null
                  ? null
                  : (): void => {
                      reverse(task, {
                        action: { type: has ? 'assign' : 'unassign', userId: person.id },
                        fields: { assigneeIds: assigned },
                        version: entry.version ?? undefined,
                      });
                    },
            }),
          });
        },
        moveTo(task: TaskSummary, target: TaskMoveTarget): void {
          const before: string = displayedTask(task).listId;
          if (before === target.listId) return;
          const key: string = task.key;
          const name: string = target.name;
          void perform(task, {
            action: { type: 'move', listId: target.listId },
            fields: { listId: target.listId },
            failure: $localize`:@@task.row-actions.failed:The task could not be changed`,
            toast: (entry: TaskBulkEntry): RowToast => ({
              title: $localize`:@@task.row-actions.moved:${key}:key: moved`,
              description: $localize`:@@task.row-actions.moved-text:To ${name}:name:.`,
              undo:
                entry.version === null
                  ? null
                  : (): void => {
                      reverse(task, {
                        action: { type: 'move', listId: before },
                        fields: { listId: before },
                        version: entry.version ?? undefined,
                      });
                    },
            }),
          });
        },
        async remind(task: TaskSummary): Promise<void> {
          const at: Date = new Date();
          at.setDate(at.getDate() + 1);
          at.setHours(REMINDER_HOUR, 0, 0, 0);
          const organizationId: string = organization();
          try {
            await enqueue(task.key, () => store._api.remind(task.key, at));
          } catch {
            if (organization() === organizationId) {
              toasts.error(
                $localize`:@@task.row-actions.remind-failed:The reminder could not be set`,
              );
            }
            return;
          }
          if (organization() !== organizationId || store._destroyRef.destroyed) return;
          const day: string = new Intl.DateTimeFormat(store._locale, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          }).format(at);
          const when: string = `${day.charAt(0).toLocaleUpperCase(store._locale)}${day.slice(1)}`;
          const key: string = task.key;
          toasts.show($localize`:@@task.row-actions.reminded:Reminder set`, {
            description: $localize`:@@task.row-actions.reminded-text:${when}:date:, 9 AM · ${key}:key:`,
          });
        },
        async duplicate(task: TaskSummary): Promise<void> {
          await perform(task, {
            action: { type: 'duplicate' },
            fields: {},
            failure: $localize`:@@task.row-actions.failed:The task could not be changed`,
            toast: (entry: TaskBulkEntry): RowToast => ({
              title: $localize`:@@task.row-actions.duplicated:Task duplicated`,
              description: entry.newTaskKey ?? '',
              undo: null,
              open: entry.newTaskKey,
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
          patchState(store, (state: TaskRowActionsState) => ({
            deleting: true,
            _hidden: state._hidden.includes(key) ? state._hidden : [...state._hidden, key],
          }));
          const entry: TaskBulkEntry | null = await perform(task, {
            action: { type: 'trash' },
            fields: {},
            failure: $localize`:@@task.row-actions.delete-failed:The task could not be deleted`,
            toast: (done: TaskBulkEntry, outcome: TaskBulkOutcome): RowToast => {
              const subtasks: number = Math.max(0, outcome.affected - 1);
              const kept: string = $localize`:@@task.row-actions.deleted-text:Kept 30 days in the trash.`;
              const entryId: string | null = done.trashEntryId;
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
                        void restore(key, entryId);
                      },
              };
            },
          });
          patchState(store, (state: TaskRowActionsState) => ({
            deleting: false,
            deleteOpen: false,
            _deleteTask: null,
            _hidden: entry
              ? state._hidden
              : state._hidden.filter((hidden: string) => hidden !== key),
          }));
        },
      };
    }),
    withHooks({
      onDestroy(store): void {
        for (const id of store._undoToasts) store._toasts.dismiss(id);
        store._undoToasts.clear();
      },
    }),
  );
}

/**
 * Constant TaskRowActionsStore
 *
 * @description
 * The writes of Task's `cw-task-menu` for rows that belong to no list page (Home, My tasks,
 * Dashboards), page-scoped: the route provides it with `TaskStatusChangesStore`, whose status
 * writes it uses and whose cancel reason dialog it exposes (`cancelKeys`). Priority, assignees,
 * `Move to`, `Duplicate` and the confirmed deletion go through `TaskActionsApi.bulk`, one write of
 * a task after the other; the reminder through `TaskActionsApi.remind`. These pages read their
 * rows without realtime notices, so a write applies the action to the task as it is (no
 * expected version) rather than being refused for a version the page read minutes ago; its `Undo`
 * is sent against the version the write returned, so it never overwrites a later change. The
 * values show at once (`rows`, `displayedTask`) until the page's copy reaches the returned
 * version; a refusal or an uncertain answer drops them with a toast. A deleted task leaves the
 * rows at once and comes back when the deletion is refused or its `Undo` restores it. Each settled
 * write emits `changed`, as does each status write, so the page reads its rows again. A write
 * answered once the organization changed reports nothing; one answered after the page was left
 * reports only what failed; leaving the page dismisses its `Undo` toasts.
 *
 * @type {Type<TaskRowActionsStoreInstance>}
 */
export const TaskRowActionsStore: Type<TaskRowActionsStoreInstance> = createTaskRowActionsStore();
