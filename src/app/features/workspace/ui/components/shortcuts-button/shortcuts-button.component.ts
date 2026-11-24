import { Component, inject } from '@angular/core';
import { CwKbd } from '@cadenway/ui/components/kbd';
import { NgIcon } from '@ng-icons/core';

import { ShortcutsHelp } from '../../../services/shortcuts-help/shortcuts-help.service';

/**
 * Component ShortcutsButton
 *
 * @description
 * The « Raccourcis clavier ? » row of the sidebar footer (mockup `App.dc.html` line 266): it opens
 * the keyboard shortcuts dialog through `ShortcutsHelp`, as `?` does. It is a `sidebarFooter`
 * slot contribution.
 */
@Component({
  selector: 'cw-shortcuts-button',
  imports: [CwKbd, NgIcon],
  host: { class: 'contents' },
  template: `
    <button
      type="button"
      class="flex items-center gap-1.5 rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
      aria-keyshortcuts="?"
      data-testid="shortcuts-button"
      (click)="help.setOpen(true)"
    >
      <ng-icon name="phosphorKeyboardBold" class="size-3.5" aria-hidden="true" />
      <ng-container i18n="@@workspace.shortcuts.button">Keyboard shortcuts</ng-container>
      <kbd cwKbd size="sm" class="ml-auto">?</kbd>
    </button>
  `,
})
export class ShortcutsButton {
  // #region Properties
  /**
   * Property help
   *
   * @description
   * Open state shared with the dialog.
   *
   * @type {ShortcutsHelp}
   * @readonly
   */
  protected readonly help: ShortcutsHelp = inject(ShortcutsHelp);
  // #endregion
}
