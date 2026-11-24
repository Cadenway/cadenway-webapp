import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Service } from '@angular/core';

import type { Shortcut } from '../../models/shortcut/shortcut.interface';

/**
 * Service ShortcutsService
 *
 * @description
 * Dispatches document keyboard events to registered bindings.
 */
@Service()
export class ShortcutsService {
  // #region Properties
  /**
   * Property document
   *
   * @description
   * Document receiving keyboard events.
   *
   * @type {Document}
   * @readonly
   */
  private readonly document: Document = inject(DOCUMENT);

  /**
   * Property shortcuts
   *
   * @description
   * Bindings in registration order.
   *
   * @type {Shortcut[]}
   * @readonly
   */
  private readonly shortcuts: Shortcut[] = [];

  /**
   * Property handle
   *
   * @description
   * Dispatches the latest eligible matching binding.
   *
   * @type {(event: KeyboardEvent) => void}
   * @readonly
   */
  private readonly handle: (event: KeyboardEvent) => void = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.isComposing) return;
    const target: EventTarget | null = event.target;
    const editable: boolean =
      target instanceof Element &&
      target.closest('input, textarea, select, [contenteditable]') !== null;
    const binding: Shortcut | undefined = [...this.shortcuts]
      .reverse()
      .find(
        (shortcut: Shortcut) =>
          (!editable || shortcut.allowInEditable === true) && this.matches(shortcut.keys, event),
      );
    if (binding) {
      event.preventDefault();
      binding.handler(event);
    }
  };
  // #endregion

  // #region Methods
  /**
   * Method register
   *
   * @description
   * Registers a binding until the supplied scope is destroyed.
   * @param {Shortcut} shortcut - Binding to register.
   * @param {DestroyRef} destroyRef - Lifetime of the binding.
   */
  public register(shortcut: Shortcut, destroyRef: DestroyRef): void {
    if (this.shortcuts.length === 0) this.document.addEventListener('keydown', this.handle);
    const registration: Shortcut = { ...shortcut };
    this.shortcuts.push(registration);
    destroyRef.onDestroy(() => {
      const index: number = this.shortcuts.indexOf(registration);
      if (index >= 0) this.shortcuts.splice(index, 1);
      if (this.shortcuts.length === 0) this.document.removeEventListener('keydown', this.handle);
    });
  }

  /**
   * Method matches
   *
   * @description
   * Requires the exact modifiers for a key combination.
   * @param {string} keys - Registered combination.
   * @param {KeyboardEvent} event - Event to compare.
   * @returns {boolean} Whether the event matches.
   */
  private matches(keys: string, event: KeyboardEvent): boolean {
    const parts: string[] = keys.split('+');
    const key: string | undefined = parts.pop();
    return (
      key === event.key.toLowerCase() &&
      (parts.includes('mod') ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey) &&
      event.altKey === parts.includes('alt') &&
      (key === '?' || event.shiftKey === parts.includes('shift'))
    );
  }
  // #endregion
}
