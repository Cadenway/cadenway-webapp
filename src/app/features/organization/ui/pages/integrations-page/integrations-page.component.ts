import { Component } from '@angular/core';

/**
 * Component IntegrationsPage
 *
 * @description
 * Stub of the organization settings section `Integrations` (mockup `Organisation.dc.html` lines
 * 493-496): the centred `max-w-4xl` column of the organization settings with the section title and
 * an empty body. It reads no data yet, so it has no loading, error or empty state; package O6 of
 * steps 7 and 8 replaces it.
 */
@Component({
  selector: 'cw-integrations-page',
  template: `
    <div class="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
      <header class="flex flex-col gap-1">
        <h1 class="text-2xl font-semibold tracking-tight" i18n="@@organization.integrations.title">
          Integrations
        </h1>
      </header>
    </div>
  `,
})
export class IntegrationsPage {}
