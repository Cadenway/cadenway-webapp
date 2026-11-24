import { Service, signal, type Signal, type WritableSignal } from '@angular/core';

/**
 * Service ShortcutsHelp
 *
 * @description
 * Whether the keyboard shortcuts dialog is open, shared by the dialog (an `overlays`
 * contribution) and the « Raccourcis clavier » button of the sidebar footer, which the shell
 * renders as separate components. It holds no user or organization data.
 */
@Service()
export class ShortcutsHelp {
  // #region Properties
  /**
   * Property state
   *
   * @description
   * Whether the dialog is open.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  private readonly state: WritableSignal<boolean> = signal(false);

  /**
   * Property isOpen
   *
   * @description
   * Whether the dialog is open.
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
   * Opens or closes the dialog; the dialog also reports its own closing (Escape, backdrop,
   * « Fermer ») here.
   *
   * @param {boolean} open - Whether the dialog is open.
   */
  public setOpen(open: boolean): void {
    this.state.set(open);
  }
  // #endregion
}
