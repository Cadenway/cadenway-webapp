import { Component, computed, inject, type Signal } from '@angular/core';
import { CwButton } from '@cadenway/ui/components/button';
import { NgIcon } from '@ng-icons/core';

import { ThemeService } from '@core/theme';

/**
 * Component ThemeToggle
 *
 * @description
 * The header's theme button of the auth screens (`Main.dc.html`): a moon in light mode, a sun in
 * dark mode, named after the theme it switches to. It drives the app-wide `ThemeService`, whose
 * transition spreads from the button's centre. It is a layout slot contribution, not a page
 * component, so it injects the core service itself.
 */
@Component({
  selector: 'cw-theme-toggle',
  imports: [CwButton, NgIcon],
  template: `
    <button
      cwButton
      type="button"
      variant="ghost"
      size="icon"
      class="text-muted-foreground"
      [attr.aria-label]="label()"
      (click)="toggle($event)"
    >
      <ng-icon [name]="dark() ? 'phosphorSunBold' : 'phosphorMoonBold'" aria-hidden="true" />
    </button>
  `,
})
export class ThemeToggle {
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
   * Accessible name: the theme the button switches to.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly label: Signal<string> = computed(() =>
    this.dark()
      ? $localize`:@@auth.layout.theme-light:Switch to the light theme`
      : $localize`:@@auth.layout.theme-dark:Switch to the dark theme`,
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
    if (target instanceof HTMLElement) {
      const box: DOMRect = target.getBoundingClientRect();
      this.theme.toggle({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
    } else {
      this.theme.toggle();
    }
  }
  // #endregion
}
