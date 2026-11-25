import {
  computed,
  type DestroyRef,
  inject,
  Service,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { type Observable, Subject } from 'rxjs';

import { ShellOverlay } from '@shared/layout-slot';

import type {
  CreatedTask,
  TaskCreateOptions,
} from '../../models/task-create/task-create.interface';

/**
 * Constant TASK_CREATE_DIALOG
 *
 * @description
 * Id of the task create dialog among the shell overlays.
 *
 * @type {string}
 */
export const TASK_CREATE_DIALOG: string = 'task.create-dialog';

/**
 * Service TaskCreate
 *
 * @description
 * Opens the task create dialog, an `overlays` contribution of the shell bound with
 * `withTaskCreate()`, from any screen of the workspace: « Créer une tâche », the « + » of a group
 * or a day, a subtask's parent. It goes through `ShellOverlay`, so the dialog never opens over the
 * command palette or the shortcuts dialog, and it announces each created task on `created` so lists
 * can refresh. It holds no user or organization data.
 */
@Service()
export class TaskCreate {
  // #region Properties
  /**
   * Property overlay
   *
   * @description
   * The shell's one-overlay-at-a-time coordinator.
   *
   * @type {ShellOverlay}
   * @readonly
   */
  private readonly overlay: ShellOverlay = inject(ShellOverlay);

  /**
   * Property presets
   *
   * @description
   * What the last `open` preset.
   *
   * @type {WritableSignal<TaskCreateOptions>}
   * @readonly
   */
  private readonly presets: WritableSignal<TaskCreateOptions> = signal<TaskCreateOptions>({});

  /**
   * Property creations
   *
   * @description
   * Tasks created through the dialog.
   *
   * @type {Subject<CreatedTask>}
   * @readonly
   */
  private readonly creations: Subject<CreatedTask> = new Subject<CreatedTask>();

  /**
   * Property defaults
   *
   * @description
   * Presets of an opening without options (the `N` shortcut), given by the screen that shows a
   * list; null when no screen gives any.
   *
   * @type {WritableSignal<(() => TaskCreateOptions) | null>}
   * @readonly
   */
  private readonly defaults: WritableSignal<(() => TaskCreateOptions) | null> = signal<
    (() => TaskCreateOptions) | null
  >(null);

  /**
   * Property isOpen
   *
   * @description
   * Whether the dialog is open.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  public readonly isOpen: Signal<boolean> = computed((): boolean =>
    this.overlay.isOpen(TASK_CREATE_DIALOG),
  );

  /**
   * Property options
   *
   * @description
   * What the dialog starts from: destination list, status, due date, parent.
   *
   * @type {Signal<TaskCreateOptions>}
   * @readonly
   */
  public readonly options: Signal<TaskCreateOptions> = this.presets.asReadonly();

  /**
   * Property created
   *
   * @description
   * Emits each task the dialog created, after the gateway confirmed it.
   *
   * @type {Observable<CreatedTask>}
   * @readonly
   */
  public readonly created: Observable<CreatedTask> = this.creations.asObservable();
  // #endregion

  // #region Methods
  /**
   * Method open
   *
   * @description
   * Opens the dialog with presets, unless another shell overlay is open. Without options it starts
   * from the defaults of the screen that gave some (`useDefaults`), else from nothing.
   *
   * @param {TaskCreateOptions} [options] - Destination list, status, due date or parent key.
   * @returns {boolean} Whether the dialog opened.
   */
  public open(
    options?: TaskCreateOptions & ({ parentKey: string; listId: string } | { parentKey?: never }),
  ): boolean {
    if (this.overlay.anyOpen()) return false;
    this.presets.set(options ?? this.defaults()?.() ?? {});
    return this.overlay.open(TASK_CREATE_DIALOG);
  }

  /**
   * Method useDefaults
   *
   * @description
   * Gives the presets of an opening without options while a screen lives: the list view makes
   * `N` create in its list. The last screen to call wins; its destruction removes its defaults.
   *
   * @param {() => TaskCreateOptions} defaults - Presets read at each opening.
   * @param {DestroyRef} destroyRef - Lifetime of the screen.
   */
  public useDefaults(defaults: () => TaskCreateOptions, destroyRef: DestroyRef): void {
    this.defaults.set(defaults);
    destroyRef.onDestroy((): void => {
      if (this.defaults() === defaults) this.defaults.set(null);
    });
  }

  /**
   * Method close
   *
   * @description
   * Closes the dialog.
   */
  public close(): void {
    this.overlay.close(TASK_CREATE_DIALOG);
    this.presets.set({});
  }

  /**
   * Method announce
   *
   * @description
   * Reports a created task to the `created` listeners; called by the dialog.
   *
   * @param {CreatedTask} task - The created task.
   */
  public announce(task: CreatedTask): void {
    this.creations.next(task);
  }
  // #endregion
}
