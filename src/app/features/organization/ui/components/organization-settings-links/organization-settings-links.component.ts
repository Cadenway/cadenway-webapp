import { Component, computed, inject, type Signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { ORGANIZATION_SECTION_LINKS } from '../../../constants/organization-sections/organization-sections.constants';
import type { OrganizationSection } from '../../../models/organization-section/organization-section.interface';

/**
 * Interface OrganizationLink
 *
 * @description
 * A section link the person's role may follow.
 */
interface OrganizationLink {
  // #region Properties
  /**
   * Property section
   *
   * @description
   * The linked section.
   *
   * @type {OrganizationSection}
   * @readonly
   */
  readonly section: OrganizationSection;

  /**
   * Property link
   *
   * @description
   * `/<slug>/organization/<section>`.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly link: readonly string[];
  // #endregion
}

/**
 * Component OrganizationSettingsLinks
 *
 * @description
 * The `Organization · <name>` group closing the account settings navigation (mockup
 * `Compte.dc.html` lines 70-77, logic lines 1526-1531): links to General, Members, Billing and
 * Quotas and usage of `/<slug>/organization`, each shown only when the person's role may open it
 * (`WORKSPACE_CONTEXT.can()`); without any, the group is not rendered (a guest). It follows an
 * organization switch in place. It is a settings shell `settingsNavigation` contribution.
 */
@Component({
  selector: 'cw-organization-settings-links',
  imports: [NgIcon, RouterLink],
  host: { class: 'contents' },
  template: `
    @if (links().length > 0) {
      <div
        class="flex flex-col gap-px"
        role="group"
        aria-labelledby="organization-settings-links-heading"
      >
        <div
          id="organization-settings-links-heading"
          class="flex h-8 items-center px-2 text-xs font-medium text-muted-foreground"
          i18n="@@organization.navigation.links-heading"
        >
          Organization · {{ workspace.organization().name }}
        </div>
        <div class="flex flex-row flex-wrap gap-px md:flex-col">
          @for (item of links(); track item.section.path) {
            <a
              [routerLink]="item.link"
              class="flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none focus-visible:ring-inset"
              [attr.data-testid]="'organization-link-' + item.section.path"
            >
              <ng-icon
                [name]="item.section.icon"
                class="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              {{ item.section.label }}
            </a>
          }
        </div>
      </div>
    }
  `,
})
export class OrganizationSettingsLinks {
  // #region Properties
  /**
   * Property workspace
   *
   * @description
   * Workspace context: the organization, its slug and the person's role.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  protected readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property links
   *
   * @description
   * The linked sections the person's role may open.
   *
   * @type {Signal<readonly OrganizationLink[]>}
   * @readonly
   */
  protected readonly links: Signal<readonly OrganizationLink[]> = computed(
    (): readonly OrganizationLink[] => {
      const slug: string = this.workspace.organization().slug;
      return ORGANIZATION_SECTION_LINKS.filter((section: OrganizationSection) =>
        this.workspace.can(section.least),
      ).map((section: OrganizationSection): OrganizationLink => ({
        section,
        link: ['/', slug, 'organization', section.path],
      }));
    },
  );
  // #endregion
}
