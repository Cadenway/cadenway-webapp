import { Component } from '@angular/core';

/**
 * Component ArchivesPage
 *
 * @description
 * The archives screen (mockup `App.dc.html` lines 1999-2022). This foundation renders its title
 * only, as the route focus target; the tabs, the archived lists and tasks and `Restore` come with
 * its page package of step 6.
 */
@Component({
  selector: 'cw-archives-page',
  host: { class: 'flex min-h-0 flex-1 flex-col overflow-y-auto' },
  template: `
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
      <h1
        class="text-2xl font-semibold tracking-tight"
        data-route-focus
        i18n="@@archives.header.title"
      >
        Archives
      </h1>
    </div>
  `,
})
export class ArchivesPage {}
