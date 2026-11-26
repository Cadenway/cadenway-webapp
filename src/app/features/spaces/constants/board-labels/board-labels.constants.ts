import type { Provider } from '@angular/core';
import { provideCwKanbanLabels } from '@cadenway/ui/components/kanban';

/**
 * Constant COLUMN
 *
 * @description
 * The board's placeholder for a column name, kept literal through the translation so that
 * `cw-kanban` fills it.
 *
 * @type {string}
 */
const COLUMN: string = '{column}';

/**
 * Constant LANE
 *
 * @description
 * The board's placeholder for a swimlane name.
 *
 * @type {string}
 */
const LANE: string = '{lane}';

/**
 * Constant ITEM
 *
 * @description
 * The board's placeholder for a card's name.
 *
 * @type {string}
 */
const ITEM: string = '{item}';

/**
 * Constant COUNT
 *
 * @description
 * The board's placeholder for a number of cards.
 *
 * @type {string}
 */
const COUNT: string = '{count}';

/**
 * Constant LIMIT
 *
 * @description
 * The board's placeholder for a work-in-progress limit.
 *
 * @type {string}
 */
const LIMIT: string = '{limit}';

/**
 * Constant POSITION
 *
 * @description
 * The board's placeholder for a card's position in its column.
 *
 * @type {string}
 */
const POSITION: string = '{position}';

/**
 * Constant TOTAL
 *
 * @description
 * The board's placeholder for the number of cards of a column.
 *
 * @type {string}
 */
const TOTAL: string = '{total}';

/**
 * Constant BOARD_KANBAN_LABELS
 *
 * @description
 * The English source texts of the `Board` view's `cw-kanban`, replacing the brick's French
 * defaults. Their `fr` translations are those defaults, except the mockup's wording of the empty
 * column (`spaces.board.empty-text`, `App.dc.html` line 764). The braces stay literal so that the
 * brick fills them in; the swimlane texts are unused (the board has no swimlanes) but given, so
 * that no French default shows.
 *
 * @type {Provider}
 */
export const BOARD_KANBAN_LABELS: Provider = provideCwKanbanLabels(() => ({
  add: $localize`:@@spaces.board.add:Add a task`,
  addIn: $localize`:@@spaces.board.add-in:Add a task in ${COLUMN}:column:`,
  collapse: $localize`:@@spaces.board.collapse:Fold the column ${COLUMN}:column:`,
  expand: $localize`:@@spaces.board.expand:Unfold the column ${COLUMN}:column:, ${COUNT}:count:`,
  column: $localize`:@@spaces.board.column:Column ${COLUMN}:column:`,
  cell: `${COLUMN}, ${LANE}`,
  countOne: $localize`:@@spaces.board.count-one:${COUNT}:count: task`,
  countOther: $localize`:@@spaces.board.count-many:${COUNT}:count: tasks`,
  countLimit: $localize`:@@spaces.board.count-limit:${COUNT}:count:, limit of ${LIMIT}:limit:`,
  overLimit: $localize`:@@spaces.board.over-limit:Limit of ${LIMIT}:limit: exceeded`,
  emptyTitle: $localize`:@@spaces.board.empty:No task`,
  emptyDescription: $localize`:@@spaces.board.empty-text:Drag a card here or create one.`,
  quickAdd: $localize`:@@spaces.board.quick-add:New task in ${COLUMN}:column:`,
  quickAddField: $localize`:@@spaces.board.quick-add-field:Task name`,
  quickAddKey: $localize`:@@spaces.board.quick-add-key:Enter`,
  quickAddHint: $localize`:@@spaces.board.quick-add-hint:create`,
  selected: $localize`:@@spaces.board.selected:selected`,
  instructions: $localize`:@@spaces.board.instructions:Space to grab the card, arrows to move it, Space to drop it, Escape to cancel.`,
  grabbed: $localize`:@@spaces.board.grabbed:${ITEM}:item: grabbed. ${POSITION}:position: Arrows to move, Space to drop, Escape to cancel.`,
  position: $localize`:@@spaces.board.position:Column ${COLUMN}:column:, position ${POSITION}:position: of ${TOTAL}:total:.`,
  positionInLane: $localize`:@@spaces.board.position-in-lane:Column ${COLUMN}:column:, lane ${LANE}:lane:, position ${POSITION}:position: of ${TOTAL}:total:.`,
  dropped: $localize`:@@spaces.board.dropped:${ITEM}:item: dropped in ${COLUMN}:column:, position ${POSITION}:position: of ${TOTAL}:total:.`,
  cancelled: $localize`:@@spaces.board.cancelled:Move cancelled.`,
  loading: $localize`:@@spaces.board.loading:Loading the board`,
}));
