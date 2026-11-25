import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  type Signal,
  signal,
  untracked,
  type WritableSignal,
} from '@angular/core';
import {
  type FieldTree,
  form,
  FormField,
  required,
  submit,
  type ValidationError,
} from '@angular/forms/signals';
import { Router } from '@angular/router';
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
import { CwTextarea } from '@cadenway/ui/components/textarea';
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
import { TaskCreateStore } from '../../../state/task-create/task-create.store';
import { statusLabel } from '../../../utils/task-status/task-status.util';
import { TaskLabelPicker } from '../../components/task-label-picker/task-label-picker.component';
import { TaskPeoplePicker } from '../../components/task-people-picker/task-people-picker.component';
import { TaskPriorityPicker } from '../../components/task-priority-picker/task-priority-picker.component';
import { TaskStatusPicker } from '../../components/task-status-picker/task-status-picker.component';
import { TaskCancelDialog } from '../task-cancel-dialog/task-cancel-dialog.component';

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
   * Text of the « Ajouter une sous-tâche » field.
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
   * Priority; « Moyenne » by default.
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
 * fields and `TaskCreate.open` opens it from any screen with presets. The header picks the
 * destination list (« dans » Produit › Sprint 14, with « Réessayer » when the lists cannot be
 * read), shows the next key and offers the space's saved templates. The body holds the required
 * name, a plain description (the block editor comes in step 5) and the subtask drafts (Entrée
 * adds one). The properties are the status split button (« Annulé » asks its reason first), the
 * assignees (the current user by default), the due date, the priority (« Moyenne ») and the
 * labels. « Créer la tâche » or Ctrl Entrée creates the task with an `Idempotency-Key`, then a
 * toast offers « Ouvrir » towards `/<slug>/t/<key>`; « Créer d'autres tâches » keeps the dialog
 * open with an empty name. Escape closes an open menu first, then the dialog. It provides its own
 * `TaskCreateStore`.
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
    CwTextarea,
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
      placeholder: $localize`:@@task.create.due:Due date`,
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
   * Label of the « Réessayer » button of a failed read.
   *
   * @type {string}
   * @readonly
   */
  protected readonly retryLabel: string = $localize`:@@task.retry:Retry`;

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
   * Workspace whose person is the default assignee and whose slug the « Ouvrir » address uses.
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
   * Property router
   *
   * @description
   * Router opening a created task.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

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
  });

  /**
   * Property more
   *
   * @description
   * « Créer d'autres tâches »: the dialog stays open after a creation.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly more: WritableSignal<boolean> = signal(false);

  /**
   * Property cancelAsk
   *
   * @description
   * Keys the cancel reason dialog names while « Annulé » waits for its reason, or null.
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
   * Property presets
   *
   * @description
   * Due date shortcuts: « Aujourd’hui », « Demain », « Vendredi », « Fin du sprint » for a
   * sprint list, « Sans échéance ».
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
   * Ends the Ctrl Entrée shortcut, bound only while the dialog is open.
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
   * Binds `N` to the dialog outside fields until the shell is destroyed, and starts each opening
   * from the presets: reads the data the first time, empties the fields and binds Ctrl Entrée.
   *
   * @constructor
   */
  public constructor() {
    this.store.reset(this.organizationId);
    this.shortcuts.register(
      {
        keys: 'n',
        handler: (): void => {
          this.taskCreate.open();
        },
      },
      this.destroyRef,
    );
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
   * « Produit › Sprint 14 ».
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
   * Takes a status; « Annulé » asks its reason first.
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
   * Entrée in « Ajouter une sous-tâche »: drafts the typed subtask.
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
   * Accessible name of a subtask's remove button (« Retirer la sous-tâche Maquette »).
   *
   * @param {string} subtask - Name of the subtask.
   * @returns {string} The name of the button.
   */
  protected removeLabel(subtask: string): string {
    return $localize`:@@task.create.subtask-remove:Remove the subtask ${subtask}:name:`;
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
   * Method create
   *
   * @description
   * « Créer la tâche » and Ctrl Entrée: an invalid form focuses the name; a valid one is created,
   * announced and confirmed by a toast with « Ouvrir », then the dialog closes or, with « Créer
   * d'autres tâches », empties the name, the description and the subtasks. A refusal keeps every
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
          if (this.more()) {
            this.patch({
              name: '',
              description: '',
              subtasks: [],
              subtaskDraft: '',
            });
            this.createForm.name().reset();
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
            const errors: ValidationError.WithOptionalFieldTree[] = [];
            const fields: Readonly<Record<string, FieldTree<unknown>>> = {
              name: this.createForm.name,
              title: this.createForm.name,
              description: this.createForm.description,
              dueDate: this.createForm.due,
              assigneeIds: this.createForm.assigneeIds,
              labels: this.createForm.labels,
              status: this.createForm.status,
            };
            for (const issue of issues as unknown[]) {
              const path: unknown =
                typeof issue === 'object' && issue !== null && 'path' in issue ? issue.path : null;
              const root: string = typeof path === 'string' ? path.split('.')[0].split('[')[0] : '';
              errors.push({
                kind: 'server',
                fieldTree: fields[root] ?? this.createForm,
                message: $localize`:@@task.create.field-invalid:Check this information.`,
              });
            }
            return errors;
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
   * « Tâche CAD-495 créée », « Sprint 14 · À faire · 2 sous-tâches. », with « Ouvrir ».
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
    const slug: string = this.workspace.organization().slug;
    this.toasts.show($localize`:@@task.create.created:Task ${created.key}:key: created`, {
      description: `${parts.filter(Boolean).join(' · ')}.`,
      duration: 6000,
      action: {
        label: $localize`:@@task.create.open:Open`,
        run: (): void => {
          void this.router.navigate(['/', slug, 't', created.key]);
        },
      },
    });
  }

  /**
   * Method blank
   *
   * @description
   * The fields of a new opening: empty, the current user assigned, « Moyenne », then the presets.
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
      assigneeIds: [this.workspace.user().id],
      due: options.due ? toDate(options.due) : null,
      priority: 'moyenne',
      labels: [],
      templateId: null,
    };
  }

  /**
   * Method start
   *
   * @description
   * Begins an opening: reads the data, resets the fields and binds Ctrl Entrée.
   *
   * @param {TaskCreateOptions} options - Presets of the opening.
   */
  private start(options: TaskCreateOptions): void {
    this.openingId++;
    this.store.activate(options.listId ?? null);
    this.model.set(this.blank(options));
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
   * Ends an opening: Ctrl Entrée is unbound.
   */
  private stop(): void {
    this.openingId++;
    this.unregisterSubmit?.();
    this.unregisterSubmit = null;
    this.cancelAsk.set(null);
  }
  // #endregion
}
