import type { DestroyRef, Signal } from '@angular/core';

/**
 * Interface ShellSidebar
 *
 * @description
 * What a routed screen may do with the collapsible sidebar of the shell that hosts it. A screen
 * reaches it through `SHELL_SIDEBAR`, since only feature root routes may import a layout.
 */
export interface ShellSidebar {
  // #region Properties
  /**
   * Property expanded
   *
   * @description
   * Whether the sidebar shows its content.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly expanded: Signal<boolean>;

  /**
   * Property toggleClaimed
   *
   * @description
   * Whether a routed screen renders the expand toggle, in which case the shell hides its own.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly toggleClaimed: Signal<boolean>;
  // #endregion

  // #region Methods
  /**
   * Method toggle
   *
   * @description
   * Opens a collapsed sidebar and moves focus into it, or collapses an open one and returns focus
   * to the control that opened it.
   */
  toggle(): void;

  /**
   * Method claimToggle
   *
   * @description
   * Declares that the calling screen renders the expand toggle (in its breadcrumb row, for
   * example) until `destroyRef` is destroyed.
   *
   * @param {DestroyRef} destroyRef - Lifetime of the claim, usually the screen's own.
   */
  claimToggle(destroyRef: DestroyRef): void;
  // #endregion
}
