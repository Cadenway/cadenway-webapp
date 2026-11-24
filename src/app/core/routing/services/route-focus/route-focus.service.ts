import { DOCUMENT } from '@angular/common';
import { afterNextRender, DestroyRef, inject, Injector, Service } from '@angular/core';
import { NavigationEnd, Router, type UrlTree } from '@angular/router';
import type { Subscription } from 'rxjs';

/**
 * Service RouteFocusService
 *
 * @description
 * Moves focus after navigation to a different path.
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
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method focus
   *
   * @description
   * Focuses the first route target without scrolling.
   */
  private focus(): void {
    const element: HTMLElement | null = this.document.querySelector('[data-route-focus]');
    if (!element) return;
    if (element.tabIndex < 0 && !element.hasAttribute('tabindex'))
      element.setAttribute('tabindex', '-1');
    element.focus({ preventScroll: true });
  }
  // #endregion
}
