import type {
  AutomationAction as AutomationActionDto,
  AutomationRule as AutomationRuleDto,
  AutomationRuleCreate,
  AutomationRun as AutomationRunDto,
  AutomationRunAction as AutomationRunActionDto,
  AutomationTrigger as AutomationTriggerDto,
} from '@cadenway/api-client';

import type {
  AutomationAction,
  AutomationDraft,
  AutomationRule,
  AutomationRun,
  AutomationRunAction,
  AutomationTrigger,
} from '../../../models/automation-rule/automation-rule.interface';

/**
 * Function toAutomationTrigger
 *
 * @description
 * Maps a rule's trigger.
 *
 * @param {AutomationTriggerDto} trigger - The gateway's trigger.
 * @returns {AutomationTrigger} The display trigger.
 */
function toAutomationTrigger(trigger: AutomationTriggerDto): AutomationTrigger {
  return trigger.type === 'status'
    ? { type: 'status', status: trigger.status }
    : { type: 'created' };
}

/**
 * Function toAutomationAction
 *
 * @description
 * Maps a rule's action.
 *
 * @param {AutomationActionDto} action - The gateway's action.
 * @returns {AutomationAction} The display action.
 */
function toAutomationAction(action: AutomationActionDto): AutomationAction {
  switch (action.type) {
    case 'assign':
    case 'notify':
      return { type: action.type, userId: action.userId };
    case 'priority':
      return { type: 'priority', priority: action.priority };
    case 'comment':
      return { type: 'comment', body: action.body };
  }
}

/**
 * Function toAutomationRunAction
 *
 * @description
 * Maps the action a run applied; a comment run carries no text.
 *
 * @param {AutomationRunActionDto} action - The gateway's run action.
 * @returns {AutomationRunAction} The display action.
 */
function toAutomationRunAction(action: AutomationRunActionDto): AutomationRunAction {
  switch (action.type) {
    case 'assign':
    case 'notify':
      return { type: action.type, userId: action.userId };
    case 'priority':
      return { type: 'priority', priority: action.priority };
    case 'comment':
      return { type: 'comment' };
  }
}

/**
 * Function toAutomationRule
 *
 * @description
 * Maps a rule of `listAutomationRules`, `createAutomationRule` or `updateAutomationRule`.
 *
 * @param {AutomationRuleDto} rule - The gateway's rule.
 * @returns {AutomationRule} The display rule.
 */
export function toAutomationRule(rule: AutomationRuleDto): AutomationRule {
  return {
    id: rule.ruleId,
    trigger: toAutomationTrigger(rule.trigger),
    action: toAutomationAction(rule.action),
    enabled: rule.enabled,
    version: rule.version,
  };
}

/**
 * Function toAutomationRun
 *
 * @description
 * Maps an execution of `listRecentAutomationRuns`.
 *
 * @param {AutomationRunDto} run - The gateway's execution.
 * @returns {AutomationRun} The display run.
 */
export function toAutomationRun(run: AutomationRunDto): AutomationRun {
  return {
    id: run.executionId,
    ruleId: run.ruleId,
    taskKey: run.taskKey,
    action: toAutomationRunAction(run.action),
    executedAt: run.executedAt,
  };
}

/**
 * Function toAutomationRuleCreate
 *
 * @description
 * The `createAutomationRule` body of a draft; a comment is sent trimmed.
 *
 * @param {AutomationDraft} draft - The rule to create.
 * @returns {AutomationRuleCreate} The request body.
 */
export function toAutomationRuleCreate(draft: AutomationDraft): AutomationRuleCreate {
  const trigger: AutomationTriggerDto =
    draft.trigger.type === 'status'
      ? { type: 'status', status: draft.trigger.status }
      : { type: 'created' };
  const source: AutomationAction = draft.action;
  let action: AutomationActionDto;
  switch (source.type) {
    case 'assign':
    case 'notify':
      action = { type: source.type, userId: source.userId };
      break;
    case 'priority':
      action = { type: 'priority', priority: source.priority };
      break;
    case 'comment':
      action = { type: 'comment', body: source.body.trim() };
      break;
  }
  return { trigger, action };
}
