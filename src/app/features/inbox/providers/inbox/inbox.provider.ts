import { inject } from '@angular/core';
import type { SlotContribution, SlotFeature } from '@shared/layout-slot';

import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { InboxRailItem } from '../../ui/components/inbox-rail-item/inbox-rail-item.component';

/**
 * Function withInbox
 *
 * @description
 * Contributes the « Boîte de réception » item and its popover to the shell's `railNavigation`
 * slot, after « Accueil ». Bind it on the `/:org` route, whose injector provides
 * `WORKSPACE_CONTEXT` and `PRESENCE`.
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withInbox(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'inbox.rail-item',
      order: 10,
      component: InboxRailItem,
      inputs: { workspace: inject(WORKSPACE_CONTEXT) },
    }),
  };
}
