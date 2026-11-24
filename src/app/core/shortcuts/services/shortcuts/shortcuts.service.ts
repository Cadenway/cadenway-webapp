import { DOCUMENT } from '@angular/common';
import {
  DestroyRef,
  inject,
  Service,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';

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
   * Property singleKeyEnabled
   *
   * @description
   * In-memory preference for unmodified character shortcuts.
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  private readonly singleKeyEnabled: WritableSignal<boolean> = signal(true);

  /**
   * Property singleKeyShortcutsEnabled
   *
   * @description
   * Whether unmodified single-key shortcuts can run.
   * @type {Signal<boolean>}
   * @readonly
   */
  public readonly singleKeyShortcutsEnabled: Signal<boolean> = this.singleKeyEnabled.asReadonly();

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
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.repeat ||
      typeof event.key !== 'string'
    )
      return;
    const target: EventTarget | null = event.target;
    const editable: boolean =
      target instanceof HTMLElement &&
      (target.isContentEditable || target.closest('input, textarea, select') !== null);
    const binding: Shortcut | undefined = [...this.shortcuts]
      .reverse()
      .find(
        (shortcut: Shortcut) =>
          (!editable || shortcut.allowInEditable === true) &&
          (this.singleKeyEnabled() || shortcut.keys.includes('+') || shortcut.keys.length !== 1) &&
          this.matches(shortcut.keys, event),
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
   * @returns {() => void} Idempotent function that unregisters the binding.
   */
  public register(shortcut: Shortcut, destroyRef: DestroyRef): () => void {
    const registration: Shortcut = { ...shortcut };
    let active: boolean = true;
    const unregister: () => void = (): void => {
      if (!active) return;
      active = false;
      const index: number = this.shortcuts.indexOf(registration);
      if (index >= 0) this.shortcuts.splice(index, 1);
      if (this.shortcuts.length === 0) this.document.removeEventListener('keydown', this.handle);
    };
    if (destroyRef.destroyed) return unregister;
    const isActive: () => boolean = (): boolean => active && !destroyRef.destroyed;
    destroyRef.onDestroy(unregister);
    if (!isActive()) return unregister;
    if (this.shortcuts.length === 0) this.document.addEventListener('keydown', this.handle);
    this.shortcuts.push(registration);
    return unregister;
  }

  /**
   * Method setSingleKeyShortcutsEnabled
   *
   * @description
   * Enables or disables unmodified single-key shortcuts for this session.
   * @param {boolean} enabled - Whether these shortcuts may run.
   */
  public setSingleKeyShortcutsEnabled(enabled: boolean): void {
    this.singleKeyEnabled.set(enabled);
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
    const navigator: Navigator | undefined = this.document.defaultView?.navigator;
    const platform: string = navigator?.platform ?? '';
    const mac: boolean = /mac|iphone|ipad|ipod/i.test(platform);
    const altGraph: boolean = event.getModifierState('AltGraph');
    const mod: boolean = parts.includes('mod');
    const ctrl: boolean = altGraph && !mod ? false : event.ctrlKey;
    const alt: boolean = altGraph && !mod ? false : event.altKey;
    const keyMatches: boolean =
      key === event.key.toLowerCase() ||
      (key !== undefined && /^[a-z]$/.test(key) && event.code === `Key${key.toUpperCase()}`);
    const symbol: boolean = key?.length === 1 && !/^[a-z]$/i.test(key);
    return (
      keyMatches &&
      (mac ? event.metaKey === mod && !ctrl : ctrl === mod && !event.metaKey) &&
      alt === parts.includes('alt') &&
      ((symbol && !parts.includes('shift')) || event.shiftKey === parts.includes('shift'))
    );
  }
  // #endregion
}
