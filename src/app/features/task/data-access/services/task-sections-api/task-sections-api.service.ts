import { HttpClient, HttpErrorResponse, type HttpEvent, HttpEventType } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import {
  AttachmentsService,
  type CompleteTaskAttachmentUploadClientResult,
  type CreateSubtaskClientResult,
  type CreateTaskCommentClientResult,
  type GetTaskApprovalClientResult,
  type GetTaskAttachmentDownloadClientResult,
  type GetTaskClientResult,
  type ListMembersClientResult,
  type ListTaskActivityClientResult,
  type ListTaskAttachmentsClientResult,
  type ListTaskCommentsClientResult,
  type ListTaskParticipantsClientResult,
  MembersService,
  type StartTaskAttachmentUploadClientResult,
  TaskActivityService,
  TasksService,
  type UpdateChecklistItemClientResult,
} from '@cadenway/api-client';
import { firstValueFrom, lastValueFrom, tap } from 'rxjs';

import type {
  TaskActivityPage,
  TaskApprovalSnapshot,
  TaskAttachment,
  TaskMentionSpan,
} from '../../../models/task-detail-sections/task-detail-sections.interface';
import type {
  TaskComment,
  TaskCommentPage,
  TaskDetailTask,
} from '../../../models/task-detail/task-detail.interface';
import type { Person } from '../../../models/person/person.interface';
import {
  type AttachmentDto,
  toActivityPage,
  toApprovalSnapshot,
  toAttachment,
  toComment,
} from '../../adapters/task-detail-sections/task-detail-sections.adapter';
import {
  toTaskCommentPage,
  toTaskDetailTask,
} from '../../adapters/task-detail/task-detail.adapter';
import { toPerson } from '../../adapters/person/person.adapter';

/**
 * Constant PAGE_SIZE
 *
 * @description
 * Page size of the collections read to their last page (attachments, participants, members).
 *
 * @type {number}
 */
const PAGE_SIZE: number = 100;

/**
 * Constant FEED_PAGE
 *
 * @description
 * Page size of the paged feeds (later comment pages, activity).
 *
 * @type {number}
 */
export const FEED_PAGE: number = 30;

/**
 * Function ifMatch
 *
 * @description
 * The `If-Match` header of a version.
 *
 * @param {number} version - The version.
 * @returns {Record<string, string>} The header.
 */
function ifMatch(version: number): Record<string, string> {
  return { 'If-Match': `"${version.toString()}"` };
}

/**
 * Interface TaskCommentDraft
 *
 * @description
 * What a new comment sends.
 */
export interface TaskCommentDraft {
  // #region Properties
  /**
   * Property body
   *
   * @description
   * The Markdown, 5,000 code points at most.
   *
   * @type {string}
   * @readonly
   */
  readonly body: string;

  /**
   * Property mentions
   *
   * @description
   * The mention spans of the body.
   *
   * @type {readonly TaskMentionSpan[]}
   * @readonly
   */
  readonly mentions: readonly TaskMentionSpan[];

  /**
   * Property replyTo
   *
   * @description
   * The live comment it answers, or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly replyTo: string | null;
  // #endregion
}

/**
 * Service TaskSectionsApi
 *
 * @description
 * The reads and writes of the task detail's tabs through the generated client, mapped to their
 * display models: the approval round and its votes, the comment pages, comment creation and
 * deletion, the participants a comment may mention, the attachments (signed upload, deletion,
 * signed download), the activity log, the checklist items, subtask creation, the parent of a task
 * (the depth of the subtree) and the organization's member directory. Collections are read to
 * their last cursor page; the feeds page by `FEED_PAGE`. Reads skip the HTTP cache.
 */
@Service()
export class TaskSectionsApi {
  // #region Properties
  /**
   * Property tasks
   *
   * @description
   * Generated task operations.
   *
   * @type {TasksService}
   * @readonly
   */
  private readonly tasks: TasksService = inject(TasksService);

  /**
   * Property activity
   *
   * @description
   * Generated activity log operations.
   *
   * @type {TaskActivityService}
   * @readonly
   */
  private readonly activity: TaskActivityService = inject(TaskActivityService);

  /**
   * Property attachments
   *
   * @description
   * Generated attachment operations.
   *
   * @type {AttachmentsService}
   * @readonly
   */
  private readonly attachments: AttachmentsService = inject(AttachmentsService);

  /**
   * Property members
   *
   * @description
   * Generated member operations.
   *
   * @type {MembersService}
   * @readonly
   */
  private readonly members: MembersService = inject(MembersService);

  /**
   * Property http
   *
   * @description
   * Sends the file to the signed object-storage form only; the API itself is reached through the
   * generated client.
   *
   * @type {HttpClient}
   * @readonly
   */
  private readonly http: HttpClient = inject(HttpClient);
  // #endregion

  // #region Methods
  /**
   * Method approval
   *
   * @description
   * Reads the current approval round of a task.
   *
   * @param {string} taskKey - Key of the task.
   * @returns {Promise<TaskApprovalSnapshot>} The approval.
   */
  public async approval(taskKey: string): Promise<TaskApprovalSnapshot> {
    const state: GetTaskApprovalClientResult = await firstValueFrom(
      this.tasks.getTaskApproval(taskKey, { cache: 'no-store' }),
    );
    return toApprovalSnapshot(state);
  }

  /**
   * Method approve
   *
   * @description
   * Records the caller's approval; the last approval moves the task to `done`.
   *
   * @param {string} taskKey - Key of the task.
   * @param {string} roundId - The current round.
   * @returns {Promise<TaskApprovalSnapshot>} The approval after the vote.
   */
  public async approve(taskKey: string, roundId: string): Promise<TaskApprovalSnapshot> {
    const state: GetTaskApprovalClientResult = await firstValueFrom(
      this.tasks.voteOnTaskApproval(taskKey, roundId, { decision: 'approved' }),
    );
    return toApprovalSnapshot(state);
  }

  /**
   * Method requestChanges
   *
   * @description
   * Records the caller's change request: the gateway stores the reason as a task comment and
   * moves the task to `progress`.
   *
   * @param {string} taskKey - Key of the task.
   * @param {string} roundId - The current round.
   * @param {string} reason - What to change (Markdown, not blank).
   * @returns {Promise<TaskApprovalSnapshot>} The approval after the vote.
   */
  public async requestChanges(
    taskKey: string,
    roundId: string,
    reason: string,
  ): Promise<TaskApprovalSnapshot> {
    const state: GetTaskApprovalClientResult = await firstValueFrom(
      this.tasks.voteOnTaskApproval(taskKey, roundId, { decision: 'changes-requested', reason }),
    );
    return toApprovalSnapshot(state);
  }

  /**
   * Method withdrawVote
   *
   * @description
   * Withdraws the caller's vote; the task status and an earlier comment stay.
   *
   * @param {string} taskKey - Key of the task.
   * @param {string} roundId - The current round.
   * @returns {Promise<void>} Resolves once withdrawn.
   */
  public async withdrawVote(taskKey: string, roundId: string): Promise<void> {
    await firstValueFrom(this.tasks.withdrawTaskApprovalVote(taskKey, roundId));
  }

  /**
   * Method requestApproval
   *
   * @description
   * Starts or replaces the approval round with its reviewers (editors of the task).
   *
   * @param {string} taskKey - Key of the task.
   * @param {readonly string[]} reviewerIds - Accounts of the reviewers, 1 to 20.
   * @returns {Promise<TaskApprovalSnapshot>} The new approval.
   */
  public async requestApproval(
    taskKey: string,
    reviewerIds: readonly string[],
  ): Promise<TaskApprovalSnapshot> {
    const state: GetTaskApprovalClientResult = await firstValueFrom(
      this.tasks.requestTaskApproval(taskKey, { reviewerUserIds: [...reviewerIds] }),
    );
    return toApprovalSnapshot(state);
  }

  /**
   * Method comments
   *
   * @description
   * Reads a later page of comments, oldest first.
   *
   * @param {string} taskKey - Key of the task.
   * @param {string} cursor - Cursor of the page.
   * @returns {Promise<TaskCommentPage>} The page.
   */
  public async comments(taskKey: string, cursor: string): Promise<TaskCommentPage> {
    const page: ListTaskCommentsClientResult = await firstValueFrom(
      this.tasks.listTaskComments(taskKey, { cursor, limit: FEED_PAGE }, { cache: 'no-store' }),
    );
    return toTaskCommentPage(page);
  }

  /**
   * Method comment
   *
   * @description
   * Posts a comment with its mention spans under an `Idempotency-Key`, so a retried send does
   * not post it twice.
   *
   * @param {string} taskKey - Key of the task.
   * @param {TaskCommentDraft} draft - The comment.
   * @param {string} idempotencyKey - Key of this send.
   * @returns {Promise<TaskComment>} The created comment.
   */
  public async comment(
    taskKey: string,
    draft: TaskCommentDraft,
    idempotencyKey: string,
  ): Promise<TaskComment> {
    const created: CreateTaskCommentClientResult = await firstValueFrom(
      this.tasks.createTaskComment(
        taskKey,
        {
          body: draft.body,
          ...(draft.mentions.length > 0
            ? {
                mentions: draft.mentions.map((span: TaskMentionSpan) => ({
                  userId: span.userId,
                  start: span.start,
                  end: span.end,
                })),
              }
            : {}),
          ...(draft.replyTo ? { replyToCommentId: draft.replyTo } : {}),
        },
        { headers: { 'Idempotency-Key': idempotencyKey } },
      ),
    );
    return toComment(created);
  }

  /**
   * Method deleteComment
   *
   * @description
   * Deletes one of the caller's comments against its version.
   *
   * @param {string} taskKey - Key of the task.
   * @param {TaskComment} comment - The comment.
   * @returns {Promise<void>} Resolves once deleted.
   */
  public async deleteComment(taskKey: string, comment: TaskComment): Promise<void> {
    await firstValueFrom(
      this.tasks.deleteTaskComment(taskKey, comment.id, { headers: ifMatch(comment.version) }),
    );
  }

  /**
   * Method participants
   *
   * @description
   * The accounts a comment or the description may mention, read to the last page. The comment
   * right comes from the detail's `callerRole`, not from this read.
   *
   * @param {string} taskKey - Key of the task.
   * @returns {Promise<readonly string[]>} The accounts.
   */
  public async participants(taskKey: string): Promise<readonly string[]> {
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const page: ListTaskParticipantsClientResult = await firstValueFrom(
        this.tasks.listTaskParticipants(
          taskKey,
          { limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) },
          { cache: 'no-store' },
        ),
      );
      ids.push(
        ...page.items.map((item: ListTaskParticipantsClientResult['items'][number]) => item.userId),
      );
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return ids;
  }

  /**
   * Method listAttachments
   *
   * @description
   * Reads every ready attachment of a task, the most recent first.
   *
   * @param {string} taskKey - Key of the task.
   * @returns {Promise<readonly TaskAttachment[]>} The attachments.
   */
  public async listAttachments(taskKey: string): Promise<readonly TaskAttachment[]> {
    const found: TaskAttachment[] = [];
    let cursor: string | undefined;
    do {
      const page: ListTaskAttachmentsClientResult = await firstValueFrom(
        this.attachments.listTaskAttachments(
          taskKey,
          { limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) },
          { cache: 'no-store' },
        ),
      );
      found.push(...page.items.map((item: AttachmentDto) => toAttachment(item)));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return found;
  }

  /**
   * Method upload
   *
   * @description
   * Attaches a file: reserves a signed upload (`Idempotency-Key`), posts the signed form fields
   * then the file as its last part `file`, and completes the reservation. The transfer reports no
   * percentage: the application's `FetchBackend` cannot observe upload progress (NG02824), so the
   * caller shows an indeterminate state. After a transfer that left the browser but got no answer
   * (status `0` once the request was sent), completion is still tried before failing, as the
   * contract asks; a request refused before it was sent fails without completing.
   *
   * @param {string} taskKey - Key of the task.
   * @param {File} file - The file, from 1 byte to 25 MiB.
   * @returns {Promise<TaskAttachment>} The ready attachment.
   */
  public async upload(taskKey: string, file: File): Promise<TaskAttachment> {
    const upload: StartTaskAttachmentUploadClientResult = await firstValueFrom(
      this.attachments.startTaskAttachmentUpload(
        taskKey,
        {
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        },
        { headers: { 'Idempotency-Key': crypto.randomUUID() } },
      ),
    );
    const body: FormData = new FormData();
    for (const [name, value] of Object.entries(upload.fields)) body.append(name, value);
    body.append('file', file);
    let sent: boolean = false;
    try {
      await lastValueFrom(
        this.http.post(upload.url, body, { observe: 'events', responseType: 'text' }).pipe(
          tap((event: HttpEvent<string>): void => {
            if (event.type === HttpEventType.Sent) sent = true;
          }),
        ),
      );
    } catch (error: unknown) {
      if (!sent || !(error instanceof HttpErrorResponse) || error.status !== 0) throw error;
    }
    const ready: CompleteTaskAttachmentUploadClientResult = await firstValueFrom(
      this.attachments.completeTaskAttachmentUpload(taskKey, upload.id),
    );
    return toAttachment(ready);
  }

  /**
   * Method deleteAttachment
   *
   * @description
   * Removes an attachment from the task against its version.
   *
   * @param {string} taskKey - Key of the task.
   * @param {TaskAttachment} attachment - The attachment.
   * @returns {Promise<void>} Resolves once removed.
   */
  public async deleteAttachment(taskKey: string, attachment: TaskAttachment): Promise<void> {
    await firstValueFrom(
      this.attachments.deleteTaskAttachment(taskKey, attachment.id, {
        headers: ifMatch(attachment.version),
      }),
    );
  }

  /**
   * Method downloadUrl
   *
   * @description
   * Signs a short-lived download of an attachment (served as a download, on the object-storage
   * origin, without the application's credentials).
   *
   * @param {string} taskKey - Key of the task.
   * @param {string} attachmentId - The attachment.
   * @returns {Promise<string>} The signed address.
   */
  public async downloadUrl(taskKey: string, attachmentId: string): Promise<string> {
    const download: GetTaskAttachmentDownloadClientResult = await firstValueFrom(
      this.attachments.getTaskAttachmentDownload(taskKey, attachmentId),
    );
    return download.url;
  }

  /**
   * Method activityPage
   *
   * @description
   * Reads a page of the activity log, the most recent first.
   *
   * @param {string} taskKey - Key of the task.
   * @param {string | null} cursor - Cursor of the page, null for the first one.
   * @returns {Promise<TaskActivityPage>} The page.
   */
  public async activityPage(taskKey: string, cursor: string | null): Promise<TaskActivityPage> {
    const page: ListTaskActivityClientResult = await firstValueFrom(
      this.activity.listTaskActivity(
        taskKey,
        { limit: FEED_PAGE, ...(cursor ? { cursor } : {}) },
        { cache: 'no-store' },
      ),
    );
    return toActivityPage(page);
  }

  /**
   * Method addChecklistItem
   *
   * @description
   * Adds an unticked item at the end of the checklist.
   *
   * @param {string} taskKey - Key of the task.
   * @param {string} text - The item, 300 characters at most.
   * @returns {Promise<TaskDetailTask>} The task with its new version.
   */
  public async addChecklistItem(taskKey: string, text: string): Promise<TaskDetailTask> {
    const task: UpdateChecklistItemClientResult = await firstValueFrom(
      this.tasks.addChecklistItem(taskKey, { text }),
    );
    return toTaskDetailTask(task);
  }

  /**
   * Method setChecklistItem
   *
   * @description
   * Ticks or unticks an item. It goes without `If-Match`: setting the same state again answers
   * the same version, so a toggle never conflicts with the detail's other writes.
   *
   * @param {string} taskKey - Key of the task.
   * @param {string} itemId - The item.
   * @param {boolean} done - Whether it is ticked.
   * @returns {Promise<TaskDetailTask>} The task as saved.
   */
  public async setChecklistItem(
    taskKey: string,
    itemId: string,
    done: boolean,
  ): Promise<TaskDetailTask> {
    const task: UpdateChecklistItemClientResult = await firstValueFrom(
      this.tasks.updateChecklistItem(taskKey, itemId, { done }),
    );
    return toTaskDetailTask(task);
  }

  /**
   * Method createSubtask
   *
   * @description
   * Creates a subtask in the parent's list (its first assignee taken by the gateway), under an
   * `Idempotency-Key`.
   *
   * @param {string} parentKey - Key of the parent.
   * @param {string} name - Name of the subtask.
   * @param {string} idempotencyKey - Key of this creation.
   * @returns {Promise<{ readonly key: string; readonly name: string }>} The created subtask.
   */
  public async createSubtask(
    parentKey: string,
    name: string,
    idempotencyKey: string,
  ): Promise<{ readonly key: string; readonly name: string }> {
    const task: CreateSubtaskClientResult = await firstValueFrom(
      this.tasks.createSubtask(
        parentKey,
        { name },
        { headers: { 'Idempotency-Key': idempotencyKey } },
      ),
    );
    return { key: task.key, name: task.name };
  }

  /**
   * Method parentOf
   *
   * @description
   * The parent of a task, to tell how deep its subtree sits.
   *
   * @param {string} taskKey - Key of the task.
   * @returns {Promise<string | null>} Key of its parent, or null at the first level.
   */
  public async parentOf(taskKey: string): Promise<string | null> {
    const task: GetTaskClientResult = await firstValueFrom(
      this.tasks.getTask(taskKey, { cache: 'no-store' }),
    );
    return task.parentKey ?? null;
  }

  /**
   * Method people
   *
   * @description
   * Every member of the organization, guests included, so comment authors, reviewers, actors and
   * assignees get their names.
   *
   * @returns {Promise<readonly Person[]>} The people.
   */
  public async people(): Promise<readonly Person[]> {
    const found: Person[] = [];
    let cursor: string | undefined;
    do {
      const page: ListMembersClientResult = await firstValueFrom(
        this.members.listMembers({ limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) }),
      );
      found.push(...page.items.map(toPerson));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return found;
  }
  // #endregion
}
