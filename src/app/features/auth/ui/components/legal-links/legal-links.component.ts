import { Component, computed, input, type InputSignal, type Signal } from '@angular/core';

/**
 * Component LegalLinks
 *
 * @description
 * The footer links of the auth screens (`Main.dc.html`): Privacy, Terms of use and Help, on the
 * public site. With no `siteUrl` it renders nothing.
 */
@Component({
  selector: 'cw-legal-links',
  host: { class: 'contents' },
  template: `
    @if (links(); as site) {
      <a
        [href]="site.privacy"
        class="rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas focus-visible:outline-none"
        i18n="@@auth.layout.privacy"
        >Privacy</a
      >
      <a
        [href]="site.terms"
        class="rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas focus-visible:outline-none"
        i18n="@@auth.layout.terms"
        >Terms of use</a
      >
      <a
        [href]="site.help"
        class="rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas focus-visible:outline-none"
        i18n="@@auth.layout.help"
        >Help</a
      >
    }
  `,
})
export class LegalLinks {
  // #region Properties
  /**
   * Property siteUrl
   *
   * @description
   * Base URL of the public site, without a trailing slash, or null to hide the links.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly siteUrl: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property links
   *
   * @description
   * The three destinations on the public site, or null.
   *
   * @type {Signal<{ readonly privacy: string; readonly terms: string; readonly help: string } | null>}
   * @readonly
   */
  protected readonly links: Signal<{
    readonly privacy: string;
    readonly terms: string;
    readonly help: string;
  } | null> = computed(() => {
    const site: string | null = this.siteUrl();
    return site === null
      ? null
      : { privacy: `${site}/privacy`, terms: `${site}/terms`, help: `${site}/help` };
  });
  // #endregion
}
