import { Component, inject, type Signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';

import { SpacesNavigationStore } from '../../../state/spaces-navigation/spaces-navigation.store';
import { injectOrganizationSlug } from '../../../utils/workspace-route/workspace-route.util';

/**
 * Component SidebarFooterLinks
 *
 * @description
 * The « Corbeille » and « Archives » rows of the sidebar footer (`App.dc.html` lines 263-264),
 * between the plan line and « Raccourcis clavier »: each links to its screen of the organization
 * and shows its count once read (`SpacesNavigationStore.trashCount` and `archiveCount`); a count
 * not read yet or whose read failed is left out, the row still links. A `sidebarFooter` slot
 * contribution; its host is `display: contents`.
 */
@Component({
  selector: 'cw-sidebar-footer-links',
  imports: [NgIcon, RouterLink],
  host: { class: 'contents' },
  template: `
    <a
      [routerLink]="['/', slug(), 'trash']"
      class="flex items-center gap-1.5 rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
      data-testid="sidebar-trash"
    >
      <ng-icon name="phosphorTrashBold" class="size-3.5" aria-hidden="true" />
      <ng-container i18n="@@spaces.footer.trash">Trash</ng-container>
      @if (navigation.trashCount.hasValue()) {
        <span class="ml-auto tabular-nums">{{ navigation.trashCount.value() }}</span>
      }
    </a>
    <a
      [routerLink]="['/', slug(), 'archives']"
      class="flex items-center gap-1.5 rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
      data-testid="sidebar-archives"
    >
      <ng-icon name="phosphorArchiveBold" class="size-3.5" aria-hidden="true" />
      <ng-container i18n="@@spaces.footer.archives">Archives</ng-container>
      @if (navigation.archiveCount.hasValue()) {
        <span class="ml-auto tabular-nums">{{ navigation.archiveCount.value() }}</span>
      }
    </a>
  `,
})
export class SidebarFooterLinks {
  // #region Properties
  /**
   * Property navigation
   *
   * @description
   * The workspace's spaces navigation, which reads the counts.
   *
   * @type {InstanceType<typeof SpacesNavigationStore>}
   * @readonly
   */
  protected readonly navigation: InstanceType<typeof SpacesNavigationStore> =
    inject(SpacesNavigationStore);

  /**
   * Property slug
   *
   * @description
   * Organization slug of the route.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly slug: Signal<string> = injectOrganizationSlug();
  // #endregion
}
