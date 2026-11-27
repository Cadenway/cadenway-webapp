import type {
  CreateGoalResultClientResult,
  GetGoalClientResult,
  GetTaskClientResult,
  GoalsService,
} from '@cadenway/api-client';

import type {
  Goal,
  GoalDraft,
  GoalHealth,
  KeyResult,
  KeyResultDraft,
  MilestoneTask,
  Quarter,
} from '../../../models/goal/goal.interface';

/**
 * Type GoalCreationDto
 *
 * @description
 * The body of `createGoal`.
 *
 * @type {Parameters<GoalsService['createGoal']>[0]}
 */
export type GoalCreationDto = Parameters<GoalsService['createGoal']>[0];

/**
 * Type KeyResultCreationDto
 *
 * @description
 * The body of `createGoalResult`.
 *
 * @type {Parameters<GoalsService['createGoalResult']>[1]}
 */
export type KeyResultCreationDto = Parameters<GoalsService['createGoalResult']>[1];

/**
 * Constant HEALTHS
 *
 * @description
 * The health values this version of the contract names; another one reads as null.
 *
 * @type {readonly GoalHealth[]}
 */
const HEALTHS: readonly GoalHealth[] = ['achieved', 'on-track', 'at-risk', 'behind'];

/**
 * Function toKeyResult
 *
 * @description
 * Maps a key result of the gateway, or null for a kind a later contract adds.
 *
 * @param {CreateGoalResultClientResult} result - The gateway's key result.
 * @returns {KeyResult | null} The display model, or null.
 */
export function toKeyResult(result: CreateGoalResultClientResult): KeyResult | null {
  const common: { id: string; label: string; progressPercent: number } = {
    id: result.id,
    label: result.label,
    progressPercent: result.progressPercent,
  };
  switch (result.kind) {
    case 'number':
      return {
        ...common,
        kind: 'number',
        startValue: result.startValue,
        currentValue: result.currentValue,
        targetValue: result.targetValue,
      };
    case 'checkbox':
      return { ...common, kind: 'checkbox', checked: result.checked };
    case 'list-progress':
      return {
        ...common,
        kind: 'list-progress',
        listId: result.listId,
        eligibleTaskCount: result.eligibleTaskCount,
        doneTaskCount: result.doneTaskCount,
      };
    case 'milestone':
      return { ...common, kind: 'milestone', taskKey: result.taskKey, reached: result.reached };
    default:
      return null;
  }
}

/**
 * Function toGoal
 *
 * @description
 * Maps a goal of the gateway to its display model.
 *
 * @param {GetGoalClientResult} goal - The gateway's goal.
 * @returns {Goal} The display model.
 */
export function toGoal(goal: GetGoalClientResult): Goal {
  return {
    id: goal.id,
    name: goal.name,
    ownerUserId: goal.ownerUserId,
    dueDate: goal.dueDate,
    spaceId: goal.spaceId,
    version: goal.version,
    progressPercent: goal.progressPercent,
    health: HEALTHS.includes(goal.health as GoalHealth) ? (goal.health as GoalHealth) : null,
    results: goal.results
      .map((result: CreateGoalResultClientResult) => toKeyResult(result))
      .filter((result: KeyResult | null): result is KeyResult => result !== null),
  };
}

/**
 * Function toKeyResultCreation
 *
 * @description
 * A number key result from 0 towards its target, as both forms of the mockup create it
 * (`App.dc.html` lines 5184 and 5203).
 *
 * @param {KeyResultDraft} draft - What a form submitted.
 * @returns {KeyResultCreationDto} The request body.
 */
export function toKeyResultCreation(draft: KeyResultDraft): KeyResultCreationDto {
  return {
    kind: 'number',
    label: draft.label,
    startValue: 0,
    currentValue: 0,
    targetValue: draft.target,
  };
}

/**
 * Function toGoalCreation
 *
 * @description
 * The creation of a goal due on the last day of its quarter (`App.dc.html` line 5204).
 *
 * @param {GoalDraft} draft - What the goal form submitted.
 * @param {Quarter} quarter - The quarter shown.
 * @returns {GoalCreationDto} The request body.
 */
export function toGoalCreation(draft: GoalDraft, quarter: Quarter): GoalCreationDto {
  return {
    name: draft.name,
    ownerUserId: draft.ownerUserId,
    dueDate: quarter.end,
    quarter: quarter.key,
    spaceId: draft.spaceId,
    results: draft.firstResult === null ? [] : [toKeyResultCreation(draft.firstResult)],
  };
}

/**
 * Function toMilestoneTask
 *
 * @description
 * What a milestone key result shows of its task.
 *
 * @param {GetTaskClientResult} task - The gateway's task.
 * @returns {MilestoneTask} The display model.
 */
export function toMilestoneTask(task: GetTaskClientResult): MilestoneTask {
  return { key: task.key, dueDate: task.dueDate };
}

/**
 * Function versionOfEtag
 *
 * @description
 * Reads the goal version of an `ETag` (`"5"`, or the weak `W/"5"`).
 *
 * @param {string | null} etag - The header, or null when absent.
 * @returns {number | null} The version, or null when the header is absent or malformed.
 */
export function versionOfEtag(etag: string | null): number | null {
  const match: RegExpExecArray | null = /^(?:W\/)?"(\d+)"$/u.exec(etag?.trim() ?? '');
  return match ? Number(match[1]) : null;
}

/**
 * Function ifMatch
 *
 * @description
 * The `If-Match` header of a goal version.
 *
 * @param {number} version - The version.
 * @returns {Record<string, string>} The header.
 */
export function ifMatch(version: number): Record<string, string> {
  return { 'If-Match': `"${String(version)}"` };
}
