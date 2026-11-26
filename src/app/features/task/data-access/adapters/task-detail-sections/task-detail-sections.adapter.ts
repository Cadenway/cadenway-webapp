import type {
  CreateTaskCommentClientResult,
  GetTaskApprovalClientResult,
  ListTaskActivityClientResult,
  ListTaskAttachmentsClientResult,
} from '@cadenway/api-client';

import type {
  TaskActivityActor,
  TaskActivityChange,
  TaskActivityEntry,
  TaskActivityPage,
  TaskApprovalDecisionKey,
  TaskApprovalRoundStatus,
  TaskApprovalSnapshot,
  TaskAttachment,
} from '../../../models/task-detail-sections/task-detail-sections.interface';
import type { TaskComment } from '../../../models/task-detail/task-detail.interface';

/**
 * Type ActivityEntryDto
 *
 * @description
 * One entry of the generated activity page.
 *
 * @type {ListTaskActivityClientResult['items'][number]}
 */
type ActivityEntryDto = ListTaskActivityClientResult['items'][number];

/**
 * Type AttachmentDto
 *
 * @description
 * One generated attachment.
 *
 * @type {ListTaskAttachmentsClientResult['items'][number]}
 */
export type AttachmentDto = ListTaskAttachmentsClientResult['items'][number];

/**
 * Function toDecision
 *
 * @description
 * Reads a reviewer's decision; an unknown one waits.
 *
 * @param {string | null} decision - The decision the gateway sent.
 * @returns {TaskApprovalDecisionKey} The decision.
 */
function toDecision(decision: string | null): TaskApprovalDecisionKey {
  return decision === 'approved' || decision === 'changes-requested' ? decision : null;
}

/**
 * Function toRoundStatus
 *
 * @description
 * Reads a round status; an unknown one is pending, as the contract asks.
 *
 * @param {string} status - The status the gateway sent.
 * @returns {TaskApprovalRoundStatus} The status.
 */
function toRoundStatus(status: string): TaskApprovalRoundStatus {
  return status === 'approved' || status === 'changes-requested' ? status : 'pending';
}

/**
 * Function toApprovalSnapshot
 *
 * @description
 * Maps the approval state of a task.
 *
 * @param {GetTaskApprovalClientResult} state - The generated state.
 * @returns {TaskApprovalSnapshot} The display model.
 */
export function toApprovalSnapshot(state: GetTaskApprovalClientResult): TaskApprovalSnapshot {
  const round: GetTaskApprovalClientResult['current'] = state.current;
  return {
    taskVersion: state.taskVersion,
    taskStatus: state.taskStatus,
    round: round
      ? {
          id: round.roundId,
          requesterId: round.requesterUserId,
          requestedAt: round.requestedAt,
          status: toRoundStatus(round.status),
          reviews: round.reviewers.map((reviewer: (typeof round.reviewers)[number]) => ({
            userId: reviewer.reviewerUserId,
            decision: toDecision(reviewer.decision),
          })),
        }
      : null,
  };
}

/**
 * Function toAttachment
 *
 * @description
 * Maps a ready attachment.
 *
 * @param {AttachmentDto} attachment - The generated attachment.
 * @returns {TaskAttachment} The display model.
 */
export function toAttachment(attachment: AttachmentDto): TaskAttachment {
  return {
    id: attachment.id,
    name: attachment.fileName,
    contentType: attachment.contentType,
    size: attachment.sizeBytes,
    authorId: attachment.authorUserId,
    uploadedAt: attachment.uploadedAt,
    version: attachment.version,
  };
}

/**
 * Function toChange
 *
 * @description
 * Reads what an activity entry records; a kind without its member, or a later kind, is a
 * generic change.
 *
 * @param {ActivityEntryDto} entry - The generated entry.
 * @returns {TaskActivityChange} The change.
 */
function toChange(entry: ActivityEntryDto): TaskActivityChange {
  switch (entry.kind) {
    case 'create':
      return { kind: 'create' };
    case 'status':
      return entry.status
        ? { kind: 'status', from: entry.status.from, to: entry.status.to }
        : { kind: 'other' };
    case 'priority':
      return entry.priority
        ? {
            kind: 'priority',
            from: entry.priority.from,
            to: entry.priority.to,
          }
        : { kind: 'other' };
    case 'due':
      return entry.dueDate
        ? { kind: 'due', from: entry.dueDate.from, to: entry.dueDate.to }
        : { kind: 'other' };
    case 'assign':
      return entry.assignee
        ? { kind: 'assign', userId: entry.assignee.userId, added: entry.assignee.added }
        : { kind: 'other' };
    case 'comment':
      return { kind: 'comment', excerpt: entry.commentExcerpt ?? '' };
    default:
      return { kind: 'other' };
  }
}

/**
 * Function toActivityPage
 *
 * @description
 * Maps a page of the activity log.
 *
 * @param {ListTaskActivityClientResult} page - The generated page.
 * @returns {TaskActivityPage} The display model.
 */
export function toActivityPage(page: ListTaskActivityClientResult): TaskActivityPage {
  return {
    total: page.total,
    nextCursor: page.nextCursor,
    items: page.items.map((entry: ActivityEntryDto): TaskActivityEntry => ({
      id: entry.id,
      at: entry.occurredAt,
      actor: {
        type: entry.actor.type,
        id: entry.actor.id,
        provider: entry.actor.provider ?? null,
      } satisfies TaskActivityActor,
      change: toChange(entry),
    })),
  };
}

/**
 * Function toComment
 *
 * @description
 * Maps one comment the gateway answered (a created comment), as the detail's comment pages
 * carry them.
 *
 * @param {CreateTaskCommentClientResult} comment - The generated comment.
 * @returns {TaskComment} The display model.
 */
export function toComment(comment: CreateTaskCommentClientResult): TaskComment {
  return {
    id: comment.id,
    author: { type: comment.actor.type, id: comment.actor.id },
    body: comment.body,
    createdAt: comment.createdAt,
    editedAt: comment.editedAt,
    version: comment.version,
    replyToCommentId: comment.replyToCommentId,
  };
}
