import { Component, computed, inject, input, type InputSignal, type Signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { type ApiProblem, readProblem } from '@core/api';
import { RuntimeConfigStore } from '@core/config';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';
import {
  type AccessDeniedRouteError,
  type DeletedTaskRouteError,
  isRouteError,
  type KnownRouteError,
  UnavailableRouteError,
} from '@shared/route-errors';

import type { RouteErrorData } from '../../../models/route-error-data/route-error-data.interface';
import { ErrorRecoveryStore } from '../../../state/error-recovery/error-recovery.store';
import { RouteErrorState } from '../route-error-state/route-error-state.component';

/**
 * Type RouteErrorKind
 *
 * @description
 * State the page renders: one per typed route error, `unavailable` also for any other failure.
 *
 * @type {KnownRouteError['kind']}
 */
type RouteErrorKind = KnownRouteError['kind'];

/**
 * Function findRouteError
 *
 * @description
 * Finds the typed route error a failure carries. The router's boundary receives what the page
 * threw: a resource read in its error state throws an error whose `cause` is what the loader
 * rejected with, so the `cause` chain is followed.
 *
 * @param {unknown} error - Failure caught by the boundary, or given by route `data`.
 * @returns {KnownRouteError | null} The typed error, or null for any other failure.
 */
function findRouteError(error: unknown): KnownRouteError | null {
  let current: unknown = error;
  for (let depth: number = 0; depth < 5 && current !== undefined; depth++) {
    if (isRouteError(current)) return current;
    current = current instanceof Error ? current.cause : undefined;
  }
  return null;
}

/**
 * Function findProblem
 *
 * @description
 * Finds the HTTP problem of a failure that is not a typed route error, through its `cause` chain.
 *
 * @param {unknown} error - Failure caught by the boundary.
 * @returns {ApiProblem | null} The problem, or null when no HTTP response is involved.
 */
function findProblem(error: unknown): ApiProblem | null {
  let current: unknown = error;
  for (let depth: number = 0; depth < 5 && current !== undefined; depth++) {
    const problem: ApiProblem | null = readProblem(current);
    if (problem) return problem;
    current = current instanceof Error ? current.cause : undefined;
  }
  return null;
}

/**
 * Component RouteErrorBoundary
 *
 * @description
 * The router's `errorComponent` (mockup `App.dc.html` lines 487-500 and 1499-1522, `ERR_PAGES`).
 * The boundary renders it in place of a page that failed, in the same outlet, so the shell and
 * the page header stay; it receives the failure through its `error` input and renders:
 * - not found: `Page not found` with a link back to `/home`;
 * - access denied: an optional message to the owner and `Request access`, which becomes
 *   `Request sent`;
 * - deleted task: `Restore the task`, which runs the route again once restored, and `Open the
 *   trash` inside a workspace;
 * - unavailable, and any failure that is not a typed route error: `Could not load this page`, the
 *   status and request reference, and `Retry`, which runs the route again with a
 *   same-URL reload navigation (the router re-creates an outlet whose error component is active);
 *   the failing route's `unavailableTitle` (`RouteErrorData`) replaces the title, and `Service
 *   status` links to the configured `statusUrl`, only when there is one.
 *
 * The page derives the state and sends the writes through its own `ErrorRecoveryStore`, so each
 * failure starts over. `RouteErrorState` renders it in an `@defer (on immediate)` block: this
 * component is the router's default error component, part of the initial bundle, so the bricks,
 * the Signal Forms runtime and the icons load in their own chunk. While that chunk loads, a status
 * line says the page is loading; when it cannot load (offline), a plain fallback says the page
 * could not be loaded and offers `Retry`, which runs the route again.
 */
@Component({
  selector: 'cw-route-error-boundary',
  imports: [RouteErrorState],
  providers: [ErrorRecoveryStore],
  host: {
    class: 'flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-10 sm:px-6',
  },
  templateUrl: './route-error-boundary.component.html',
})
export class RouteErrorBoundary {
  // #region Properties
  /**
   * Property error
   *
   * @description
   * Failure to render, set by the router's error boundary or by the route `data` of the 404.
   *
   * @type {InputSignal<unknown>}
   * @readonly
   */
  public readonly error: InputSignal<unknown> = input<unknown>();

  /**
   * Property store
   *
   * @description
   * Progress of the access request and the restore.
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
   * State to render.
   *
   * @type {Signal<RouteErrorKind>}
   * @readonly
   */
  protected readonly kind: Signal<RouteErrorKind> = computed(
    (): RouteErrorKind => this.routeError()?.kind ?? 'unavailable',
  );

  /**
   * Property accessDenied
   *
   * @description
   * The access-denied error, when that is the state.
   *
   * @type {Signal<AccessDeniedRouteError | null>}
   * @readonly
   */
  protected readonly accessDenied: Signal<AccessDeniedRouteError | null> = computed(
    (): AccessDeniedRouteError | null => {
      const error: KnownRouteError | null = this.routeError();
      return error?.kind === 'access-denied' ? error : null;
    },
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
   * HTTP status of an unavailable read, or null when none is known (network failure, script
   * error).
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

  /**
   * Property unavailableTitle
   *
   * @description
   * Title the failing route gives its unavailable state (`RouteErrorData`), or null for the
   * generic one.
   *
   * @type {string | null}
   * @readonly
   */
  protected readonly unavailableTitle: string | null;

  /**
   * Property statusUrl
   *
   * @description
   * Configured status page, or null when the environment has none.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  protected readonly statusUrl: Signal<string | null>;

  /**
   * Property router
   *
   * @description
   * Router running the failed route again.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Reads the workspace, when the page renders inside one, for the trash link, the failing
   * route's error copy, and the configured status page.
   *
   * @constructor
   */
  public constructor() {
    const workspace: WorkspaceContextPort | null = inject(WORKSPACE_CONTEXT, { optional: true });
    this.trashLink = workspace ? ['/', workspace.organization().slug, 'trash'] : null;
    const data: RouteErrorData | undefined = inject(ActivatedRoute, { optional: true })?.snapshot
      .data;
    this.unavailableTitle =
      typeof data?.unavailableTitle === 'string' ? data.unavailableTitle : null;
    const config: InstanceType<typeof RuntimeConfigStore> = inject(RuntimeConfigStore);
    this.statusUrl = computed((): string | null => config.config().statusUrl ?? null);
  }
  // #endregion

  // #region Methods
  /**
   * Method retry
   *
   * @description
   * Runs the failed route again: a same-URL reload navigation makes the router re-create the page
   * the boundary replaced, and re-runs the guards and resolvers its `runGuardsAndResolvers`
   * allows.
   *
   * @returns {Promise<boolean>} Whether the navigation succeeded.
   */
  protected retry(): Promise<boolean> {
    return this.router.navigateByUrl(this.router.url, { onSameUrlNavigation: 'reload' });
  }

  /**
   * Method requestAccess
   *
   * @description
   * Sends the access request for the inaccessible resource with the person's message.
   *
   * @param {string} message - Message typed by the person.
   * @returns {Promise<void>} Resolves once the request settled.
   */
  protected async requestAccess(message: string): Promise<void> {
    const error: AccessDeniedRouteError | null = this.accessDenied();
    if (!error) return;
    await this.store.requestAccess({ kind: error.resource.kind, id: error.resource.id }, message);
  }

  /**
   * Method restore
   *
   * @description
   * Restores the deleted task, then runs the route again so the task page loads it.
   *
   * @returns {Promise<void>} Resolves once the restore settled.
   */
  protected async restore(): Promise<void> {
    const error: DeletedTaskRouteError | null = this.deletedTask();
    if (!error) return;
    if (await this.store.restoreTask(error.trashEntryId)) await this.retry();
  }
  // #endregion
}
