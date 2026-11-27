import { Component } from '@angular/core';

/**
 * Component PreferencesPage
 *
 * @description
 * Stub of the account settings section `Preferences` (mockup `Compte.dc.html` lines 405-408): the
 * centred `max-w-3xl` column of the account settings with the section title and an empty body. It
 * reads no data yet, so it has no loading, error or empty state; package A4 of steps 7 and 8
 * replaces it.
 */
@Component({
  selector: 'cw-preferences-page',
  template: `
    <div class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
      <header class="flex flex-col gap-1">
        <h1 class="text-2xl font-semibold tracking-tight" i18n="@@account.preferences.title">
          Preferences
        </h1>
      </header>
    </div>
  `,
})
export class PreferencesPage {}
