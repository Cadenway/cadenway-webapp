import { DOCUMENT } from '@angular/common';
import { Component, inject } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

/**
 * Component HostName
 *
 * @description
 * The address of the application in the header of the auth screens (`Main.dc.html`): a globe and
 * the host the page was opened from (`location.host`), so a person can check where they type their
 * password. Hidden below the `sm` breakpoint. It is a layout slot contribution, not a page
 * component, so it reads the document location itself.
 */
@Component({
  selector: 'cw-host-name',
  imports: [NgIcon],
  host: { class: 'hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex' },
  template: `<ng-icon name="phosphorGlobeSimpleBold" class="size-3.5" aria-hidden="true" />{{
      host
    }}`,
})
export class HostName {
  // #region Properties
  /**
   * Property host
   *
   * @description
   * Host name and port of the current page.
   *
   * @type {string}
   * @readonly
   */
  protected readonly host: string = inject(DOCUMENT).location.host;
  // #endregion
}
