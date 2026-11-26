import { inject, type Signal, type Type } from '@angular/core';
import type { StatusKey } from '@cadenway/contracts';
import { CwToastService } from '@cadenway/ui/components/toast';
import {
  patchState,
  signalStore,
  withComputed,
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
  type StatusOption,
  type TaskSummary,
} from '@features/task';

import { BOARD_ORDER } from '../../constants/statuses/statuses.constants';
import type {
  BoardCard,
  BoardCardProgress,
  BoardColumn,
} from '../../models/board-view/board-view.interface';
import type { ListMember } from '../../models/list-member/list-member.interface';
import type { ListTaskItem } from '../../models/list-tasks/list-tasks.interface';
import type { Space, SpaceStatusOption } from '../../models/space/space.interface';
import { ListPageStore } from '../list-page/list-page.store';
import { ListTasksStore } from '../list-tasks/list-tasks.store';
import { ListViewStore } from '../list-view/list-view.store';

/**
 * Interface BoardViewState
 *
 * @description
 * What the board keeps on its own: its folded columns and a counter that hands the board's
 * cards back to `cw-kanban` after a drop that changes nothing.
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
const initialState: BoardViewState = { collapsedColumns: [], _revision: 0 };

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
   * The cards in the view's order, each filed under the status it shows (the view's writes and
   * pending changes applied).
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
   * (`ListViewStore.presentation`) and shows `Column hidden`, whose `Undo` shows the columns
   * hidden before.
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
        const people: ReadonlyMap<string, Person> = new Map(
          store.people().map((person: Person): [string, Person] => [person.id, person]),
        );
        return store._tasks.items().map((item: ListTaskItem): BoardCard => ({
          task: item.task,
          status: item.status,
          closed: isClosedStatus(item.status),
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
    withMethods((store) => ({
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
        const previous: readonly StatusKey[] = store._view.presentation().hiddenBoardStatusKeys;
        if (previous.includes(column)) return;
        const label: string =
          store.statusOptions().find((option: StatusOption): boolean => option.key === column)
            ?.label ?? '';
        store._view.setPresentation({ hiddenBoardStatusKeys: [...previous, column] });
        store._toasts.show($localize`:@@spaces.board.hidden:Column hidden`, {
          description: $localize`:@@spaces.board.hidden-text:${label}:label: · show it again from “Columns”.`,
          undo: (): void => {
            store._view.setPresentation({ hiddenBoardStatusKeys: previous });
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
    })),
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
 * folded columns (kept while the view lives) and `Hide the column` with its `Undo`. Moving a
 * card is written by the page through `ViewTaskWritesStore`; a drop that writes nothing hands
 * the cards back (`restoreCards`) so the card returns to its column.
 *
 * @type {Type<BoardViewStoreInstance>}
 */
export const BoardViewStore: Type<BoardViewStoreInstance> = createBoardViewStore();
