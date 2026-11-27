import { Component } from '@angular/core';

/**
 * Component DocumentPage
 *
 * @description
 * A document at its shareable address (mockup `App.dc.html` lines 1925-1959). This foundation
 * renders a fallback title only, as the route focus target; the reader, the editor and the document
 * title come with the documents page package of step 6.
 */
@Component({
  selector: 'cw-document-page',
  host: { class: 'flex min-h-0 flex-1 flex-col overflow-y-auto' },
  template: `
    <div class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
      <h1
        class="text-3xl font-semibold tracking-tight"
        data-route-focus
        i18n="@@docs.document.title-fallback"
      >
        Document
      </h1>
    </div>
  `,
})
export class DocumentPage {}
