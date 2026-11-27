import { Component, computed, inject, type Signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgIcon } from '@ng-icons/core';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { ORGANIZATION_SECTIONS } from '../../../constants/organization-sections/organization-sections.constants';
import type { OrganizationSection } from '../../../models/organization-section/organization-section.interface';
import type { OrganizationSubscription } from '../../../models/organization-subscription/organization-subscription.interface';
import { SubscriptionStore } from '../../../state/subscription/subscription.store';
import { planName } from '../../../utils/plan-label/plan-label.util';

/**
 * Interface OrganizationNavigationItem
 *
 * @description
 * A section the person's role may open, with its commands.
 */
interface OrganizationNavigationItem {
  // #region Properties
  /**
   * Property section
   *
   * @description
   * The section.
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
 * Component OrganizationSettingsNavigation
 *
 * @description
 * The organization part of the organization settings navigation (mockup `Organisation.dc.html`
 * lines 50-64, logic lines 1617-1647 and 1738): the identity row (initials square, name, then
 * `Team plan · 18 members` from the subscription's used seats, or the plan alone for whoever may
 * not read billing), then the `Organization` group with a link per section the person's role may
 * open (`WORKSPACE_CONTEXT.can()`), to `/<slug>/organization/<section>`. The current link carries
 * `aria-current="page"`, the violet tint and the Fill icon; `Quotas and usage` carries the red
 * `Critical quota` alert while the seats or the storage use at least 90 % of their limit. Below
 * 768 px the links wrap in rows. It reads Organization's `SubscriptionStore` of `/:org` and follows
 * an organization switch in place. It is a settings shell `settingsNavigation` contribution.
 */
@Component({
  selector: 'cw-organization-settings-navigation',
  imports: [NgIcon, RouterLink, RouterLinkActive],
  host: { class: 'contents' },
  template: `
    <div class="flex items-center gap-2 px-2" data-testid="organization-identity">
      <span
        class="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-sidebar-primary text-[11px] font-semibold text-sidebar-primary-foreground"
        aria-hidden="true"
        >{{ workspace.organization().initials }}</span
      >
      <span class="flex min-w-0 flex-col">
        <span class="truncate leading-4 font-semibold">{{ workspace.organization().name }}</span>
        <span class="truncate text-xs text-muted-foreground tabular-nums">{{ subtitle() }}</span>
      </span>
    </div>
    <div
      class="flex flex-col gap-px"
      role="group"
      aria-labelledby="organization-settings-navigation-heading"
    >
      <div
        id="organization-settings-navigation-heading"
        class="flex h-8 items-center px-2 text-xs font-medium text-muted-foreground"
        i18n="@@organization.navigation.heading"
      >
        Organization
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
            [attr.data-testid]="'organization-navigation-' + section.path"
          >
            <ng-icon
              [name]="active.isActive ? section.activeIcon : section.icon"
              class="size-4 shrink-0"
              [class]="active.isActive ? 'text-primary' : 'text-muted-foreground'"
              aria-hidden="true"
            />
            {{ section.label }}
            @if (section.path === 'quotas' && usage.quotaCritical()) {
              <ng-icon
                name="phosphorWarningCircleFill"
                aria-hidden="false"
                class="ml-auto size-3.5 shrink-0 text-destructive"
                aria-label="Critical quota"
                i18n-aria-label="@@organization.navigation.quota-critical"
              />
            }
          </a>
        }
      </div>
    </div>
  `,
})
export class OrganizationSettingsNavigation {
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
   * Property usage
   *
   * @description
   * The organization's plan and usage, read for an owner only.
   *
   * @type {InstanceType<typeof SubscriptionStore>}
   * @readonly
   */
  protected readonly usage: InstanceType<typeof SubscriptionStore> = inject(SubscriptionStore);

  /**
   * Property items
   *
   * @description
   * The sections the person's role may open, in the mockup's order.
   *
   * @type {Signal<readonly OrganizationNavigationItem[]>}
   * @readonly
   */
  protected readonly items: Signal<readonly OrganizationNavigationItem[]> = computed(
    (): readonly OrganizationNavigationItem[] => {
      const slug: string = this.workspace.organization().slug;
      return ORGANIZATION_SECTIONS.filter((section: OrganizationSection) =>
        this.workspace.can(section.least),
      ).map((section: OrganizationSection): OrganizationNavigationItem => ({
        section,
        link: ['/', slug, 'organization', section.path],
      }));
    },
  );

  /**
   * Property subtitle
   *
   * @description
   * `<plan> plan · <n> members` once the subscription is read, `<plan> plan` otherwise.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly subtitle: Signal<string> = computed((): string => {
    const plan: string = planName(this.workspace.organization().plan);
    const subscription: OrganizationSubscription | null = this.usage.current();
    if (subscription === null) return $localize`:@@organization.navigation.plan:${plan}:plan: plan`;
    const count: number = subscription.seatsUsed;
    return count === 1
      ? $localize`:@@organization.navigation.plan-member:${plan}:plan: plan · ${count}:count: member`
      : $localize`:@@organization.navigation.plan-members:${plan}:plan: plan · ${count}:count: members`;
  });
  // #endregion
}
