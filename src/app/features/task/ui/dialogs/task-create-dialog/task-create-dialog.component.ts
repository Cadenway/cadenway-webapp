import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  linkedSignal,
  type Signal,
  signal,
  untracked,
  type WritableSignal,
} from '@angular/core';
import {
  type FieldContext,
  type FieldTree,
  form,
  FormField,
  required,
  submit,
  validate,
  type ValidationError,
} from '@angular/forms/signals';
import type { CancelReason, PriorityKey, StatusKey } from '@cadenway/contracts';
import { CwButton } from '@cadenway/ui/components/button';
import {
  type CwDatePickerValue,
  type CwDatePreset,
  CwDatePicker,
  provideCwDatePickerLabels,
} from '@cadenway/ui/components/date-picker';
import {
  CwDialog,
  CwDialogFooter,
  CwDialogHeader,
  CwDialogTitle,
  provideCwDialogLabels,
} from '@cadenway/ui/components/dialog';
import { CwInput } from '@cadenway/ui/components/input';
import { CwKbd } from '@cadenway/ui/components/kbd';
import { CwMenu, CwMenuItem, CwMenuLabel, CwMenuTriggerFor } from '@cadenway/ui/components/menu';
import { CwStatusIcon } from '@cadenway/ui/components/status-icon';
import { CwSwitch } from '@cadenway/ui/components/switch';
import { CwToastService } from '@cadenway/ui/components/toast';
import { NgIcon } from '@ng-icons/core';

import { ShortcutsService } from '@core/shortcuts';
import { hasProblemCode, readProblem, type ApiProblem } from '@core/api';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import type {
  CreatedTask,
  ListDestination,
  TaskCreateOptions,
  TaskDraft,
  TaskTemplateOption,
} from '../../../models/task-create/task-create.interface';
import type { TaskCancellation } from '../../../models/task-status-change/task-status-change.interface';
import { TaskCreate } from '../../../services/task-create/task-create.service';
import { TaskDetailOpener } from '../../../services/task-detail-opener/task-detail-opener.service';
import { TaskCreateStore } from '../../../state/task-create/task-create.store';
import { statusLabel } from '../../../utils/task-status/task-status.util';
import { TaskLabelPicker } from '../../components/task-label-picker/task-label-picker.component';
import { TaskPeoplePicker } from '../../components/task-people-picker/task-people-picker.component';
import { TaskPriorityPicker } from '../../components/task-priority-picker/task-priority-picker.component';
import { TaskStatusPicker } from '../../components/task-status-picker/task-status-picker.component';
import { TaskCancelDialog } from '../task-cancel-dialog/task-cancel-dialog.component';

/**
 * Function dueLabel
 *
 * @description
 * `Due date`: the due date picker's placeholder, and its name once a date is picked.
 *
 * @returns {string} The label.
 */
function dueLabel(): string {
  return $localize`:@@task.create.due:Due date`;
}

/**
 * Type ServerIssueField
 *
 * @description
 * Where a refused creation's issue is shown: one of the dialog's fields, or the whole form for a
 * path the dialog does not show.
 *
 * @type {'name' | 'description' | 'due' | 'assigneeIds' | 'labels' | 'status' | 'form'}
 */
type ServerIssueField =
  'name' | 'description' | 'due' | 'assigneeIds' | 'labels' | 'status' | 'form';

/**
 * Constant SERVER_ISSUE_FIELDS
 *
 * @description
 * The dialog field of each first segment of a 422 issue path.
 *
 * @type {Readonly<Record<string, ServerIssueField>>}
 */
const SERVER_ISSUE_FIELDS: Readonly<Record<string, ServerIssueField>> = {
  name: 'name',
  title: 'name',
  description: 'description',
  dueDate: 'due',
  assigneeIds: 'assigneeIds',
  labels: 'labels',
  status: 'status',
};

/**
 * Interface TaskCreateModel
 *
 * @description
 * The fields of the create dialog.
 */
interface TaskCreateModel {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * Name of the task; required.
   *
   * @type {string}
   */
  name: string;

  /**
   * Property description
   *
   * @description
   * Description, a plain text until the block editor of step 5.
   *
   * @type {string}
   */
  description: string;

  /**
   * Property subtaskDraft
   *
   * @description
   * Text of the `Add a subtask` field.
   *
   * @type {string}
   */
  subtaskDraft: string;

  /**
   * Property subtasks
   *
   * @description
   * Names of the drafted subtasks.
   *
   * @type {readonly string[]}
   */
  subtasks: readonly string[];

  /**
   * Property checklist
   *
   * @description
   * Checklist entries a template added.
   *
   * @type {readonly string[]}
   */
  checklist: readonly string[];

  /**
   * Property status
   *
   * @description
   * Initial status.
   *
   * @type {StatusKey}
   */
  status: StatusKey;

  /**
   * Property cancellation
   *
   * @description
   * Reason and note when the initial status is `cancelled`.
   *
   * @type {TaskCancellation | null}
   */
  cancellation: TaskCancellation | null;

  /**
   * Property assigneeIds
   *
   * @description
   * User ids of the assignees; the current user by default.
   *
   * @type {readonly string[]}
   */
  assigneeIds: readonly string[];

  /**
   * Property due
   *
   * @description
   * Due date, or null.
   *
   * @type {Date | null}
   */
  due: Date | null;

  /**
   * Property priority
   *
   * @description
   * Priority; `Medium` by default.
   *
   * @type {PriorityKey}
   */
  priority: PriorityKey;

  /**
   * Property labels
   *
   * @description
   * Label names.
   *
   * @type {readonly string[]}
   */
  labels: readonly string[];

  /**
   * Property templateId
   *
   * @description
   * Template the dialog was filled from, or null.
   *
   * @type {string | null}
   */
  templateId: string | null;
  // #endregion
}

/**
 * Function toDate
 *
 * @description
 * The local midnight of an ISO calendar date.
 *
 * @param {string} iso - `yyyy-mm-dd`.
 * @returns {Date} The date.
 */
function toDate(iso: string): Date {
  const [year, month, day]: number[] = iso.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Function toIso
 *
 * @description
 * The ISO calendar date of a local date.
 *
 * @param {Date} date - The date.
 * @returns {string} `yyyy-mm-dd`.
 */
function toIso(date: Date): string {
  const month: string = String(date.getMonth() + 1).padStart(2, '0');
  const day: string = String(date.getDate()).padStart(2, '0');
  return `${String(date.getFullYear())}-${month}-${day}`;
}

/**
 * Function addDays
 *
 * @description
 * A date some days later, at local midnight.
 *
 * @param {Date} date - Start.
 * @param {number} days - Days to add.
 * @returns {Date} The later date.
 */
function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * Component TaskCreateDialog
 *
 * @description
 * The task create dialog of mockup `App.dc.html` (lines 2820-2975, logic near line 7232), on
 * `cw-dialog`, an `overlays` slot contribution bound by `withTaskCreate()`. `N` opens it outside
 * fields and `TaskCreate.open` opens it from any screen with presets. The 896 px window is pinned
 * 8vh from the top (`placement="top"`), so it grows downwards, and scrolls its flush body between
 * the bar header and the footer (`padding="none"`, `scrollable`). The header picks the
 * destination list (`in` Product › Sprint 14, with `Retry` when the lists cannot be
 * read), shows the next key and offers the space's saved templates. The body holds the required
 * name, a plain description (the block editor comes in step 5) and the subtask drafts (Enter
 * adds one). The properties are the status split button (`Cancelled` asks its reason first), the
 * assignees (the current user by default), the due date, the priority (`Medium`) and the
 * labels. `Create the task` or Ctrl Enter creates the task with an `Idempotency-Key`, then a
 * toast offers `Open`, the task's detail over the page; `Create more tasks` keeps the dialog
 * open with an empty name. Escape closes an open menu first, then the dialog. An empty name only
 * disables `Create the task`, as in the mockup, and is said under the field once it was left. The
 * footer's error summary, an alert, holds the other fields' errors once a field was left or a
 * creation was refused. It provides its own `TaskCreateStore`.
 */
@Component({
  selector: 'cw-task-create-dialog',
  imports: [
    CwButton,
    CwDatePicker,
    CwDialog,
    CwDialogFooter,
    CwDialogHeader,
    CwDialogTitle,
    CwInput,
    CwKbd,
    CwMenu,
    CwMenuItem,
    CwMenuLabel,
    CwMenuTriggerFor,
    CwStatusIcon,
    CwSwitch,
    FormField,
    NgIcon,
    TaskCancelDialog,
    TaskLabelPicker,
    TaskPeoplePicker,
    TaskPriorityPicker,
    TaskStatusPicker,
  ],
  providers: [
    TaskCreateStore,
    provideCwDialogLabels(() => ({ close: $localize`:@@task.create.close:Close` })),
    provideCwDatePickerLabels(() => ({
      placeholder: dueLabel(),
      dialog: $localize`:@@task.create.due-dialog:Due date`,
      clear: $localize`:@@task.create.due-clear:Clear`,
      addTime: $localize`:@@task.create.due-add-time:Add a time`,
      time: $localize`:@@task.create.due-time:Time`,
      openCalendar: $localize`:@@task.create.due-calendar:Open the calendar`,
      inputPlaceholder: $localize`:@@task.create.due-input:dd/mm/yyyy`,
    })),
  ],
  templateUrl: './task-create-dialog.component.html',
})
export class TaskCreateDialog {
  // #region Properties
  /**
   * Property retryLabel
   *
   * @description
   * Label of the `Retry` button of a failed read.
   *
   * @type {string}
   * @readonly
   */
  protected readonly retryLabel: string = $localize`:@@task.retry:Retry`;

  /**
   * Property footerErrors
   *
   * @description
   * The errors of the footer summary: none before a field was left or a creation was tried, and
   * never the name's, which its field already says, so that one error is announced once.
   *
   * @type {Signal<readonly ValidationError.WithFieldTree[]>}
   * @readonly
   */
  protected readonly footerErrors: Signal<readonly ValidationError.WithFieldTree[]> = computed(
    (): readonly ValidationError.WithFieldTree[] =>
      this.createForm().touched()
        ? this.createForm()
            .errorSummary()
            .filter(
              (error: ValidationError.WithFieldTree): boolean =>
                error.fieldTree() !== this.createForm.name(),
            )
        : [],
  );

  /**
   * Property dueName
   *
   * @description
   * Name of the due date picker, put before the picked date (`Due date, Nov 18`). Without a
   * date the trigger shows the same word as its placeholder and takes its name from that text, so
   * it is not announced twice. Valid for the button variant only: the `input` variant would need
   * its name at all times.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly dueName: Signal<string> = computed((): string =>
    this.model().due === null ? '' : dueLabel(),
  );

  /**
   * Property taskCreate
   *
   * @description
   * Open state and presets shared with the screens that open the dialog.
   *
   * @type {TaskCreate}
   * @readonly
   */
  protected readonly taskCreate: TaskCreate = inject(TaskCreate);

  /**
   * Property store
   *
   * @description
   * Data and creation of the dialog.
   *
   * @type {InstanceType<typeof TaskCreateStore>}
   * @readonly
   */
  protected readonly store: InstanceType<typeof TaskCreateStore> = inject(TaskCreateStore);

  /**
   * Property workspace
   *
   * @description
   * Workspace whose person is the default assignee and whose slug the `Open` address uses.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  protected readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property organizationId
   *
   * @description
   * Committed organization for the current dialog session.
   *
   * @type {string}
   */
  private organizationId: string = this.workspace.organization().id;

  /**
   * Property openingId
   *
   * @description
   * Identifies an opening across asynchronous creation responses.
   *
   * @type {number}
   */
  private openingId: number = 0;

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
   * Property taskDetail
   *
   * @description
   * Opens a created task's detail over the page; while a detail is open, `N` creates nothing.
   *
   * @type {TaskDetailOpener}
   * @readonly
   */
  private readonly taskDetail: TaskDetailOpener = inject(TaskDetailOpener);

  /**
   * Property shortcuts
   *
   * @description
   * App-wide keyboard shortcuts.
   *
   * @type {ShortcutsService}
   * @readonly
   */
  private readonly shortcuts: ShortcutsService = inject(ShortcutsService);

  /**
   * Property destroyRef
   *
   * @description
   * Lifetime of the dialog, which ends its shortcuts.
   *
   * @type {DestroyRef}
   * @readonly
   */
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /**
   * Property model
   *
   * @description
   * The fields of the dialog.
   *
   * @type {WritableSignal<TaskCreateModel>}
   * @readonly
   */
  protected readonly model: WritableSignal<TaskCreateModel> = signal<TaskCreateModel>(
    this.blank({}),
  );

  /**
   * Property serverIssues
   *
   * @description
   * The fields a refused creation (422) named, each with the value it had then. A field's error
   * goes for good once its value changes, even if it comes back to the refused value, and all go
   * when another destination list is picked; each opening starts without any, which submission errors of Signal Forms could not offer (they survive a
   * reset).
   *
   * @type {WritableSignal<Readonly<Partial<Record<ServerIssueField, unknown>>>>}
   * @readonly
   */
  private readonly serverIssues: WritableSignal<
    Readonly<Partial<Record<ServerIssueField, unknown>>>
  > = signal({});

  /**
   * Property createForm
   *
   * @description
   * The dialog's form: the name is required.
   *
   * @type {FieldTree<TaskCreateModel>}
   * @readonly
   */
  protected readonly createForm: FieldTree<TaskCreateModel> = form(this.model, (path) => {
    required(path.name, {
      message: $localize`:@@task.create.name-required:Enter a name for the task.`,
    });
    validate(path.name, (context: FieldContext<string>) =>
      this.serverIssue('name', context.value()),
    );
    validate(path.description, (context: FieldContext<string>) =>
      this.serverIssue('description', context.value()),
    );
    validate(path.due, (context: FieldContext<Date | null>) =>
      this.serverIssue('due', context.value()),
    );
    validate(path.assigneeIds, (context: FieldContext<readonly string[]>) =>
      this.serverIssue('assigneeIds', context.value()),
    );
    validate(path.labels, (context: FieldContext<readonly string[]>) =>
      this.serverIssue('labels', context.value()),
    );
    validate(path.status, (context: FieldContext<StatusKey>) =>
      this.serverIssue('status', context.value()),
    );
    validate(path, (context: FieldContext<TaskCreateModel>) =>
      this.serverIssue('form', context.value()),
    );
  });

  /**
   * Property more
   *
   * @description
   * `Create more tasks`: the dialog stays open after a creation.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly more: WritableSignal<boolean> = signal(false);

  /**
   * Property cancelAsk
   *
   * @description
   * Keys the cancel reason dialog names while `Cancelled` waits for its reason, or null.
   *
   * @type {WritableSignal<readonly string[] | null>}
   * @readonly
   */
  protected readonly cancelAsk: WritableSignal<readonly string[] | null> = signal<
    readonly string[] | null
  >(null);

  /**
   * Property parentKey
   *
   * @description
   * Parent of the new task when it is a subtask, or null.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  protected readonly parentKey: Signal<string | null> = computed(
    (): string | null => this.taskCreate.options().parentKey ?? null,
  );

  /**
   * Property template
   *
   * @description
   * The template the dialog was filled from, or null.
   *
   * @type {Signal<TaskTemplateOption | null>}
   * @readonly
   */
  protected readonly template: Signal<TaskTemplateOption | null> = computed(
    (): TaskTemplateOption | null =>
      this.store
        .templates()
        .find((option: TaskTemplateOption) => option.id === this.model().templateId) ?? null,
  );

  /**
   * Property statusFrom
   *
   * @description
   * The status the picker's icon animates from: the previous status of the draft.
   *
   * @type {Signal<StatusKey | null>}
   * @readonly
   */
  protected readonly statusFrom: Signal<StatusKey | null> = linkedSignal<
    StatusKey,
    StatusKey | null
  >({
    source: (): StatusKey => this.model().status,
    computation: (_: StatusKey, previous?: { source: StatusKey }): StatusKey | null =>
      previous?.source ?? null,
  });

  /**
   * Property dueFormat
   *
   * @description
   * The due date as the trigger shows it: `Mon, Nov 9`.
   *
   * @type {Intl.DateTimeFormatOptions}
   * @readonly
   */
  protected readonly dueFormat: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  };

  /**
   * Property presets
   *
   * @description
   * Due date shortcuts: `Today`, `Tomorrow`, `Friday`, `End of the sprint` for a
   * sprint list, `No due date`.
   *
   * @type {Signal<readonly CwDatePreset[]>}
   * @readonly
   */
  protected readonly presets: Signal<readonly CwDatePreset[]> = computed(
    (): readonly CwDatePreset[] => {
      const today: Date = addDays(new Date(), 0);
      const untilFriday: number = (5 - today.getDay() + 7) % 7 || 7;
      const sprintEnd: string | null = this.store.destination()?.sprintEnd ?? null;
      return [
        { label: $localize`:@@task.create.due-today:Today`, date: today },
        { label: $localize`:@@task.create.due-tomorrow:Tomorrow`, date: addDays(today, 1) },
        { label: $localize`:@@task.create.due-friday:Friday`, date: addDays(today, untilFriday) },
        ...(sprintEnd
          ? [
              {
                label: $localize`:@@task.create.due-sprint:End of the sprint`,
                date: toDate(sprintEnd),
              },
            ]
          : []),
        { label: $localize`:@@task.create.due-none:No due date`, date: null },
      ];
    },
  );

  /**
   * Property unregisterSubmit
   *
   * @description
   * Ends the Ctrl Enter shortcut, bound only while the dialog is open.
   *
   * @type {(() => void) | null}
   */
  private unregisterSubmit: (() => void) | null = null;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds `N` to the dialog outside fields until the shell is destroyed (not while a task detail
   * is open, as in the mockup), and starts each opening
   * from the presets: reads the data the first time, empties the fields and binds Ctrl Enter.
   *
   * @constructor
   */
  public constructor() {
    this.store.reset(this.organizationId);
    this.shortcuts.register(
      {
        keys: 'n',
        handler: (): void => {
          if (!this.taskDetail.isOpen()) this.taskCreate.open();
        },
      },
      this.destroyRef,
    );
    let destination: string | null = null;
    effect(() => {
      const listId: string | null = this.store.destination()?.listId ?? null;
      if (listId === destination) return;
      destination = listId;
      untracked((): void => {
        if (Object.keys(this.serverIssues()).length > 0) this.serverIssues.set({});
      });
    });
    effect(() => {
      const issues: Readonly<Partial<Record<ServerIssueField, unknown>>> = this.serverIssues();
      const model: TaskCreateModel = this.model();
      const kept: [string, unknown][] = Object.entries(issues).filter(
        ([field, value]: [string, unknown]): boolean =>
          (field === 'form' ? model : model[field as Exclude<ServerIssueField, 'form'>]) === value,
      );
      if (kept.length !== Object.keys(issues).length) {
        untracked((): void => {
          this.serverIssues.set(Object.fromEntries(kept));
        });
      }
    });
    effect(() => {
      const open: boolean = this.taskCreate.isOpen();
      const organizationId: string = this.workspace.organization().id;
      untracked(() => {
        if (organizationId !== this.organizationId) {
          this.organizationId = organizationId;
          this.openingId++;
          this.taskCreate.close();
          this.store.reset(organizationId);
          this.model.set(this.blank({}));
          return;
        }
        if (open) this.start(this.taskCreate.options());
        else this.stop();
      });
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method patch
   *
   * @description
   * Changes some fields.
   *
   * @param {Partial<TaskCreateModel>} changes - New values.
   */
  protected patch(changes: Partial<TaskCreateModel>): void {
    this.model.update((model: TaskCreateModel) => ({ ...model, ...changes }));
  }

  /**
   * Method destinationLabel
   *
   * @description
   * `Product › Sprint 14`.
   *
   * @param {ListDestination} destination - A destination.
   * @returns {string} Its label.
   */
  protected destinationLabel(destination: ListDestination): string {
    return `${destination.spaceName} › ${destination.listName}`;
  }

  /**
   * Method pickStatus
   *
   * @description
   * Takes a status; `Cancelled` asks its reason first.
   *
   * @param {StatusKey} status - Chosen status.
   */
  protected pickStatus(status: StatusKey): void {
    if (status === 'cancelled') {
      this.cancelAsk.set([this.store.nextKey() ?? '']);
      return;
    }
    this.patch({ status, cancellation: null });
  }

  /**
   * Method confirmCancel
   *
   * @description
   * Takes `cancelled` with its reason.
   *
   * @param {TaskCancellation} cancellation - Reason and note.
   */
  protected confirmCancel(cancellation: TaskCancellation): void {
    this.cancelAsk.set(null);
    this.patch({ status: 'cancelled', cancellation });
  }

  /**
   * Method pickDue
   *
   * @description
   * Takes the date picker's value as the due date.
   *
   * @param {CwDatePickerValue} value - Chosen date, or null.
   */
  protected pickDue(value: CwDatePickerValue): void {
    this.patch({ due: value instanceof Date ? value : null });
  }

  /**
   * Method pickTemplate
   *
   * @description
   * Fills the dialog from a template: its name when the name is still empty, its description,
   * priority, labels, subtasks and checklist.
   *
   * @param {TaskTemplateOption} template - Chosen template.
   */
  protected pickTemplate(template: TaskTemplateOption): void {
    this.model.update((model: TaskCreateModel): TaskCreateModel => ({
      ...model,
      name: model.name.trim() === '' ? template.title : model.name,
      description: template.description,
      priority: template.priority,
      labels: [...template.labels],
      subtasks: [...template.subtasks],
      checklist: [...template.checklist],
      templateId: template.id,
    }));
  }

  /**
   * Method addSubtask
   *
   * @description
   * Enter in `Add a subtask`: drafts the typed subtask.
   *
   * @param {Event} event - The keydown event.
   */
  protected addSubtask(event: Event): void {
    if (event instanceof KeyboardEvent && (event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    const name: string = this.model().subtaskDraft.trim();
    if (name === '') return;
    this.model.update((model: TaskCreateModel) => ({
      ...model,
      subtasks: [...model.subtasks, name],
      subtaskDraft: '',
    }));
  }

  /**
   * Method typeSubtask
   *
   * @description
   * Keeps the typed subtask.
   *
   * @param {Event} event - Input event of the field.
   */
  protected typeSubtask(event: Event): void {
    if (event.target instanceof HTMLInputElement) this.patch({ subtaskDraft: event.target.value });
  }

  /**
   * Method removeSubtask
   *
   * @description
   * Removes a drafted subtask.
   *
   * @param {number} index - Its position.
   */
  protected removeSubtask(index: number): void {
    this.model.update((model: TaskCreateModel) => ({
      ...model,
      subtasks: model.subtasks.filter((_name: string, position: number) => position !== index),
    }));
  }

  /**
   * Method removeLabel
   *
   * @description
   * Accessible name of a subtask's remove button (`Remove the subtask Mockup`).
   *
   * @param {string} subtask - Name of the subtask.
   * @returns {string} The name of the button.
   */
  protected removeLabel(subtask: string): string {
    return $localize`:@@task.create.subtask-remove:Remove the subtask ${subtask}:name:`;
  }

  /**
   * Method templateHint
   *
   * @description
   * What a template drafts, under its name: `3 subtasks · 4 items · Bug, Front`.
   *
   * @param {TaskTemplateOption} template - The template.
   * @returns {string} The hint, empty when it drafts nothing.
   */
  protected templateHint(template: TaskTemplateOption): string {
    const subtasks: number = template.subtasks.length;
    const checks: number = template.checklist.length;
    return [
      subtasks === 0
        ? ''
        : subtasks === 1
          ? $localize`:@@task.create.template-subtask:${subtasks}:count: subtask`
          : $localize`:@@task.create.template-subtasks:${subtasks}:count: subtasks`,
      checks === 0
        ? ''
        : checks === 1
          ? $localize`:@@task.create.template-check:${checks}:count: item`
          : $localize`:@@task.create.template-checks:${checks}:count: items`,
      template.labels.join(', '),
    ]
      .filter((part: string): boolean => part !== '')
      .join(' · ');
  }

  /**
   * Method openChange
   *
   * @description
   * Reports a close by Escape, the backdrop or the close button.
   *
   * @param {boolean} open - Whether the dialog stays open.
   */
  protected openChange(open: boolean): void {
    if (!open && !this.store.creating()) this.taskCreate.close();
  }

  /**
   * Method serverIssue
   *
   * @description
   * The refused creation's error of a field while it keeps the value that was refused.
   *
   * @param {ServerIssueField} field - The field, or the whole form.
   * @param {unknown} value - Its current value.
   * @returns {ValidationError.WithoutFieldTree | undefined} `Check this information.`, or
   * nothing.
   */
  private serverIssue(
    field: ServerIssueField,
    value: unknown,
  ): ValidationError.WithoutFieldTree | undefined {
    const issues: Readonly<Partial<Record<ServerIssueField, unknown>>> = this.serverIssues();
    return field in issues && issues[field] === value
      ? {
          kind: 'server',
          message: $localize`:@@task.create.field-invalid:Check this information.`,
        }
      : undefined;
  }

  /**
   * Method create
   *
   * @description
   * `Create the task` and Ctrl Enter: an invalid form focuses the name; a valid one is created,
   * announced and confirmed by a toast with `Open`, then the dialog closes or, with `Create
   * more tasks`, empties the name, the description and the subtasks. A refusal keeps every
   * field and shows the failure toast.
   *
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async create(): Promise<void> {
    if (this.store.creating() || this.cancelAsk() !== null) return;
    await submit(this.createForm, {
      action: async (): Promise<ValidationError.WithOptionalFieldTree[] | undefined> => {
        const model: TaskCreateModel = this.model();
        const destination: ListDestination | null = this.store.destination();
        const openingId: number = this.openingId;
        try {
          const created: CreatedTask = await this.store.create(this.draft(model), this.parentKey());
          if (openingId !== this.openingId || !this.taskCreate.isOpen()) return undefined;
          this.taskCreate.announce(created);
          this.confirm(created, destination);
          this.serverIssues.set({});
          if (this.more()) {
            this.patch({
              name: '',
              description: '',
              subtasks: [],
              subtaskDraft: '',
            });
            this.createForm().reset();
            this.createForm.name().focusBoundControl();
          } else {
            this.taskCreate.close();
          }
        } catch (error: unknown) {
          if (openingId !== this.openingId || !this.taskCreate.isOpen()) return undefined;
          const problem: ApiProblem | null = readProblem(error);
          const issues: unknown = problem?.details?.['issues'];
          if (
            problem?.status === 422 &&
            !hasProblemCode(error, 'task.status-hidden') &&
            Array.isArray(issues) &&
            issues.length
          ) {
            // An issue belongs to the value that was sent: a field edited, or a destination
            // changed, while the request ran is not marked with it. When nothing refused is left
            // to point at, the toast says the creation was refused.
            const now: TaskCreateModel = this.model();
            const sameDestination: boolean =
              (this.store.destination()?.listId ?? null) === (destination?.listId ?? null);
            const refused: Partial<Record<ServerIssueField, unknown>> = {};
            for (const issue of issues as unknown[]) {
              const path: unknown =
                typeof issue === 'object' && issue !== null && 'path' in issue ? issue.path : null;
              const root: string = typeof path === 'string' ? path.split('.')[0].split('[')[0] : '';
              const field: ServerIssueField = SERVER_ISSUE_FIELDS[root] ?? 'form';
              const sent: unknown = field === 'form' ? model : model[field];
              const current: unknown = field === 'form' ? now : now[field];
              if (sameDestination && sent === current) refused[field] = sent;
            }
            if (Object.keys(refused).length > 0) {
              this.serverIssues.set(refused);
              return undefined;
            }
          }
          const description: string =
            problem?.status === 403 && hasProblemCode(error, 'access.role-insufficient')
              ? $localize`:@@task.create.role-insufficient:You cannot create tasks in this list.`
              : problem?.status === 422 && hasProblemCode(error, 'task.status-hidden')
                ? $localize`:@@task.create.status-hidden:This status is no longer available. Choose another.`
                : !problem || problem.status === 0 || problem.status >= 500
                  ? $localize`:@@task.create.failed-text:The server did not answer. Try again in a moment.`
                  : $localize`:@@task.create.refused:The task could not be created. Check its details and try again.`;
          this.toasts.error($localize`:@@task.create.failed:Could not create the task`, {
            description,
          });
        }
        return undefined;
      },
      onInvalid: (): void => {
        this.createForm.name().focusBoundControl();
      },
    });
  }

  /**
   * Method draft
   *
   * @description
   * The submitted content of the fields.
   *
   * @param {TaskCreateModel} model - The fields.
   * @returns {TaskDraft} The draft.
   */
  private draft(model: TaskCreateModel): TaskDraft {
    const cancelled: boolean = model.status === 'cancelled' && model.cancellation !== null;
    const reason: CancelReason | null = cancelled ? (model.cancellation?.reason ?? null) : null;
    return {
      name: model.name.trim(),
      description: model.description.trim(),
      status: model.status,
      cancelReason: reason,
      cancelNote: cancelled ? (model.cancellation?.note ?? '') : '',
      priority: model.priority,
      assigneeIds: [...model.assigneeIds],
      due: model.due ? toIso(model.due) : null,
      labels: [...model.labels],
      subtasks: this.parentKey() === null ? [...model.subtasks] : [],
      checklist: [...model.checklist],
    };
  }

  /**
   * Method confirm
   *
   * @description
   * `Task CAD-495 created`, `Sprint 14 · To do · 2 subtasks.`, with `Open`.
   *
   * @param {CreatedTask} created - The created task.
   * @param {ListDestination | null} destination - Its list.
   */
  private confirm(created: CreatedTask, destination: ListDestination | null): void {
    const status: string = statusLabel(created.status, this.store.statuses(), false);
    const parts: string[] = [destination?.listName ?? '', status];
    if (created.subtasks === 1) parts.push($localize`:@@task.create.subtask-one:1 subtask`);
    if (created.subtasks > 1) {
      parts.push($localize`:@@task.create.subtask-many:${created.subtasks}:count: subtasks`);
    }
    this.toasts.show($localize`:@@task.create.created:Task ${created.key}:key: created`, {
      description: `${parts.filter(Boolean).join(' · ')}.`,
      duration: 6000,
      action: {
        label: $localize`:@@task.create.open:Open`,
        run: (): void => {
          void this.taskDetail.open(created.key);
        },
      },
    });
  }

  /**
   * Method blank
   *
   * @description
   * The fields of a new opening: empty, the current user assigned, `Medium`, then the presets
   * (status, due date, priority and assignees).
   *
   * @param {TaskCreateOptions} options - Presets of the opening.
   * @returns {TaskCreateModel} The fields.
   */
  private blank(options: TaskCreateOptions): TaskCreateModel {
    return {
      name: '',
      description: '',
      subtaskDraft: '',
      subtasks: [],
      checklist: [],
      status: options.status && options.status !== 'cancelled' ? options.status : 'todo',
      cancellation: null,
      assigneeIds: options.assigneeIds ? [...options.assigneeIds] : [this.workspace.user().id],
      due: options.due ? toDate(options.due) : null,
      priority: options.priority ?? 'moyenne',
      labels: [],
      templateId: null,
    };
  }

  /**
   * Method start
   *
   * @description
   * Begins an opening: reads the data, resets the fields and binds Ctrl Enter.
   *
   * @param {TaskCreateOptions} options - Presets of the opening.
   */
  private start(options: TaskCreateOptions): void {
    this.openingId++;
    this.store.activate(options.listId ?? null);
    this.model.set(this.blank(options));
    this.serverIssues.set({});
    this.createForm().reset();
    this.cancelAsk.set(null);
    this.unregisterSubmit?.();
    this.unregisterSubmit = this.shortcuts.register(
      {
        keys: 'mod+enter',
        allowInEditable: true,
        handler: (): void => {
          void this.create();
        },
      },
      this.destroyRef,
    );
  }

  /**
   * Method stop
   *
   * @description
   * Ends an opening: Ctrl Enter is unbound.
   */
  private stop(): void {
    this.openingId++;
    this.unregisterSubmit?.();
    this.unregisterSubmit = null;
    this.cancelAsk.set(null);
  }
  // #endregion
}
