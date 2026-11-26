import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  inject,
  LOCALE_ID,
  resource,
  type ResourceRef,
  type Signal,
  signal,
  viewChild,
  type WritableSignal,
} from '@angular/core';
import type { StatusKey } from '@cadenway/contracts';
import type { CwMentionPerson, CwMentionSearch } from '@cadenway/ui/components/block-editor';
import type {
  CwAttachmentDraft,
  CwCommentSubmit,
  CwPerson,
} from '@cadenway/ui/components/comment-composer';
import { CwTab, CwTabPanel, CwTabs, CwTabsList } from '@cadenway/ui/components/tabs';
import { CwToastService } from '@cadenway/ui/components/toast';
import { from, map, type Observable } from 'rxjs';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { TASK_SECTIONS_BRICK_LABELS } from '../../../constants/task-detail-sections/task-detail-sections.constants';
import type { Person } from '../../../models/person/person.interface';
import type {
  TaskAddRequest,
  TaskAttachment,
} from '../../../models/task-detail-sections/task-detail-sections.interface';
import type {
  TaskChecklistItem,
  TaskComment,
  TaskDetailTab,
  TaskDetailTask,
} from '../../../models/task-detail/task-detail.interface';
import type { TaskSummary } from '../../../models/task-summary/task-summary.interface';
import { TaskDetailOpener } from '../../../services/task-detail-opener/task-detail-opener.service';
import {
  TaskActivityStore,
  type TaskActivityStoreInstance,
} from '../../../state/task-activity/task-activity.store';
import {
  TaskApprovalCardStore,
  type TaskApprovalCardStoreInstance,
} from '../../../state/task-approval-card/task-approval-card.store';
import {
  TaskAttachmentsStore,
  type TaskAttachmentsStoreInstance,
} from '../../../state/task-attachments/task-attachments.store';
import {
  TaskCommentsStore,
  type TaskCommentsStoreInstance,
} from '../../../state/task-comments/task-comments.store';
import {
  TaskDetailSectionsStore,
  type TaskDetailSectionsStoreInstance,
} from '../../../state/task-detail-sections/task-detail-sections.store';
import {
  TaskDetailStore,
  type TaskDetailStoreInstance,
} from '../../../state/task-detail/task-detail.store';
import {
  type TaskStatusChangesInstance,
  TaskStatusChangesStore,
} from '../../../state/task-status-changes/task-status-changes.store';
import {
  fileSize,
  firstName,
  isPreviewableImage,
  plainText,
  relativeInstant,
} from '../../../utils/task-detail-sections/task-detail-sections.util';
import { nextStatus, statusLabel } from '../../../utils/task-status/task-status.util';
import { TaskActivity } from '../task-activity/task-activity.component';
import { TaskApprovalCard } from '../task-approval-card/task-approval-card.component';
import { TaskAttachments } from '../task-attachments/task-attachments.component';
import { TaskAttachmentsPreview } from '../task-attachments-preview/task-attachments-preview.component';
import { TaskChecklist } from '../task-checklist/task-checklist.component';
import { type TaskCommentRow, TaskComments } from '../task-comments/task-comments.component';
import { TaskCommentsComposer } from '../task-comments-composer/task-comments-composer.component';
import { TaskDescription } from '../task-description/task-description.component';
import { TaskDevelopment } from '../task-development/task-development.component';
import { type TaskSubtaskRow, TaskSubtasks } from '../task-subtasks/task-subtasks.component';

/**
 * Constant MENTION_OPTIONS
 *
 * @description
 * People the `@` menu offers at most.
 *
 * @type {number}
 */
const MENTION_OPTIONS: number = 8;

/**
 * Component TaskDetailTabs
 *
 * @description
 * The left column of the task detail (`App.dc.html` lines 2111-2366): the tab list `Task
 * sections` (`Details`, `Subtasks` and `Comments` with their counts, `Activity`; `Details` at each
 * opening, since the dialog renders the column anew for each task, unless the opening asked for
 * a tab through `TaskDetailOpener`: `Subtasks` then also focuses the new-subtask field) over the
 * scrolling area (`px-4 py-4`), and, on `Comments`, the composer pinned at the bottom. The detail
 * dialog renders it in a column that fills the height on desktop and flows in the page scroll
 * under 768 px.
 *
 * It is a container of the detail dialog, which acts as a page and provides `TaskDetailStore` and
 * `TaskStatusChangesStore`; it provides the section stores (`TaskDetailSectionsStore`,
 * `TaskApprovalCardStore`, `TaskAttachmentsStore`, `TaskCommentsStore`, `TaskActivityStore`) and
 * the bricks' English texts, so all of them die with the open task, and wires the presentational
 * sections: `Details` (approval card, description, checklist, attachments with their preview,
 * the development placeholder), `Subtasks` (status advance through the status changes, opening
 * through `TaskDetailOpener`, creation), `Comments` (list, menu actions, composer with mentions of
 * the task's participants and files attached to the task too) and `Activity` (the log, read each
 * time the tab is shown). The description's `@` menu offers the same participants as the
 * composer, read the first time either menu searches. Writing needs the list's `edit` role;
 * commenting needs `comment` or `edit` (`TaskDetailStore.canComment`).
 */
@Component({
  selector: 'cw-task-detail-tabs',
  imports: [
    CwTab,
    CwTabPanel,
    CwTabs,
    CwTabsList,
    TaskActivity,
    TaskApprovalCard,
    TaskAttachments,
    TaskAttachmentsPreview,
    TaskChecklist,
    TaskComments,
    TaskCommentsComposer,
    TaskDescription,
    TaskDevelopment,
    TaskSubtasks,
  ],
  providers: [
    TaskDetailSectionsStore,
    TaskApprovalCardStore,
    TaskAttachmentsStore,
    TaskCommentsStore,
    TaskActivityStore,
    ...TASK_SECTIONS_BRICK_LABELS,
  ],
  host: { class: 'flex min-h-0 min-w-0 flex-1 flex-col' },
  templateUrl: './task-detail-tabs.component.html',
})
export class TaskDetailTabs {
  // #region Properties
  /**
   * Property store
   *
   * @description
   * The detail of the open task, provided by the detail dialog.
   *
   * @type {TaskDetailStoreInstance}
   * @readonly
   */
  protected readonly store: TaskDetailStoreInstance = inject(TaskDetailStore);

  /**
   * Property sections
   *
   * @description
   * The tabs' own writes and the member directory.
   *
   * @type {TaskDetailSectionsStoreInstance}
   * @readonly
   */
  protected readonly sections: TaskDetailSectionsStoreInstance = inject(TaskDetailSectionsStore);

  /**
   * Property approval
   *
   * @description
   * The approval card.
   *
   * @type {TaskApprovalCardStoreInstance}
   * @readonly
   */
  protected readonly approval: TaskApprovalCardStoreInstance = inject(TaskApprovalCardStore);

  /**
   * Property attachments
   *
   * @description
   * The attachments.
   *
   * @type {TaskAttachmentsStoreInstance}
   * @readonly
   */
  protected readonly attachments: TaskAttachmentsStoreInstance = inject(TaskAttachmentsStore);

  /**
   * Property comments
   *
   * @description
   * The comments.
   *
   * @type {TaskCommentsStoreInstance}
   * @readonly
   */
  protected readonly comments: TaskCommentsStoreInstance = inject(TaskCommentsStore);

  /**
   * Property activity
   *
   * @description
   * The activity log.
   *
   * @type {TaskActivityStoreInstance}
   * @readonly
   */
  protected readonly activity: TaskActivityStoreInstance = inject(TaskActivityStore);

  /**
   * Property tab
   *
   * @description
   * The selected tab.
   *
   * @type {WritableSignal<string>}
   * @readonly
   */
  protected readonly tab: WritableSignal<string> = signal<string>('details');

  /**
   * Property draft
   *
   * @description
   * The comment being written.
   *
   * @type {WritableSignal<string>}
   * @readonly
   */
  protected readonly draft: WritableSignal<string> = signal<string>('');

  /**
   * Property drafts
   *
   * @description
   * The files joined to the comment being written.
   *
   * @type {WritableSignal<readonly CwAttachmentDraft[]>}
   * @readonly
   */
  protected readonly drafts: WritableSignal<readonly CwAttachmentDraft[]> = signal<
    readonly CwAttachmentDraft[]
  >([]);

  /**
   * Property removal
   *
   * @description
   * The attachment whose removal is being confirmed.
   *
   * @type {WritableSignal<TaskAttachment | null>}
   * @readonly
   */
  protected readonly removal: WritableSignal<TaskAttachment | null> = signal<TaskAttachment | null>(
    null,
  );

  /**
   * Property previewIndex
   *
   * @description
   * Position of the previewed attachment, null while the preview is closed.
   *
   * @type {WritableSignal<number | null>}
   * @readonly
   */
  protected readonly previewIndex: WritableSignal<number | null> = signal<number | null>(null);

  /**
   * Property meId
   *
   * @description
   * The caller's account.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly meId: Signal<string> = computed((): string => this.workspace.user().id);

  /**
   * Property author
   *
   * @description
   * The caller as the composer draws them.
   *
   * @type {Signal<CwPerson>}
   * @readonly
   */
  protected readonly author: Signal<CwPerson> = computed((): CwPerson => ({
    id: this.workspace.user().id,
    name: this.workspace.user().name,
  }));

  /**
   * Property description
   *
   * @description
   * The description's Markdown, empty without one.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly description: Signal<string> = computed(
    (): string => this.store.task()?.description ?? '',
  );

  /**
   * Property subtaskCount
   *
   * @description
   * The `Subtasks` tab's count, undefined at zero.
   *
   * @type {Signal<number | undefined>}
   * @readonly
   */
  protected readonly subtaskCount: Signal<number | undefined> = computed((): number | undefined => {
    const count: number = this.store.subtasks().length;
    return count > 0 ? count : undefined;
  });

  /**
   * Property commentCount
   *
   * @description
   * The `Comments` tab's count, undefined at zero or while unknown.
   *
   * @type {Signal<number | undefined>}
   * @readonly
   */
  protected readonly commentCount: Signal<number | undefined> = computed((): number | undefined => {
    const count: number | null = this.comments.total();
    return count !== null && count > 0 ? count : undefined;
  });

  /**
   * Property subtaskRows
   *
   * @description
   * The subtasks with their shown status and the name of their status button.
   *
   * @type {Signal<readonly TaskSubtaskRow[]>}
   * @readonly
   */
  protected readonly subtaskRows: Signal<readonly TaskSubtaskRow[]> = computed(
    (): readonly TaskSubtaskRow[] => {
      const people: ReadonlyMap<string, Person> = this.sections.peopleById();
      return this.store.subtasks().map((task: TaskSummary): TaskSubtaskRow => {
        const status: StatusKey = this.statusChanges.displayedStatus(task);
        const next: StatusKey | null = nextStatus(status, task.milestone);
        const label: string = statusLabel(status, this.store.statuses(), task.milestone);
        const nextLabel: string = next
          ? statusLabel(next, this.store.statuses(), task.milestone)
          : '';
        return {
          task,
          status,
          canAdvance: next !== null,
          advanceLabel: next
            ? $localize`:@@task.subtasks.advance:${label}:status: · move to “${nextLabel}:next:”`
            : label,
          people: task.assigneeIds
            .map((id: string): Person | undefined => people.get(id))
            .filter((person: Person | undefined): person is Person => person !== undefined),
        };
      });
    },
  );

  /**
   * Property commentRows
   *
   * @description
   * The comments with their author's name, whether the caller wrote them, and their time.
   *
   * @type {Signal<readonly TaskCommentRow[]>}
   * @readonly
   */
  protected readonly commentRows: Signal<readonly TaskCommentRow[]> = computed(
    (): readonly TaskCommentRow[] => {
      const people: ReadonlyMap<string, Person> = this.sections.peopleById();
      const now: Date = new Date();
      return this.comments.items().map((comment: TaskComment): TaskCommentRow => {
        const person: Person | undefined =
          comment.author.type === 'user' ? people.get(comment.author.id) : undefined;
        const name: string =
          person?.name ??
          (comment.author.type === 'automation'
            ? $localize`:@@task.activity.automation:An automation`
            : comment.author.type === 'user'
              ? $localize`:@@task.sections.avatar-unknown:Unknown user`
              : comment.author.id);
        return {
          comment,
          name,
          person: person?.name ?? null,
          mine: comment.author.type === 'user' && comment.author.id === this.meId(),
          time: relativeInstant(comment.createdAt, now, this.locale),
        };
      });
    },
  );

  /**
   * Property commentsLoading
   *
   * @description
   * Whether the first comment page is being read with nothing to show.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly commentsLoading: Signal<boolean> = computed(
    (): boolean => this.store.comments() === null && !this.store.commentsFailed(),
  );

  /**
   * Property sendError
   *
   * @description
   * The composer's error after a failed post, or null.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  protected readonly sendError: Signal<string | null> = computed((): string | null =>
    this.comments.sendFailed()
      ? $localize`:@@task.comments.send-failed:Could not send the comment.`
      : null,
  );

  /**
   * Property mentionSearch
   *
   * @description
   * The `@` menu's lookup of the composer and the description: the task's participants named by
   * the member directory, matched on the typed text. The first search reads the participants
   * when the `Comments` tab has not read them yet.
   *
   * @type {CwMentionSearch}
   * @readonly
   */
  protected readonly mentionSearch: CwMentionSearch = (
    query: string,
  ): Observable<readonly CwMentionPerson[]> => {
    const text: string = query.trim().toLocaleLowerCase();
    return from(this.comments.start()).pipe(
      map((): readonly CwMentionPerson[] => {
        const people: ReadonlyMap<string, Person> = this.sections.peopleById();
        return this.comments
          .participants()
          .map((id: string): Person | undefined => people.get(id))
          .filter(
            (person: Person | undefined): person is Person =>
              person?.name.toLocaleLowerCase().includes(text) === true,
          )
          .slice(0, MENTION_OPTIONS)
          .map((person: Person): CwMentionPerson => ({ id: person.id, name: person.name }));
      }),
    );
  };

  /**
   * Property previewImage
   *
   * @description
   * The signed address of the previewed image, read while an image is previewed.
   *
   * @type {ResourceRef<string | null | undefined>}
   * @readonly
   */
  protected readonly previewImage: ResourceRef<string | null | undefined> = resource({
    params: (): TaskAttachment | undefined => {
      const index: number | null = this.previewIndex();
      const shown: TaskAttachment | undefined =
        index === null ? undefined : this.attachments.items()[index];
      return shown !== undefined && isPreviewableImage(shown.contentType) ? shown : undefined;
    },
    loader: ({ params }: { params: TaskAttachment }): Promise<string | null> =>
      this.attachments.signedUrl(params),
  });

  /**
   * Property statusChanges
   *
   * @description
   * The status changes of the detail dialog, for the subtasks' status buttons.
   *
   * @type {TaskStatusChangesInstance}
   * @readonly
   */
  private readonly statusChanges: TaskStatusChangesInstance = inject(TaskStatusChangesStore);

  /**
   * Property opener
   *
   * @description
   * Opens a subtask in the same dialog.
   *
   * @type {TaskDetailOpener}
   * @readonly
   */
  private readonly opener: TaskDetailOpener = inject(TaskDetailOpener);

  /**
   * Property workspace
   *
   * @description
   * The caller and the organization.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  private readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property toasts
   *
   * @description
   * Confirms copies and downloads.
   *
   * @type {CwToastService}
   * @readonly
   */
  private readonly toasts: CwToastService = inject(CwToastService);

  /**
   * Property document
   *
   * @description
   * The page, for the clipboard and the download link.
   *
   * @type {Document}
   * @readonly
   */
  private readonly document: Document = inject(DOCUMENT);

  /**
   * Property locale
   *
   * @description
   * The active locale, for times and sizes.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);

  /**
   * Property replyTo
   *
   * @description
   * The comment the draft answers, or null.
   *
   * @type {string | null}
   */
  private replyTo: string | null = null;

  /**
   * Property lastSubmit
   *
   * @description
   * The last comment submitted, sent again by the composer's `Retry`.
   *
   * @type {CwCommentSubmit | null}
   */
  private lastSubmit: CwCommentSubmit | null = null;

  /**
   * Property composer
   *
   * @description
   * The composer, to focus it after `Reply`.
   *
   * @type {Signal<TaskCommentsComposer | undefined>}
   * @readonly
   */
  private readonly composer: Signal<TaskCommentsComposer | undefined> =
    viewChild(TaskCommentsComposer);

  /**
   * Property subtasksSection
   *
   * @description
   * The `Subtasks` section, to focus its add field when the opening asked for that tab.
   *
   * @type {Signal<TaskSubtasks | undefined>}
   * @readonly
   */
  private readonly subtasksSection: Signal<TaskSubtasks | undefined> = viewChild(TaskSubtasks);
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Opens the tab the opening asked for (`TaskDetailOpener.takeTab`), `Details` otherwise; on
   * `Subtasks`, the new-subtask field takes the focus once rendered.
   *
   * @constructor
   */
  public constructor() {
    const key: string | null = this.store.taskKey();
    const requested: TaskDetailTab | null = key === null ? null : this.opener.takeTab(key);
    if (requested === null || requested === 'details') return;
    this.select(requested);
    if (requested === 'subtasks') {
      afterNextRender((): void => {
        this.subtasksSection()?.focusNew();
      });
    }
  }
  // #endregion

  // #region Methods
  /**
   * Method select
   *
   * @description
   * Shows a tab: `Comments` reads the participants once, `Activity` reads the log each time.
   *
   * @param {string} tab - The tab.
   */
  protected select(tab: string): void {
    this.tab.set(tab);
    this.activity.show(tab === 'activity');
    if (tab === 'comments') void this.comments.start();
  }

  /**
   * Method toggleItem
   *
   * @description
   * Ticks or unticks a checklist item.
   *
   * @param {TaskChecklistItem} item - The item.
   */
  protected toggleItem(item: TaskChecklistItem): void {
    void this.sections.toggleItem(item);
  }

  /**
   * Method addItem
   *
   * @description
   * Adds a checklist item and tells the field whether it was saved.
   *
   * @param {TaskAddRequest} request - The item and its field's settlement.
   */
  protected addItem(request: TaskAddRequest): void {
    void this.sections.addItem(request.text).then(request.settle);
  }

  /**
   * Method addFiles
   *
   * @description
   * Attaches files from the section.
   *
   * @param {File[]} files - The files.
   */
  protected addFiles(files: File[]): void {
    void this.attachments.add(files);
  }

  /**
   * Method removeAttachment
   *
   * @description
   * Removes a confirmed attachment, closing the confirmation once done.
   *
   * @param {TaskAttachment} attachment - The attachment.
   * @returns {Promise<void>} Resolves once settled.
   */
  protected async removeAttachment(attachment: TaskAttachment): Promise<void> {
    if (await this.attachments.remove(attachment)) {
      this.removal.set(null);
      this.previewIndex.set(null);
    }
  }

  /**
   * Method download
   *
   * @description
   * Downloads an attachment from its signed address and toasts `Download started`; an address
   * that cannot be signed toasts `Download blocked` (in the store).
   *
   * @param {TaskAttachment} attachment - The attachment.
   * @returns {Promise<void>} Resolves once started.
   */
  protected async download(attachment: TaskAttachment): Promise<void> {
    const url: string | null = await this.attachments.signedUrl(attachment);
    if (url === null) return;
    const link: HTMLAnchorElement = this.document.createElement('a');
    link.href = url;
    link.rel = 'noopener';
    link.download = attachment.name;
    link.click();
    this.toasts.show($localize`:@@task.attachments.download-started:Download started`, {
      description: `${attachment.name} · ${fileSize(attachment.size, this.locale)}`,
    });
  }

  /**
   * Method advance
   *
   * @description
   * Moves a subtask to its next status through the status changes (settle, undo, toasts).
   *
   * @param {TaskSummary} task - The subtask.
   */
  protected advance(task: TaskSummary): void {
    const next: StatusKey | null = nextStatus(
      this.statusChanges.displayedStatus(task),
      task.milestone,
    );
    if (next) this.statusChanges.request(task, next, this.store.statuses());
  }

  /**
   * Method openSubtask
   *
   * @description
   * Opens a subtask in the dialog.
   *
   * @param {TaskSummary} task - The subtask.
   */
  protected openSubtask(task: TaskSummary): void {
    void this.opener.open(task.key, {
      key: task.key,
      name: task.name,
      status: this.statusChanges.displayedStatus(task),
      milestone: task.milestone,
    });
  }

  /**
   * Method createSubtask
   *
   * @description
   * Creates a subtask of the open task and tells the field whether it was saved.
   *
   * @param {TaskAddRequest} request - Its name and its field's settlement.
   */
  protected createSubtask(request: TaskAddRequest): void {
    void this.sections.createSubtask(request.text).then(request.settle);
  }

  /**
   * Method copyKey
   *
   * @description
   * Copies the task's key (the development hint).
   */
  protected copyKey(): void {
    const task: TaskDetailTask | null = this.store.task();
    if (task) void this.copy(task.key, $localize`:@@task.detail.key-copied:Identifier copied`);
  }

  /**
   * Method copyComment
   *
   * @description
   * Copies a comment's text without its marks.
   *
   * @param {TaskCommentRow} row - The comment.
   */
  protected copyComment(row: TaskCommentRow): void {
    void this.copy(plainText(row.comment.body), $localize`:@@task.comments.copied:Comment copied`);
  }

  /**
   * Method reply
   *
   * @description
   * Prefills the draft with `@<first name> ` and answers that comment.
   *
   * @param {TaskCommentRow} row - The comment.
   */
  protected reply(row: TaskCommentRow): void {
    this.draft.set(`@${firstName(row.name)} `);
    this.replyTo = row.comment.id;
    queueMicrotask((): void => this.composer()?.focus());
  }

  /**
   * Method deleteComment
   *
   * @description
   * Deletes one of the caller's comments (with `Undo`).
   *
   * @param {TaskComment} comment - The comment.
   */
  protected deleteComment(comment: TaskComment): void {
    void this.comments.remove(comment);
  }

  /**
   * Method draftChanged
   *
   * @description
   * Keeps the draft; an emptied draft answers no comment any more.
   *
   * @param {string} markdown - The draft.
   */
  protected draftChanged(markdown: string): void {
    this.draft.set(markdown);
    if (markdown.trim() === '') this.replyTo = null;
  }

  /**
   * Method send
   *
   * @description
   * Posts the comment, its attached files named on a last line `Attachments: a, b` (they are
   * already attached to the task), then empties the composer.
   *
   * @param {CwCommentSubmit} submit - What the composer submitted.
   * @returns {Promise<void>} Resolves once settled.
   */
  protected async send(submit: CwCommentSubmit): Promise<void> {
    this.lastSubmit = submit;
    const names: readonly string[] = this.drafts()
      .filter((file: CwAttachmentDraft): boolean => file.state === 'done')
      .map((file: CwAttachmentDraft): string => file.name);
    const body: string =
      names.length > 0
        ? `${submit.markdown.trim()}\n\n${$localize`:@@task.comments.attachments-line:Attachments: ${names.join(', ')}:names:`}`
        : submit.markdown;
    if (await this.comments.send(body, this.replyTo)) {
      this.draft.set('');
      this.drafts.set([]);
      this.replyTo = null;
      this.lastSubmit = null;
    }
  }

  /**
   * Method resend
   *
   * @description
   * Sends the last submitted comment again (the composer's `Retry`).
   */
  protected resend(): void {
    if (this.lastSubmit) void this.send(this.lastSubmit);
  }

  /**
   * Method attachToComment
   *
   * @description
   * Uploads the composer's files to the task's attachments, each chip spinning while it is sent
   * (the transfer reports no percentage); a refused or failed file shows its error there.
   *
   * @param {File[]} files - The files.
   */
  protected attachToComment(files: File[]): void {
    for (const file of files) {
      const id: string = crypto.randomUUID();
      this.drafts.update((drafts: readonly CwAttachmentDraft[]) => [
        ...drafts,
        {
          id,
          name: file.name,
          mimeType: file.type,
          fileSize: file.size,
          state: 'uploading',
          progress: 0,
        },
      ]);
      const patch: (changes: Partial<CwAttachmentDraft>) => void = (
        changes: Partial<CwAttachmentDraft>,
      ): void => {
        this.drafts.update((drafts: readonly CwAttachmentDraft[]) =>
          drafts.map((draft: CwAttachmentDraft) =>
            draft.id === id ? { ...draft, ...changes } : draft,
          ),
        );
      };
      void this.attachments.attach(file).then((attachment: TaskAttachment | null): void => {
        patch(
          attachment
            ? { state: 'done', name: attachment.name }
            : {
                state: 'error',
                error: $localize`:@@task.attachments.upload-failed:Could not attach ${file.name}:name:`,
              },
        );
      });
    }
  }

  /**
   * Method detachFromComment
   *
   * @description
   * Takes a file off the comment; an uploaded file stays attached to the task.
   *
   * @param {string} id - The composer's id of the file.
   */
  protected detachFromComment(id: string): void {
    this.drafts.update((drafts: readonly CwAttachmentDraft[]) =>
      drafts.filter((draft: CwAttachmentDraft) => draft.id !== id),
    );
  }

  /**
   * Method copy
   *
   * @description
   * Writes a text to the clipboard and shows the confirmation, or the failure.
   *
   * @param {string} text - The text.
   * @param {string} title - The confirmation's title.
   * @returns {Promise<void>} Resolves once copied.
   */
  private async copy(text: string, title: string): Promise<void> {
    try {
      await this.document.defaultView?.navigator.clipboard.writeText(text);
      this.toasts.show(title);
    } catch {
      this.toasts.error($localize`:@@task.detail.copy-failed:Could not copy`, {
        description: text,
      });
    }
  }
  // #endregion
}
