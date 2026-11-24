import { Component, computed, inject, type Signal } from '@angular/core';
import { CwAppRailItem } from '@cadenway/ui/components/app-rail';

import { ThemeService } from '@core/theme';

/**
 * Component ThemeRailItem
 *
 * @description
 * The theme button of the rail footer (mockup `App.dc.html` lines 60-64): a moon in light mode, a
 * sun in dark mode, named and titled after the theme it switches to, kept out of the phone tab
 * bar. It drives the app-wide `ThemeService`, whose transition spreads from the button's centre.
 * It is a slot contribution acting as a widget, so it injects the core service itself. Its host is
 * `display: contents`, so the item joins the rail footer's layout.
 */
@Component({
  selector: 'cw-theme-rail-item',
  imports: [CwAppRailItem],
  host: { class: 'contents' },
  template: `
    <button
      cwAppRailItem
      desktopOnly
      [icon]="dark() ? 'phosphorSunBold' : 'phosphorMoonBold'"
      data-testid="theme-rail-item"
      (click)="toggle($event)"
    >
      {{ label() }}
    </button>
  `,
})
export class ThemeRailItem {
  // #region Properties
  /**
   * Property theme
   *
   * @description
   * App-wide theme preference.
   *
   * @type {ThemeService}
   * @readonly
   */
  private readonly theme: ThemeService = inject(ThemeService);

  /**
   * Property dark
   *
   * @description
   * Whether the effective theme is dark.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly dark: Signal<boolean> = computed(() => this.theme.resolved() === 'dark');

  /**
   * Property label
   *
   * @description
   * Accessible name and tooltip: the theme the button switches to.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly label: Signal<string> = computed(() =>
    this.dark()
      ? $localize`:@@workspace.theme.to-light:Switch to the light theme`
      : $localize`:@@workspace.theme.to-dark:Switch to the dark theme`,
  );
  // #endregion

  // #region Methods
  /**
   * Method toggle
   *
   * @description
   * Switches the theme from the button's centre.
   *
   * @param {MouseEvent} event - The click.
   */
  protected toggle(event: MouseEvent): void {
    const target: EventTarget | null = event.currentTarget;
    if (!(target instanceof HTMLElement)) {
      this.theme.toggle();
      return;
    }
    const box: DOMRect = target.getBoundingClientRect();
    this.theme.toggle({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
  }
  // #endregion
}
