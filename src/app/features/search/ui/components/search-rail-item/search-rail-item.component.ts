import { Component, inject } from '@angular/core';
import { CwAppRailItem } from '@cadenway/ui/components/app-rail';

import { CommandPalette } from '../../../services/command-palette/command-palette.service';

/**
 * Component SearchRailItem
 *
 * @description
 * The « Rechercher » item of the rail footer (mockup `App.dc.html` lines 56-59): a magnifying
 * glass whose tooltip shows Ctrl K, opening the command palette. It stays in the phone tab bar. Its
 * host is `display: contents`, so the item joins the rail footer's layout.
 */
@Component({
  selector: 'cw-search-rail-item',
  imports: [CwAppRailItem],
  host: { class: 'contents' },
  template: `
    <button
      cwAppRailItem
      icon="phosphorMagnifyingGlassBold"
      [shortcut]="shortcut"
      aria-keyshortcuts="Control+K Meta+K"
      data-testid="search-rail-item"
      (click)="palette.setOpen(true)"
      i18n="@@search.rail.label"
    >
      Search
    </button>
  `,
})
export class SearchRailItem {
  // #region Properties
  /**
   * Property shortcut
   *
   * @description
   * Keys shown in the tooltip after the label.
   *
   * @type {readonly string[]}
   * @readonly
   */
  protected readonly shortcut: readonly string[] = [$localize`:@@search.key-ctrl:Ctrl`, 'K'];

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
