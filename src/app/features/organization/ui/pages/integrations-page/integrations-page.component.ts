import { Component } from '@angular/core';
import { CwEmpty, CwEmptyHeader, CwEmptyMedia, CwEmptyTitle } from '@cadenway/ui/components/empty';
import { NgIcon } from '@ng-icons/core';

/**
 * Component IntegrationsPage
 *
 * @description
 * Stub of the organization settings section `Integrations` (mockup `Organisation.dc.html` lines
 * 493-497): the centred `max-w-4xl` column of the organization settings with the section title, the
 * mockup's lead (`Connect code to tasks: …`) and an outlined empty state, `No repository`, with the
 * section's plugs icon. It reads no data yet (the integration backend, B7, does not exist), so it
 * draws no provider card, no loading and no error state; package O6 of steps 7 and 8 replaces it.
 */
@Component({
  selector: 'cw-integrations-page',
  imports: [CwEmpty, CwEmptyHeader, CwEmptyMedia, CwEmptyTitle, NgIcon],
  template: `
    <div class="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
      <header class="flex flex-col gap-1">
        <h1 class="text-2xl font-semibold tracking-tight" i18n="@@organization.integrations.title">
          Integrations
        </h1>
        <p class="text-sm text-muted-foreground" i18n="@@organization.integrations.lead">
          Connect code to tasks: the branches, commits and pull requests that mention an identifier
          such as CAD-482 show in the task.
        </p>
      </header>
      <cw-empty variant="outline" data-testid="integrations-empty">
        <cw-empty-header>
          <cw-empty-media>
            <ng-icon name="phosphorPlugsConnectedBold" aria-hidden="true" />
          </cw-empty-media>
          <cw-empty-title i18n="@@organization.integrations.empty-title"
            >No repository</cw-empty-title
          >
        </cw-empty-header>
      </cw-empty>
    </div>
  `,
})
export class IntegrationsPage {}
