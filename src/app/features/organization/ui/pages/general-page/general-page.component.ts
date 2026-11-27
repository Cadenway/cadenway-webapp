import { Component, type Signal, viewChild } from '@angular/core';

import { DiscardChangesDialog } from '@features/workspace/ui/dialogs/discard-changes-dialog';
import type { UnsavedChanges } from '@shared/unsaved-changes';

/**
 * Component GeneralPage
 *
 * @description
 * Stub of the organization settings section `Organization profile` (mockup `Organisation.dc.html`
 * lines 130-133): the centred `max-w-4xl` column of the organization settings with the section
 * title and an empty body. It reads no data yet, so it has no loading, error or empty state;
 * package O1 of steps 7 and 8 replaces it. The route guards it with `unsavedChangesGuard`, and the
 * page asks through Workspace's `cw-discard-changes-dialog`; without a form it never holds unsaved
 * changes, so it never asks yet. Package O1 reports its form's dirty state.
 */
@Component({
  selector: 'cw-general-page',
  imports: [DiscardChangesDialog],
  template: `
    <div class="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
      <header class="flex flex-col gap-1">
        <h1 class="text-2xl font-semibold tracking-tight" i18n="@@organization.general.title">
          Organization profile
        </h1>
      </header>
    </div>
    <cw-discard-changes-dialog />
  `,
})
export class GeneralPage implements UnsavedChanges {
  // #region Properties
  /**
   * Property discard
   *
   * @description
   * The confirmation shown before unsaved edits are lost.
   *
   * @type {Signal<DiscardChangesDialog>}
   * @readonly
   */
  private readonly discard: Signal<DiscardChangesDialog> = viewChild.required(DiscardChangesDialog);
  // #endregion

  // #region Methods
  /**
   * Method hasUnsavedChanges
   *
   * @description
   * The stub has no form, so nothing is ever unsaved.
   *
   * @returns {boolean} Always false.
   */
  public hasUnsavedChanges(): boolean {
    return false;
  }

  /**
   * Method confirmDiscard
   *
   * @description
   * Asks whether to discard the unsaved edits.
   *
   * @returns {Promise<boolean>} Resolves true on `Discard`, false on `Keep editing`.
   */
  public confirmDiscard(): Promise<boolean> {
    return this.discard().ask();
  }
  // #endregion
}
