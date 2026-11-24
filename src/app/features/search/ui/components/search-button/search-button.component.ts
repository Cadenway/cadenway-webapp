import { Component, inject } from '@angular/core';
import { CwKbd } from '@cadenway/ui/components/kbd';
import { NgIcon } from '@ng-icons/core';

import { CommandPalette } from '../../../services/command-palette/command-palette.service';

/**
 * Component SearchButton
 *
 * @description
 * The « Rechercher… Ctrl K » field-like button of the sidebar header (mockup `App.dc.html` lines
 * 191-196), opening the command palette. It is a `sidebarHeader` slot contribution.
 */
@Component({
  selector: 'cw-search-button',
  imports: [CwKbd, NgIcon],
  template: `
    <button
      type="button"
      class="flex h-8 w-full items-center gap-2 rounded-lg border border-input px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
      aria-keyshortcuts="Control+K Meta+K"
      data-testid="search-button"
      (click)="palette.setOpen(true)"
    >
      <ng-icon name="phosphorMagnifyingGlassBold" aria-hidden="true" />
      <ng-container i18n="@@search.sidebar.label">Search…</ng-container>
      <span class="ml-auto inline-flex items-center gap-1" aria-hidden="true">
        <kbd cwKbd size="sm" i18n="@@search.key-ctrl">Ctrl</kbd>
        <kbd cwKbd size="sm">K</kbd>
      </span>
    </button>
  `,
})
export class SearchButton {
  // #region Properties
  /**
   * Property palette
   *
   * @description
   * Open state of the command palette.
   *
   * @type {CommandPalette}
   * @readonly
   */
  protected readonly palette: CommandPalette = inject(CommandPalette);
  // #endregion
}
