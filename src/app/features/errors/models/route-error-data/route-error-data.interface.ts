/**
 * Interface RouteErrorData
 *
 * @description
 * Route `data` a feature gives the error boundary of that route (`satisfies RouteErrorData`), so its
 * failed read says what could not be loaded; other routes keep the generic copy.
 */
export interface RouteErrorData {
  // #region Properties
  /**
   * Property unavailableTitle
   *
   * @description
   * Title of the unavailable state in place of `Could not load this page` (the list view
   * says `Could not load the tasks`), localized by the route file.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly unavailableTitle?: string;
  // #endregion
}
