import { Component, inject } from '@angular/core';
import { CwAppRailItem } from '@cadenway/ui/components/app-rail';

import { CommandPalette } from '../../../services/command-palette/command-palette.service';

/**
 * Component SearchRailItem
 *
 * @description
 * The « Rechercher » item of the rail footer (mockup `App.dc.html` lines 55-58): a magnifying
 * glass named « Rechercher (Ctrl K) » whose tooltip reads « Rechercher · Ctrl K », opening the
 * command palette. It stays in the phone tab bar. Its
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
      [tooltip]="tooltip"
      aria-keyshortcuts="Control+K Meta+K"
      data-testid="search-rail-item"
      (click)="palette.setOpen(true)"
      i18n="@@search.rail.label"
    >
      Search (Ctrl K)
    </button>
  `,
})
export class SearchRailItem {
  // #region Properties
  /**
   * Property tooltip
   *
   * @description
   * Tooltip of the item, the label and its shortcut on one line.
   *
   * @type {string}
   * @readonly
   */
  protected readonly tooltip: string = $localize`:@@search.rail.tooltip:Search · Ctrl K`;

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
