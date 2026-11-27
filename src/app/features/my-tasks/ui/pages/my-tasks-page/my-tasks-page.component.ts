import { Component } from '@angular/core';

/**
 * Component MyTasksPage
 *
 * @description
 * The `My tasks` screen (mockup `App.dc.html` lines 1749-1789). This foundation renders its title
 * only, as the route focus target; the tabs, the groups and the task rows come with its page
 * package of step 6.
 */
@Component({
  selector: 'cw-my-tasks-page',
  host: { class: 'flex min-h-0 flex-1 flex-col overflow-y-auto' },
  template: `
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
      <h1
        class="text-2xl font-semibold tracking-tight"
        data-route-focus
        i18n="@@my-tasks.header.title"
      >
        My tasks
      </h1>
    </div>
  `,
})
export class MyTasksPage {}
