import type { OrganizationRoleFallback } from '@features/workspace/http/guards/organization-role';

import type { OrganizationSection } from '../../models/organization-section/organization-section.interface';

/**
 * Constant ORGANIZATION_SECTIONS
 *
 * @description
 * The 7 sections of the organization settings, in the mockup's order (`Organisation.dc.html`
 * lines 1617-1623), with the least role that may open each: Billing and Quotas for the owner
 * (`billing.yaml` answers the owner only, O:321); General (every control writes, and
 * `updateCurrentOrganization` is owner or admin), Security and SSO, Integrations and the Audit log
 * for an administrator; Members for a member. Guests open none.
 *
 * @type {readonly OrganizationSection[]}
 */
export const ORGANIZATION_SECTIONS: readonly OrganizationSection[] = [
  {
    path: 'general',
    least: 'admin',
    label: $localize`:@@organization.navigation.general:General`,
    icon: 'phosphorBuildingsBold',
    activeIcon: 'phosphorBuildingsFill',
  },
  {
    path: 'members',
    least: 'member',
    label: $localize`:@@organization.navigation.members:Members`,
    icon: 'phosphorUsersBold',
    activeIcon: 'phosphorUsersFill',
  },
  {
    path: 'billing',
    least: 'owner',
    label: $localize`:@@organization.navigation.billing:Billing`,
    icon: 'phosphorCreditCardBold',
    activeIcon: 'phosphorCreditCardFill',
  },
  {
    path: 'quotas',
    least: 'owner',
    label: $localize`:@@organization.navigation.quotas:Quotas and usage`,
    icon: 'phosphorGaugeBold',
    activeIcon: 'phosphorGaugeFill',
  },
  {
    path: 'security',
    least: 'admin',
    label: $localize`:@@organization.navigation.security:Security and SSO`,
    icon: 'phosphorShieldCheckBold',
    activeIcon: 'phosphorShieldCheckFill',
  },
  {
    path: 'integrations',
    least: 'admin',
    label: $localize`:@@organization.navigation.integrations:Integrations`,
    icon: 'phosphorPlugsConnectedBold',
    activeIcon: 'phosphorPlugsConnectedFill',
  },
  {
    path: 'audit-log',
    least: 'admin',
    label: $localize`:@@organization.navigation.audit-log:Audit log`,
    icon: 'phosphorClipboardTextBold',
    activeIcon: 'phosphorClipboardTextFill',
  },
];

/**
 * Constant ORGANIZATION_SECTION_LINKS
 *
 * @description
 * The organization sections the account settings link to (mockup `Compte.dc.html` lines
 * 1526-1531): General, Members, Billing and Quotas and usage.
 *
 * @type {readonly OrganizationSection[]}
 */
export const ORGANIZATION_SECTION_LINKS: readonly OrganizationSection[] =
  ORGANIZATION_SECTIONS.slice(0, 4);

/**
 * Constant ORGANIZATION_SECTION_FALLBACKS
 *
 * @description
 * Where `organizationRoleGuard` sends a person refused a section: the first section, in the
 * navigation's order, their role may open.
 *
 * @type {readonly OrganizationRoleFallback[]}
 */
export const ORGANIZATION_SECTION_FALLBACKS: readonly OrganizationRoleFallback[] =
  ORGANIZATION_SECTIONS.map((section: OrganizationSection): OrganizationRoleFallback => ({
    least: section.least,
    path: ['organization', section.path],
  }));
