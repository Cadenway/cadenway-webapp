import { Dialog, type DialogRef } from '@angular/cdk/dialog';
import { DOCUMENT, formatDate } from '@angular/common';
import {
  Component,
  computed,
  ElementRef,
  inject,
  LOCALE_ID,
  type Signal,
  signal,
  viewChild,
  viewChildren,
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
import { take } from 'rxjs';

import { type UnsavedChanges, warnBeforeUnload } from '@shared/unsaved-changes';

import type {
  ApiToken,
  ApiTokenCreateOutcome,
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
 * dialog then shows the secret once; the secret step stays on screen while the dialog leaves and
 * the secret is forgotten once it left. `Copy the token` confirms with `Token copied`, or `Copy
 * failed` when the clipboard refuses. `Revoke` asks through `cw-alert-dialog`, typing the token's
 * name, and its button spins while the gateway answers; once a revoked row left and the
 * confirmation closed, focus moves to the `Revoke` of the row that took its place (or the one
 * before it), or to the header's `Create a token` when no token is left. The table carries
 * explicit table, row, column header and cell roles, which its card layout would otherwise lose;
 * below 768 px its header row stays for screen readers only. A creation whose answer was lost
 * highlights the token it may have made and closes the dialog. Leaving the page waits for a
 * creation in progress (`unsavedChangesGuard`): once it settles the person leaves, unless it
 * brought a secret, which keeps the page with its dialog until `I have copied the token`; the
 * browser asks before closing the tab meanwhile.
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
export class ApiTokensPage implements UnsavedChanges {
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

  /**
   * Property dialogs
   *
   * @description
   * The CDK dialogs under `cw-alert-dialog`, watched to learn when the revoke confirmation has
   * closed and given focus back, since the brick reports no such moment.
   *
   * @type {Dialog}
   * @readonly
   */
  private readonly dialogs: Dialog = inject(Dialog);

  /**
   * Property revokeRef
   *
   * @description
   * The open revoke confirmation, or null.
   *
   * @type {DialogRef | null}
   */
  private revokeRef: DialogRef | null = null;

  /**
   * Property createButton
   *
   * @description
   * The header's `Create a token`, which takes focus when the last token is revoked.
   *
   * @type {Signal<ElementRef<HTMLButtonElement> | undefined>}
   * @readonly
   */
  private readonly createButton: Signal<ElementRef<HTMLButtonElement> | undefined> = viewChild(
    'createButton',
    { read: ElementRef },
  );

  /**
   * Property revokeButtons
   *
   * @description
   * The rows' `Revoke` buttons, in the list's order.
   *
   * @type {Signal<readonly ElementRef<HTMLButtonElement>[]>}
   * @readonly
   */
  private readonly revokeButtons: Signal<readonly ElementRef<HTMLButtonElement>[]> = viewChildren(
    'revokeButton',
    { read: ElementRef },
  );

  /**
   * Property creation
   *
   * @description
   * The creation in progress, which leaving the page waits for, or null.
   *
   * @type {Promise<ApiTokenCreateOutcome> | null}
   */
  private creation: Promise<ApiTokenCreateOutcome> | null = null;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Asks the browser to confirm closing the tab while a creation runs or its secret shows.
   *
   * @constructor
   */
  public constructor() {
    warnBeforeUnload((): boolean => this.hasUnsavedChanges());
  }
  // #endregion

  // #region Methods
  /**
   * Method hasUnsavedChanges
   *
   * @description
   * Whether leaving now would lose a one-time result: a creation in progress, or the secret it
   * brought.
   *
   * @returns {boolean} Whether to hold the navigation.
   */
  public hasUnsavedChanges(): boolean {
    return this.store.creating() || this.store.secret() !== null;
  }

  /**
   * Method confirmDiscard
   *
   * @description
   * Waits for the creation in progress, then lets the person leave unless a secret now shows,
   * which keeps the page and its dialog so the secret is not lost.
   *
   * @returns {Promise<boolean>} Whether to leave.
   */
  public async confirmDiscard(): Promise<boolean> {
    if (this.creation !== null) await this.creation;
    return this.store.secret() === null;
  }

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
   * Sends the dialog's draft; the dialog shows the secret once the store holds it. When the
   * answer was lost but the token exists, the dialog closes onto its highlighted row.
   *
   * @param {ApiTokenDraft} draft - The draft.
   * @returns {Promise<void>} Resolves once settled.
   */
  protected async create(draft: ApiTokenDraft): Promise<void> {
    const creation: Promise<ApiTokenCreateOutcome> = this.store.create(draft);
    this.creation = creation;
    try {
      if ((await creation) === 'orphaned') this.createOpen.set(false);
    } finally {
      if (this.creation === creation) this.creation = null;
    }
  }

  /**
   * Method closeCreate
   *
   * @description
   * Closes the create dialog; the secret stays until it has left the screen.
   */
  protected closeCreate(): void {
    this.createOpen.set(false);
  }

  /**
   * Method forgetSecret
   *
   * @description
   * Forgets the secret once the closed create dialog left the screen.
   */
  protected forgetSecret(): void {
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
    this.revokeRef = null;
    this.dialogs.afterOpened.pipe(take(1)).subscribe((ref: DialogRef): void => {
      this.revokeRef = ref;
    });
    this.revokeOpen.set(true);
  }

  /**
   * Method confirmRevoke
   *
   * @description
   * Revokes the confirmed token, then closes the confirmation, whatever the gateway answered (the
   * store's toast says which). When the row left, focus moves on once the confirmation closed.
   *
   * @returns {Promise<void>} Resolves once settled.
   */
  protected async confirmRevoke(): Promise<void> {
    const token: ApiToken | null = this.revokeTarget();
    if (token === null) return;
    const index: number = (this.store.list() ?? []).findIndex(
      (item: ApiToken): boolean => item.id === token.id,
    );
    const removed: boolean = await this.store.revoke(token);
    const ref: DialogRef | null = this.revokeRef;
    if (removed && ref !== null)
      ref.closed.pipe(take(1)).subscribe((): void => {
        this.focusAfterRevoke(index);
      });
    this.revokeOpen.set(false);
  }

  /**
   * Method focusAfterRevoke
   *
   * @description
   * Gives focus to the `Revoke` now at the revoked row's place, or the one before it, or the
   * header's `Create a token` when no row is left.
   *
   * @param {number} index - Where the revoked row was.
   */
  private focusAfterRevoke(index: number): void {
    const buttons: readonly ElementRef<HTMLButtonElement>[] = this.revokeButtons();
    const target: ElementRef<HTMLButtonElement> | undefined =
      buttons.length > 0
        ? buttons[Math.min(Math.max(index, 0), buttons.length - 1)]
        : this.createButton();
    target?.nativeElement.focus();
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
