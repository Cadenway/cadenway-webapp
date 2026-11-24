import type { SlotContribution, SlotFeature } from '@shared/layout-slot';

import { UserMenu } from '../../ui/components/user-menu/user-menu.component';

/**
 * Function withUserMenu
 *
 * @description
 * Contributes the account button and its menu to the shell's `railFooter` slot, after the search
 * and theme buttons. Bind it on the `/:org` route, whose injector provides `WORKSPACE_CONTEXT` and,
 * through `providePresence()`, `PRESENCE`.
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withUserMenu(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'account.user-menu',
      order: 20,
      component: UserMenu,
    }),
  };
}
