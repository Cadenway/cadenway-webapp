import { Component } from '@angular/core';

/**
 * Component DocsPage
 *
 * @description
 * The documents catalog (mockup `App.dc.html` lines 1895-1924). This foundation renders its title
 * only, as the route focus target; the search, `New document` and the table come with its page
 * package of step 6.
 */
@Component({
  selector: 'cw-docs-page',
  host: { class: 'flex min-h-0 flex-1 flex-col overflow-y-auto' },
  template: `
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 class="text-2xl font-semibold tracking-tight" data-route-focus i18n="@@docs.header.title">
        Documents
      </h1>
    </div>
  `,
})
export class DocsPage {}
