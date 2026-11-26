import type {
  GetTaskApprovalClientResult,
  GetTaskStatusDurationsClientResult,
  ListDependencyCandidatesClientResult,
  ListTaskDependenciesClientResult,
} from '@cadenway/api-client';

import type {
  TaskApproval,
  TaskApprovalDecision,
  TaskDependency,
  TaskDependencyTask,
  TaskStatusTimes,
} from '../../../models/task-property/task-property.interface';

/**
 * Type DependencyDto
 *
 * @description
 * A dependency edge as the gateway returns it.
 *
 * @type {ListTaskDependenciesClientResult['items'][number]}
 */
type DependencyDto = ListTaskDependenciesClientResult['items'][number];

/**
 * Type DependencyTaskDto
 *
 * @description
 * A task summary at one end of an edge, or a dependency candidate.
 *
 * @type {ListDependencyCandidatesClientResult['items'][number]}
 */
type DependencyTaskDto = ListDependencyCandidatesClientResult['items'][number];

/**
 * Function toTaskDependencyTask
 *
 * @description
 * Maps a task summary of the gateway to what a dependency chip or a candidate shows.
 *
 * @param {DependencyTaskDto} task - The summary.
 * @returns {TaskDependencyTask} The display model.
 */
export function toTaskDependencyTask(task: DependencyTaskDto): TaskDependencyTask {
  return {
    key: task.key,
    name: task.name,
    status: task.status,
    milestone: task.milestone ?? false,
    due: task.dueDate ?? null,
  };
}

/**
 * Function toTaskDependency
 *
 * @description
 * Maps an edge to the open task's point of view: `blocked-by` when the open task is the blocked
 * end, `blocks` when it is the blocker.
 *
 * @param {DependencyDto} edge - The edge.
 * @param {string} taskKey - Key of the open task.
 * @returns {TaskDependency} The dependency.
 */
export function toTaskDependency(edge: DependencyDto, taskKey: string): TaskDependency {
  const blocked: boolean = edge.blocked.key === taskKey;
  return {
    id: edge.id,
    direction: blocked ? 'blocked-by' : 'blocks',
    task: toTaskDependencyTask(blocked ? edge.blocker : edge.blocked),
  };
}

/**
 * Function toApprovalDecision
 *
 * @description
 * Reads a reviewer's decision; an unknown value reads as no vote, as the contract allows.
 *
 * @param {string | null} decision - The decision of the gateway.
 * @returns {TaskApprovalDecision} The decision.
 */
function toApprovalDecision(decision: string | null): TaskApprovalDecision {
  return decision === 'approved' || decision === 'changes-requested' ? decision : null;
}

/**
 * Function toTaskApproval
 *
 * @description
 * Maps the approval state of a task; no current round gives no reviewers.
 *
 * @param {GetTaskApprovalClientResult} state - The approval state.
 * @returns {TaskApproval} The approval.
 */
export function toTaskApproval(state: GetTaskApprovalClientResult): TaskApproval {
  return {
    taskVersion: state.taskVersion,
    reviewers: (state.current?.reviewers ?? []).map((reviewer) => ({
      userId: reviewer.reviewerUserId,
      decision: toApprovalDecision(reviewer.decision),
    })),
  };
}

/**
 * Function toTaskStatusTimes
 *
 * @description
 * Maps the time per status of a task; a milestone has none (null).
 *
 * @param {GetTaskStatusDurationsClientResult} result - The durations.
 * @returns {TaskStatusTimes | null} The times, or null for a milestone.
 */
export function toTaskStatusTimes(
  result: GetTaskStatusDurationsClientResult,
): TaskStatusTimes | null {
  if (!result.summary) return null;
  return {
    complete: result.summary.complete,
    durations: result.summary.durations.map((duration) => ({
      status: duration.status,
      milliseconds: duration.durationMilliseconds,
      active: duration.active,
    })),
  };
}
