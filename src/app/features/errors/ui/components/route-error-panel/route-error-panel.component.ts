import {
  Component,
  computed,
  inject,
  input,
  type InputSignal,
  output,
  type OutputEmitterRef,
  type Signal,
} from '@angular/core';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';
import {
  type DeletedTaskRouteError,
  type KnownRouteError,
  UnavailableRouteError,
} from '@shared/route-errors';

import { ErrorRecoveryStore } from '../../../state/error-recovery/error-recovery.store';
import { findProblem, findRouteError } from '../../../utils/route-error/route-error.util';
import { RouteErrorState } from '../route-error-state/route-error-state.component';

/**
 * Component RouteErrorPanel
 *
 * @description
 * The typed route error states of `RouteErrorBoundary` for a resource read outside the router,
 * such as the task detail dialog over the current page: not found, deleted task (`Restore the
 * task`, `Open the trash`) and unavailable (`Retry`, with the status and request reference).
 * Instead of running a route again, it emits `retried` on `Retry` and `restored` once the deleted
 * task is back, so its owner reads the resource again. It sends no access request: its owner
 * never passes an access-denied error (a task the caller does not see answers not found). It
 * provides its own `ErrorRecoveryStore`, so each failure starts over.
 */
@Component({
  selector: 'cw-route-error-panel',
  imports: [RouteErrorState],
  providers: [ErrorRecoveryStore],
  host: { class: 'flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-8' },
  templateUrl: './route-error-panel.component.html',
})
export class RouteErrorPanel {
  // #region Properties
  /**
   * Property error
   *
   * @description
   * Failure to render: a typed route error, or any other failure (unavailable).
   *
   * @type {InputSignal<unknown>}
   * @readonly
   */
  public readonly error: InputSignal<unknown> = input<unknown>();

  /**
   * Property retried
   *
   * @description
   * Emitted when the person asks to read the resource again.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly retried: OutputEmitterRef<void> = output();

  /**
   * Property restored
   *
   * @description
   * Emitted once the deleted task is out of the trash.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly restored: OutputEmitterRef<void> = output();

  /**
   * Property store
   *
   * @description
   * Progress of the restore.
   *
   * @type {InstanceType<typeof ErrorRecoveryStore>}
   * @readonly
   */
  protected readonly store: InstanceType<typeof ErrorRecoveryStore> = inject(ErrorRecoveryStore);

  /**
   * Property routeError
   *
   * @description
   * Typed route error the failure carries, or null.
   *
   * @type {Signal<KnownRouteError | null>}
   * @readonly
   */
  protected readonly routeError: Signal<KnownRouteError | null> = computed(
    (): KnownRouteError | null => findRouteError(this.error()),
  );

  /**
   * Property kind
   *
   * @description
   * State to render; any failure that is not a typed route error is unavailable.
   *
   * @type {Signal<KnownRouteError['kind']>}
   * @readonly
   */
  protected readonly kind: Signal<KnownRouteError['kind']> = computed(
    (): KnownRouteError['kind'] => this.routeError()?.kind ?? 'unavailable',
  );

  /**
   * Property deletedTask
   *
   * @description
   * The deleted-task error, when that is the state.
   *
   * @type {Signal<DeletedTaskRouteError | null>}
   * @readonly
   */
  protected readonly deletedTask: Signal<DeletedTaskRouteError | null> = computed(
    (): DeletedTaskRouteError | null => {
      const error: KnownRouteError | null = this.routeError();
      return error?.kind === 'deleted-task' ? error : null;
    },
  );

  /**
   * Property status
   *
   * @description
   * HTTP status of an unavailable read, or null when none is known.
   *
   * @type {Signal<number | null>}
   * @readonly
   */
  protected readonly status: Signal<number | null> = computed((): number | null => {
    const error: KnownRouteError | null = this.routeError();
    const status: number =
      error instanceof UnavailableRouteError
        ? error.status
        : (findProblem(this.error())?.status ?? 0);
    return status > 0 ? status : null;
  });

  /**
   * Property requestId
   *
   * @description
   * Gateway request reference of an unavailable read, or null.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  protected readonly requestId: Signal<string | null> = computed((): string | null => {
    const error: KnownRouteError | null = this.routeError();
    return error instanceof UnavailableRouteError
      ? error.requestId
      : (findProblem(this.error())?.requestId ?? null);
  });

  /**
   * Property trashLink
   *
   * @description
   * Trash of the current workspace, or null outside a workspace.
   *
   * @type {readonly string[] | null}
   * @readonly
   */
  protected readonly trashLink: readonly string[] | null;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Reads the workspace, when the panel renders inside one, for the trash link.
   *
   * @constructor
   */
  public constructor() {
    const workspace: WorkspaceContextPort | null = inject(WORKSPACE_CONTEXT, { optional: true });
    this.trashLink = workspace ? ['/', workspace.organization().slug, 'trash'] : null;
  }
  // #endregion

  // #region Methods
  /**
   * Method restore
   *
   * @description
   * Restores the deleted task, then emits `restored`.
   *
   * @returns {Promise<void>} Resolves once the restore settled.
   */
  protected async restore(): Promise<void> {
    const error: DeletedTaskRouteError | null = this.deletedTask();
    if (!error) return;
    if (await this.store.restoreTask(error.trashEntryId)) this.restored.emit();
  }
  // #endregion
}
