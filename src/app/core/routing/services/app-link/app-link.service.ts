import { DOCUMENT, LocationStrategy } from '@angular/common';
import { inject, Service } from '@angular/core';

/**
 * Service AppLinkService
 *
 * @description
 * Builds the absolute addresses the application gives a person to copy or share (a task, a list,
 * a document, a public form). Each locale is a separate build below its own segment (`/fr/`), the
 * document's base href, so an address is the router path prepared by the location strategy, which
 * puts that base in front, on the page origin: `/atelier-nord/t/CAD-482` becomes
 * `https://app.cadenway.example/fr/atelier-nord/t/CAD-482`. The segment is never written by hand.
 */
@Service()
export class AppLinkService {
  // #region Properties
  /**
   * Property document
   *
   * @description
   * Document whose location gives the origin.
   *
   * @type {Document}
   * @readonly
   */
  private readonly document: Document = inject(DOCUMENT);

  /**
   * Property locationStrategy
   *
   * @description
   * The router's location strategy, which knows the base href.
   *
   * @type {LocationStrategy}
   * @readonly
   */
  private readonly locationStrategy: LocationStrategy = inject(LocationStrategy);
  // #endregion

  // #region Methods
  /**
   * Method absolute
   *
   * @description
   * The absolute address of an application path, below the current locale segment.
   *
   * @param {string} path - A router path starting with `/` (`/atelier-nord/t/CAD-482`), its
   * segments already encoded.
   * @returns {string} The address (`https://app.cadenway.example/fr/atelier-nord/t/CAD-482`).
   */
  public absolute(path: string): string {
    return new URL(this.locationStrategy.prepareExternalUrl(path), this.document.location.origin)
      .href;
  }
  // #endregion
}
