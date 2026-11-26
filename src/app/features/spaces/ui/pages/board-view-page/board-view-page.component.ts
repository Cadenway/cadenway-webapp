import { formatNumber } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  type InputSignal,
  linkedSignal,
  LOCALE_ID,
  type Signal,
  signal,
  viewChild,
  type WritableSignal,
} from '@angular/core';
import type { StatusKey } from '@cadenway/contracts';
import {
  CwAlertDialog,
  CwAlertDialogAction,
  CwAlertDialogCancel,
  CwAlertDialogDescription,
  CwAlertDialogTitle,
} from '@cadenway/ui/components/alert-dialog';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwKanban,
  type CwKanbanAddRequest,
  CwKanbanCardDef,
  type CwKanbanMove,
} from '@cadenway/ui/components/kanban';
import { CwMenu, CwMenuItem, CwMenuLabel, CwMenuSeparator } from '@cadenway/ui/components/menu';
import { CwPriorityIcon } from '@cadenway/ui/components/priority-icon';
import { CwStatusIcon } from '@cadenway/ui/components/status-icon';
import { NgIcon } from '@ng-icons/core';

import {
  PRIORITY_LABELS,
  TaskCancelDialog,
  TaskCreate,
  TaskDueDate,
  TaskLabelChips,
  type TaskSummary,
} from '@features/task';

import { BOARD_KANBAN_LABELS } from '../../../constants/board-labels/board-labels.constants';
import { SPACES_RETRY } from '../../../constants/data-table-texts/data-table-texts.constants';
import type { BoardCard, BoardColumn } from '../../../models/board-view/board-view.interface';
import type { TaskList } from '../../../models/task-list/task-list.interface';
import type { ListTasksRead } from '../../../models/list-tasks/list-tasks.interface';
import {
  BoardViewStore,
  type BoardViewStoreInstance,
} from '../../../state/board-view/board-view.store';
import { ListPageStore } from '../../../state/list-page/list-page.store';
import {
  LIST_TASKS_CAP,
  ListTasksStore,
  type ListTasksStoreInstance,
} from '../../../state/list-tasks/list-tasks.store';
import { ListViewStore } from '../../../state/list-view/list-view.store';
import {
  ViewTaskWritesStore,
  type ViewTaskWritesStoreInstance,
} from '../../../state/view-task-writes/view-task-writes.store';
import { VIEW_TASK_WRITER } from '../../../state/view-task-writes/view-task-writer.token';
import { TaskMenu } from '../../components/task-menu/task-menu.component';

/**
 * Function isBoardCard
 *
 * @description
 * Whether a menu's `data()` is a card of the board (what `cw-kanban` gives its card menu).
 *
 * @param {unknown} data - The menu's data.
 * @returns {boolean} Whether it is a card.
 */
function isBoardCard(data: unknown): data is BoardCard {
  return typeof data === 'object' && data !== null && 'task' in data && 'assignees' in data;
}

/**
 * Component BoardViewPage
 *
 * @description
 * The `Board` view at `/:org/l/:listId/board` (`App.dc.html` lines 716-773), below the list
 * frame: `cw-kanban` with one column per status in `BOARD_ORDER` (the space's names; the columns
 * hidden with `Columns` and the statuses the space stopped using left out), filled from the
 * view's `ListTasksStore` read with the view's filters, search and sort. A card shows the key,
 * the priority icon and word, the milestone's icon, the name (muted once closed, struck through
 * when cancelled), the labels, the due date, the subtasks' or checklist's progress and the
 * assignees' initials; a closed card is see-through. A click or Enter opens the task's detail
 * (`?task=<KEY>`). A card dropped in another column, with the mouse or with Space, the arrows and
 * Space (the brick's keyboard move), changes its status through `ViewTaskWritesStore.setStatus`
 * (the card moves at once, the toast offers `Undo`, a refusal puts it back; `Cancelled` asks the
 * reason first); a drop in its own column, or in a column whose status the task cannot take,
 * puts it back, since the board has no manual order (G1). There is no work-in-progress limit
 * (G2) and no Git chip (G3). A right click, Shift F10 or the Menu key on a card opens
 * `cw-task-menu` for the card, or for the selection (Ctrl click) it belongs to; in a column,
 * the column menu: `New task in “X”`, `Fold the column` or `Unfold the column`, and
 * `Hide the column` (with `Undo`). `+` in a header, `Add a task` in a footer or an empty column
 * and N on a card open Task's create dialog with the column's status; N elsewhere creates in
 * this list. The first read shows the brick's skeleton (`Loading the board`) and a failed first
 * read reaches the route's error boundary; a failed refresh offers `Retry` in place; a list
 * of more than `LIST_TASKS_CAP` tasks says the board shows the first ones. Under 768 px the board
 * scrolls sideways.
 */
@Component({
  selector: 'cw-board-view-page',
  imports: [
    CwAlertDialog,
    CwAlertDialogAction,
    CwAlertDialogCancel,
    CwAlertDialogDescription,
    CwAlertDialogTitle,
    CwButton,
    CwKanban,
    CwKanbanCardDef,
    CwMenu,
    CwMenuItem,
    CwMenuLabel,
    CwMenuSeparator,
    CwPriorityIcon,
    CwStatusIcon,
    NgIcon,
    TaskCancelDialog,
    TaskDueDate,
    TaskLabelChips,
    TaskMenu,
  ],
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  providers: [
    BOARD_KANBAN_LABELS,
    ViewTaskWritesStore,
    { provide: VIEW_TASK_WRITER, useExisting: ListTasksStore },
  ],
  templateUrl: './board-view-page.component.html',
})
export class BoardViewPage {
  // #region Properties
  /**
   * Property listId
   *
   * @description
   * The open list, from the route.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly listId: InputSignal<string> = input.required<string>();

  /**
   * Property retryLabel
   *
   * @description
   * Label for retrying a failed refresh.
   *
   * @type {string}
   * @readonly
   */
  protected readonly retryLabel: string = SPACES_RETRY;

  /**
   * Property board
   *
   * @description
   * The board's columns, cards and folded columns.
   *
   * @type {BoardViewStoreInstance}
   * @readonly
   */
  protected readonly board: BoardViewStoreInstance = inject(BoardViewStore);

  /**
   * Property tasks
   *
   * @description
   * The view's tasks, read flat with the view's query.
   *
   * @type {ListTasksStoreInstance}
   * @readonly
   */
  protected readonly tasks: ListTasksStoreInstance = inject(ListTasksStore);

  /**
   * Property writes
   *
   * @description
   * The writes of the task menu and of the drops, with their toasts and confirmations.
   *
   * @type {ViewTaskWritesStoreInstance}
   * @readonly
   */
  protected readonly writes: ViewTaskWritesStoreInstance = inject(ViewTaskWritesStore);

  /**
   * Property selection
   *
   * @description
   * The keys of the cards selected with Ctrl click or Ctrl Space, which the task menu acts on
   * together.
   *
   * @type {WritableSignal<readonly string[]>}
   * @readonly
   */
  protected readonly selection: WritableSignal<readonly string[]> = signal<readonly string[]>([]);

  /**
   * Property trackBy
   *
   * @description
   * The id of a card on the board: its task key.
   *
   * @type {(card: BoardCard) => string}
   * @readonly
   */
  protected readonly trackBy: (card: BoardCard) => string = (card: BoardCard): string =>
    card.task.key;

  /**
   * Property groupBy
   *
   * @description
   * The column of a card: the status it shows.
   *
   * @type {(card: BoardCard) => string}
   * @readonly
   */
  protected readonly groupBy: (card: BoardCard) => string = (card: BoardCard): string =>
    card.status;

  /**
   * Property itemLabel
   *
   * @description
   * The accessible name of a card, read in the brick's announcements: `CAD-482 — name`.
   *
   * @type {(card: BoardCard) => string}
   * @readonly
   */
  protected readonly itemLabel: (card: BoardCard) => string = (card: BoardCard): string =>
    `${card.task.key} — ${card.task.name}`;

  /**
   * Property dimmedBy
   *
   * @description
   * Whether a card is drawn see-through: a closed task (`App.dc.html` line 6301).
   *
   * @type {(card: BoardCard) => boolean}
   * @readonly
   */
  protected readonly dimmedBy: (card: BoardCard) => boolean = (card: BoardCard): boolean =>
    card.closed;

  /**
   * Property priorityLabels
   *
   * @description
   * The priority words of the cards.
   *
   * @type {typeof PRIORITY_LABELS}
   * @readonly
   */
  protected readonly priorityLabels: typeof PRIORITY_LABELS = PRIORITY_LABELS;

  /**
   * Property regionLabel
   *
   * @description
   * Name of the board region: `Board of Sprint 14`.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly regionLabel: Signal<string> = computed((): string => {
    const name: string = this.list()?.name ?? '';
    return $localize`:@@spaces.board.region:Board of ${name}:name:`;
  });

  /**
   * Property truncatedText
   *
   * @description
   * What the board says when the list holds more tasks than one read shows.
   *
   * @type {string}
   * @readonly
   */
  protected readonly truncatedText: string;

  /**
   * Property menuCard
   *
   * @description
   * The card whose menu opened last (the card menu's `data()`), kept once the menu closes so
   * that its items act on it.
   *
   * @type {WritableSignal<BoardCard | null>}
   * @readonly
   */
  protected readonly menuCard: WritableSignal<BoardCard | null> = linkedSignal<
    unknown,
    BoardCard | null
  >({
    source: (): unknown => this.taskMenu()?.menu().data(),
    computation: (data: unknown, previous?: { value: BoardCard | null }): BoardCard | null =>
      isBoardCard(data) ? data : (previous?.value ?? null),
  });

  /**
   * Property menuColumn
   *
   * @description
   * The column whose menu opened last (the column menu's `data()`), kept once the menu closes.
   *
   * @type {WritableSignal<BoardColumn | null>}
   * @readonly
   */
  protected readonly menuColumn: WritableSignal<BoardColumn | null> = linkedSignal<
    unknown,
    BoardColumn | null
  >({
    source: (): unknown => this.columnMenu()?.data(),
    computation: (data: unknown, previous?: { value: BoardColumn | null }): BoardColumn | null =>
      this.board.columns().find((column: BoardColumn): boolean => column === data) ??
      previous?.value ??
      null,
  });

  /**
   * Property menuTasks
   *
   * @description
   * What the card menu acts on: the selection when the card belongs to a selection of several
   * cards, else the card's task.
   *
   * @type {Signal<readonly TaskSummary[]>}
   * @readonly
   */
  protected readonly menuTasks: Signal<readonly TaskSummary[]> = computed(
    (): readonly TaskSummary[] => {
      const card: BoardCard | null = this.menuCard();
      if (!card) return [];
      const selected: readonly string[] = this.selection();
      if (selected.length < 2 || !selected.includes(card.task.key)) return [card.task];
      return this.board
        .cards()
        .filter((item: BoardCard): boolean => selected.includes(item.task.key))
        .map((item: BoardCard): TaskSummary => item.task);
    },
  );

  /**
   * Property menuStatus
   *
   * @description
   * The status every task of the menu shows, or null when they differ.
   *
   * @type {Signal<StatusKey | null>}
   * @readonly
   */
  protected readonly menuStatus: Signal<StatusKey | null> = computed((): StatusKey | null => {
    const statuses: Set<StatusKey> = new Set<StatusKey>(
      this.menuTasks().map((task: TaskSummary): StatusKey => this.tasks.shownStatus(task)),
    );
    return statuses.size === 1 ? [...statuses][0] : null;
  });

  /**
   * Property menuMilestone
   *
   * @description
   * Whether every task of the menu is a milestone, which offers a milestone's four statuses.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly menuMilestone: Signal<boolean> = computed((): boolean => {
    const tasks: readonly TaskSummary[] = this.menuTasks();
    return tasks.length > 0 && tasks.every((task: TaskSummary): boolean => task.milestone);
  });

  /**
   * Property menuColumnCollapsed
   *
   * @description
   * Whether the column of the column menu is folded (`Unfold the column` then).
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly menuColumnCollapsed: Signal<boolean> = computed((): boolean => {
    const column: BoardColumn | null = this.menuColumn();
    return column !== null && this.board.collapsedColumns().includes(column.id);
  });

  /**
   * Property page
   *
   * @description
   * The list page: the list, for the board's name.
   *
   * @type {InstanceType<typeof ListPageStore>}
   * @readonly
   */
  private readonly page: InstanceType<typeof ListPageStore> = inject(ListPageStore);

  /**
   * Property view
   *
   * @description
   * The view configuration: the query the tasks are read with, and the tools' count.
   *
   * @type {InstanceType<typeof ListViewStore>}
   * @readonly
   */
  private readonly view: InstanceType<typeof ListViewStore> = inject(ListViewStore);

  /**
   * Property taskCreate
   *
   * @description
   * Task's create dialog.
   *
   * @type {TaskCreate}
   * @readonly
   */
  private readonly taskCreate: TaskCreate = inject(TaskCreate);

  /**
   * Property taskMenu
   *
   * @description
   * The shared task menu, opened by the board on a card.
   *
   * @type {Signal<TaskMenu | undefined>}
   * @readonly
   */
  private readonly taskMenu: Signal<TaskMenu | undefined> = viewChild(TaskMenu);

  /**
   * Property columnMenu
   *
   * @description
   * The column menu, opened by the board in a column.
   *
   * @type {Signal<CwMenu | undefined>}
   * @readonly
   */
  private readonly columnMenu: Signal<CwMenu | undefined> = viewChild<CwMenu>('columnMenu');

  /**
   * Property list
   *
   * @description
   * The open list, once read.
   *
   * @type {Signal<TaskList | null>}
   * @readonly
   */
  private readonly list: Signal<TaskList | null> = computed((): TaskList | null =>
    this.page.list.hasValue() ? this.page.list.value() : null,
  );
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Reads the tasks of the list with the view's query, publishes their summary to the view
   * tools, makes `N` create in this list while the view lives and keeps the refused cards of a
   * menu action selected. A failed first read is read again when the error boundary runs the
   * route again.
   *
   * @constructor
   */
  public constructor() {
    const destroyRef: DestroyRef = inject(DestroyRef);
    const cap: string = formatNumber(LIST_TASKS_CAP, inject(LOCALE_ID));
    this.truncatedText = $localize`:@@spaces.board.truncated:The board shows the first ${cap}:count: tasks of the list.`;
    if (this.tasks.primary.error()) this.tasks.primary.reload();
    this.tasks.load(
      computed((): ListTasksRead => ({ listId: this.listId(), query: this.view.taskQuery() })),
    );
    this.view.followRows(this.tasks.summary);
    this.taskCreate.useDefaults(() => ({ listId: this.listId() }), destroyRef);
    this.writes.onRefused((taskKeys: readonly string[]): void => {
      this.selection.set(taskKeys);
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method open
   *
   * @description
   * Opens a card's task over the view.
   *
   * @param {BoardCard} card - The card.
   */
  protected open(card: BoardCard): void {
    this.writes.open(card.task.key, card.task);
  }

  /**
   * Method moveCard
   *
   * @description
   * A card dropped elsewhere: another column whose status the task may take writes that status
   * (`Cancelled` asks the reason first); anything else puts the card back in its column.
   *
   * @param {CwKanbanMove<BoardCard>} move - The drop.
   */
  protected moveCard(move: CwKanbanMove<BoardCard>): void {
    const card: BoardCard = move.item;
    const column: string = move.to.column;
    if (this.board.accepts(card, column)) {
      this.writes.setStatus([card.task], column, card.task.milestone);
    }
    this.board.restoreCards();
  }

  /**
   * Method addTask
   *
   * @description
   * `+`, `Add a task` or N in a column: opens the create dialog in this list with the column's
   * status.
   *
   * @param {CwKanbanAddRequest} request - The column asked.
   */
  protected addTask(request: CwKanbanAddRequest): void {
    this.createIn(request.column);
  }

  /**
   * Method createIn
   *
   * @description
   * Opens the create dialog in this list with a column's status (`New task in “X”`).
   *
   * @param {string} column - Status of the column.
   */
  protected createIn(column: string): void {
    const status: StatusKey | undefined = this.board
      .columns()
      .find((item: BoardColumn): boolean => item.id === column)?.id;
    this.taskCreate.open({ listId: this.listId(), ...(status ? { status } : {}) });
  }
  // #endregion
}
