import type {
  PriorityKey,
  StatusKey,
} from '../../models/list-view-config/list-view-config.interface';

/**
 * Constant STATUS_ORDER
 *
 * @description
 * The ten statuses in workflow order (`StatutTache.dc.html`).
 *
 * @type {readonly StatusKey[]}
 */
export const STATUS_ORDER: readonly StatusKey[] = [
  'triage',
  'backlog',
  'todo',
  'progress',
  'review',
  'testing',
  'waiting',
  'blocked',
  'done',
  'cancelled',
];

/**
 * Constant BOARD_ORDER
 *
 * @description
 * The board's status columns, left to right (`BOARD_ORDER` of `App.dc.html` line 3548), which
 * the board's `Columns shown` menu lists: `blocked` comes before `waiting`.
 *
 * @type {readonly StatusKey[]}
 */
export const BOARD_ORDER: readonly StatusKey[] = [
  'triage',
  'backlog',
  'todo',
  'progress',
  'review',
  'testing',
  'blocked',
  'waiting',
  'done',
  'cancelled',
];

/**
 * Constant PRIORITY_ORDER
 *
 * @description
 * The four priorities, from the highest, as the `Filter` dialog lists them. The keys are the
 * contract's wire values (`@cadenway/contracts` priority enum).
 *
 * @type {readonly PriorityKey[]}
 */
export const PRIORITY_ORDER: readonly PriorityKey[] = ['urgente', 'haute', 'moyenne', 'basse'];
