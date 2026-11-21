import type { PriorityKey, StatusKey } from '@cadenway/contracts';
import { MILESTONE_STATUS_KEYS } from '@cadenway/contracts';

/**
 * Type BoardLocation
 *
 * @description
 * Binds a board to the organization and list resolved before opening the view.
 *
 * @type {object}
 */
export type BoardLocation = Readonly<{
  organizationId: string;
  spaceId: string;
  listId: string;
  mayEdit: boolean;
}>;

/**
 * Type BoardCard
 *
 * @description
 * The summary shown on a card and the version used for an eventual write.
 *
 * @type {object}
 */
export type BoardCard = Readonly<{
  key: string;
  name: string;
  status: StatusKey;
  version: number;
  milestone: boolean;
  priority: PriorityKey;
  dueDate: string | null;
  labels: readonly string[];
  subtaskCounts: Readonly<{ total: number; closed: number }>;
}>;

/**
 * Type BoardCardPage
 *
 * @description
 * A bounded, independently pageable slice of one status group.
 *
 * @type {object}
 */
export type BoardCardPage = Readonly<{
  cards: readonly BoardCard[];
  count: number;
  nextCursor: string | null;
}>;

/**
 * Type BoardColumn
 *
 * @description
 * A visible workflow status and the currently loaded page of its cards.
 *
 * @type {object}
 */
export type BoardColumn = BoardCardPage &
  Readonly<{
    status: StatusKey;
    label: string;
    hasPreviousPage: boolean;
  }>;

/**
 * Type BoardMoveStatus
 *
 * @description
 * An ordinary status with a reversible patch. Cancellation needs a reason and completion may
 * create a recurring successor, so their dedicated workflows own those transitions.
 *
 * @type {Exclude<StatusKey, 'done' | 'cancelled'>}
 */
export type BoardMoveStatus = Exclude<StatusKey, 'done' | 'cancelled'>;

/**
 * Type BoardPendingMove
 *
 * @description
 * Tracks a reversible move against the last confirmed version of one card.
 *
 * @type {object}
 */
export type BoardPendingMove = Readonly<{
  card: BoardCard;
  status: BoardMoveStatus;
  writing: boolean;
}>;

/**
 * Type BoardPendingMoves
 *
 * @description
 * Keys the pending presentation overlay by each affected task.
 *
 * @type {Readonly<Record<string, BoardPendingMove | undefined>>}
 */
export type BoardPendingMoves = Readonly<Record<string, BoardPendingMove | undefined>>;

/**
 * Type BoardPresentation
 *
 * @description
 * Read-only view inputs from the owning list page and its board store.
 *
 * @type {object}
 */
export type BoardPresentation = Readonly<{
  columns: readonly BoardColumn[];
  moves: BoardPendingMoves;
  hasPendingMoves: boolean;
  loading: boolean;
  loadError: boolean;
  organizationChanged: boolean;
  paging: StatusKey | null;
  mayEdit: boolean;
}>;

/**
 * Type BoardStatusChoice
 *
 * @description
 * A new card status selected through a pointer or the keyboard.
 *
 * @type {Readonly<{ key: string; status: StatusKey | null }>}
 */
export type BoardStatusChoice = Readonly<{ key: string; status: StatusKey | null }>;

/**
 * Type BoardPageChoice
 *
 * @description
 * Navigation to another page of just one status's cards.
 *
 * @type {Readonly<{ status: StatusKey; cursor?: string }>}
 */
export type BoardPageChoice = Readonly<{ status: StatusKey; cursor?: string }>;

/**
 * Class BoardOrganizationChanged
 *
 * @description
 * Marks a board whose route no longer belongs to the active session.
 */
export class BoardOrganizationChanged extends Error {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Identifies a stale organization without retaining a gateway error body.
   * @constructor
   */
  public constructor() {
    super('The active organization changed.');
  }
  // #endregion
}

/**
 * Function isBoardMoveStatus
 *
 * @description
 * Identifies the reversible statuses handled by the click and card-drop paths.
 *
 * @param {StatusKey} status - A workflow status from the API.
 * @returns {boolean} Whether the board can write it without additional input or side effects.
 */
export function isBoardMoveStatus(status: StatusKey): status is BoardMoveStatus {
  return status !== 'cancelled' && status !== 'done';
}

/**
 * Function allowsBoardStatus
 *
 * @description
 * Restricts this reversible interaction to the statuses supported by the card type.
 *
 * @param {BoardCard} card - The task before the change.
 * @param {StatusKey} status - The desired destination.
 * @returns {status is BoardMoveStatus} Whether the board offers the transition.
 */
export function allowsBoardStatus(card: BoardCard, status: StatusKey): status is BoardMoveStatus {
  return (
    isBoardMoveStatus(card.status) &&
    isBoardMoveStatus(status) &&
    (!card.milestone || MILESTONE_STATUS_KEYS.some((key) => key === status))
  );
}
