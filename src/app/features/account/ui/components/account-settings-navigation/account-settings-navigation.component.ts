import { Component, computed, inject, type Signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgIcon } from '@ng-icons/core';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { ACCOUNT_SECTIONS } from '../../../constants/account-sections/account-sections.constants';
import type { AccountSection } from '../../../models/account-section/account-section.interface';

/**
 * Component AccountSettingsNavigation
 *
 * @description
 * The `My account` group of the account settings navigation (mockup `Compte.dc.html` lines
 * 60-69, logic lines 1518-1524): its heading, then a link per section to
 * `/<slug>/account/<section>`. The current section's link carries `aria-current="page"`, the
 * violet tint and the Fill icon. Below 768 px the links wrap in rows; from 768 px they stack. It
 * follows an organization switch in place through the workspace port. It is a settings shell
 * `settingsNavigation` contribution.
 */
@Component({
  selector: 'cw-account-settings-navigation',
  imports: [NgIcon, RouterLink, RouterLinkActive],
  host: { class: 'contents' },
  template: `
    <div
      class="flex flex-col gap-px"
      role="group"
      aria-labelledby="account-settings-navigation-heading"
    >
      <div
        id="account-settings-navigation-heading"
        class="flex h-8 items-center px-2 text-xs font-medium text-muted-foreground"
        i18n="@@account.navigation.heading"
      >
        My account
      </div>
      <div class="flex flex-row flex-wrap gap-px md:flex-col">
        @for (item of items(); track item.section.path) {
          @let section = item.section;
          <a
            [routerLink]="item.link"
            routerLinkActive
            #active="routerLinkActive"
            ariaCurrentWhenActive="page"
            class="flex h-8 items-center gap-2 rounded-md px-2 text-left text-sm transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none focus-visible:ring-inset"
            [class]="active.isActive ? 'bg-primary/5 font-medium text-primary' : ''"
            [attr.data-testid]="'account-navigation-' + section.path"
          >
            <ng-icon
              [name]="active.isActive ? section.activeIcon : section.icon"
              size="1rem"
              class="shrink-0"
              [class]="active.isActive ? 'text-primary' : 'text-muted-foreground'"
              aria-hidden="true"
            />
            {{ section.label }}
          </a>
        }
      </div>
    </div>
  `,
})
export class AccountSettingsNavigation {
  // #region Properties
  /**
   * Property workspace
   *
   * @description
   * Workspace context whose slug the links open.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  private readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property items
   *
   * @description
   * The account sections, in the mockup's order, each with its `/<slug>/account/<section>`
   * commands.
   *
   * @type {Signal<readonly { readonly section: AccountSection; readonly link: readonly string[] }[]>}
   * @readonly
   */
  protected readonly items: Signal<
    readonly { readonly section: AccountSection; readonly link: readonly string[] }[]
  > = computed(() => {
    const slug: string = this.workspace.organization().slug;
    return ACCOUNT_SECTIONS.map((section: AccountSection) => ({
      section,
      link: ['/', slug, 'account', section.path],
    }));
  });
  // #endregion
}
