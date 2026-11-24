import { computed, Service, signal, type Signal, type WritableSignal } from '@angular/core';

/**
 * Service ShellOverlay
 *
 * @description
 * Keeps at most one shell overlay contribution open at a time (the command palette, the keyboard
 * shortcuts dialog), so a shortcut never opens one over the other. Each overlay names itself with a
 * stable id; opening is refused while another overlay is open. It holds no user or organization
 * data.
 */
@Service()
export class ShellOverlay {
  // #region Properties
  /**
   * Property current
   *
   * @description
   * Id of the open overlay, or null.
   *
   * @type {WritableSignal<string | null>}
   * @readonly
   */
  private readonly current: WritableSignal<string | null> = signal<string | null>(null);

  /**
   * Property openId
   *
   * @description
   * Id of the open overlay, or null when none is open.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  public readonly openId: Signal<string | null> = this.current.asReadonly();

  /**
   * Property anyOpen
   *
   * @description
   * Whether an overlay is open.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  public readonly anyOpen: Signal<boolean> = computed((): boolean => this.current() !== null);
  // #endregion

  // #region Methods
  /**
   * Method isOpen
   *
   * @description
   * Whether the given overlay is the open one. Reactive.
   *
   * @param {string} id - Overlay id.
   * @returns {boolean} Whether it is open.
   */
  public isOpen(id: string): boolean {
    return this.current() === id;
  }

  /**
   * Method open
   *
   * @description
   * Opens an overlay unless another one is open.
   *
   * @param {string} id - Overlay id.
   * @returns {boolean} Whether the overlay is now open.
   */
  public open(id: string): boolean {
    const open: string | null = this.current();
    if (open !== null && open !== id) return false;
    this.current.set(id);
    return true;
  }

  /**
   * Method close
   *
   * @description
   * Closes an overlay if it is the open one; closing another id does nothing.
   *
   * @param {string} id - Overlay id.
   */
  public close(id: string): void {
    if (this.current() === id) this.current.set(null);
  }
  // #endregion
}
