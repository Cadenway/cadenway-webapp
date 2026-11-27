import { Component } from '@angular/core';

/**
 * Component GoalsPage
 *
 * @description
 * The goals screen (mockup `App.dc.html` lines 1571-1637). This foundation renders its title only,
 * as the route focus target; the statistics, the goals, their key results and the forms come with
 * its page package of step 6.
 */
@Component({
  selector: 'cw-goals-page',
  host: { class: 'flex min-h-0 flex-1 flex-col overflow-y-auto' },
  template: `
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
      <h1
        class="text-2xl font-semibold tracking-tight"
        data-route-focus
        i18n="@@goals.header.title"
      >
        Goals
      </h1>
    </div>
  `,
})
export class GoalsPage {}
