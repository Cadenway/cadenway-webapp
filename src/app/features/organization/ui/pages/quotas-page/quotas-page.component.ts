import { Component } from '@angular/core';

/**
 * Component QuotasPage
 *
 * @description
 * Stub of the organization settings section `Quotas and usage` (mockup `Organisation.dc.html` lines
 * 380-384): the centred `max-w-4xl` column of the organization settings with the section title and
 * an empty body. It reads no data yet, so it has no loading, error or empty state; package O4 of
 * steps 7 and 8 replaces it.
 */
@Component({
  selector: 'cw-quotas-page',
  template: `
    <div class="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
      <header class="flex flex-col gap-1">
        <h1 class="text-2xl font-semibold tracking-tight" i18n="@@organization.quotas.title">
          Quotas and usage
        </h1>
      </header>
    </div>
  `,
})
export class QuotasPage {}
