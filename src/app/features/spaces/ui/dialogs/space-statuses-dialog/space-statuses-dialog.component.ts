import { Component, input, type InputSignal, model, type ModelSignal } from '@angular/core';

import type { SpaceDetails } from '../../../models/space/space.interface';

/**
 * Component SpaceStatusesDialog
 *
 * @description
 * `Space statuses` (`App.dc.html` lines 3302-3317): the names and use of the space's statuses. A
 * stub hosted by the list page, which opens it from the list menu's `Space statuses`, enabled when
 * the space is editable; the opener shows once the lead adds the dialog to
 * `RELEASED_LIST_DIALOGS`. The dialog's package owns this folder and keeps these inputs: `open`
 * (two-way; the dialog sets it to false when it closes) and `space`, the sidebar's read with its
 * version and rights.
 */
@Component({
  selector: 'cw-space-statuses-dialog',
  templateUrl: './space-statuses-dialog.component.html',
})
export class SpaceStatusesDialog {
  // #region Properties
  /**
   * Property open
   *
   * @description
   * Whether the dialog shows; `[(open)]`.
   *
   * @type {ModelSignal<boolean>}
   * @readonly
   */
  public readonly open: ModelSignal<boolean> = model(false);

  /**
   * Property space
   *
   * @description
   * The space the dialog is about, or null while it is read.
   *
   * @type {InputSignal<SpaceDetails | null>}
   * @readonly
   */
  public readonly space: InputSignal<SpaceDetails | null> = input<SpaceDetails | null>(null);
  // #endregion
}
