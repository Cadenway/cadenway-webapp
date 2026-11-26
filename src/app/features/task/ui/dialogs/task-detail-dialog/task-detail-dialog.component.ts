import { DOCUMENT } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  type InputSignal,
  output,
  type OutputEmitterRef,
  type Signal,
  signal,
  untracked,
  type WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  CwAlertDialog,
  CwAlertDialogAction,
  CwAlertDialogCancel,
  CwAlertDialogDescription,
  CwAlertDialogTitle,
  provideCwAlertDialogLabels,
} from '@cadenway/ui/components/alert-dialog';
import { CwButton } from '@cadenway/ui/components/button';
import { CwDialog, CwDialogHeader, provideCwDialogLabels } from '@cadenway/ui/components/dialog';
import { provideCwStatusLabels } from '@cadenway/ui/components/status-icon';
import {
  CwEmpty,
  CwEmptyContent,
  CwEmptyDescription,
  CwEmptyHeader,
  CwEmptyMedia,
  CwEmptyTitle,
} from '@cadenway/ui/components/empty';
import { CwToastService } from '@cadenway/ui/components/toast';
import { NgIcon } from '@ng-icons/core';

import { RouteErrorPanel } from '@features/errors';
import {
  LIST_DIRECTORY,
  type ListDirectoryEntry,
  type ListDirectoryPort,
} from '@features/spaces/ports/list-directory';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';
import { isRouteError } from '@shared/route-errors';

import { STATUS_LABELS } from '../../../constants/task-copy/task-copy.constants';
import type {
  TaskDetailPreview,
  TaskDetailTask,
  TaskParentCandidate,
  TaskReference,
} from '../../../models/task-detail/task-detail.interface';
import type { TaskSummary } from '../../../models/task-summary/task-summary.interface';
import { TaskDetailOpener } from '../../../services/task-detail-opener/task-detail-opener.service';
import {
  TaskDetailStore,
  type TaskDetailStoreInstance,
} from '../../../state/task-detail/task-detail.store';
import type { TaskParentContext } from '../../../state/task-parent-picker/task-parent-picker.store';
import { TaskStatusChangesStore } from '../../../state/task-status-changes/task-status-changes.store';
import { statusLabel } from '../../../utils/task-status/task-status.util';
import { TaskDetailHeader } from '../../components/task-detail-header/task-detail-header.component';
import { TaskDetailSkeleton } from '../../components/task-detail-skeleton/task-detail-skeleton.component';
import { TaskDetailTabs } from '../../components/task-detail-tabs/task-detail-tabs.component';
import { TaskPropertiesPanel } from '../../components/task-properties-panel/task-properties-panel.component';
import type { ReminderChoice } from '../../components/task-reminder-menu/task-reminder-menu.component';
import {
  type TaskListOption,
  TaskListPickerDialog,
} from '../task-list-picker-dialog/task-list-picker-dialog.component';
import { TaskParentPickerDialog } from '../task-parent-picker-dialog/task-parent-picker-dialog.component';

/**
 * Component TaskDetailDialog
 *
 * @description
 * The task detail (`App.dc.html` lines 2027-2673), a `cw-dialog` over the current page: the
 * header (`cw-task-detail-header`), then the body: the left column (`cw-task-detail-tabs`) and the
 * aside `Properties of the task` (`cw-task-properties-panel`, `md:w-96`, its own scroll), side by
 * side from 768 px, the aside below the content and the whole panel full screen under it. While
 * the detail is read the header shows what the opening screen gave and the body the skeleton; a
 * failed read renders inside the body: the mockup's `Could not load the task` (with `Retry`) when
 * the header comes from the list, else the typed route error (`cw-route-error-panel`: not found,
 * deleted task with `Restore the task`, unavailable with `Retry`). Closing (backdrop, `Close`,
 * Escape, an archive or a deletion) emits `closed` once the dialog has closed; the focus trap and
 * the focus return come from the brick.
 *
 * It acts as a page: it provides and drives `TaskDetailStore`, provides Task's
 * `TaskStatusChangesStore` for the properties panel (a completed status write reads the detail
 * again), and owns the header's dialogs: the delete confirmation, the list picker (the lists of
 * Spaces' `LIST_DIRECTORY`) and the parent picker.
 */
@Component({
  selector: 'cw-task-detail-dialog',
  imports: [
    CwAlertDialog,
    CwAlertDialogAction,
    CwAlertDialogCancel,
    CwAlertDialogDescription,
    CwAlertDialogTitle,
    CwButton,
    CwDialog,
    CwDialogHeader,
    CwEmpty,
    CwEmptyContent,
    CwEmptyDescription,
    CwEmptyHeader,
    CwEmptyMedia,
    CwEmptyTitle,
    NgIcon,
    RouteErrorPanel,
    TaskDetailHeader,
    TaskDetailSkeleton,
    TaskDetailTabs,
    TaskListPickerDialog,
    TaskParentPickerDialog,
    TaskPropertiesPanel,
  ],
  providers: [
    TaskDetailStore,
    TaskStatusChangesStore,
    provideCwDialogLabels(() => ({ close: $localize`:@@task.detail.dialog-close:Close` })),
    provideCwAlertDialogLabels(() => ({
      confirm: $localize`:@@task.detail.confirm-type:To confirm, type`,
      more: (count: number): string =>
        $localize`:@@task.detail.confirm-more:+ ${count}:count: others`,
    })),
    provideCwStatusLabels(() => ({ ...STATUS_LABELS })),
  ],
  templateUrl: './task-detail-dialog.component.html',
})
export class TaskDetailDialog {
  // #region Properties
  /**
   * Property taskKey
   *
   * @description
   * Key of the task to show (`?task=`); another key shows that task in the same dialog.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly taskKey: InputSignal<string> = input.required<string>();

  /**
   * Property preview
   *
   * @description
   * What the opening screen showed of the task, for the header while it is read.
   *
   * @type {InputSignal<TaskDetailPreview | null>}
   * @readonly
   */
  public readonly preview: InputSignal<TaskDetailPreview | null> = input<TaskDetailPreview | null>(
    null,
  );

  /**
   * Property closed
   *
   * @description
   * Emitted once the dialog has closed, so its host removes `?task=`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly closed: OutputEmitterRef<void> = output();

  /**
   * Property store
   *
   * @description
   * The detail of the open task.
   *
   * @type {TaskDetailStoreInstance}
   * @readonly
   */
  protected readonly store: TaskDetailStoreInstance = inject(TaskDetailStore);

  /**
   * Property open
   *
   * @description
   * Whether the dialog is open; it starts open and closes once.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly open: WritableSignal<boolean> = signal<boolean>(true);

  /**
   * Property confirmDelete
   *
   * @description
   * Whether the delete confirmation is open.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly confirmDelete: WritableSignal<boolean> = signal<boolean>(false);

  /**
   * Property listPicker
   *
   * @description
   * Whether the list picker is open.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly listPicker: WritableSignal<boolean> = signal<boolean>(false);

  /**
   * Property parentPicker
   *
   * @description
   * Whether the parent picker is open.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly parentPicker: WritableSignal<boolean> = signal<boolean>(false);

  /**
   * Property statusLabel
   *
   * @description
   * The space's word for the shown status.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  protected readonly statusLabel: Signal<string | null> = computed((): string | null => {
    const header: ReturnType<TaskDetailStoreInstance['header']> = this.store.header();
    return header?.status
      ? statusLabel(header.status, this.store.statuses(), header.milestone)
      : null;
  });

  /**
   * Property inlineError
   *
   * @description
   * Whether a failed read shows the mockup's inline error: an unavailable read while the header
   * comes from the opening screen.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly inlineError: Signal<boolean> = computed((): boolean => {
    const error: Error | null = this.store.error();
    if (!error || !this.store.hasPreview()) return false;
    return !isRouteError(error) || error.kind === 'unavailable';
  });

  /**
   * Property deleteTitle
   *
   * @description
   * Title of the delete confirmation.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly deleteTitle: Signal<string> = computed(
    (): string =>
      $localize`:@@task.detail.delete-title:Delete ${this.store.header()?.key ?? ''}:key:?`,
  );

  /**
   * Property deleteText
   *
   * @description
   * What the deletion takes to the trash.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly deleteText: Signal<string> = computed((): string => {
    const task: TaskDetailTask | null = this.store.task();
    const subtasks: number = task?.subtasks.total ?? 0;
    const comments: number = this.store.comments()?.total ?? 0;
    return $localize`:@@task.detail.delete-text:“${task?.name ?? ''}:name:”, its ${subtasks}:subtasks: subtasks, its checklist and its ${comments}:comments: comments will go to the trash for 30 days.`;
  });

  /**
   * Property listOptions
   *
   * @description
   * The lists the task can move to.
   *
   * @type {Signal<readonly TaskListOption[]>}
   * @readonly
   */
  protected readonly listOptions: Signal<readonly TaskListOption[]> = computed(
    (): readonly TaskListOption[] =>
      (this.directory?.lists() ?? []).map((list: ListDirectoryEntry): TaskListOption => ({
        id: list.id,
        name: list.name,
        spaceName: list.spaceName,
        icon: list.icon,
      })),
  );

  /**
   * Property parentContext
   *
   * @description
   * What the parent picker needs of the open task: its list, parent, subtasks and the levels
   * below it.
   *
   * @type {Signal<TaskParentContext | null>}
   * @readonly
   */
  protected readonly parentContext: Signal<TaskParentContext | null> = computed(
    (): TaskParentContext | null => {
      const task: TaskDetailTask | null = this.store.confirmedTask();
      if (!task) return null;
      const subtasks: readonly TaskSummary[] = this.store.subtasks();
      return {
        key: task.key,
        listId: task.listId,
        parentKey: task.parentKey,
        childKeys: subtasks.map((subtask: TaskSummary): string => subtask.key),
        height:
          subtasks.length === 0
            ? 0
            : subtasks.some((subtask: TaskSummary): boolean => subtask.subtasks.total > 0)
              ? 2
              : 1,
      };
    },
  );

  /**
   * Property opener
   *
   * @description
   * Opens another task over the page (the parent, a copy).
   *
   * @type {TaskDetailOpener}
   * @readonly
   */
  private readonly opener: TaskDetailOpener = inject(TaskDetailOpener);

  /**
   * Property directory
   *
   * @description
   * Spaces' lists of the workspace, for `Move to…`; absent outside the shell.
   *
   * @type {ListDirectoryPort | null}
   * @readonly
   */
  private readonly directory: ListDirectoryPort | null = inject(LIST_DIRECTORY, {
    optional: true,
  });

  /**
   * Property workspace
   *
   * @description
   * Workspace whose slug the shareable link uses.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  private readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property toasts
   *
   * @description
   * Toasts of the shell's toaster.
   *
   * @type {CwToastService}
   * @readonly
   */
  private readonly toasts: CwToastService = inject(CwToastService);

  /**
   * Property document
   *
   * @description
   * Document whose origin the shareable link starts with.
   *
   * @type {Document}
   * @readonly
   */
  private readonly document: Document = inject(DOCUMENT);
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Shows each task the address names, and reads the detail again after each status write of
   * the properties panel.
   *
   * @constructor
   */
  public constructor() {
    effect((): void => {
      const key: string = this.taskKey();
      const preview: TaskDetailPreview | null = this.preview();
      untracked((): void => {
        this.store.open(key, preview);
      });
    });
    inject(TaskStatusChangesStore)
      .completed.pipe(takeUntilDestroyed())
      .subscribe((): void => {
        void this.store.reload();
      });
  }
  // #endregion

  // #region Methods
  /**
   * Method dialogOpenChange
   *
   * @description
   * Follows the dialog's own closing (backdrop, Escape).
   *
   * @param {boolean} open - Whether it is open.
   */
  protected dialogOpenChange(open: boolean): void {
    this.open.set(open);
  }

  /**
   * Method close
   *
   * @description
   * Closes the dialog; `closed` follows once it has.
   */
  protected close(): void {
    this.open.set(false);
  }

  /**
   * Method openParent
   *
   * @description
   * Opens the parent over the page.
   *
   * @param {TaskReference} parent - The parent.
   */
  protected openParent(parent: TaskReference): void {
    void this.opener.open(parent.key, { ...parent, milestone: false });
  }

  /**
   * Method rename
   *
   * @description
   * Saves the new title.
   *
   * @param {string} name - The new title.
   */
  protected rename(name: string): void {
    void this.store.update({ name });
  }

  /**
   * Method schedule
   *
   * @description
   * Sets the reminder the person picked.
   *
   * @param {ReminderChoice} choice - The moment and its note.
   */
  protected schedule(choice: ReminderChoice): void {
    void this.store.setReminder(choice.at, choice.when, choice.note);
  }

  /**
   * Method copyLink
   *
   * @description
   * Copies the shareable link (`<origin>/<slug>/t/<KEY>`) and says so.
   */
  protected copyLink(): void {
    const key: string | undefined = this.store.header()?.key;
    if (!key) return;
    const link: string = `${this.document.location.origin}/${this.workspace.organization().slug}/t/${key}`;
    void this.copy(link, $localize`:@@task.detail.link-copied:Link copied`);
  }

  /**
   * Method copyKey
   *
   * @description
   * Copies the task's key and says so.
   */
  protected copyKey(): void {
    const key: string | undefined = this.store.header()?.key;
    if (key) void this.copy(key, $localize`:@@task.detail.key-copied:Identifier copied`);
  }

  /**
   * Method archive
   *
   * @description
   * Archives the task and closes the detail once done.
   *
   * @returns {Promise<void>} Resolves once the archive settled.
   */
  protected async archive(): Promise<void> {
    if (await this.store.archive()) this.close();
  }

  /**
   * Method trash
   *
   * @description
   * Deletes the confirmed task and closes the detail once done.
   *
   * @returns {Promise<void>} Resolves once the deletion settled.
   */
  protected async trash(): Promise<void> {
    const deleted: boolean = await this.store.trash();
    this.confirmDelete.set(false);
    if (deleted) this.close();
  }

  /**
   * Method moveTo
   *
   * @description
   * Moves the task to the picked list.
   *
   * @param {TaskListOption} list - The destination.
   */
  protected moveTo(list: TaskListOption): void {
    void this.store.moveTo(list);
  }

  /**
   * Method attachTo
   *
   * @description
   * Attaches the task to the picked parent.
   *
   * @param {TaskParentCandidate} parent - The new parent.
   */
  protected attachTo(parent: TaskParentCandidate): void {
    void this.store.attachTo(parent);
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
      this.toasts.show(title, { description: text });
    } catch {
      this.toasts.error($localize`:@@task.detail.copy-failed:Could not copy`, {
        description: text,
      });
    }
  }
  // #endregion
}
