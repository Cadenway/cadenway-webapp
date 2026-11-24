import { Service, signal, type Signal, type WritableSignal } from '@angular/core';

/**
 * Service CommandPalette
 *
 * @description
 * Whether the command palette is open, shared by the palette (an `overlays` contribution), the
 * rail's « Rechercher » item and the sidebar's « Rechercher… » button, which the shell renders as
 * separate components. It holds no user or organization data.
 */
@Service()
export class CommandPalette {
  // #region Properties
  /**
   * Property state
   *
   * @description
   * Whether the palette is open.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  private readonly state: WritableSignal<boolean> = signal(false);

  /**
   * Property isOpen
   *
   * @description
   * Whether the palette is open.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  public readonly isOpen: Signal<boolean> = this.state.asReadonly();
  // #endregion

  // #region Methods
  /**
   * Method setOpen
   *
   * @description
   * Opens or closes the palette; the palette also reports its own closing here.
   *
   * @param {boolean} open - Whether the palette is open.
   */
  public setOpen(open: boolean): void {
    this.state.set(open);
  }

  /**
   * Method toggle
   *
   * @description
   * Opens a closed palette or closes an open one, as Ctrl K does.
   */
  public toggle(): void {
    this.state.update((open: boolean) => !open);
  }
  // #endregion
}
