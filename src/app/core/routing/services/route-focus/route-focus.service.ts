import { DOCUMENT } from '@angular/common';
import { afterNextRender, DestroyRef, inject, Injector, Service } from '@angular/core';
import { NavigationEnd, Router, type UrlTree } from '@angular/router';
import type { Subscription } from 'rxjs';

/**
 * Service RouteFocusService
 *
 * @description
 * Moves focus after navigation to a different path; while a modal window holds the focus, the
 * move waits for the modal windows to close.
 */
@Service()
export class RouteFocusService {
  // #region Properties
  /**
   * Property document
   *
   * @description
   * Document containing the route target.
   *
   * @type {Document}
   * @readonly
   */
  private readonly document: Document = inject(DOCUMENT);

  /**
   * Property router
   *
   * @description
   * Router that emits navigation events.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property injector
   *
   * @description
   * Injection context used for render scheduling.
   *
   * @type {Injector}
   * @readonly
   */
  private readonly injector: Injector = inject(Injector);

  /**
   * Property destroyRef
   *
   * @description
   * Service lifetime.
   *
   * @type {DestroyRef}
   * @readonly
   */
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /**
   * Property previousPath
   *
   * @description
   * Path of the previous successful navigation.
   *
   * @type {string | null}
   */
  private previousPath: string | null = null;

  /**
   * Property deferred
   *
   * @description
   * Watches the document while a route focus move waits for the modal windows to close; `null`
   * when none waits.
   *
   * @type {MutationObserver | null}
   */
  private deferred: MutationObserver | null = null;

  /**
   * Property queued
   *
   * @description
   * Clears the focus move queued once the last modal window closed; `null` when none is queued.
   *
   * @type {(() => void) | null}
   */
  private queued: (() => void) | null = null;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Subscribes to successful navigation until destruction.
   *
   * @constructor
   */
  public constructor() {
    const subscription: Subscription = this.router.events.subscribe((event) => {
      if (!(event instanceof NavigationEnd)) return;
      const tree: UrlTree = this.router.parseUrl(event.urlAfterRedirects);
      tree.queryParams = {};
      tree.fragment = null;
      const path: string = this.router.serializeUrl(tree);
      const changed: boolean = this.previousPath !== null && this.previousPath !== path;
      this.previousPath = path;
      if (changed)
        afterNextRender(
          () => {
            this.focus();
          },
          { injector: this.injector },
        );
    });
    this.destroyRef.onDestroy(() => {
      subscription.unsubscribe();
      this.stopWaiting();
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method focus
   *
   * @description
   * Focuses the innermost route target, or main, without scrolling. While a modal window holds the
   * focus (an `aria-modal` dialog kept open across the navigation, such as the onboarding
   * assistant, or one still playing its exit animation, such as the command palette), the move
   * waits until no modal window is left in the document, then runs after the window's own focus
   * restoration: the route target is behind the window until then.
   */
  private focus(): void {
    this.stopWaiting();
    if (this.document.activeElement?.closest('[aria-modal="true"]')) {
      this.waitForModals();
      return;
    }
    const targets: NodeListOf<HTMLElement> = this.document.querySelectorAll('[data-route-focus]');
    const element: HTMLElement | null =
      Array.from(targets).at(-1) ?? this.document.querySelector('main');
    if (!element) return;
    if (element.tabIndex < 0 && !element.hasAttribute('tabindex'))
      element.setAttribute('tabindex', '-1');
    element.focus({ preventScroll: true });
  }

  /**
   * Method waitForModals
   *
   * @description
   * Watches the document until no `aria-modal` window is left, then moves the focus to the route
   * target on the next task, after the closed window restored the focus to its origin. A later
   * navigation, or the service's destruction, stops the wait.
   */
  private waitForModals(): void {
    const view: (Window & typeof globalThis) | null = this.document.defaultView;
    if (view === null) return;
    const observer: MutationObserver = new view.MutationObserver((): void => {
      if (this.document.querySelector('[aria-modal="true"]') !== null) return;
      this.stopWaiting();
      const timer: number = view.setTimeout((): void => {
        this.queued = null;
        this.focus();
      });
      this.queued = (): void => {
        view.clearTimeout(timer);
      };
    });
    observer.observe(this.document.body, { childList: true, subtree: true });
    this.deferred = observer;
  }

  /**
   * Method stopWaiting
   *
   * @description
   * Stops a route focus move waiting for the modal windows to close, or already queued after they
   * closed.
   */
  private stopWaiting(): void {
    this.deferred?.disconnect();
    this.deferred = null;
    this.queued?.();
    this.queued = null;
  }
  // #endregion
}
