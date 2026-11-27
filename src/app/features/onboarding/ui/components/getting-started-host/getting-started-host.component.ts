import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, inject, Injector } from '@angular/core';

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
 * the progress is unread or when its read failed. The panel loads in its own chunk; the small
 * invite dialog does not, so a chunk that fails to load can never leave its `ShellOverlay` held.
 * After `Hide “Getting started”`, the focus moves to the page's `main` landmark rather than
 * falling back to the document body with the removed panel.
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
          (dismissed)="hide()"
          (picked)="store.start($event)"
        />
      }
    }
    <cw-onboarding-invite-dialog
      [open]="store.inviteOpen()"
      (openChange)="store.setInviteOpen($event)"
      [pending]="store.inviting()"
      (submitted)="store.invite($event)"
    />
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

  /**
   * Property document
   *
   * @description
   * The document, to find the `main` landmark.
   *
   * @type {Document}
   * @readonly
   */
  private readonly document: Document = inject(DOCUMENT);

  /**
   * Property injector
   *
   * @description
   * Injector of the host, to move the focus once the panel is gone.
   *
   * @type {Injector}
   * @readonly
   */
  private readonly injector: Injector = inject(Injector);
  // #endregion

  // #region Methods
  /**
   * Method hide
   *
   * @description
   * Dismisses the checklist, then moves the focus to the `main` landmark, made focusable by script
   * only (`tabindex="-1"`) when it is not already, once the panel has left.
   */
  protected hide(): void {
    void this.store.dismiss();
    afterNextRender(
      (): void => {
        const main: HTMLElement | null = this.document.querySelector<HTMLElement>('main');
        if (main === null) return;
        if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
        main.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }
  // #endregion
}
