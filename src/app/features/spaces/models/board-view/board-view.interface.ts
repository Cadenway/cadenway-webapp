import type { StatusKey } from '@cadenway/contracts';

import type { Person, TaskSummary } from '@features/task';

/**
 * Interface BoardColumn
 *
 * @description
 * A status column of the board, in `BOARD_ORDER`: the status key (the column id), the space's
 * name for it and the status drawn next to it (`CwKanbanColumn`).
 */
export interface BoardColumn {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * The status of the column, which the cards are filed by.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly id: StatusKey;

  /**
   * Property label
   *
   * @description
   * The space's name of the status, else its default word.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property status
   *
   * @description
   * The status icon of the column header.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;
  // #endregion
}

/**
 * Interface BoardCardProgress
 *
 * @description
 * The progress a card shows: its subtasks when it has some, else its checklist.
 */
export interface BoardCardProgress {
  // #region Properties
  /**
   * Property icon
   *
   * @description
   * The tree for subtasks, the checklist for checklist items.
   *
   * @type {string}
   * @readonly
   */
  readonly icon: string;

  /**
   * Property closed
   *
   * @description
   * Closed subtasks or done checklist items.
   *
   * @type {number}
   * @readonly
   */
  readonly closed: number;

  /**
   * Property total
   *
   * @description
   * All of them.
   *
   * @type {number}
   * @readonly
   */
  readonly total: number;
  // #endregion
}

/**
 * Interface BoardCard
 *
 * @description
 * One card of the board (`App.dc.html` lines 741-757): the task as shown (the view's writes
 * applied), the column it is filed in and what its fields show.
 */
export interface BoardCard {
  // #region Properties
  /**
   * Property task
   *
   * @description
   * The task as shown, the view's writes applied.
   *
   * @type {TaskSummary}
   * @readonly
   */
  readonly task: TaskSummary;

  /**
   * Property status
   *
   * @description
   * The status the card shows and the column it sits in: a pending change or a write included.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;

  /**
   * Property closed
   *
   * @description
   * Whether the shown status is closed (done or cancelled): the card is see-through and its name
   * muted.
   *
   * @type {boolean}
   * @readonly
   */
  readonly closed: boolean;

  /**
   * Property progress
   *
   * @description
   * The subtasks' progress, else the checklist's; null when the task has neither.
   *
   * @type {BoardCardProgress | null}
   * @readonly
   */
  readonly progress: BoardCardProgress | null;

  /**
   * Property assignees
   *
   * @description
   * The task's assignees among the organization's members, in the task's order.
   *
   * @type {readonly Person[]}
   * @readonly
   */
  readonly assignees: readonly Person[];
  // #endregion
}

/**
 * Interface BoardPendingMove
 *
 * @description
 * A card's move waiting to be written: the status it was dropped on, the status the view had
 * confirmed when the first of its quick moves began, and the task as it showed then, so the move
 * is written even once the current read no longer holds the task (a filter, a search).
 */
export interface BoardPendingMove {
  // #region Properties
  /**
   * Property status
   *
   * @description
   * The status of the column the card was last dropped in.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;

  /**
   * Property from
   *
   * @description
   * The status the view had confirmed when the move began: a move back to it writes nothing.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly from: StatusKey;

  /**
   * Property task
   *
   * @description
   * The task as shown when the move began.
   *
   * @type {TaskSummary}
   * @readonly
   */
  readonly task: TaskSummary;
  // #endregion
}
