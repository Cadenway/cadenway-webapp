import { Component } from '@angular/core';
import { CwEmpty, CwEmptyHeader, CwEmptyMedia, CwEmptyTitle } from '@cadenway/ui/components/empty';
import { NgIcon } from '@ng-icons/core';

/**
 * Component AuditLogPage
 *
 * @description
 * Stub of the organization settings section `Audit log` (mockup `Organisation.dc.html` lines
 * 630-637): the centred `max-w-4xl` column of the organization settings with the section title, the
 * mockup's lead (`Sensitive actions of the last 90 days: …`) and an outlined state saying the
 * audit log is not available yet, with the section's clipboard icon. It reads no data yet (the
 * audit backend, B11, does not exist), so it never states that the history is empty: an empty
 * state belongs after a successful read only. It draws no table, no `Export (CSV)`, no loading and
 * no error state; package O6 of steps 7 and 8 replaces it.
 */
@Component({
  selector: 'cw-audit-log-page',
  imports: [CwEmpty, CwEmptyHeader, CwEmptyMedia, CwEmptyTitle, NgIcon],
  template: `
    <div class="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
      <header class="flex flex-col gap-1">
        <h1 class="text-2xl font-semibold tracking-tight" i18n="@@organization.audit-log.title">
          Audit log
        </h1>
        <p class="text-sm text-muted-foreground" i18n="@@organization.audit-log.lead">
          Sensitive actions of the last 90 days: sign-ins, roles, tokens, billing and settings.
        </p>
      </header>
      <cw-empty variant="outline" data-testid="audit-log-empty">
        <cw-empty-header>
          <cw-empty-media>
            <ng-icon name="phosphorClipboardTextBold" aria-hidden="true" />
          </cw-empty-media>
          <cw-empty-title i18n="@@organization.audit-log.unavailable"
            >The audit log is not available yet</cw-empty-title
          >
        </cw-empty-header>
      </cw-empty>
    </div>
  `,
})
export class AuditLogPage {}
