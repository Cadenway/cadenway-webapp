import type { SeatSummary } from '../../data-access/services/sidebar-api/sidebar-api.service';

/**
 * Interface SidebarTip
 *
 * @description
 * One suggestion of the sidebar carousel (`SIDEBAR_TIPS` of `App.dc.html`).
 */
export interface SidebarTip {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Stable key, stored once the carousel is dismissed.
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;

  /**
   * Property icon
   *
   * @description
   * Icon name.
   *
   * @type {string}
   * @readonly
   */
  readonly icon: string;

  /**
   * Property tone
   *
   * @description
   * Icon color class.
   *
   * @type {string}
   * @readonly
   */
  readonly tone: string;

  /**
   * Property title
   *
   * @description
   * Suggestion title.
   *
   * @type {string}
   * @readonly
   */
  readonly title: string;

  /**
   * Property text
   *
   * @description
   * Suggestion text.
   *
   * @type {string}
   * @readonly
   */
  readonly text: string;

  /**
   * Property cta
   *
   * @description
   * Label of the call to action.
   *
   * @type {string}
   * @readonly
   */
  readonly cta: string;

  /**
   * Property path
   *
   * @description
   * Address below the slug that the call to action opens.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly path: readonly string[];
  // #endregion
}

/**
 * Function planLabel
 *
 * @description
 * The name of a plan in the invitation tip (`Team`), or its key for a later plan.
 *
 * @param {string} plan - Plan key.
 * @returns {string} The name.
 */
function planLabel(plan: string): string {
  switch (plan) {
    case 'free':
      return $localize`:@@spaces.tips.plan-free:Free`;
    case 'team':
      return $localize`:@@spaces.tips.plan-team:Team`;
    case 'enterprise':
      return $localize`:@@spaces.tips.plan-enterprise:Enterprise`;
    default:
      return plan;
  }
}

/**
 * Function inviteTip
 *
 * @description
 * `Invite your team`, with the free seats of the plan, opening the organization's members.
 *
 * @param {number} free - Free seats, at least one.
 * @param {string} plan - Name of the plan.
 * @returns {SidebarTip} The suggestion.
 */
function inviteTip(free: number, plan: string): SidebarTip {
  return {
    key: 'invite',
    icon: 'phosphorUserPlusBold',
    tone: 'text-primary',
    title: $localize`:@@spaces.tips.invite-title:Invite your team`,
    text:
      free === 1
        ? $localize`:@@spaces.tips.invite-text-one:1 free seat on your ${plan}:plan: plan. Invite colleagues to assign them tasks.`
        : $localize`:@@spaces.tips.invite-text:${free}:count: free seats on your ${plan}:plan: plan. Invite colleagues to assign them tasks.`,
    cta: $localize`:@@spaces.tips.invite-cta:Invite`,
    path: ['organization', 'members'],
  };
}

/**
 * Function sidebarTips
 *
 * @description
 * The suggestions this version can act on: connecting GitHub opens the organization's
 * integrations, inviting the team opens its members while the plan has free seats, and securing
 * the account opens its security settings. The mockup's Slack and Figma tips name integrations no
 * service provides; they are left out.
 *
 * @param {SeatSummary | null} seats - The plan and its free seats, or null while unknown.
 * @returns {readonly SidebarTip[]} The suggestions, in the mockup's order.
 */
export function sidebarTips(seats: SeatSummary | null = null): readonly SidebarTip[] {
  const invite: readonly SidebarTip[] =
    seats !== null && seats.free > 0 ? [inviteTip(seats.free, planLabel(seats.plan))] : [];
  return [
    {
      key: 'github',
      icon: 'svglGithubLight',
      tone: 'text-foreground',
      title: $localize`:@@spaces.tips.github-title:Connect GitHub`,
      text: $localize`:@@spaces.tips.github-text:Link commits and pull requests to tasks: mention CAD-482 in a branch and the status moves on its own.`,
      cta: $localize`:@@spaces.tips.github-cta:Connect`,
      path: ['organization', 'integrations'],
    },
    ...invite,
    {
      key: 'mfa',
      icon: 'phosphorShieldCheckBold',
      tone: 'text-jade-text',
      title: $localize`:@@spaces.tips.mfa-title:Secure your account`,
      text: $localize`:@@spaces.tips.mfa-text:Turn on two-step verification: a code on top of the password at each sign-in.`,
      cta: $localize`:@@spaces.tips.mfa-cta:Turn on`,
      path: ['account', 'security'],
    },
  ];
}
