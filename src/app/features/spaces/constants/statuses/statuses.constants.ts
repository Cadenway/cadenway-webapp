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
 * Constant PRIORITY_ORDER
 *
 * @description
 * The four priorities, from the highest, as the `Filter` dialog lists them. The keys are the
 * contract's wire values (`@cadenway/contracts` priority enum).
 *
 * @type {readonly PriorityKey[]}
 */
export const PRIORITY_ORDER: readonly PriorityKey[] = ['urgente', 'haute', 'moyenne', 'basse'];
