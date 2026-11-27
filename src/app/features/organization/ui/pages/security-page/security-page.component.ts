import { Component } from '@angular/core';

/**
 * Component SecurityPage
 *
 * @description
 * Stub of the organization settings section `Security and SSO` (mockup `Organisation.dc.html` lines
 * 437-440): the centred `max-w-4xl` column of the organization settings with the section title and
 * an empty body. It reads no data yet, so it has no loading, error or empty state; package O5 of
 * steps 7 and 8 replaces it.
 */
@Component({
  selector: 'cw-organization-security-page',
  template: `
    <div class="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
      <header class="flex flex-col gap-1">
        <h1 class="text-2xl font-semibold tracking-tight" i18n="@@organization.security.title">
          Security and SSO
        </h1>
      </header>
    </div>
  `,
})
export class SecurityPage {}
