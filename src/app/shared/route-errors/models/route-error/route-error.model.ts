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
 * Describes a route failure for the boundary.
 */
export class NotFoundRouteError extends RouteError {
  // #region Properties
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
}

/**
 * Class AccessDeniedRouteError
 *
 * @description
 * Describes a route failure for the boundary.
 */
export class AccessDeniedRouteError extends RouteError {
  // #region Properties
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
   * Context needed by the route boundary.
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
   * Stores the context for the boundary.
   *
   * @constructor
   * @param {{ kind: 'space' | 'list'; id: string; name: string | null; ownerName: string | null }} resource - Context for the failure.
   */
  public constructor(resource: {
    kind: 'space' | 'list';
    id: string;
    name: string | null;
    ownerName: string | null;
  }) {
    super('access-denied');
    this.resource = resource;
  }
  // #endregion
}

/**
 * Class DeletedTaskRouteError
 *
 * @description
 * Describes a route failure for the boundary.
 */
export class DeletedTaskRouteError extends RouteError {
  // #region Properties
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
   * Context needed by the route boundary.
   *
   * @type {{ key: string; name: string }}
   * @readonly
   */
  public readonly task: { key: string; name: string };

  /**
   * Property trashEntryId
   *
   * @description
   * Context needed by the route boundary.
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
   * Stores the context for the boundary.
   *
   * @constructor
   * @param {{ key: string; name: string }} task - Context for the failure.
   * @param {string} trashEntryId - Context for the failure.
   */
  public constructor(task: { key: string; name: string }, trashEntryId: string) {
    super('deleted-task');
    this.task = task;
    this.trashEntryId = trashEntryId;
  }
  // #endregion
}

/**
 * Class UnavailableRouteError
 *
 * @description
 * Describes a route failure for the boundary.
 */
export class UnavailableRouteError extends RouteError {
  // #region Properties
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
   * Context needed by the route boundary.
   *
   * @type {number}
   * @readonly
   */
  public readonly status: number;

  /**
   * Property requestId
   *
   * @description
   * Context needed by the route boundary.
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
   * Stores the context for the boundary.
   *
   * @constructor
   * @param {number} status - Context for the failure.
   * @param {string | null} requestId - Context for the failure.
   */
  public constructor(status: number, requestId: string | null) {
    super('unavailable');
    this.status = status;
    this.requestId = requestId;
  }
  // #endregion
}

/**
 * Function isRouteError
 *
 * @description
 * Identifies a failure understood by the route boundary.
 * @param {unknown} error - Value to inspect.
 * @returns {boolean} Whether the value is a route error.
 */
export function isRouteError(error: unknown): error is RouteError {
  return error instanceof RouteError;
}
