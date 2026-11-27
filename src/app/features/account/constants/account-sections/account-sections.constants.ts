import type { AccountSection } from '../../models/account-section/account-section.interface';

/**
 * Constant ACCOUNT_SECTIONS
 *
 * @description
 * The 5 sections of the account settings navigation, in the mockup's order
 * (`Compte.dc.html` lines 1455-1461): Profile, Security and sign-in, Notifications, Preferences
 * and API tokens. Every signed-in person may open each of them.
 *
 * @type {readonly AccountSection[]}
 */
export const ACCOUNT_SECTIONS: readonly AccountSection[] = [
  {
    path: 'profile',
    label: $localize`:@@account.navigation.profile:Profile`,
    icon: 'phosphorUserCircleBold',
    activeIcon: 'phosphorUserCircleFill',
  },
  {
    path: 'security',
    label: $localize`:@@account.navigation.security:Security and sign-in`,
    icon: 'phosphorShieldCheckBold',
    activeIcon: 'phosphorShieldCheckFill',
  },
  {
    path: 'notifications',
    label: $localize`:@@account.navigation.notifications:Notifications`,
    icon: 'phosphorBellBold',
    activeIcon: 'phosphorBellFill',
  },
  {
    path: 'preferences',
    label: $localize`:@@account.navigation.preferences:Preferences`,
    icon: 'phosphorSlidersHorizontalBold',
    activeIcon: 'phosphorSlidersHorizontalFill',
  },
  {
    path: 'api-tokens',
    label: $localize`:@@account.navigation.api-tokens:API tokens`,
    icon: 'phosphorKeyBold',
    activeIcon: 'phosphorKeyFill',
  },
];
