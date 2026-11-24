import { Component, DestroyRef, inject } from '@angular/core';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwDialog,
  CwDialogClose,
  CwDialogDescription,
  CwDialogFooter,
  CwDialogHeader,
  CwDialogTitle,
  provideCwDialogLabels,
} from '@cadenway/ui/components/dialog';
import { CwKbd } from '@cadenway/ui/components/kbd';

import { ShortcutsService } from '@core/shortcuts';

import {
  SHORTCUT_GROUPS,
  type ShortcutGroup,
} from '../../../constants/shortcut-groups/shortcut-groups.constants';
import { ShortcutsHelp } from '../../../services/shortcuts-help/shortcuts-help.service';

/**
 * Component ShortcutsDialog
 *
 * @description
 * The keyboard shortcuts dialog of mockup `App.dc.html` (lines 3318-3326 and `SHORTCUTS`):
 * « Raccourcis clavier », its hint, then the « Partout », « Listes et tâches » and « Édition »
 * sections, each shortcut drawn with `kbd[cwKbd]` keys, and « Fermer ». `?` opens it from anywhere
 * outside a field, through `ShortcutsService`, for as long as the shell lives; the sidebar
 * footer's « Raccourcis clavier » button opens it through `ShortcutsHelp`. It is an `overlays`
 * slot contribution.
 */
@Component({
  selector: 'cw-shortcuts-dialog',
  imports: [
    CwButton,
    CwDialog,
    CwDialogClose,
    CwDialogDescription,
    CwDialogFooter,
    CwDialogHeader,
    CwDialogTitle,
    CwKbd,
  ],
  providers: [
    provideCwDialogLabels(() => ({ close: $localize`:@@workspace.shortcuts.close-button:Close` })),
  ],
  templateUrl: './shortcuts-dialog.component.html',
})
export class ShortcutsDialog {
  // #region Properties
  /**
   * Property groups
   *
   * @description
   * The dialog's sections.
   *
   * @type {readonly ShortcutGroup[]}
   * @readonly
   */
  protected readonly groups: readonly ShortcutGroup[] = SHORTCUT_GROUPS;

  /**
   * Property help
   *
   * @description
   * Open state shared with the sidebar footer's button.
   *
   * @type {ShortcutsHelp}
   * @readonly
   */
  protected readonly help: ShortcutsHelp = inject(ShortcutsHelp);
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds `?` to the dialog until the shell is destroyed.
   *
   * @constructor
   */
  public constructor() {
    inject(ShortcutsService).register(
      {
        keys: '?',
        handler: (): void => {
          this.help.setOpen(true);
        },
      },
      inject(DestroyRef),
    );
  }
  // #endregion
}
