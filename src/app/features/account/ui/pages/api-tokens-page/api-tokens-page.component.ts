import { DOCUMENT, formatDate } from '@angular/common';
import {
  Component,
  computed,
  inject,
  LOCALE_ID,
  type Signal,
  signal,
  type WritableSignal,
} from '@angular/core';
import {
  CwAlertDialog,
  CwAlertDialogAction,
  CwAlertDialogCancel,
  CwAlertDialogDescription,
  CwAlertDialogMedia,
  CwAlertDialogTitle,
  provideCwAlertDialogLabels,
} from '@cadenway/ui/components/alert-dialog';
import { CwBadge } from '@cadenway/ui/components/badge';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwEmpty,
  CwEmptyContent,
  CwEmptyDescription,
  CwEmptyHeader,
  CwEmptyMedia,
  CwEmptyTitle,
} from '@cadenway/ui/components/empty';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import {
  CwTable,
  CwTableBody,
  CwTableCell,
  CwTableContainer,
  CwTableHead,
  CwTableHeader,
  CwTableRow,
} from '@cadenway/ui/components/table';
import { CwToastService } from '@cadenway/ui/components/toast';
import { NgIcon } from '@ng-icons/core';

import type {
  ApiToken,
  ApiTokenDraft,
  ApiTokenExpiry,
  ApiTokenLastUse,
} from '../../../models/api-token/api-token.interface';
import { ApiTokensStore } from '../../../state/api-tokens/api-tokens.store';
import { TokenCreateDialog } from '../../dialogs/token-create-dialog/token-create-dialog.component';

/**
 * Component ApiTokensPage
 *
 * @description
 * The account settings section `API tokens` (`Compte.dc.html` lines 527-569): the header with
 * `Create a token`, then the table of the person's active tokens in the current organization
 * (name and prefix, scopes, last use, expiry in grenat within 7 days, `Revoke`), or `No active
 * token` with its own `Create a token`. The section skeleton shows during the first read; a failed
 * read reaches the route's error boundary through the template's read of the resource, whose
 * `Retry` runs the route again. Below 768 px the table becomes cards (the mockup's `.cw-cards`
 * rule): no header row, the name on its own line, `Revoke` pushed to the end. The mockup's API
 * usage strip waits for the call counters of billing (gap B15) and is left out. `Create a token`
 * opens `TokenCreateDialog`; the store creates through the reauthentication service and the
 * dialog then shows the secret once; closing the dialog forgets the secret. `Copy the token`
 * confirms with `Token copied`, or `Copy failed` when the clipboard refuses. `Revoke` asks
 * through `cw-alert-dialog`, typing the token's name, and its button spins while the gateway
 * answers.
 */
@Component({
  selector: 'cw-api-tokens-page',
  imports: [
    CwAlertDialog,
    CwAlertDialogAction,
    CwAlertDialogCancel,
    CwAlertDialogDescription,
    CwAlertDialogMedia,
    CwAlertDialogTitle,
    CwBadge,
    CwButton,
    CwEmpty,
    CwEmptyContent,
    CwEmptyDescription,
    CwEmptyHeader,
    CwEmptyMedia,
    CwEmptyTitle,
    CwSkeleton,
    CwTable,
    CwTableBody,
    CwTableCell,
    CwTableContainer,
    CwTableHead,
    CwTableHeader,
    CwTableRow,
    NgIcon,
    TokenCreateDialog,
  ],
  providers: [
    ApiTokensStore,
    provideCwAlertDialogLabels(() => ({
      confirm: $localize`:@@account.api-tokens.revoke-confirm-label:To confirm, type`,
    })),
  ],
  templateUrl: './api-tokens-page.component.html',
})
export class ApiTokensPage {
  // #region Properties
  /**
   * Property store
   *
   * @description
   * The tokens, their creation and their revocation.
   *
   * @type {InstanceType<typeof ApiTokensStore>}
   * @readonly
   */
  protected readonly store: InstanceType<typeof ApiTokensStore> = inject(ApiTokensStore);

  /**
   * Property toasts
   *
   * @description
   * The settings shell's toaster.
   *
   * @type {CwToastService}
   * @readonly
   */
  private readonly toasts: CwToastService = inject(CwToastService);

  /**
   * Property document
   *
   * @description
   * Document whose window holds the clipboard.
   *
   * @type {Document}
   * @readonly
   */
  private readonly document: Document = inject(DOCUMENT);

  /**
   * Property locale
   *
   * @description
   * Application locale of the dates.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);

  /**
   * Property createOpen
   *
   * @description
   * Whether the create dialog is open.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly createOpen: WritableSignal<boolean> = signal(false);

  /**
   * Property revokeOpen
   *
   * @description
   * Whether the revoke confirmation is open.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly revokeOpen: WritableSignal<boolean> = signal(false);

  /**
   * Property revokeTarget
   *
   * @description
   * The token the revoke confirmation names; kept after it closes so its exit animation keeps
   * the text.
   *
   * @type {WritableSignal<ApiToken | null>}
   * @readonly
   */
  protected readonly revokeTarget: WritableSignal<ApiToken | null> = signal(null);

  /**
   * Property revoking
   *
   * @description
   * Whether the revocation of the confirmed token is waiting for the gateway.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly revoking: Signal<boolean> = computed(
    (): boolean => this.store.revokingId() !== null,
  );
  // #endregion

  // #region Methods
  /**
   * Method openCreate
   *
   * @description
   * `Create a token`: opens the create dialog on its form.
   */
  protected openCreate(): void {
    this.store.dismissSecret();
    this.createOpen.set(true);
  }

  /**
   * Method create
   *
   * @description
   * Sends the dialog's draft; the dialog shows the secret once the store holds it.
   *
   * @param {ApiTokenDraft} draft - The draft.
   * @returns {Promise<void>} Resolves once settled.
   */
  protected create(draft: ApiTokenDraft): Promise<void> {
    return this.store.create(draft);
  }

  /**
   * Method closeCreate
   *
   * @description
   * Closes the create dialog and forgets the secret it showed.
   */
  protected closeCreate(): void {
    this.createOpen.set(false);
    this.store.dismissSecret();
  }

  /**
   * Method copySecret
   *
   * @description
   * `Copy the token`: writes the secret to the clipboard and confirms it, or says the copy failed
   * so the person selects it by hand. The toasts never contain the secret.
   *
   * @returns {Promise<void>} Resolves once the clipboard answered.
   */
  protected async copySecret(): Promise<void> {
    const secret: string | null = this.store.secret();
    if (secret === null) return;
    try {
      const clipboard: Clipboard | undefined = this.document.defaultView?.navigator.clipboard;
      if (clipboard === undefined) throw new Error('The clipboard is unavailable.');
      await clipboard.writeText(secret);
      this.toasts.success($localize`:@@account.api-tokens.copied:Token copied`, {
        description: $localize`:@@account.api-tokens.copied-text:It will not be shown again.`,
      });
    } catch {
      this.toasts.error($localize`:@@account.api-tokens.copy-failed:Copy failed`, {
        description: $localize`:@@account.api-tokens.copy-failed-text:Select the text, then copy it with Ctrl C.`,
      });
    }
  }

  /**
   * Method askRevoke
   *
   * @description
   * `Revoke`: opens the confirmation for a token.
   *
   * @param {ApiToken} token - The token.
   */
  protected askRevoke(token: ApiToken): void {
    this.revokeTarget.set(token);
    this.revokeOpen.set(true);
  }

  /**
   * Method confirmRevoke
   *
   * @description
   * Revokes the confirmed token, then closes the confirmation, whatever the gateway answered (the
   * store's toast says which).
   *
   * @returns {Promise<void>} Resolves once settled.
   */
  protected async confirmRevoke(): Promise<void> {
    const token: ApiToken | null = this.revokeTarget();
    if (token === null) return;
    await this.store.revoke(token);
    this.revokeOpen.set(false);
  }

  /**
   * Method revokeTitle
   *
   * @description
   * Title of the revoke confirmation.
   *
   * @param {ApiToken} token - The token.
   * @returns {string} The title.
   */
  protected revokeTitle(token: ApiToken): string {
    return $localize`:@@account.api-tokens.revoke-title:Revoke the token “${token.name}:name:”?`;
  }

  /**
   * Method revokeLabel
   *
   * @description
   * Accessible name of a row's `Revoke` button, which names the token.
   *
   * @param {ApiToken} token - The token.
   * @returns {string} The name.
   */
  protected revokeLabel(token: ApiToken): string {
    return $localize`:@@account.api-tokens.revoke-label:Revoke the token “${token.name}:name:”`;
  }

  /**
   * Method countOf
   *
   * @description
   * The count of a last use or an expiry worded in minutes, hours or days; 0 otherwise.
   *
   * @param {ApiTokenLastUse | ApiTokenExpiry} moment - The last use or the expiry.
   * @returns {number} The count.
   */
  protected countOf(moment: ApiTokenLastUse | ApiTokenExpiry): number {
    return 'count' in moment ? moment.count : 0;
  }

  /**
   * Method dateLabel
   *
   * @description
   * The date of a last use or an expiry worded as a date, in the application locale
   * (`Jan 12, 2027`); empty otherwise.
   *
   * @param {ApiTokenLastUse | ApiTokenExpiry} moment - The last use or the expiry.
   * @returns {string} The label.
   */
  protected dateLabel(moment: ApiTokenLastUse | ApiTokenExpiry): string {
    return 'date' in moment ? formatDate(moment.date, 'mediumDate', this.locale) : '';
  }
  // #endregion
}
