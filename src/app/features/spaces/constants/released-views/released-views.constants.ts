import type { ListDialog } from '../../models/list-dialog/list-dialog.type';
import type { ViewLayout } from '../../models/saved-view/saved-view.interface';

/**
 * Constant RELEASED_LAYOUTS
 *
 * @description
 * The layouts users can reach: each has a tab and its route opens. Another layout, in a saved
 * view or typed in the address, falls back to `list`. Its route and stub page exist so that its
 * package fills them without touching the frame. The lead adds a layout here when its package
 * merges; view builders never edit this file.
 *
 * @type {readonly ViewLayout[]}
 */
export const RELEASED_LAYOUTS: readonly ViewLayout[] = [
  'list',
  'calendar',
  'workload',
  'form',
  'activity',
  'timesheet',
];

/**
 * Constant RELEASED_LIST_DIALOGS
 *
 * @description
 * The header dialogs whose openers show: `Share`, `Sprint report`, `Space statuses` and
 * `Automations` stay hidden until their package merges and the lead adds them here, so no
 * opener leads to an empty dialog. Dialog builders never edit this file.
 *
 * @type {readonly ListDialog[]}
 */
export const RELEASED_LIST_DIALOGS: readonly ListDialog[] = [
  'space-statuses',
  'automations',
  'sprint-report',
  'share',
];
