import { Component } from '@angular/core';

/**
 * Component DashboardPage
 *
 * @description
 * The team dashboard (mockup `App.dc.html` lines 1791-1892). This foundation renders its title
 * only, as the route focus target; the period, the statistics, the chart, the workload and the late
 * tasks come with its page package of step 6.
 */
@Component({
  selector: 'cw-dashboard-page',
  host: { class: 'flex min-h-0 flex-1 flex-col overflow-y-auto' },
  template: `
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <h1
        class="text-2xl font-semibold tracking-tight"
        data-route-focus
        i18n="@@dashboards.header.title"
      >
        Team dashboard
      </h1>
    </div>
  `,
})
export class DashboardPage {}
