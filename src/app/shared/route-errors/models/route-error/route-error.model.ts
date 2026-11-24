/**
 * Class RouteError
 *
 * @description
 * Base class for route boundary failures.
 */
export abstract class RouteError extends Error {
  // #region Properties
  /**
   * Property kind
   *
   * @description
   * Discriminator for the route boundary.
   *
   * @type {string}
   * @readonly
   */
  public abstract readonly kind: string;
  // #endregion
}

/**
 * Class NotFoundRouteError
 *
 * @description
 * A page throws this when its requested route resource cannot be found.
 */
export class NotFoundRouteError extends RouteError {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * Stable error name for diagnostics.
   * @type {string}
   * @readonly
   */
  public override readonly name: string = 'NotFoundRouteError';

  /**
   * Property kind
   *
   * @description
   * Identifies this failure.
   *
   * @type {'not-found'}
   * @readonly
   */
  public readonly kind: 'not-found' = 'not-found';
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Creates a missing resource failure.
   * @constructor
   */
  public constructor() {
    super('The requested resource was not found.');
  }
  // #endregion
}

/**
 * Class AccessDeniedRouteError
 *
 * @description
 * A page throws this with the inaccessible space or list needed by the error view.
 */
export class AccessDeniedRouteError extends RouteError {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * Stable error name for diagnostics.
   * @type {string}
   * @readonly
   */
  public override readonly name: string = 'AccessDeniedRouteError';

  /**
   * Property kind
   *
   * @description
   * Identifies this failure.
   *
   * @type {'access-denied'}
   * @readonly
   */
  public readonly kind: 'access-denied' = 'access-denied';

  /**
   * Property resource
   *
   * @description
   * Inaccessible space or list and its owner, when known.
   *
   * @type {{ kind: 'space' | 'list'; id: string; name: string | null; ownerName: string | null }}
   * @readonly
   */
  public readonly resource: {
    kind: 'space' | 'list';
    id: string;
    name: string | null;
    ownerName: string | null;
  };
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Stores the inaccessible resource for the error view.
   *
   * @constructor
   * @param {{ kind: 'space' | 'list'; id: string; name: string | null; ownerName: string | null }} resource - Inaccessible resource details.
   */
  public constructor(resource: {
    kind: 'space' | 'list';
    id: string;
    name: string | null;
    ownerName: string | null;
  }) {
    super('Access to the requested resource was denied.');
    this.resource = resource;
  }
  // #endregion
}

/**
 * Class DeletedTaskRouteError
 *
 * @description
 * A task page throws this with the deleted task and trash entry needed for restoration.
 */
export class DeletedTaskRouteError extends RouteError {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * Stable error name for diagnostics.
   * @type {string}
   * @readonly
   */
  public override readonly name: string = 'DeletedTaskRouteError';

  /**
   * Property kind
   *
   * @description
   * Identifies this failure.
   *
   * @type {'deleted-task'}
   * @readonly
   */
  public readonly kind: 'deleted-task' = 'deleted-task';

  /**
   * Property task
   *
   * @description
   * Deleted task key and display name.
   *
   * @type {{ key: string; name: string }}
   * @readonly
   */
  public readonly task: { key: string; name: string };

  /**
   * Property trashEntryId
   *
   * @description
   * Trash entry identifier used to restore the task.
   *
   * @type {string}
   * @readonly
   */
  public readonly trashEntryId: string;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Stores the deleted task and its trash entry.
   *
   * @constructor
   * @param {{ key: string; name: string }} task - Deleted task details.
   * @param {string} trashEntryId - Identifier of the trash entry.
   */
  public constructor(task: { key: string; name: string }, trashEntryId: string) {
    super('The requested task has been deleted.');
    this.task = task;
    this.trashEntryId = trashEntryId;
  }
  // #endregion
}

/**
 * Class UnavailableRouteError
 *
 * @description
 * A page throws this with response diagnostics when its resource cannot be loaded.
 */
export class UnavailableRouteError extends RouteError {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * Stable error name for diagnostics.
   * @type {string}
   * @readonly
   */
  public override readonly name: string = 'UnavailableRouteError';

  /**
   * Property kind
   *
   * @description
   * Identifies this failure.
   *
   * @type {'unavailable'}
   * @readonly
   */
  public readonly kind: 'unavailable' = 'unavailable';

  /**
   * Property status
   *
   * @description
   * HTTP response status, or zero for a network failure.
   *
   * @type {number}
   * @readonly
   */
  public readonly status: number;

  /**
   * Property requestId
   *
   * @description
   * Response request identifier, when available.
   *
   * @type {string | null}
   * @readonly
   */
  public readonly requestId: string | null;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Stores response diagnostics for the error view.
   *
   * @constructor
   * @param {number} status - HTTP response status.
   * @param {string | null} requestId - Response request identifier, if available.
   */
  public constructor(status: number, requestId: string | null) {
    super('The requested resource is unavailable.');
    this.status = status;
    this.requestId = requestId;
  }
  // #endregion
}

/**
 * Type KnownRouteError
 *
 * @description
 * Route failures handled by the shared error boundary.
 * @type {NotFoundRouteError | AccessDeniedRouteError | DeletedTaskRouteError | UnavailableRouteError}
 */
export type KnownRouteError =
  NotFoundRouteError | AccessDeniedRouteError | DeletedTaskRouteError | UnavailableRouteError;

/**
 * Function isRouteError
 *
 * @description
 * Identifies a failure understood by the route boundary.
 * @param {unknown} error - Value to inspect.
 * @returns {boolean} Whether the value is a route error.
 */
export function isRouteError(error: unknown): error is KnownRouteError {
  return (
    error instanceof NotFoundRouteError ||
    error instanceof AccessDeniedRouteError ||
    error instanceof DeletedTaskRouteError ||
    error instanceof UnavailableRouteError
  );
}
