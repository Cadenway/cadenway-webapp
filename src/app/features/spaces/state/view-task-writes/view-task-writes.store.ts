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

import {
  CANCEL_REASON_LABELS,
  defaultStatusOptions,
  type Person,
  personOf,
  PRIORITY_LABELS,
  statusLabel,
  type StatusOption,
  type TaskBulkAction,
  type TaskBulkEntry,
  type TaskBulkOutcome,
  type TaskBulkSelection,
  type TaskCancellation,
  TaskDetailOpener,
  type TaskSummary,
} from '@features/task';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import {
  bulkDeletedText,
  bulkDoneText,
  bulkMovedText,
  bulkPartialText,
  bulkUpdatedText,
  undoConflictText,
  undoConflictTitle,
} from '../../constants/bulk-copy/bulk-copy.constants';
import type { ListMember } from '../../models/list-member/list-member.interface';
import type { Space, SpaceStatusOption } from '../../models/space/space.interface';
import type { ListSummary, SpaceOverview } from '../../models/task-list/task-list.interface';
import type {
  ConfirmedTask,
  MoveTarget,
  TaskFieldChanges,
  ViewTaskOutcome,
  ViewTaskWriter,
} from '../../models/view-task-write/view-task-write.interface';
import { listIconName, lookTone } from '../../utils/look/look.util';
import { ListPageStore } from '../list-page/list-page.store';
import { SpacesNavigationStore } from '../spaces-navigation/spaces-navigation.store';
import { VIEW_TASK_WRITER } from './view-task-writer.token';

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
 * Interface WriteToast
 *
 * @description
 * The toast of an applied write and what its `Undo` sends back.
 */
export interface WriteToast {
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
   * Key of a single copy the toast's `Open` opens instead of an `Undo`.
   *
   * @type {string | null | undefined}
   * @readonly
   */
  readonly open?: string | null;
  // #endregion
}

/**
 * Interface FieldWriteToast
 *
 * @description
 * The toast of a single-field write (`ViewTaskWritesStore.updateFields`); its `Undo` is built
 * by the store.
 */
export interface FieldWriteToast {
  // #region Properties
  /**
   * Property title
   *
   * @description
   * Title of the toast (`CAD-482 rescheduled`).
   *
   * @type {string}
   * @readonly
   */
  readonly title: string;

  /**
   * Property description
   *
   * @description
   * Second line of the toast (`Due: Friday, November 27.`).
   *
   * @type {string}
   * @readonly
   */
  readonly description: string;
  // #endregion
}

/**
 * Interface ReverseWrite
 *
 * @description
 * One write of an `Undo`: tasks that get the same values back.
 */
interface ReverseWrite {
  // #region Properties
  /**
   * Property tasks
   *
   * @description
   * The tasks as confirmed before the undone action.
   *
   * @type {readonly ConfirmedTask[]}
   * @readonly
   */
  readonly tasks: readonly ConfirmedTask[];

  /**
   * Property action
   *
   * @description
   * The write that puts their values back.
   *
   * @type {TaskBulkAction}
   * @readonly
   */
  readonly action: TaskBulkAction;
  // #endregion
}

/**
 * Interface ViewTaskWritesState
 *
 * @description
 * The confirmations of the task menu and the selection bar.
 */
interface ViewTaskWritesState {
  // #region Properties
  /**
   * Property deleteOpen
   *
   * @description
   * Whether the deletion of `_deleteTasks` is being confirmed.
   *
   * @type {boolean}
   * @readonly
   */
  readonly deleteOpen: boolean;

  /**
   * Property deleting
   *
   * @description
   * Whether a deletion is being recorded (its confirmation shows it).
   *
   * @type {boolean}
   * @readonly
   */
  readonly deleting: boolean;

  /**
   * Property _deleteTasks
   *
   * @description
   * The tasks the confirmation deletes.
   *
   * @type {readonly TaskSummary[]}
   * @readonly
   */
  readonly _deleteTasks: readonly TaskSummary[];

  /**
   * Property _deleteFromMenu
   *
   * @description
   * Whether the task menu asked (its wording names the task) rather than the selection bar.
   *
   * @type {boolean}
   * @readonly
   */
  readonly _deleteFromMenu: boolean;

  /**
   * Property _cancelTasks
   *
   * @description
   * Tasks awaiting a shared cancellation reason, those not cancelled already.
   *
   * @type {readonly TaskSummary[] | null}
   * @readonly
   */
  readonly _cancelTasks: readonly TaskSummary[] | null;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * No confirmation open.
 *
 * @type {ViewTaskWritesState}
 */
const initialState: ViewTaskWritesState = {
  deleteOpen: false,
  deleting: false,
  _deleteTasks: [],
  _deleteFromMenu: false,
  _cancelTasks: null,
};

/**
 * Function groupBy
 *
 * @description
 * Splits items by a key, in order of first appearance.
 *
 * @param {readonly T[]} items - The items.
 * @param {(item: T) => string} keyOf - The key of an item.
 * @returns {readonly T[][]} The groups.
 */
function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): readonly T[][] {
  const groups: Map<string, T[]> = new Map<string, T[]>();
  for (const item of items) {
    const key: string = keyOf(item);
    const group: T[] | undefined = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return [...groups.values()];
}

/**
 * Function confirmedOf
 *
 * @description
 * The tasks a write applied to, as confirmed before it: what its `Undo` puts back.
 *
 * @param {ViewTaskOutcome} outcome - What the write ended with.
 * @returns {readonly ConfirmedTask[]} The applied tasks, in the order of the outcome.
 */
function confirmedOf(outcome: ViewTaskOutcome): readonly ConfirmedTask[] {
  return outcome.done.flatMap((entry: TaskBulkEntry): ConfirmedTask[] => {
    const task: ConfirmedTask | undefined = outcome.before[entry.taskKey];
    return task ? [task] : [];
  });
}

/**
 * Function tasksLabel
 *
 * @description
 * How a toast names the tasks: `CAD-482` or `3 tasks`.
 *
 * @param {readonly TaskSummary[]} tasks - The tasks.
 * @returns {string} The label.
 */
function tasksLabel(tasks: readonly TaskSummary[]): string {
  const count: number = tasks.length;
  return count > 1
    ? $localize`:@@spaces.rows.count-many:${count}:count: tasks`
    : (tasks[0]?.key ?? '');
}

/**
 * Function previousFields
 *
 * @description
 * The values a single-field write replaced, as the task was confirmed before it: its `Undo`.
 * The estimate and custom fields are not part of a task summary: the caller gives them.
 *
 * @param {ConfirmedTask} task - The task before the write.
 * @param {TaskFieldChanges} changes - The written fields.
 * @param {TaskFieldChanges | undefined} given - The previous values the caller knows.
 * @returns {TaskFieldChanges} The values to write back.
 */
function previousFields(
  task: ConfirmedTask,
  changes: TaskFieldChanges,
  given: TaskFieldChanges | undefined,
): TaskFieldChanges {
  return {
    ...(changes.dueDate === undefined ? {} : { dueDate: task.due }),
    ...(changes.startDate === undefined && changes.dueDate === undefined
      ? {}
      : { startDate: task.start }),
    ...(changes.name === undefined ? {} : { name: task.name }),
    ...given,
  };
}

/**
 * Interface ViewTaskWritesStoreInstance
 *
 * @description
 * Public API of `ViewTaskWritesStore`.
 */
export interface ViewTaskWritesStoreInstance {
  // #region Properties
  /**
   * Property deleteOpen
   *
   * @description
   * Whether the deletion confirmation (`cw-alert-dialog`) is open.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly deleteOpen: Signal<boolean>;

  /**
   * Property deleting
   *
   * @description
   * Whether the confirmed deletion is being recorded.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly deleting: Signal<boolean>;

  /**
   * Property deleteTitle
   *
   * @description
   * Question of the deletion: `Delete “name”?` from the task menu, else `Delete this task?`;
   * `Delete N tasks?` for several.
   *
   * @type {Signal<string>}
   * @readonly
   */
  readonly deleteTitle: Signal<string>;

  /**
   * Property deleteText
   *
   * @description
   * What the deletion does, in the wording of its origin.
   *
   * @type {Signal<string>}
   * @readonly
   */
  readonly deleteText: Signal<string>;

  /**
   * Property deleteAction
   *
   * @description
   * Action of the deletion (`Delete the task`, `Delete 3 tasks`).
   *
   * @type {Signal<string>}
   * @readonly
   */
  readonly deleteAction: Signal<string>;

  /**
   * Property deleteItems
   *
   * @description
   * The tasks the confirmation lists (`CAD-482 · name`).
   *
   * @type {Signal<readonly string[]>}
   * @readonly
   */
  readonly deleteItems: Signal<readonly string[]>;

  /**
   * Property cancelKeys
   *
   * @description
   * Keys the shared cancellation dialog names, null while it is closed.
   *
   * @type {Signal<readonly string[] | null>}
   * @readonly
   */
  readonly cancelKeys: Signal<readonly string[] | null>;

  /**
   * Property statusOptions
   *
   * @description
   * The statuses of the list's space: its names and hidden statuses; the default words until
   * the space is read.
   *
   * @type {Signal<readonly StatusOption[]>}
   * @readonly
   */
  readonly statusOptions: Signal<readonly StatusOption[]>;

  /**
   * Property people
   *
   * @description
   * The members the assignees are chosen among, the signed-in member first.
   *
   * @type {Signal<readonly Person[]>}
   * @readonly
   */
  readonly people: Signal<readonly Person[]>;

  /**
   * Property userId
   *
   * @description
   * The signed-in member, shown `(me)` in the task menu.
   *
   * @type {Signal<string>}
   * @readonly
   */
  readonly userId: Signal<string>;

  /**
   * Property targets
   *
   * @description
   * The other lists of the sidebar, with their icon, their tone and their space (`Move to`).
   *
   * @type {Signal<readonly MoveTarget[]>}
   * @readonly
   */
  readonly targets: Signal<readonly MoveTarget[]>;
  // #endregion

  // #region Methods
  /**
   * Method onRefused
   *
   * @description
   * Follows the tasks of a refused chunk, which the view keeps selected (the selection bar's
   * second toast says so); called while the view lives.
   *
   * @param {(taskKeys: readonly string[]) => void} keep - Selects the refused tasks again.
   */
  onRefused(keep: (taskKeys: readonly string[]) => void): void;

  /**
   * Method open
   *
   * @description
   * Opens a task's detail over the view (`?task=<KEY>`), the shown task as the header's preview.
   *
   * @param {string} taskKey - Key of the task.
   * @param {TaskSummary} [task] - The task as shown.
   */
  open(taskKey: string, task?: TaskSummary): void;

  /**
   * Method setStatus
   *
   * @description
   * `Status` of the task menu: sets the status of its tasks at once. `Cancelled` asks the reason
   * first (`cancelKeys`), for the tasks not cancelled already, and only when there is one.
   *
   * @param {readonly TaskSummary[]} tasks - The tasks of the menu.
   * @param {StatusKey} status - The status.
   * @param {boolean} milestone - Whether every task is a milestone (the status word).
   */
  setStatus(tasks: readonly TaskSummary[], status: StatusKey, milestone: boolean): void;

  /**
   * Method confirmCancel
   *
   * @description
   * Cancels the tasks of the dialog with their shared reason; the toast names the reason and
   * offers `Undo`.
   *
   * @param {TaskCancellation} cancellation - The reason and optional note.
   */
  confirmCancel(cancellation: TaskCancellation): void;

  /**
   * Method keepCancel
   *
   * @description
   * Closes the cancellation dialog without writing.
   */
  keepCancel(): void;

  /**
   * Method setPriority
   *
   * @description
   * `Priority` of the task menu.
   *
   * @param {readonly TaskSummary[]} tasks - The tasks of the menu.
   * @param {PriorityKey} priority - The priority.
   */
  setPriority(tasks: readonly TaskSummary[], priority: PriorityKey): void;

  /**
   * Method toggleAssignee
   *
   * @description
   * `Assign` of the task menu or of the selection bar: assigns the person to every task, or
   * removes the person when every task has them already.
   *
   * @param {readonly TaskSummary[]} tasks - The tasks.
   * @param {string} userId - The person.
   * @param {boolean} [bar] - Whether the selection bar asked (its toast counts the tasks).
   */
  toggleAssignee(tasks: readonly TaskSummary[], userId: string, bar?: boolean): void;

  /**
   * Method moveTo
   *
   * @description
   * `Move to` of the task menu or of the selection bar; the tasks leave the view at once.
   *
   * @param {readonly TaskSummary[]} tasks - The tasks.
   * @param {string} listId - The destination.
   * @param {boolean} [bar] - Whether the selection bar asked (its toast counts the tasks).
   */
  moveTo(tasks: readonly TaskSummary[], listId: string, bar?: boolean): void;

  /**
   * Method markDone
   *
   * @description
   * `Mark done` of the selection bar, for the tasks not done already.
   *
   * @param {readonly TaskSummary[]} tasks - The selected tasks.
   */
  markDone(tasks: readonly TaskSummary[]): void;

  /**
   * Method remind
   *
   * @description
   * `Remind me tomorrow morning`: a reminder tomorrow at 9 for each task.
   *
   * @param {readonly TaskSummary[]} tasks - The tasks.
   * @returns {Promise<void>} Resolves once reported.
   */
  remind(tasks: readonly TaskSummary[]): Promise<void>;

  /**
   * Method duplicate
   *
   * @description
   * `Duplicate`: copies each task; the toast names the copies and `Open` opens a single copy.
   *
   * @param {readonly TaskSummary[]} tasks - The tasks.
   */
  duplicate(tasks: readonly TaskSummary[]): void;

  /**
   * Method copyLinks
   *
   * @description
   * `Copy the link`: the shareable addresses of the tasks (`/<slug>/t/<KEY>`), one per line.
   *
   * @param {readonly TaskSummary[]} tasks - The tasks.
   */
  copyLinks(tasks: readonly TaskSummary[]): void;

  /**
   * Method copyKeys
   *
   * @description
   * `Copy the identifier`: the keys of the tasks, comma-separated.
   *
   * @param {readonly TaskSummary[]} tasks - The tasks.
   */
  copyKeys(tasks: readonly TaskSummary[]): void;

  /**
   * Method askDelete
   *
   * @description
   * Opens the deletion confirmation of the task menu or of the selection bar.
   *
   * @param {readonly TaskSummary[]} tasks - The tasks.
   * @param {boolean} menu - Whether the task menu asked.
   */
  askDelete(tasks: readonly TaskSummary[], menu: boolean): void;

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
   * Moves the confirmed tasks to the trash; the toast counts their subtasks and `Undo` restores
   * the trash entries.
   *
   * @returns {Promise<void>} Resolves once reported.
   */
  trash(): Promise<void>;

  /**
   * Method updateFields
   *
   * @description
   * A single-field write of one task (reschedule, estimate, name, custom field) with its toast;
   * `Undo` writes back the values confirmed before it (dates and name from the task, the
   * estimate and custom fields from `previous`), bound to the version the write left the task at.
   *
   * @param {TaskSummary} task - The task, as shown.
   * @param {TaskFieldChanges} changes - The fields.
   * @param {FieldWriteToast} toast - The toast of the applied write.
   * @param {TaskFieldChanges} [previous] - The previous estimate or custom field values.
   * @returns {Promise<ViewTaskOutcome>} What the write ended with.
   */
  updateFields(
    task: TaskSummary,
    changes: TaskFieldChanges,
    toast: FieldWriteToast,
    previous?: TaskFieldChanges,
  ): Promise<ViewTaskOutcome>;
  // #endregion
}

/**
 * Function createViewTaskWritesStore
 *
 * @description
 * Creates the store of the task menu's and the selection bar's writes.
 *
 * @returns {Type<ViewTaskWritesStoreInstance>} Injectable store constructor.
 */
function createViewTaskWritesStore(): Type<ViewTaskWritesStoreInstance> {
  return signalStore(
    withState(initialState),
    withProps(() => ({
      _writer: inject(VIEW_TASK_WRITER),
      _page: inject(ListPageStore),
      _navigation: inject(SpacesNavigationStore),
      _workspace: inject<WorkspaceContextPort>(WORKSPACE_CONTEXT),
      _toasts: inject(CwToastService),
      _taskDetail: inject(TaskDetailOpener),
      _document: inject(DOCUMENT),
      _locale: inject(LOCALE_ID),
      _destroyRef: inject(DestroyRef),
      _undoToasts: new Set<string>(),
    })),
    withComputed((store) => ({
      cancelKeys: (): readonly string[] | null =>
        store._cancelTasks()?.map((task: TaskSummary): string => task.key) ?? null,
      deleteTitle: (): string => {
        const tasks: readonly TaskSummary[] = store._deleteTasks();
        const count: number = tasks.length;
        if (count > 1) return $localize`:@@spaces.bulk.delete-title:Delete ${count}:count: tasks?`;
        const name: string = tasks[0]?.name ?? '';
        return store._deleteFromMenu()
          ? $localize`:@@spaces.rows.delete-title:Delete “${name}:name:”?`
          : $localize`:@@spaces.bulk.delete-title-one:Delete this task?`;
      },
      deleteText: (): string => {
        if (!store._deleteFromMenu()) {
          return $localize`:@@spaces.bulk.delete-text:The selected tasks go to the trash with their subtasks, where they stay 30 days.`;
        }
        return store._deleteTasks().length > 1
          ? $localize`:@@spaces.rows.delete-text-many:They go to the trash with their subtasks, where they stay 30 days.`
          : $localize`:@@spaces.rows.delete-text-one:It goes to the trash with its subtasks, where it stays 30 days.`;
      },
      deleteAction: (): string => {
        const count: number = store._deleteTasks().length;
        return count > 1
          ? $localize`:@@spaces.bulk.delete-action:Delete ${count}:count: tasks`
          : $localize`:@@spaces.bulk.delete-action-one:Delete the task`;
      },
      deleteItems: (): readonly string[] =>
        store._deleteTasks().map((task: TaskSummary): string => `${task.key} · ${task.name}`),
      statusOptions: (): readonly StatusOption[] => {
        const space: Space | null = store._page.space.hasValue() ? store._page.space.value() : null;
        return defaultStatusOptions().map((option: StatusOption): StatusOption => {
          const own: SpaceStatusOption | undefined = space?.statuses.find(
            (status: SpaceStatusOption): boolean => status.key === option.key,
          );
          return own ? { ...option, label: own.name ?? option.label, hidden: own.hidden } : option;
        });
      },
      people: (): readonly Person[] => {
        if (!store._page.organizationMembers.hasValue()) return [];
        const me: string = store._workspace.user().id;
        return store._page.organizationMembers
          .value()
          .filter((member: ListMember): boolean => member.name !== null)
          .map((member: ListMember): Person => personOf(member.userId, member.name ?? ''))
          .sort((a: Person, b: Person): number => Number(b.id === me) - Number(a.id === me));
      },
      userId: (): string => store._workspace.user().id,
      targets: (): readonly MoveTarget[] => {
        if (!store._navigation.spaces.hasValue() || !store._navigation.overviews.hasValue()) {
          return [];
        }
        const overviews: Readonly<Record<string, SpaceOverview>> =
          store._navigation.overviews.value();
        const current: string | null = store._page.listId();
        return store._navigation.spaces.value().flatMap((space: Space): MoveTarget[] =>
          space.id in overviews
            ? overviews[space.id].lists
                .filter((summary: ListSummary): boolean => summary.list.id !== current)
                .map((summary: ListSummary): MoveTarget => ({
                  listId: summary.list.id,
                  name: summary.list.name,
                  spaceName: space.name,
                  icon: listIconName(summary.list),
                  tone:
                    summary.list.color === 'gris'
                      ? 'text-muted-foreground'
                      : lookTone(summary.list.color),
                }))
            : [],
        );
      },
    })),
    withMethods((store) => {
      let keepRefused: ((taskKeys: readonly string[]) => void) | null = null;
      const writer: ViewTaskWriter = store._writer;
      const toasts: CwToastService = store._toasts;

      const open: (taskKey: string, task?: TaskSummary) => void = (
        taskKey: string,
        task?: TaskSummary,
      ): void => {
        void store._taskDetail.open(
          taskKey,
          task
            ? { key: task.key, name: task.name, status: task.status, milestone: task.milestone }
            : undefined,
        );
      };

      const reportProblems: (outcome: TaskBulkOutcome) => boolean = (
        outcome: TaskBulkOutcome,
      ): boolean => {
        if (outcome.notSent.length > 0) {
          toasts.warning($localize`:@@spaces.bulk.not-sent:Some selected tasks were not sent.`);
        }
        if (outcome.unknown.length > 0) {
          toasts.warning(
            $localize`:@@spaces.bulk.unknown:The outcome is unknown. The tasks are being refreshed.`,
          );
        }
        if (outcome.done.length > 0) return true;
        if (
          outcome.failed.length > 0 &&
          outcome.unknown.length === 0 &&
          outcome.notSent.length === 0
        ) {
          toasts.error($localize`:@@spaces.bulk.failed:The selection could not be changed`);
        }
        return false;
      };

      const keepUndoToast: (id: string) => void = (id: string): void => {
        const shown: ReadonlySet<string> = new Set(
          toasts.toasts().map((item: { readonly id: string }): string => item.id),
        );
        for (const kept of store._undoToasts) if (!shown.has(kept)) store._undoToasts.delete(kept);
        store._undoToasts.add(id);
      };

      const report: (
        tasks: readonly TaskSummary[],
        outcome: ViewTaskOutcome,
        toast: (done: readonly TaskBulkEntry[], outcome: ViewTaskOutcome) => WriteToast,
        organizationId: string,
      ) => void = (
        tasks: readonly TaskSummary[],
        outcome: ViewTaskOutcome,
        toast: (done: readonly TaskBulkEntry[], outcome: ViewTaskOutcome) => WriteToast,
        organizationId: string,
      ): void => {
        if (store._workspace.organization().id !== organizationId) return;
        const live: boolean = !store._destroyRef.destroyed;
        if (live && (outcome.done.length > 0 || outcome.unknown.length > 0)) {
          store._page.refreshCounts();
        }
        if (!reportProblems(outcome)) return;
        const failedKeys: readonly string[] = outcome.failed.map(
          (item: TaskBulkSelection): string => item.taskKey,
        );
        if (live && failedKeys.length > 0) keepRefused?.(failedKeys);
        if (live) {
          const message: WriteToast = toast(outcome.done, outcome);
          const copy: string | null = message.open ?? null;
          const id: string = toasts.show(message.title, {
            description: message.description,
            ...(copy
              ? {
                  action: {
                    label: $localize`:@@spaces.rows.open:Open`,
                    run: (): void => {
                      open(copy);
                    },
                  },
                }
              : message.undo
                ? { undo: message.undo }
                : {}),
          });
          if (!copy && message.undo) keepUndoToast(id);
        }
        if (outcome.failed.length > 0) {
          toasts.error(
            bulkPartialText(outcome.failed.length, tasks.length),
            live ? { description: $localize`:@@spaces.bulk.partial-text:They stay selected.` } : {},
          );
        }
      };

      const perform: (
        tasks: readonly TaskSummary[],
        action: TaskBulkAction,
        toast: (done: readonly TaskBulkEntry[], outcome: ViewTaskOutcome) => WriteToast,
      ) => Promise<void> = async (
        tasks: readonly TaskSummary[],
        action: TaskBulkAction,
        toast: (done: readonly TaskBulkEntry[], outcome: ViewTaskOutcome) => WriteToast,
      ): Promise<void> => {
        if (tasks.length === 0) return;
        const organizationId: string = store._workspace.organization().id;
        const outcome: ViewTaskOutcome = await writer.act(tasks, action);
        report(tasks, outcome, toast, organizationId);
      };

      const settleUndo: (outcomes: readonly ViewTaskOutcome[], total: number) => void = (
        outcomes: readonly ViewTaskOutcome[],
        total: number,
      ): void => {
        const changed: readonly string[] = outcomes.flatMap((item: ViewTaskOutcome) =>
          item.changed.map((selection: TaskBulkSelection): string => selection.taskKey),
        );
        if (changed.length > 0) {
          toasts.warning(undoConflictTitle(changed), {
            description: undoConflictText(changed.length),
          });
        }
        const outcome: TaskBulkOutcome = {
          affected: outcomes.reduce((sum: number, item: ViewTaskOutcome) => sum + item.affected, 0),
          done: outcomes.flatMap((item: ViewTaskOutcome) => item.done),
          failed: outcomes.flatMap((item: ViewTaskOutcome) => item.failed),
          unknown: outcomes.flatMap((item: ViewTaskOutcome) => item.unknown),
          notSent: outcomes.flatMap((item: ViewTaskOutcome) => item.notSent),
        };
        if (!store._destroyRef.destroyed) {
          if (outcome.done.length > 0 || outcome.unknown.length > 0) store._page.refreshCounts();
          if (outcome.failed.length > 0) writer.reload();
        }
        if (reportProblems(outcome) && outcome.failed.length > 0) {
          toasts.error(bulkPartialText(outcome.failed.length, total - changed.length));
        }
      };

      const reverse: (
        writes: readonly ReverseWrite[],
        after: Readonly<Partial<Record<string, number>>>,
      ) => Promise<void> = async (
        writes: readonly ReverseWrite[],
        after: Readonly<Partial<Record<string, number>>>,
      ): Promise<void> => {
        const sent: readonly ReverseWrite[] = writes.filter(
          (write: ReverseWrite): boolean => write.tasks.length > 0,
        );
        if (sent.length === 0) return;
        const outcomes: readonly ViewTaskOutcome[] = await Promise.all(
          sent.map((write: ReverseWrite) => writer.act(write.tasks, write.action, after)),
        );
        settleUndo(
          outcomes,
          sent.reduce((sum: number, write: ReverseWrite): number => sum + write.tasks.length, 0),
        );
      };

      const undoStatuses: (outcome: ViewTaskOutcome) => void = (outcome: ViewTaskOutcome): void => {
        void reverse(
          groupBy(
            confirmedOf(outcome),
            (task: ConfirmedTask) =>
              `${task.status}\u0000${task.cancelReason ?? ''}\u0000${task.cancelNote ?? ''}`,
          ).map((group: readonly ConfirmedTask[]): ReverseWrite => {
            const { status, cancelReason, cancelNote }: ConfirmedTask = group[0];
            return {
              tasks: group,
              action:
                status === 'cancelled' && cancelReason
                  ? { type: 'status', status, cancelReason, cancelNote }
                  : { type: 'status', status },
            };
          }),
          outcome.after,
        );
      };

      const restore: (entryIds: readonly string[]) => Promise<void> = async (
        entryIds: readonly string[],
      ): Promise<void> => {
        const restored: boolean = await writer.restore(entryIds);
        if (!store._destroyRef.destroyed) store._page.refreshCounts();
        if (!restored) {
          toasts.error($localize`:@@spaces.bulk.restore-failed:The tasks could not be restored`);
        }
      };

      const copy: (text: string, title: string) => Promise<void> = async (
        text: string,
        title: string,
      ): Promise<void> => {
        try {
          await store._document.defaultView?.navigator.clipboard.writeText(text);
          toasts.show(title, { description: text });
        } catch {
          toasts.error($localize`:@@spaces.rows.copy-failed:Could not copy`, {
            description: text,
          });
        }
      };

      const toggleAssignee: (
        tasks: readonly TaskSummary[],
        userId: string,
        bar?: boolean,
      ) => void = (tasks: readonly TaskSummary[], userId: string, bar: boolean = false): void => {
        if (tasks.length === 0) return;
        const name: string =
          store.people().find((person: Person): boolean => person.id === userId)?.name ?? '';
        const all: boolean = tasks.every((task: TaskSummary): boolean =>
          task.assigneeIds.includes(userId),
        );
        const changed: readonly TaskSummary[] = all
          ? tasks
          : tasks.filter((task: TaskSummary): boolean => !task.assigneeIds.includes(userId));
        const label: string = tasksLabel(tasks);
        void perform(
          changed,
          { type: all ? 'unassign' : 'assign', userId },
          (done: readonly TaskBulkEntry[], outcome: ViewTaskOutcome) => ({
            title: all
              ? $localize`:@@spaces.bulk.unassigned:${name}:name: removed`
              : $localize`:@@spaces.bulk.assigned:${name}:name: assigned`,
            description: bar ? bulkUpdatedText(done.length) : label,
            undo: (): void => {
              void reverse(
                [
                  {
                    tasks: confirmedOf(outcome),
                    action: { type: all ? 'assign' : 'unassign', userId },
                  },
                ],
                outcome.after,
              );
            },
          }),
        );
      };

      return {
        onRefused(keep: (taskKeys: readonly string[]) => void): void {
          keepRefused = keep;
        },
        open,
        setStatus(tasks: readonly TaskSummary[], status: StatusKey, milestone: boolean): void {
          if (status === 'cancelled') {
            const pending: readonly TaskSummary[] = tasks.filter(
              (task: TaskSummary): boolean => writer.shownStatus(task) !== 'cancelled',
            );
            if (pending.length > 0) patchState(store, { _cancelTasks: pending });
            return;
          }
          const changed: readonly TaskSummary[] = tasks.filter(
            (task: TaskSummary): boolean => writer.shownStatus(task) !== status,
          );
          if (changed.length === 0) return;
          const word: string = statusLabel(status, store.statusOptions(), milestone);
          const label: string = tasksLabel(tasks);
          void perform(
            changed,
            { type: 'status', status },
            (done: readonly TaskBulkEntry[], outcome: ViewTaskOutcome) => ({
              title: $localize`:@@spaces.rows.status-toast:${label}:label: · ${word}:status:`,
              description:
                tasks.length > 1
                  ? bulkUpdatedText(done.length)
                  : $localize`:@@spaces.rows.status-changed:Status changed.`,
              undo: (): void => {
                undoStatuses(outcome);
              },
            }),
          );
        },
        confirmCancel(cancellation: TaskCancellation): void {
          const tasks: readonly TaskSummary[] = store._cancelTasks() ?? [];
          patchState(store, { _cancelTasks: null });
          if (tasks.length === 0) return;
          const reason: string = CANCEL_REASON_LABELS[cancellation.reason];
          void perform(
            tasks,
            {
              type: 'status',
              status: 'cancelled',
              cancelReason: cancellation.reason,
              cancelNote: cancellation.note || null,
            },
            (done: readonly TaskBulkEntry[], outcome: ViewTaskOutcome) => {
              const count: number = done.length;
              const key: string = done[0]?.taskKey ?? '';
              return {
                title:
                  count > 1
                    ? $localize`:@@spaces.rows.cancelled-many:${count}:count: tasks cancelled`
                    : $localize`:@@spaces.rows.cancelled-one:${key}:key: cancelled`,
                description: $localize`:@@spaces.rows.cancel-reason:Reason: ${reason}:reason:.`,
                undo: (): void => {
                  undoStatuses(outcome);
                },
              };
            },
          );
        },
        keepCancel(): void {
          patchState(store, { _cancelTasks: null });
        },
        setPriority(tasks: readonly TaskSummary[], priority: PriorityKey): void {
          const changed: readonly TaskSummary[] = tasks.filter(
            (task: TaskSummary): boolean => task.priority !== priority,
          );
          if (changed.length === 0) return;
          const label: string = tasksLabel(tasks);
          const word: string = PRIORITY_LABELS[priority].toLocaleLowerCase(store._locale);
          void perform(
            changed,
            { type: 'priority', priority },
            (done: readonly TaskBulkEntry[], outcome: ViewTaskOutcome) => ({
              title: $localize`:@@spaces.rows.priority-toast:${label}:label: · ${word}:priority: priority`,
              description:
                tasks.length > 1
                  ? bulkUpdatedText(done.length)
                  : $localize`:@@spaces.rows.priority-changed:Priority changed.`,
              undo: (): void => {
                void reverse(
                  groupBy(confirmedOf(outcome), (task: ConfirmedTask) => task.priority).map(
                    (group: readonly ConfirmedTask[]): ReverseWrite => ({
                      tasks: group,
                      action: { type: 'priority', priority: group[0].priority },
                    }),
                  ),
                  outcome.after,
                );
              },
            }),
          );
        },
        toggleAssignee,
        moveTo(tasks: readonly TaskSummary[], listId: string, bar: boolean = false): void {
          const moved: readonly TaskSummary[] = tasks.filter(
            (task: TaskSummary): boolean => task.listId !== listId,
          );
          if (moved.length === 0) return;
          const name: string =
            store.targets().find((target: MoveTarget): boolean => target.listId === listId)?.name ??
            '';
          const key: string = moved[0].key;
          void perform(
            moved,
            { type: 'move', listId },
            (done: readonly TaskBulkEntry[], outcome: ViewTaskOutcome) => ({
              title:
                bar || tasks.length > 1
                  ? bulkMovedText(done.length)
                  : $localize`:@@spaces.rows.moved-one:${key}:key: moved`,
              description: $localize`:@@spaces.bulk.moved-text:To ${name}:name:.`,
              undo: (): void => {
                void reverse(
                  groupBy(confirmedOf(outcome), (task: ConfirmedTask) => task.listId).map(
                    (group: readonly ConfirmedTask[]): ReverseWrite => ({
                      tasks: group,
                      action: { type: 'move', listId: group[0].listId },
                    }),
                  ),
                  outcome.after,
                );
              },
            }),
          );
        },
        markDone(tasks: readonly TaskSummary[]): void {
          const open: readonly TaskSummary[] = tasks.filter(
            (task: TaskSummary): boolean => writer.shownStatus(task) !== 'done',
          );
          if (open.length === 0) return;
          void perform(
            open,
            { type: 'status', status: 'done' },
            (done: readonly TaskBulkEntry[], outcome: ViewTaskOutcome) => ({
              title: bulkDoneText(done.length),
              description: $localize`:@@spaces.bulk.done-toast-text:Status: Done.`,
              undo: (): void => {
                undoStatuses(outcome);
              },
            }),
          );
        },
        async remind(tasks: readonly TaskSummary[]): Promise<void> {
          const at: Date = new Date();
          at.setDate(at.getDate() + 1);
          at.setHours(REMINDER_HOUR, 0, 0, 0);
          const keys: readonly string[] = await writer.remind(
            tasks.map((task: TaskSummary): string => task.key),
            at,
          );
          if (store._destroyRef.destroyed) return;
          if (keys.length === 0) {
            toasts.error($localize`:@@spaces.rows.remind-failed:The reminder could not be set`);
            return;
          }
          const day: string = new Intl.DateTimeFormat(store._locale, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          }).format(at);
          const when: string = `${day.charAt(0).toLocaleUpperCase(store._locale)}${day.slice(1)}`;
          const count: number = keys.length;
          toasts.show(
            count > 1
              ? $localize`:@@spaces.rows.reminded-many:${count}:count: reminders set`
              : $localize`:@@spaces.rows.reminded:Reminder set`,
            {
              description: $localize`:@@spaces.rows.reminded-text:${when}:date:, 9 AM · ${keys.join(', ')}:keys:`,
            },
          );
        },
        duplicate(tasks: readonly TaskSummary[]): void {
          void perform(tasks, { type: 'duplicate' }, (done: readonly TaskBulkEntry[]) => {
            const copies: readonly string[] = done
              .map((entry: TaskBulkEntry) => entry.newTaskKey)
              .filter((key: string | null): key is string => key !== null);
            const count: number = copies.length;
            return {
              title:
                tasks.length > 1
                  ? $localize`:@@spaces.rows.duplicated-many:${count}:count: tasks duplicated`
                  : $localize`:@@spaces.rows.duplicated:Task duplicated`,
              description: copies.join(', '),
              undo: null,
              open: count === 1 ? copies[0] : null,
            };
          });
        },
        copyLinks(tasks: readonly TaskSummary[]): void {
          const origin: string = store._document.defaultView?.location.origin ?? '';
          const slug: string = store._workspace.organization().slug;
          const count: number = tasks.length;
          void copy(
            tasks.map((task: TaskSummary): string => `${origin}/${slug}/t/${task.key}`).join('\n'),
            count > 1
              ? $localize`:@@spaces.rows.links-copied:${count}:count: links copied`
              : $localize`:@@spaces.rows.link-copied:Link copied`,
          );
        },
        copyKeys(tasks: readonly TaskSummary[]): void {
          void copy(
            tasks.map((task: TaskSummary): string => task.key).join(', '),
            tasks.length > 1
              ? $localize`:@@spaces.rows.keys-copied:Identifiers copied`
              : $localize`:@@spaces.rows.key-copied:Identifier copied`,
          );
        },
        askDelete(tasks: readonly TaskSummary[], menu: boolean): void {
          if (tasks.length === 0) return;
          patchState(store, { _deleteTasks: tasks, _deleteFromMenu: menu, deleteOpen: true });
        },
        setDeleteOpen(open: boolean): void {
          patchState(store, { deleteOpen: open });
        },
        async trash(): Promise<void> {
          const tasks: readonly TaskSummary[] = store._deleteTasks();
          const menu: boolean = store._deleteFromMenu();
          if (tasks.length === 0 || store.deleting()) return;
          patchState(store, { deleting: true });
          const key: string = tasks[0].key;
          await perform(
            tasks,
            { type: 'trash' },
            (done: readonly TaskBulkEntry[], outcome: ViewTaskOutcome) => {
              const count: number = done.length;
              const subtasks: number = Math.max(0, outcome.affected - count);
              const kept: string = $localize`:@@spaces.bulk.deleted-text:Kept 30 days in the trash.`;
              const entries: readonly string[] = [
                ...new Set(
                  done
                    .map((entry: TaskBulkEntry) => entry.trashEntryId)
                    .filter((id: string | null): id is string => id !== null),
                ),
              ];
              return {
                title:
                  menu && tasks.length === 1
                    ? $localize`:@@spaces.rows.deleted-one:${key}:key: deleted`
                    : bulkDeletedText(count),
                description:
                  subtasks === 0
                    ? kept
                    : subtasks === 1
                      ? $localize`:@@spaces.bulk.deleted-subtask:With ${subtasks}:count: subtask. ${kept}:kept:`
                      : $localize`:@@spaces.bulk.deleted-subtasks:With ${subtasks}:count: subtasks. ${kept}:kept:`,
                undo:
                  entries.length > 0
                    ? (): void => {
                        void restore(entries);
                      }
                    : null,
              };
            },
          );
          if (store._destroyRef.destroyed) return;
          patchState(store, { deleting: false, deleteOpen: false });
        },
        async updateFields(
          task: TaskSummary,
          changes: TaskFieldChanges,
          toast: FieldWriteToast,
          previous?: TaskFieldChanges,
        ): Promise<ViewTaskOutcome> {
          const organizationId: string = store._workspace.organization().id;
          const outcome: ViewTaskOutcome = await writer.update(task, changes);
          report(
            [task],
            outcome,
            (_: readonly TaskBulkEntry[], applied: ViewTaskOutcome) => {
              const before: ConfirmedTask | undefined = applied.before[task.key];
              return {
                title: toast.title,
                description: toast.description,
                undo: before
                  ? (): void => {
                      void writer
                        .update(before, previousFields(before, changes, previous), applied.after)
                        .then((undone: ViewTaskOutcome): void => {
                          settleUndo([undone], 1);
                        });
                    }
                  : null,
              };
            },
            organizationId,
          );
          return outcome;
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
 * Constant ViewTaskWritesStore
 *
 * @description
 * The writes of a task view's menu and selection bar, page-scoped (each task view's page provides
 * it with `VIEW_TASK_WRITER`, its reader store): status (`Cancelled` asks one reason through
 * `cancelKeys`), priority, assignees, `Move to`, `Mark done`, the reminder, `Duplicate`, the two
 * copies, the confirmed deletion and the single-field writes (`updateFields`). Each write goes
 * through the writer, whose rows change at once; a refused chunk stays selected (`onRefused`) and
 * a second toast counts it, an uncertain answer warns, a refusal of everything shows the failure
 * toast; each applied write reads the list's counts again (`ListPageStore.refreshCounts`) and
 * shows a toast whose `Undo` writes back the values confirmed before it (statuses with their
 * reasons and recorded notes, priorities, assignees, lists, fields) or restores the trash entries,
 * bound to the version the write left each task at. A write answered after the view was left
 * reports only what failed; leaving the view dismisses its `Undo` toasts.
 *
 * @type {Type<ViewTaskWritesStoreInstance>}
 */
export const ViewTaskWritesStore: Type<ViewTaskWritesStoreInstance> = createViewTaskWritesStore();
