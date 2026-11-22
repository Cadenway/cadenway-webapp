import type { StatusKey } from '@cadenway/contracts';

/**
 * Constant BOARD_STATUS_LABELS
 *
 * @description
 * Board labels from the sprint mockup, overridden by the active space's names.
 *
 * @type {Readonly<Record<StatusKey, string>>}
 */
export const BOARD_STATUS_LABELS: Readonly<Record<StatusKey, string>> = {
  triage: 'À trier',
  backlog: 'À planifier',
  todo: 'À faire',
  progress: 'En cours',
  review: 'En revue',
  testing: 'En validation',
  blocked: 'Bloqué',
  waiting: 'En attente',
  done: 'Terminé',
  cancelled: 'Annulé',
};

/**
 * Constant BOARD_PAGE_SIZE
 *
 * @description
 * Bounds the cards rendered and fetched for each visible status column.
 *
 * @type {number}
 */
export const BOARD_PAGE_SIZE: number = 12;
