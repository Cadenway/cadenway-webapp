import { Component, computed, inject, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { type Event as RouterEvent, NavigationEnd, Router } from '@angular/router';
import {
  CwAppRailGroup,
  CwAppRailItem,
  CwAppRailSeparator,
} from '@cadenway/ui/components/app-rail';
import { CwContextMenuTriggerFor } from '@cadenway/ui/components/context-menu';
import { CwMenu, CwMenuItem, CwMenuSeparator } from '@cadenway/ui/components/menu';
import { CwToastService } from '@cadenway/ui/components/toast';
import { NgIcon } from '@ng-icons/core';
import { filter, map, startWith, tap } from 'rxjs';

import type { Favorite } from '../../../models/favorite/favorite.interface';
import type { SpaceDetails } from '../../../models/space/space.interface';
import { SpacesNavigationStore } from '../../../state/spaces-navigation/spaces-navigation.store';
import { lookIconName, lookTone } from '../../../utils/look/look.util';
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
 * Constant SPACE_PATH
 *
 * @description
 * Reads the space id of a space overview address below a slug.
 *
 * @type {RegExp}
 */
const SPACE_PATH: RegExp = /^\/[^/?#]+\/spaces\/([^/?#]+)/u;

/**
 * Interface RailSpaceView
 *
 * @description
 * A favorite space of the rail with its mark.
 */
interface RailSpaceView {
  // #region Properties
  /**
   * Property space
   *
   * @description
   * The space.
   *
   * @type {SpaceDetails}
   * @readonly
   */
  readonly space: SpaceDetails;

  /**
   * Property icon
   *
   * @description
   * Fill glyph of its icon, or null for its initial.
   *
   * @type {string | null}
   * @readonly
   */
  readonly icon: string | null;

  /**
   * Property tone
   *
   * @description
   * Text color of its mark.
   *
   * @type {string}
   * @readonly
   */
  readonly tone: string;
  // #endregion
}

/**
 * Component SpacesRailItem
 *
 * @description
 * The `Spaces` item of the rail (`railDefs` of `App.dc.html`) and the favorite spaces after it
 * (`railSpaces`, lines 43-52). `Spaces` shows the spaces screen: the last list or space
 * overview shown in this tab, or the first space; it shows the filled squares and is current
 * while a space overview or a list is shown. After a separator, each favorite space has a
 * desktop-only button with its icon in its color (or its initial), named and labelled by the
 * space, current while its overview is shown, which opens the overview; its context menu is the
 * space menu, whose dialogs the sidebar hosts. Its host is `display: contents`, so its groups
 * join the rail's layout.
 */
@Component({
  selector: 'cw-spaces-rail-item',
  imports: [
    CwAppRailGroup,
    CwAppRailItem,
    CwAppRailSeparator,
    CwContextMenuTriggerFor,
    CwMenu,
    CwMenuItem,
    CwMenuSeparator,
    NgIcon,
  ],
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
    @if (favoriteSpaces().length > 0) {
      <cw-app-rail-group desktopOnly data-testid="rail-spaces">
        <cw-app-rail-separator />
        @for (view of favoriteSpaces(); track view.space.id) {
          <button
            type="button"
            cwAppRailItem
            desktopOnly
            [current]="shownSpaceId() === view.space.id"
            [cwContextMenuTriggerFor]="spaceMenu"
            [cwContextMenuData]="view.space"
            (click)="openOverview(view.space)"
          >
            @if (view.icon; as icon) {
              <ng-icon cwAppRailItemMedia [name]="icon" [class]="view.tone" />
            } @else {
              <span cwAppRailItemMedia class="text-sm font-semibold" [class]="view.tone">{{
                view.space.name.charAt(0).toUpperCase()
              }}</span>
            }
            {{ view.space.name }}
          </button>
        }
      </cw-app-rail-group>
    }

    <cw-menu #spaceMenu side="right" [ariaLabel]="menuSpace(spaceMenu.data())?.name ?? ''">
      @if (menuSpace(spaceMenu.data()); as space) {
        <button cwMenuItem (triggered)="openOverview(space)">
          <ng-icon name="phosphorSquaresFourBold" aria-hidden="true" />
          <ng-container i18n="@@spaces.menu.overview">Overview</ng-container>
        </button>
        <button
          cwMenuItem
          [disabled]="!space.canEdit"
          (triggered)="navigation.openDialog({ kind: 'space', space })"
        >
          <ng-icon name="phosphorPencilSimpleBold" aria-hidden="true" />
          <ng-container i18n="@@spaces.menu.edit-space">Edit the space</ng-container>
        </button>
        <button cwMenuItem (triggered)="removeFavorite(space)">
          <ng-icon name="phosphorStarFill" aria-hidden="true" />
          <ng-container i18n="@@spaces.overview.favorite-remove"
            >Remove from favorite spaces</ng-container
          >
        </button>
        <cw-menu-separator />
        <button
          cwMenuItem
          [disabled]="!space.canEdit"
          (triggered)="
            navigation.openDialog({ kind: 'list', spaceId: space.id, list: null, sprint: false })
          "
        >
          <ng-icon name="phosphorPlusBold" aria-hidden="true" />
          <ng-container i18n="@@spaces.menu.new-list">New list</ng-container>
        </button>
        <button
          cwMenuItem
          [disabled]="!space.canEdit"
          (triggered)="
            navigation.openDialog({ kind: 'list', spaceId: space.id, list: null, sprint: true })
          "
        >
          <ng-icon name="phosphorLightningBold" aria-hidden="true" />
          <ng-container i18n="@@spaces.menu.new-sprint">New sprint</ng-container>
        </button>
        <cw-menu-separator />
        @if (navigation.expanded()[space.id]) {
          <button cwMenuItem (triggered)="navigation.setExpanded(space.id, false)">
            <ng-icon name="phosphorCaretUpBold" aria-hidden="true" />
            <ng-container i18n="@@spaces.menu.collapse-space">Collapse the space</ng-container>
          </button>
        } @else {
          <button cwMenuItem (triggered)="navigation.setExpanded(space.id, true)">
            <ng-icon name="phosphorCaretDownBold" aria-hidden="true" />
            <ng-container i18n="@@spaces.menu.expand-space">Expand the space</ng-container>
          </button>
        }
        <cw-menu-separator />
        <button
          cwMenuItem
          variant="destructive"
          [disabled]="!space.canManage"
          (triggered)="navigation.openDialog({ kind: 'delete-space', space })"
        >
          <ng-icon name="phosphorTrashBold" aria-hidden="true" />
          <ng-container i18n="@@spaces.menu.delete-space">Delete the space</ng-container>
        </button>
      }
    </cw-menu>
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
  protected readonly navigation: InstanceType<typeof SpacesNavigationStore> =
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
   * Property toasts
   *
   * @description
   * Feedback of the favorite toggle.
   *
   * @type {CwToastService}
   * @readonly
   */
  private readonly toasts: CwToastService = inject(CwToastService);

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

  /**
   * Property shownSpaceId
   *
   * @description
   * The space whose overview is shown, or null.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  protected readonly shownSpaceId: Signal<string | null> = computed(
    (): string | null => SPACE_PATH.exec(this.url())?.[1] ?? null,
  );

  /**
   * Property favoriteSpaces
   *
   * @description
   * The favorite spaces the sidebar knows, in insertion order.
   *
   * @type {Signal<readonly RailSpaceView[]>}
   * @readonly
   */
  protected readonly favoriteSpaces: Signal<readonly RailSpaceView[]> = computed(
    (): readonly RailSpaceView[] => {
      if (!this.navigation.favorites.hasValue() || !this.navigation.spaces.hasValue()) return [];
      return this.navigation.favorites
        .value()
        .filter((favorite: Favorite): boolean => favorite.kind === 'space')
        .map((favorite: Favorite): SpaceDetails | undefined =>
          this.navigation.spaceById(favorite.targetId),
        )
        .filter((space: SpaceDetails | undefined): space is SpaceDetails => space !== undefined)
        .map((space: SpaceDetails): RailSpaceView => ({
          space,
          icon: space.icon ? lookIconName(space.icon, true) : null,
          tone: space.color === 'gris' ? 'text-foreground' : lookTone(space.color),
        }));
    },
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
  protected openOverview(space: SpaceDetails): void {
    this.navigation.setExpanded(space.id, true);
    void this.router.navigate(['/', this.slug(), 'spaces', space.id]);
  }

  /**
   * Method menuSpace
   *
   * @description
   * The space the context menu was opened on.
   *
   * @param {unknown} data - The menu's data.
   * @returns {SpaceDetails | null} The space, or null.
   */
  protected menuSpace(data: unknown): SpaceDetails | null {
    return typeof data === 'object' && data !== null && 'prefix' in data
      ? (data as SpaceDetails)
      : null;
  }

  /**
   * Method removeFavorite
   *
   * @description
   * `Remove from favorite spaces`: the space leaves the rail.
   *
   * @param {SpaceDetails} space - The space.
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async removeFavorite(space: SpaceDetails): Promise<void> {
    if (!(await this.navigation.setFavorite('space', space.id, space.name, false))) {
      this.toasts.error($localize`:@@spaces.favorite.failed:The favorites could not be changed`);
      return;
    }
    this.toasts.show($localize`:@@spaces.favorite.space-removed:Removed from favorite spaces`, {
      description: space.name,
    });
  }
  // #endregion
}
