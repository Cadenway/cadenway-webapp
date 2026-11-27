import { Component, computed, inject, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { type Event as RouterEvent, NavigationEnd, Router } from '@angular/router';
import { CwAppRailGroup, CwAppRailItem } from '@cadenway/ui/components/app-rail';
import { filter, map, startWith, tap } from 'rxjs';

import type { SpaceDetails } from '../../../models/space/space.interface';
import { SpacesNavigationStore } from '../../../state/spaces-navigation/spaces-navigation.store';
import { injectOrganizationSlug } from '../../../utils/workspace-route/workspace-route.util';

/**
 * Constant SPACES_PATH
 *
 * @description
 * Addresses of the spaces screens below a slug: a space overview or a list.
 *
 * @type {RegExp}
 */
const SPACES_PATH: RegExp = /^\/[^/?#]+\/(?:spaces|l)\//u;

/**
 * Component SpacesRailItem
 *
 * @description
 * The `Spaces` item of the rail (`railDefs` of `App.dc.html`). It shows the spaces screen: the
 * last list or space overview shown in this tab, or the first space; it shows the filled squares
 * and is current while a space overview or a list is shown. It behaves the same in both shells;
 * the favorite spaces that follow the applications are `FavoriteSpacesRail`. Its host is
 * `display: contents`, so its group joins the rail's layout.
 */
@Component({
  selector: 'cw-spaces-rail-item',
  imports: [CwAppRailGroup, CwAppRailItem],
  host: { class: 'contents' },
  template: `
    <cw-app-rail-group>
      <button
        type="button"
        cwAppRailItem
        icon="phosphorSquaresFourBold"
        activeIcon="phosphorSquaresFourFill"
        [current]="onSpaces()"
        data-testid="spaces-rail-item"
        (click)="openSpaces()"
        i18n="@@spaces.rail.label"
      >
        Spaces
      </button>
    </cw-app-rail-group>
  `,
})
export class SpacesRailItem {
  // #region Properties
  /**
   * Property navigation
   *
   * @description
   * The workspace's spaces navigation.
   *
   * @type {InstanceType<typeof SpacesNavigationStore>}
   * @readonly
   */
  private readonly navigation: InstanceType<typeof SpacesNavigationStore> =
    inject(SpacesNavigationStore);

  /**
   * Property router
   *
   * @description
   * Router whose address tells the spaces screen shown.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property slug
   *
   * @description
   * Organization slug of the route.
   *
   * @type {Signal<string>}
   * @readonly
   */
  private readonly slug: Signal<string> = injectOrganizationSlug();

  /**
   * Property url
   *
   * @description
   * The address shown, after redirects; the navigation remembers a spaces address as it is
   * shown.
   *
   * @type {Signal<string>}
   * @readonly
   */
  private readonly url: Signal<string> = toSignal(
    this.router.events.pipe(
      filter((event: RouterEvent): event is NavigationEnd => event instanceof NavigationEnd),
      map((event: NavigationEnd): string => event.urlAfterRedirects),
      startWith(this.router.url),
      tap((url: string): void => {
        if (SPACES_PATH.test(url)) this.navigation.rememberSpacesUrl(url);
      }),
    ),
    { initialValue: this.router.url },
  );

  /**
   * Property onSpaces
   *
   * @description
   * Whether a space overview or a list is shown.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly onSpaces: Signal<boolean> = computed((): boolean =>
    SPACES_PATH.test(this.url()),
  );
  // #endregion

  // #region Methods
  /**
   * Method openSpaces
   *
   * @description
   * Shows the spaces screen: the last list or overview shown, else the first space. Nothing
   * happens while a spaces screen is shown or before any space is known.
   */
  protected openSpaces(): void {
    if (this.onSpaces()) return;
    const last: string | null = this.navigation.lastSpacesUrl();
    if (last?.startsWith(`/${this.slug()}/`)) {
      void this.router.navigateByUrl(last);
      return;
    }
    const first: SpaceDetails | undefined = this.navigation.spaces.hasValue()
      ? this.navigation.spaces.value()[0]
      : undefined;
    if (first) this.openOverview(first);
  }

  /**
   * Method openOverview
   *
   * @description
   * Shows a space's overview with its lists open in the sidebar.
   *
   * @param {SpaceDetails} space - The space.
   */
  private openOverview(space: SpaceDetails): void {
    this.navigation.setExpanded(space.id, true);
    void this.router.navigate(['/', this.slug(), 'spaces', space.id]);
  }
  // #endregion
}
