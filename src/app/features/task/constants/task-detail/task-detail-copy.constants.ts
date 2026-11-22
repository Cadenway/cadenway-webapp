import type { StatusKey } from '@cadenway/contracts';

/**
 * Constant TASK_STATUS_LABELS
 *
 * @description
 * Status labels from the task mockup before applying a space's custom labels.
 *
 * @type {Readonly<Record<StatusKey, string>>}
 */
export const TASK_STATUS_LABELS: Readonly<Record<StatusKey, string>> = {
  triage: 'À trier',
  backlog: 'À planifier',
  todo: 'À faire',
  progress: 'En cours',
  review: 'En revue',
  testing: 'En validation',
  waiting: 'En attente',
  blocked: 'Bloqué',
  done: 'Terminé',
  cancelled: 'Annulé',
};
