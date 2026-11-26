import { inject, type Signal, type Type } from '@angular/core';
import type { StatusKey } from '@cadenway/contracts';
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

import {
  defaultStatusOptions,
  isClosedStatus,
  type Person,
  personOf,
  pickableStatuses,
  STATUS_SETTLE_MS,
  statusLabel,
  type StatusOption,
  TaskActionsApi,
  type TaskBulkAction,
  type TaskBulkOutcome,
  type TaskSummary,
} from '@features/task';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { undoConflictText, undoConflictTitle } from '../../constants/bulk-copy/bulk-copy.constants';
import { BOARD_ORDER } from '../../constants/statuses/statuses.constants';
import type {
  BoardCard,
  BoardCardProgress,
  BoardColumn,
  BoardPendingMove,
} from '../../models/board-view/board-view.interface';
import type { ListMember } from '../../models/list-member/list-member.interface';
import type { ListTaskItem } from '../../models/list-tasks/list-tasks.interface';
import type { ListTaskQuery } from '../../models/list-view-config/list-view-config.interface';
import type { Space, SpaceStatusOption } from '../../models/space/space.interface';
import type {
  ViewTaskOutcome,
  ViewTaskWriter,
} from '../../models/view-task-write/view-task-write.interface';
import { ListPageStore } from '../list-page/list-page.store';
import { ListTasksStore } from '../list-tasks/list-tasks.store';
import { ListViewStore } from '../list-view/list-view.store';

/**
 * Interface BoardViewState
 *
 * @description
 * What the board keeps on its own: its folded columns, the moves waiting to be written and a
 * counter that hands the board's cards back to `cw-kanban` after a drop that changes nothing.
 */
interface BoardViewState {
  // #region Properties
  /**
   * Property collapsedColumns
   *
   * @description
   * The statuses whose column is folded to its band, for as long as the view lives.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly collapsedColumns: readonly string[];

  /**
   * Property _pending
   *
   * @description
   * The moves waiting to be written, by task key: the status each moved card shows, settled
   * `STATUS_SETTLE_MS` after the last move of its task, with the task it started from.
   *
   * @type {Readonly<Partial<Record<string, BoardPendingMove>>>}
   * @readonly
   */
  readonly _pending: Readonly<Partial<Record<string, BoardPendingMove>>>;

  /**
   * Property _revision
   *
   * @description
   * Bumped to give `cw-kanban` a new `items` array, which puts a card moved by a drop that
   * writes nothing back in its column.
   *
   * @type {number}
   * @readonly
   */
  readonly _revision: number;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * Every column unfolded.
 *
 * @type {BoardViewState}
 */
const initialState: BoardViewState = { collapsedColumns: [], _pending: {}, _revision: 0 };

/**
 * Type BoardStatusSend
 *
 * @description
 * Writes a settled move: the task as shown and the status of the column it was dropped in.
 *
 * @type {(task: TaskSummary, status: StatusKey) => void}
 */
export type BoardStatusSend = (task: TaskSummary, status: StatusKey) => void;

/**
 * Function progressOf
 *
 * @description
 * The progress a card shows: its subtasks when it has some, else its checklist.
 *
 * @param {TaskSummary} task - The task.
 * @returns {BoardCardProgress | null} The progress, or null without subtasks or checklist.
 */
function progressOf(task: TaskSummary): BoardCardProgress | null {
  const { subtasks, checklist }: TaskSummary = task;
  if (subtasks.total > 0) {
    return { icon: 'phosphorTreeStructureBold', closed: subtasks.closed, total: subtasks.total };
  }
  return checklist.total > 0
    ? { icon: 'phosphorListChecksBold', closed: checklist.closed, total: checklist.total }
    : null;
}

/**
 * Interface BoardViewStoreInstance
 *
 * @description
 * Public API of `BoardViewStore`.
 */
export interface BoardViewStoreInstance {
  // #region Properties
  /**
   * Property collapsedColumns
   *
   * @description
   * The statuses whose column is folded.
   *
   * @type {Signal<readonly string[]>}
   * @readonly
   */
  readonly collapsedColumns: Signal<readonly string[]>;

  /**
   * Property statusOptions
   *
   * @description
   * The statuses of the list's space (its names and hidden statuses); the default words until
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
   * The organization's members, whose initials the cards show.
   *
   * @type {Signal<readonly Person[]>}
   * @readonly
   */
  readonly people: Signal<readonly Person[]>;

  /**
   * Property cards
   *
   * @description
   * The cards in the view's order, each filed under the status it shows: a move waiting to be
   * written, else the view's writes and pending changes applied. A read of the tasks never
   * replaces a waiting move.
   *
   * @type {Signal<readonly BoardCard[]>}
   * @readonly
   */
  readonly cards: Signal<readonly BoardCard[]>;

  /**
   * Property columns
   *
   * @description
   * The status columns in `BOARD_ORDER`, without those hidden with `Columns` and without the
   * statuses the space stopped using, unless a card still sits there.
   *
   * @type {Signal<readonly BoardColumn[]>}
   * @readonly
   */
  readonly columns: Signal<readonly BoardColumn[]>;
  // #endregion

  // #region Methods
  /**
   * Method setCollapsed
   *
   * @description
   * Follows the board's folded columns (its fold buttons).
   *
   * @param {readonly string[]} columns - The folded statuses.
   */
  setCollapsed(columns: readonly string[]): void;

  /**
   * Method toggleCollapsed
   *
   * @description
   * Folds an unfolded column or unfolds a folded one (the column menu).
   *
   * @param {string} column - Status of the column.
   */
  toggleCollapsed(column: string): void;

  /**
   * Method hideColumn
   *
   * @description
   * `Hide the column` of the column menu: adds the status to the view's hidden board columns
   * (`ListViewStore.presentation`) and shows `Column hidden`, whose `Undo` shows that column again
   * and leaves the columns hidden since as they are.
   *
   * @param {StatusKey} column - Status of the column.
   */
  hideColumn(column: StatusKey): void;

  /**
   * Method accepts
   *
   * @description
   * Whether a drop of a card onto a column changes its status: another column whose status the
   * task may take (a milestone takes its four statuses; a status the space stopped using is not
   * offered).
   *
   * @param {BoardCard} card - The dropped card.
   * @param {string} column - Status of the column it was dropped in.
   * @returns {boolean} Whether the status should be written, the column's id then being a status.
   */
  accepts(card: BoardCard, column: string): column is StatusKey;

  /**
   * Method restoreCards
   *
   * @description
   * Hands the cards back to the board, so a card moved by a drop that writes nothing returns to
   * the column of its status.
   */
  restoreCards(): void;

  /**
   * Method settleWith
   *
   * @description
   * Gives the write a settled move goes through (the page's `ViewTaskWritesStore.setStatus`), or
   * null once nothing may be written.
   *
   * @param {BoardStatusSend | null} send - The write.
   */
  settleWith(send: BoardStatusSend | null): void;

  /**
   * Method stage
   *
   * @description
   * A card dropped in another column: the card shows the status at once and the move is written
   * `STATUS_SETTLE_MS` after the last move of that task, so quick moves write only the last
   * status. A move back to the status the view had confirmed cancels the waiting write: nothing
   * is sent.
   *
   * @param {BoardCard} card - The moved card.
   * @param {StatusKey} status - Status of the column it was dropped in.
   */
  stage(card: BoardCard, status: StatusKey): void;

  /**
   * Method discard
   *
   * @description
   * Forgets the waiting moves of tasks without writing them: another write of their status (the
   * task menu, a drop on `Cancelled`) replaces them.
   *
   * @param {readonly string[]} taskKeys - The tasks.
   */
  discard(taskKeys: readonly string[]): void;

  /**
   * Method hold
   *
   * @description
   * Keeps the waiting moves of tasks from settling while the cancellation reason of those tasks
   * is asked (a drop on `Cancelled`, `Cancelled` in the task menu): the card keeps its waiting
   * column, and the move is replaced only once the cancellation is confirmed (`discard`).
   *
   * @param {readonly string[]} taskKeys - The tasks whose reason is asked.
   */
  hold(taskKeys: readonly string[]): void;

  /**
   * Method release
   *
   * @description
   * The cancellation was dismissed: the held moves settle again, `STATUS_SETTLE_MS` from now.
   *
   * @param {readonly string[]} taskKeys - The tasks whose reason was asked.
   */
  release(taskKeys: readonly string[]): void;

  /**
   * Method flush
   *
   * @description
   * Writes every waiting move at once through `settleWith`'s write, from the task it started
   * from when the current read no longer holds it; the view's query changing does it on its own.
   */
  flush(): void;

  /**
   * Method leave
   *
   * @description
   * The view is left: every waiting move (a held one included) is written with
   * `TaskActionsApi.bulk`, which outlives the view, each after the board's write of the same task
   * still in flight has settled and at the version it left, so the last move lands last.
   * `Cancelled` is never sent from here (it always waits for its reason in the view). An applied
   * move reads the list's counts again (`ListPageStore.refreshCounts`, inert once the list page
   * is left too) and shows the status toast, whose `Undo` writes the confirmed status back at the
   * version the move left (a refusal warns that the task changed since); a refused, uncertain or
   * unsent move (the organization changed) shows `The task could not be changed`.
   */
  leave(): void;

  /**
   * Method writerOver
   *
   * @description
   * The view's writer (`VIEW_TASK_WRITER`) over the reader's writes, which records each task's
   * write in flight and the version its answer left, for `leave`.
   *
   * @param {ViewTaskWriter} writer - The reader's writes (`ListTasksStore`).
   * @returns {ViewTaskWriter} The same writes, followed.
   */
  writerOver(writer: ViewTaskWriter): ViewTaskWriter;
  // #endregion
}

/**
 * Function createBoardViewStore
 *
 * @description
 * Creates the `Board` view's store.
 *
 * @returns {Type<BoardViewStoreInstance>} Injectable store constructor.
 */
function createBoardViewStore(): Type<BoardViewStoreInstance> {
  return signalStore(
    withState(initialState),
    withProps(() => ({
      _tasks: inject(ListTasksStore),
      _page: inject(ListPageStore),
      _view: inject(ListViewStore),
      _toasts: inject(CwToastService),
      _actions: inject(TaskActionsApi),
      _workspace: inject<WorkspaceContextPort>(WORKSPACE_CONTEXT),
    })),
    withComputed((store) => ({
      statusOptions: (): readonly StatusOption[] => {
        const space: Space | null = store._page.space.hasValue() ? store._page.space.value() : null;
        return defaultStatusOptions().map((option: StatusOption): StatusOption => {
          const own: SpaceStatusOption | undefined = space?.statuses.find(
            (status: SpaceStatusOption): boolean => status.key === option.key,
          );
          return own ? { ...option, label: own.name ?? option.label, hidden: own.hidden } : option;
        });
      },
      people: (): readonly Person[] =>
        store._page.organizationMembers.hasValue()
          ? store._page.organizationMembers
              .value()
              .filter((member: ListMember): boolean => member.name !== null)
              .map((member: ListMember): Person => personOf(member.userId, member.name ?? ''))
          : [],
    })),
    withComputed((store) => ({
      cards: (): readonly BoardCard[] => {
        store._revision();
        const pending: Readonly<Partial<Record<string, BoardPendingMove>>> = store._pending();
        const people: ReadonlyMap<string, Person> = new Map(
          store.people().map((person: Person): [string, Person] => [person.id, person]),
        );
        return store._tasks.items().map((item: ListTaskItem): BoardCard => ({
          task: item.task,
          status: pending[item.task.key]?.status ?? item.status,
          closed: isClosedStatus(pending[item.task.key]?.status ?? item.status),
          progress: progressOf(item.task),
          assignees: item.task.assigneeIds.flatMap((id: string): Person[] => {
            const person: Person | undefined = people.get(id);
            return person ? [person] : [];
          }),
        }));
      },
    })),
    withComputed((store) => ({
      columns: (): readonly BoardColumn[] => {
        const hidden: readonly StatusKey[] = store._view.presentation().hiddenBoardStatusKeys;
        const filled: ReadonlySet<StatusKey> = new Set(
          store.cards().map((card: BoardCard): StatusKey => card.status),
        );
        const options: ReadonlyMap<StatusKey, StatusOption> = new Map(
          store
            .statusOptions()
            .map((option: StatusOption): [StatusKey, StatusOption] => [option.key, option]),
        );
        return BOARD_ORDER.flatMap((key: StatusKey): BoardColumn[] => {
          const option: StatusOption | undefined = options.get(key);
          if (!option || hidden.includes(key) || (option.hidden && !filled.has(key))) return [];
          return [{ id: key, label: option.label, status: key }];
        });
      },
    })),
    withMethods((store) => {
      let send: BoardStatusSend | null = null;
      const timers: Map<string, ReturnType<typeof setTimeout>> = new Map<
        string,
        ReturnType<typeof setTimeout>
      >();
      const inflight: Map<string, Promise<ViewTaskOutcome>> = new Map<
        string,
        Promise<ViewTaskOutcome>
      >();
      const versions: Map<string, number> = new Map<string, number>();
      let query: string | null = null;
      const itemOf: (key: string) => ListTaskItem | undefined = (
        key: string,
      ): ListTaskItem | undefined =>
        store._tasks.items().find((item: ListTaskItem): boolean => item.task.key === key);
      const forget: (keys: readonly string[]) => void = (keys: readonly string[]): void => {
        for (const key of keys) {
          clearTimeout(timers.get(key));
          timers.delete(key);
          held.delete(key);
        }
        patchState(store, {
          _pending: Object.fromEntries(
            Object.entries(store._pending()).filter(
              ([key]: [string, BoardPendingMove | undefined]): boolean => !keys.includes(key),
            ),
          ),
        });
      };
      const held: Set<string> = new Set<string>();
      const due: (key: string) => BoardPendingMove | null = (
        key: string,
      ): BoardPendingMove | null => {
        const move: BoardPendingMove | undefined = store._pending()[key];
        if (!move) return null;
        const item: ListTaskItem | undefined = itemOf(key);
        const confirmed: StatusKey = item?.status ?? move.from;
        return confirmed === move.status
          ? null
          : { task: item?.task ?? move.task, status: move.status, from: confirmed };
      };
      const write: (key: string) => void = (key: string): void => {
        const move: BoardPendingMove | null = due(key);
        if (move) send?.(move.task, move.status);
        forget([key]);
      };
      const schedule: (key: string) => void = (key: string): void => {
        clearTimeout(timers.get(key));
        timers.set(
          key,
          setTimeout((): void => {
            timers.delete(key);
            write(key);
          }, STATUS_SETTLE_MS),
        );
      };
      const follow: (keys: readonly string[], answer: Promise<ViewTaskOutcome>) => void = (
        keys: readonly string[],
        answer: Promise<ViewTaskOutcome>,
      ): void => {
        for (const key of keys) inflight.set(key, answer);
        void answer.then((outcome: ViewTaskOutcome): void => {
          for (const key of keys) {
            const version: number | undefined = outcome.after[key];
            if (version !== undefined) versions.set(key, Math.max(versions.get(key) ?? 0, version));
            if (inflight.get(key) === answer) inflight.delete(key);
          }
        });
      };
      const failed: () => void = (): void => {
        store._toasts.error(
          $localize`:@@spaces.task-writes.field-failed:The task could not be changed`,
        );
      };
      const undoLeft: (
        key: string,
        version: number,
        action: TaskBulkAction,
        organizationId: string,
      ) => Promise<void> = async (
        key: string,
        version: number,
        action: TaskBulkAction,
        organizationId: string,
      ): Promise<void> => {
        const answer: TaskBulkOutcome = await store._actions.bulk(
          [{ taskKey: key, version }],
          action,
          (): boolean => store._workspace.organization().id === organizationId,
        );
        if (answer.done.length > 0) {
          store._page.refreshCounts();
        } else if (answer.failed.length > 0) {
          store._toasts.warning(undoConflictTitle([key]), { description: undoConflictText(1) });
        } else {
          failed();
        }
      };
      const sendAfter: (key: string, move: BoardPendingMove) => Promise<void> = async (
        key: string,
        move: BoardPendingMove,
      ): Promise<void> => {
        const organizationId: string = store._workspace.organization().id;
        const outcome: ViewTaskOutcome | undefined = await inflight.get(key);
        const version: number = Math.max(
          move.task.version,
          store._tasks.taskOf(key)?.version ?? 0,
          versions.get(key) ?? 0,
          outcome?.after[key] ?? 0,
        );
        const answer: TaskBulkOutcome = await store._actions.bulk(
          [{ taskKey: key, version }],
          { type: 'status', status: move.status },
          (): boolean => store._workspace.organization().id === organizationId,
        );
        const left: number | null | undefined = answer.done.find(
          (entry: { readonly taskKey: string }): boolean => entry.taskKey === key,
        )?.version;
        if (left === undefined) {
          failed();
          return;
        }
        store._page.refreshCounts();
        const reason: TaskSummary['cancelReason'] = move.task.cancelReason;
        const back: TaskBulkAction | null =
          move.from !== 'cancelled'
            ? { type: 'status', status: move.from }
            : reason
              ? { type: 'status', status: move.from, cancelReason: reason }
              : null;
        const word: string = statusLabel(move.status, store.statusOptions(), move.task.milestone);
        store._toasts.show($localize`:@@spaces.rows.status-toast:${key}:label: · ${word}:status:`, {
          description: $localize`:@@spaces.rows.status-changed:Status changed.`,
          ...(back && left !== null
            ? {
                undo: (): void => {
                  void undoLeft(key, left, back, organizationId);
                },
              }
            : {}),
        });
      };
      return {
        setCollapsed(columns: readonly string[]): void {
          patchState(store, { collapsedColumns: columns });
        },
        toggleCollapsed(column: string): void {
          const collapsed: readonly string[] = store.collapsedColumns();
          patchState(store, {
            collapsedColumns: collapsed.includes(column)
              ? collapsed.filter((key: string): boolean => key !== column)
              : [...collapsed, column],
          });
        },
        hideColumn(column: StatusKey): void {
          const hidden: readonly StatusKey[] = store._view.presentation().hiddenBoardStatusKeys;
          if (hidden.includes(column)) return;
          const label: string =
            store.statusOptions().find((option: StatusOption): boolean => option.key === column)
              ?.label ?? '';
          store._view.setPresentation({ hiddenBoardStatusKeys: [...hidden, column] });
          store._toasts.show($localize`:@@spaces.board.hidden:Column hidden`, {
            description: $localize`:@@spaces.board.hidden-text:${label}:label: · show it again from “Columns”.`,
            undo: (): void => {
              store._view.setPresentation({
                hiddenBoardStatusKeys: store._view
                  .presentation()
                  .hiddenBoardStatusKeys.filter((key: StatusKey): boolean => key !== column),
              });
            },
          });
        },
        accepts(card: BoardCard, column: string): column is StatusKey {
          return (
            column !== card.status &&
            pickableStatuses(store.statusOptions(), card.status, card.task.milestone).some(
              (option: StatusOption): boolean => option.key === column,
            )
          );
        },
        restoreCards(): void {
          patchState(store, { _revision: store._revision() + 1 });
        },
        settleWith(next: BoardStatusSend | null): void {
          send = next;
        },
        stage(card: BoardCard, status: StatusKey): void {
          const key: string = card.task.key;
          const waiting: BoardPendingMove | undefined = store._pending()[key];
          const confirmed: StatusKey = itemOf(key)?.status ?? waiting?.from ?? card.task.status;
          if (confirmed === status) {
            forget([key]);
            return;
          }
          held.delete(key);
          patchState(store, {
            _pending: {
              ...store._pending(),
              [key]: { status, from: waiting?.from ?? confirmed, task: waiting?.task ?? card.task },
            },
          });
          schedule(key);
        },
        discard(taskKeys: readonly string[]): void {
          forget(taskKeys);
        },
        hold(taskKeys: readonly string[]): void {
          for (const key of taskKeys) {
            if (!store._pending()[key]) continue;
            clearTimeout(timers.get(key));
            timers.delete(key);
            held.add(key);
          }
        },
        release(taskKeys: readonly string[]): void {
          for (const key of taskKeys) {
            if (!held.delete(key) || !store._pending()[key]) continue;
            schedule(key);
          }
        },
        flush(): void {
          for (const key of Object.keys(store._pending())) write(key);
        },
        leave(): void {
          for (const key of Object.keys(store._pending())) {
            const move: BoardPendingMove | null = due(key);
            forget([key]);
            if (move && move.status !== 'cancelled') void sendAfter(key, move);
          }
          send = null;
        },
        writerOver(writer: ViewTaskWriter): ViewTaskWriter {
          return {
            act: (
              tasks: readonly TaskSummary[],
              action: Parameters<ViewTaskWriter['act']>[1],
              expected?: Readonly<Partial<Record<string, number>>>,
            ): Promise<ViewTaskOutcome> => {
              const answer: Promise<ViewTaskOutcome> = writer.act(tasks, action, expected);
              follow(
                tasks.map((task: TaskSummary): string => task.key),
                answer,
              );
              return answer;
            },
            update: (
              task: TaskSummary,
              changes: Parameters<ViewTaskWriter['update']>[1],
              expected?: Readonly<Partial<Record<string, number>>>,
            ): Promise<ViewTaskOutcome> => {
              const answer: Promise<ViewTaskOutcome> = writer.update(task, changes, expected);
              follow([task.key], answer);
              return answer;
            },
            remind: (taskKeys: readonly string[], at: Date): Promise<readonly string[]> =>
              writer.remind(taskKeys, at),
            restore: (entryIds: readonly string[]): Promise<boolean> => writer.restore(entryIds),
            reload: (): void => {
              writer.reload();
            },
            shownStatus: (task: TaskSummary): StatusKey => writer.shownStatus(task),
          };
        },
        _followQuery: signalMethod<ListTaskQuery>((next: ListTaskQuery): void => {
          const key: string = JSON.stringify(next);
          if (query !== null && key !== query) {
            for (const pending of Object.keys(store._pending())) write(pending);
          }
          query = key;
        }),
      };
    }),
    withHooks({
      onInit(store): void {
        store._followQuery(store._view.taskQuery);
      },
      onDestroy(store): void {
        store.leave();
      },
    }),
  );
}

/**
 * Constant BoardViewStore
 *
 * @description
 * The state of the `Board` view (`l/:listId/board`), route-scoped through
 * `BOARD_VIEW_PROVIDERS`, over the view's `ListTasksStore`: the status columns (`BOARD_ORDER`
 * with the space's names, without the columns hidden with `Columns` and the statuses the space
 * stopped using unless a card sits there), the cards filed under the status they show, the
 * folded columns (kept while the view lives) and `Hide the column` with its `Undo`. A moved
 * card shows its new status at once (`stage`); the move is written through the page's
 * `ViewTaskWritesStore` (`settleWith`) `STATUS_SETTLE_MS` after the last move of its task, a move
 * back to the confirmed status writes nothing, another query writes the waiting moves at once
 * (`flush`, from the task each started from when the new read no longer holds it), and leaving
 * the view writes them with `TaskActionsApi` after the board's writes in flight (`leave`, over
 * the writer `writerOver` follows); a read of the tasks never replaces a waiting move. A drop that writes nothing hands
 * the cards back (`restoreCards`) so the card returns to its column.
 *
 * @type {Type<BoardViewStoreInstance>}
 */
export const BoardViewStore: Type<BoardViewStoreInstance> = createBoardViewStore();
