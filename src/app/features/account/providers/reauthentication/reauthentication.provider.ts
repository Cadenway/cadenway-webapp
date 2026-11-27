import type { Provider } from '@angular/core';
import type { SlotContribution, SlotFeature } from '@shared/layout-slot';

import { ReauthenticationService } from '../../reauthentication/reauthentication.service';
import { ReauthenticationDialog } from '../../ui/dialogs/reauthentication-dialog/reauthentication-dialog.component';

/**
 * Function provideReauthentication
 *
 * @description
 * Provides the `ReauthenticationService` the settings sections and the dialog share. Give it to
 * the route that loads the settings shell, next to `withReauthenticationDialog()` in its
 * `overlays`, so the pages below and the dialog see the same instance.
 *
 * @returns {Provider[]} The service.
 */
export function provideReauthentication(): Provider[] {
  return [ReauthenticationService];
}

/**
 * Function withReauthenticationDialog
 *
 * @description
 * Contributes the reauthentication dialog to the settings shell's `overlays` slot. Bind it on the
 * route that also calls `provideReauthentication()`.
 *
 * @returns {SlotFeature<SlotContribution>} The slot contribution factory.
 */
export function withReauthenticationDialog(): SlotFeature<SlotContribution> {
  return {
    useFactory: (): SlotContribution => ({
      id: 'account.reauthentication-dialog',
      order: 30,
      component: ReauthenticationDialog,
    }),
  };
}
