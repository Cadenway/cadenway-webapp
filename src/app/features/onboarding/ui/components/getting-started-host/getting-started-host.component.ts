import { Component, inject } from '@angular/core';

import { GettingStartedStore } from '../../../state/getting-started/getting-started.store';
import { OnboardingInviteDialog } from '../../dialogs/onboarding-invite-dialog/onboarding-invite-dialog.component';
import { GettingStartedPanel } from '../getting-started-panel/getting-started-panel.component';

/**
 * Component GettingStartedHost
 *
 * @description
 * Host of the `Getting started` checklist in the application shell's `overlays` slot (order 40),
 * acting as its page: it provides `GettingStartedStore`, which asks the route's `OnboardingStore`
 * to load. The panel floats over the shell once the assistant provisioned the first space, while
 * the checklist is not dismissed and the assistant does not cover the shell; nothing renders while
 * the progress is unread or when its read failed. The panel and the invite dialog load in their
 * own chunks, the dialog on its first opening.
 */
@Component({
  selector: 'cw-getting-started-host',
  imports: [GettingStartedPanel, OnboardingInviteDialog],
  providers: [GettingStartedStore],
  host: { 'data-testid': 'getting-started-host' },
  template: `
    @if (store.visible()) {
      @defer (on immediate) {
        <cw-getting-started-panel
          [items]="store.items()"
          [expanded]="store.expanded()"
          (toggled)="store.toggle()"
          (dismissed)="store.dismiss()"
          (picked)="store.start($event)"
        />
      }
    }
    @defer (when store.inviteOpen()) {
      <cw-onboarding-invite-dialog
        [open]="store.inviteOpen()"
        (openChange)="store.setInviteOpen($event)"
        [pending]="store.inviting()"
        (submitted)="store.invite($event)"
      />
    }
  `,
})
export class GettingStartedHost {
  // #region Properties
  /**
   * Property store
   *
   * @description
   * The checklist's state.
   *
   * @type {GettingStartedStore}
   * @readonly
   */
  protected readonly store: GettingStartedStore = inject(GettingStartedStore);
  // #endregion
}
