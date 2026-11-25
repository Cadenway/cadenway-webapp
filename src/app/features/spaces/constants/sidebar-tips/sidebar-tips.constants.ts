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
 * Function sidebarTips
 *
 * @description
 * The suggestions this version can act on: connecting GitHub opens the organization's
 * integrations, securing the account opens its security settings. The mockup's Slack and Figma
 * tips name integrations no service provides, and its invitation tip counts free seats the
 * sidebar does not read; they are left out.
 *
 * @returns {readonly SidebarTip[]} The suggestions, in the mockup's order.
 */
export function sidebarTips(): readonly SidebarTip[] {
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
