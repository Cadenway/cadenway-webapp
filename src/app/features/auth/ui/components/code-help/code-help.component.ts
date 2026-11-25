import { Component, computed, input, type InputSignal, type Signal } from '@angular/core';

/**
 * Component CodeHelp
 *
 * @description
 * The line below the card of the code screens (`Otp.dc.html`): what to check when the code does
 * not arrive. « demandez à l'administrateur » links to the Help page of the public site at `siteUrl`;
 * without a site, the same sentence renders as plain text.
 */
@Component({
  selector: 'cw-code-help',
  template: `
    <p class="text-center text-xs text-muted-foreground">
      @if (helpUrl(); as url) {
        <span i18n="@@auth.code.help"
          >Code not arriving? Check your spam folder, or
          <a
            [href]="url"
            class="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas focus-visible:outline-none"
            >ask your administrator</a
          >
          to allow Cadenway's emails in your mail filter.</span
        >
      } @else {
        <span i18n="@@auth.code.help-plain"
          >Code not arriving? Check your spam folder, or ask your administrator to allow Cadenway's
          emails in your mail filter.</span
        >
      }
    </p>
  `,
})
export class CodeHelp {
  // #region Properties
  /**
   * Property siteUrl
   *
   * @description
   * Base URL of the public site, without a trailing slash, or null when none is configured.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly siteUrl: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property helpUrl
   *
   * @description
   * The Help page of the public site, or null without a site.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  protected readonly helpUrl: Signal<string | null> = computed(() => {
    const site: string | null = this.siteUrl();
    return site === null ? null : `${site}/help`;
  });
  // #endregion
}
