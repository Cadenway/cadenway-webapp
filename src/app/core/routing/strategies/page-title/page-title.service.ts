import { inject, Service } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TitleStrategy, type RouterStateSnapshot } from '@angular/router';

/**
 * Service PageTitleStrategy
 *
 * @description
 * Adds the product name to the active route title.
 */
@Service()
export class PageTitleStrategy extends TitleStrategy {
  // #region Properties
  /**
   * Property title
   *
   * @description
   * Browser title service.
   *
   * @type {Title}
   * @readonly
   */
  private readonly title: Title = inject(Title);
  // #endregion

  // #region Methods
  /**
   * Method updateTitle
   *
   * @description
   * Updates the browser title for a completed navigation.
   * @param {RouterStateSnapshot} snapshot - Active router state.
   */
  public override updateTitle(snapshot: RouterStateSnapshot): void {
    const title: string | undefined = this.buildTitle(snapshot);
    this.title.setTitle(title ? `${title} — Cadenway` : 'Cadenway');
  }
  // #endregion
}
