import { Component, input, type InputSignal, model, type ModelSignal } from '@angular/core';

import type { SpaceDetails } from '../../../models/space/space.interface';

/**
 * Component AutomationsDialog
 *
 * @description
 * `Automations` (`App.dc.html` lines 3246-3301): the organization's rules; its Git section stays
 * hidden until B6 is decided. A stub hosted by the list page, which opens it from the list menu's
 * `Automations`, offered to organization admins and owners; the opener shows once the lead adds
 * the dialog to `RELEASED_LIST_DIALOGS`. The dialog's package owns this folder and keeps these
 * inputs: `open` (two-way; the dialog sets it to false when it closes) and `space`.
 */
@Component({
  selector: 'cw-automations-dialog',
  templateUrl: './automations-dialog.component.html',
})
export class AutomationsDialog {
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
