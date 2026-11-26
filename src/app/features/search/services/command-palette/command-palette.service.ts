import { computed, inject, Service, type Signal } from '@angular/core';
import { ShellOverlay } from '@shared/layout-slot';

/**
 * Constant PALETTE
 *
 * @description
 * Id of the command palette among the shell overlays.
 *
 * @type {string}
 */
const PALETTE: string = 'search.command-palette';

/**
 * Service CommandPalette
 *
 * @description
 * Whether the command palette is open, shared by the palette (an `overlays` contribution), the
 * rail's `Search` item and the sidebar's `Search…` button, which the shell renders as
 * separate components. It goes through `ShellOverlay`, so the palette never opens over another
 * shell overlay such as the keyboard shortcuts dialog. It holds no user or organization data.
 */
@Service()
export class CommandPalette {
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
   * Whether the palette is open.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  public readonly isOpen: Signal<boolean> = computed((): boolean => this.overlay.isOpen(PALETTE));
  // #endregion

  // #region Methods
  /**
   * Method setOpen
   *
   * @description
   * Opens the palette unless another shell overlay is open, or closes it; the palette also reports
   * its own closing here.
   *
   * @param {boolean} open - Whether the palette should be open.
   */
  public setOpen(open: boolean): void {
    if (open) this.overlay.open(PALETTE);
    else this.overlay.close(PALETTE);
  }
  // #endregion
}
