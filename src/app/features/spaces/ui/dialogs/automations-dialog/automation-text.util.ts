import { formatDate } from '@angular/common';

import { priorityLabels, statusLabels } from '../../../constants/view-labels/view-labels.constants';
import type {
  AutomationAction,
  AutomationRun,
  AutomationTrigger,
} from '../../../models/automation-rule/automation-rule.interface';
import type { PriorityKey } from '../../../models/list-view-config/list-view-config.interface';

/**
 * Constant MINUTE_MS
 *
 * @description
 * One minute, in milliseconds.
 *
 * @type {number}
 */
const MINUTE_MS: number = 60_000;

/**
 * Type MemberName
 *
 * @description
 * Gives the name of an organization member from its user id, or null when the directory does not
 * have it (a former member, or the directory is not read).
 *
 * @type {(userId: string) => string | null}
 */
export type MemberName = (userId: string) => string | null;

/**
 * Function personName
 *
 * @description
 * The name of the person a rule or a run names; `Former member` when the directory lacks it.
 *
 * @param {string} userId - The member.
 * @param {MemberName} nameOf - The directory's names.
 * @returns {string} The name.
 */
function personName(userId: string, nameOf: MemberName): string {
  return nameOf(userId) ?? $localize`:@@spaces.automations.former-member:Former member`;
}

/**
 * Function priorityWord
 *
 * @description
 * The priority word in lower case, as written inside a sentence (`App.dc.html` line 8538).
 *
 * @param {PriorityKey} priority - The priority.
 * @returns {string} The word.
 */
function priorityWord(priority: PriorityKey): string {
  return priorityLabels()[priority].toLocaleLowerCase();
}

/**
 * Function describeTrigger
 *
 * @description
 * The `When…` half of a rule (`App.dc.html` line 8537): `When a task is created`, or
 * `When the status becomes “In review”` with the status's default word, since a rule applies to
 * every space of the organization.
 *
 * @param {AutomationTrigger} trigger - The trigger.
 * @returns {string} The text.
 */
export function describeTrigger(trigger: AutomationTrigger): string {
  if (trigger.type === 'created') {
    return $localize`:@@spaces.automations.when-created:When a task is created`;
  }
  const status: string = statusLabels()[trigger.status];
  return $localize`:@@spaces.automations.when-status:When the status becomes “${status}:status:”`;
}

/**
 * Function describeAction
 *
 * @description
 * The `then…` half of a rule (`App.dc.html` line 8538): `assign to Camille Martin`,
 * `set the priority to urgent`, `notify Hugo Dubois` or `comment “…”` (an ellipsis while the
 * comment is empty).
 *
 * @param {AutomationAction} action - The action.
 * @param {MemberName} nameOf - The directory's names.
 * @returns {string} The text.
 */
export function describeAction(action: AutomationAction, nameOf: MemberName): string {
  switch (action.type) {
    case 'assign': {
      const name: string = personName(action.userId, nameOf);
      return $localize`:@@spaces.automations.then-assign:assign to ${name}:name:`;
    }
    case 'notify': {
      const name: string = personName(action.userId, nameOf);
      return $localize`:@@spaces.automations.then-notify:notify ${name}:name:`;
    }
    case 'priority': {
      const priority: string = priorityWord(action.priority);
      return $localize`:@@spaces.automations.then-priority:set the priority to ${priority}:priority:`;
    }
    case 'comment': {
      const text: string = action.body.trim() || '…';
      return $localize`:@@spaces.automations.then-comment:comment “${text}:text:”`;
    }
  }
}

/**
 * Function describeRun
 *
 * @description
 * The text of a run of `Last runs` (`runAutomations`, `App.dc.html` lines 4663-4668):
 * `CAD-482 assigned to Camille Martin`, `CAD-482 moved to urgent priority`,
 * `Hugo Dubois notified about CAD-482` or `Comment added on CAD-482`.
 *
 * @param {AutomationRun} run - The run.
 * @param {MemberName} nameOf - The directory's names.
 * @returns {string} The text.
 */
export function describeRun(run: AutomationRun, nameOf: MemberName): string {
  const key: string = run.taskKey;
  const action: AutomationRun['action'] = run.action;
  switch (action.type) {
    case 'assign': {
      const name: string = personName(action.userId, nameOf);
      return $localize`:@@spaces.automations.run-assign:${key}:key: assigned to ${name}:name:`;
    }
    case 'notify': {
      const name: string = personName(action.userId, nameOf);
      return $localize`:@@spaces.automations.run-notify:${name}:name: notified about ${key}:key:`;
    }
    case 'priority': {
      const priority: string = priorityWord(action.priority);
      return $localize`:@@spaces.automations.run-priority:${key}:key: moved to ${priority}:priority: priority`;
    }
    case 'comment':
      return $localize`:@@spaces.automations.run-comment:Comment added on ${key}:key:`;
  }
}

/**
 * Function runMoment
 *
 * @description
 * When a run happened: `just now` within a minute (the mockup's only moment, `App.dc.html`
 * line 4672), then `N min ago`, `N h ago` the same day, else the day (`26 Nov`).
 *
 * @param {string} instant - ISO 8601 instant of the run.
 * @param {Date} now - The present.
 * @param {string} locale - Locale of the day's format.
 * @returns {string} The moment.
 */
export function runMoment(instant: string, now: Date, locale: string): string {
  const moment: Date = new Date(instant);
  const elapsed: number = Math.max(0, now.getTime() - moment.getTime());
  if (elapsed < MINUTE_MS) return $localize`:@@spaces.automations.run-now:just now`;
  if (elapsed < 60 * MINUTE_MS) {
    const minutes: number = Math.floor(elapsed / MINUTE_MS);
    return $localize`:@@spaces.automations.run-minutes:${minutes}:count: min ago`;
  }
  if (moment.toDateString() === now.toDateString()) {
    const hours: number = Math.floor(elapsed / (60 * MINUTE_MS));
    return $localize`:@@spaces.automations.run-hours:${hours}:count: h ago`;
  }
  return formatDate(moment, 'd MMM', locale);
}
