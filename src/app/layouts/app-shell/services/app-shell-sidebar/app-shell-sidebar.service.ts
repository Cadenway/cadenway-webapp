import {
  computed,
  type DestroyRef,
  DOCUMENT,
  inject,
  Service,
  type Signal,
  signal,
  type WritableSignal,
} from '@angular/core';
import type { CwSidebarState } from '@cadenway/ui/components/sidebar';
import type { ShellSidebar } from '@shared/layout-slot';

/**
 * Service AppShellSidebar
 *
 * @description
 * State of the space sidebar of `AppShell`, provided by the shell component and reached by its
 * routed screens through `SHELL_SIDEBAR`. It mirrors the `cw-sidebar` state in both directions,
 * remembers the control that opened the sidebar so the shell can return focus to it, and counts the
 * screens that render the expand toggle themselves.
 */
@Service({ autoProvided: false })
export class AppShellSidebar implements ShellSidebar {
  // #region Properties
  /**
   * Property state
   *
   * @description
   * Current `cw-sidebar` state; it starts expanded and `cw-sidebar` collapses it on a phone.
   *
   * @type {Signal<CwSidebarState>}
   * @readonly
   */
  public readonly state: Signal<CwSidebarState>;

  /**
   * Property expanded
   *
   * @description
   * Whether the sidebar shows its content.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  public readonly expanded: Signal<boolean>;

  /**
   * Property toggleClaimed
   *
   * @description
   * Whether at least one routed screen renders the expand toggle.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  public readonly toggleClaimed: Signal<boolean>;

  /**
   * Property stateValue
   *
   * @description
   * Writable source of `state`.
   *
   * @type {WritableSignal<CwSidebarState>}
   * @readonly
   */
  private readonly stateValue: WritableSignal<CwSidebarState> = signal<CwSidebarState>('expanded');

  /**
   * Property claims
   *
   * @description
   * Number of live toggle claims.
   *
   * @type {WritableSignal<number>}
   * @readonly
   */
  private readonly claims: WritableSignal<number> = signal(0);

  /**
   * Property document
   *
   * @description
   * Document whose focused element is remembered as the opener.
   *
   * @type {Document}
   * @readonly
   */
  private readonly document: Document = inject(DOCUMENT);

  /**
   * Property opener
   *
   * @description
   * Element focused when `toggle()` last opened the sidebar, or null.
   *
   * @type {HTMLElement | null}
   */
  private opener: HTMLElement | null = null;

  /**
   * Property focusRequested
   *
   * @description
   * Whether the last opening came from `toggle()` and still waits for focus to move into the
   * sidebar.
   *
   * @type {boolean}
   */
  private focusRequested: boolean = false;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Derives the public read-only signals.
   *
   * @constructor
   */
  public constructor() {
    this.state = this.stateValue.asReadonly();
    this.expanded = computed((): boolean => this.stateValue() === 'expanded');
    this.toggleClaimed = computed((): boolean => this.claims() > 0);
  }
  // #endregion

  // #region Methods
  /**
   * Method toggle
   *
   * @description
   * Opens a collapsed sidebar, remembering the focused control and asking the shell to move focus
   * into the sidebar, or collapses an open one; the shell then returns focus to the opener.
   */
  public toggle(): void {
    if (this.expanded()) {
      this.stateValue.set('collapsed');
      return;
    }
    const active: Element | null = this.document.activeElement;
    this.opener = active instanceof HTMLElement && active !== this.document.body ? active : null;
    this.focusRequested = true;
    this.stateValue.set('expanded');
  }

  /**
   * Method claimToggle
   *
   * @description
   * Hides the shell's own expand toggle while the calling screen lives.
   *
   * @param {DestroyRef} destroyRef - Lifetime of the claim.
   */
  public claimToggle(destroyRef: DestroyRef): void {
    this.claims.update((count: number): number => count + 1);
    destroyRef.onDestroy((): void => {
      this.claims.update((count: number): number => count - 1);
    });
  }

  /**
   * Method sync
   *
   * @description
   * Records a state change made by `cw-sidebar` itself (Escape, backdrop, Ctrl B, phone drawer).
   *
   * @param {CwSidebarState} state - New state emitted by `cw-sidebar`.
   */
  public sync(state: CwSidebarState): void {
    if (state === 'collapsed') this.focusRequested = false;
    this.stateValue.set(state);
  }

  /**
   * Method takeFocusRequest
   *
   * @description
   * Consumes the pending request to move focus into the sidebar after `toggle()` opened it.
   *
   * @returns {boolean} True once per opening made by `toggle()`.
   */
  public takeFocusRequest(): boolean {
    const requested: boolean = this.focusRequested;
    this.focusRequested = false;
    return requested;
  }

  /**
   * Method returnTarget
   *
   * @description
   * The control that opened the sidebar, when it is still in the document.
   *
   * @returns {HTMLElement | null} The opener, or null.
   */
  public returnTarget(): HTMLElement | null {
    return this.opener?.isConnected ? this.opener : null;
  }
  // #endregion
}
