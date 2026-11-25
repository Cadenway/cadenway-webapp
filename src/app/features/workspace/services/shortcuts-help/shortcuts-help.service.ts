import { computed, inject, Service, type Signal } from '@angular/core';
import { ShellOverlay } from '@shared/layout-slot';

/**
 * Constant SHORTCUTS
 *
 * @description
 * Id of the keyboard shortcuts dialog among the shell overlays.
 *
 * @type {string}
 */
const SHORTCUTS: string = 'workspace.shortcuts-dialog';

/**
 * Service ShortcutsHelp
 *
 * @description
 * Whether the keyboard shortcuts dialog is open, shared by the dialog (an `overlays`
 * contribution) and the `Keyboard shortcuts` button of the sidebar footer, which the shell
 * renders as separate components. It goes through `ShellOverlay`, so the dialog never opens over
 * another shell overlay such as the command palette. It holds no user or organization data.
 */
@Service()
export class ShortcutsHelp {
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
   * Property isOpen
   *
   * @description
   * Whether the dialog is open.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  public readonly isOpen: Signal<boolean> = computed((): boolean => this.overlay.isOpen(SHORTCUTS));
  // #endregion

  // #region Methods
  /**
   * Method setOpen
   *
   * @description
   * Opens the dialog unless another shell overlay is open, or closes it; the dialog also reports
   * its own closing (Escape, backdrop, `Close`) here.
   *
   * @param {boolean} open - Whether the dialog should be open.
   */
  public setOpen(open: boolean): void {
    if (open) this.overlay.open(SHORTCUTS);
    else this.overlay.close(SHORTCUTS);
  }
  // #endregion
}
