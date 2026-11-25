import { Service } from '@angular/core';

/**
 * Constant WORKSPACE_RECOVERY_NAVIGATION
 *
 * @description
 * Identifies recovery navigation without persisting its origin in browser history.
 *
 * @type {symbol}
 */
export const WORKSPACE_RECOVERY_NAVIGATION: symbol = Symbol('WORKSPACE_RECOVERY_NAVIGATION');

/**
 * Service WorkspaceRevalidation
 *
 * @description
 * Carries a one-shot request to rerun workspace guards on the next navigation.
 */
@Service({ autoProvided: false })
export class WorkspaceRevalidation {
  // #region Properties
  /**
   * Property requested
   *
   * @description
   * Whether the next route comparison should rerun guards and resolvers.
   *
   * @type {boolean}
   */
  private requested: boolean = false;
  // #endregion

  // #region Methods
  /**
   * Method request
   *
   * @description
   * Marks the current workspace for revalidation.
   */
  public request(): void {
    this.requested = true;
  }

  /**
   * Method consume
   *
   * @description
   * Takes and clears the pending revalidation request.
   *
   * @returns {boolean} Whether a request was pending.
   */
  public consume(): boolean {
    const requested: boolean = this.requested;
    this.requested = false;
    return requested;
  }
  // #endregion
}
