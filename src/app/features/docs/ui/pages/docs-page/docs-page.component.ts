import { DOCUMENT } from '@angular/common';
import {
  Component,
  DestroyRef,
  inject,
  input,
  type InputSignal,
  linkedSignal,
  signal,
  type WritableSignal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwInputGroup,
  CwInputGroupAddon,
  CwInputGroupInput,
} from '@cadenway/ui/components/input-group';
import { CwToastService } from '@cadenway/ui/components/toast';
import { NgIcon } from '@ng-icons/core';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import type {
  DocumentCreateOutcome,
  DocumentRow,
} from '../../../models/document/document.interface';
import { DocsStore } from '../../../state/docs/docs.store';
import { copyDocumentLink } from '../../../utils/document-link/document-link.util';
import { DocsSkeleton } from '../../components/docs-skeleton/docs-skeleton.component';
import { DocumentTable } from '../../components/document-table/document-table.component';
import { DocumentDeleteDialog } from '../../dialogs/document-delete-dialog/document-delete-dialog.component';

/**
 * Constant SEARCH_DELAY_MS
 *
 * @description
 * Pause in typing, in milliseconds, after which the search is applied to the address (`?q=`) and
 * read.
 *
 * @type {number}
 */
const SEARCH_DELAY_MS: number = 300;

/**
 * Component DocsPage
 *
 * @description
 * The documents catalog (mockup `App.dc.html` lines 1895-1924): the `Documents` header and its
 * subtitle, the search (full width below 640 px), `New document`, then `DocumentTable`. The page
 * skeleton shows during the first read; a failed read reaches the route's error boundary (the
 * unavailable state and its `Retry`) through the template's read of `rows`.
 *
 * The search is the address's `?q=`: typing writes it there after a 300 ms pause (replacing the
 * history entry), and the store reads the catalog for it on the server, keeping the last rows
 * shown meanwhile. The catalog is read again whenever the window regains focus (gap G-C4).
 *
 * `New document` shows only when the caller may edit a space, creates an `Untitled` document in
 * it (gap G-C3) and opens it in edit mode (`?mode=edit`). A row opens its document; its menu's
 * `Edit` opens it in edit mode, `Copy the link` copies its address with
 * `Document link copied`, and `Delete` asks `DocumentDeleteDialog` first (gap G-C1, no `Undo`).
 */
@Component({
  selector: 'cw-docs-page',
  imports: [
    CwButton,
    CwInputGroup,
    CwInputGroupAddon,
    CwInputGroupInput,
    DocsSkeleton,
    DocumentDeleteDialog,
    DocumentTable,
    NgIcon,
  ],
  providers: [DocsStore],
  host: {
    class: 'flex min-h-0 flex-1 flex-col overflow-y-auto',
    '(window:focus)': 'refresh()',
  },
  templateUrl: './docs-page.component.html',
})
export class DocsPage {
  // #region Properties
  /**
   * Property q
   *
   * @description
   * The search of the address (`?q=`).
   *
   * @type {InputSignal<string | undefined>}
   * @readonly
   */
  public readonly q: InputSignal<string | undefined> = input<string | undefined>();

  /**
   * Property store
   *
   * @description
   * The catalog, its creation and its deletions.
   *
   * @type {InstanceType<typeof DocsStore>}
   * @readonly
   */
  protected readonly store: InstanceType<typeof DocsStore> = inject(DocsStore);

  /**
   * Property searchText
   *
   * @description
   * The search field's text: the address's search, or what is typed until it is applied.
   *
   * @type {WritableSignal<string>}
   * @readonly
   */
  protected readonly searchText: WritableSignal<string> = linkedSignal(
    (): string => this.q() ?? '',
  );

  /**
   * Property deleteOpen
   *
   * @description
   * Whether the delete confirmation is open.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly deleteOpen: WritableSignal<boolean> = signal(false);

  /**
   * Property deleteTarget
   *
   * @description
   * The row the delete confirmation names; kept after it closes so its exit animation keeps the
   * text.
   *
   * @type {WritableSignal<DocumentRow | null>}
   * @readonly
   */
  protected readonly deleteTarget: WritableSignal<DocumentRow | null> = signal(null);

  /**
   * Property workspace
   *
   * @description
   * The organization, whose slug starts the documents' addresses.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  private readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property router
   *
   * @description
   * Opens the documents and writes the search to the address.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property route
   *
   * @description
   * The catalog's route, which the search's address is relative to.
   *
   * @type {ActivatedRoute}
   * @readonly
   */
  private readonly route: ActivatedRoute = inject(ActivatedRoute);

  /**
   * Property toasts
   *
   * @description
   * The shell's toaster.
   *
   * @type {CwToastService}
   * @readonly
   */
  private readonly toasts: CwToastService = inject(CwToastService);

  /**
   * Property document
   *
   * @description
   * Document whose window holds the clipboard and the origin of the links.
   *
   * @type {Document}
   * @readonly
   */
  private readonly document: Document = inject(DOCUMENT);

  /**
   * Property searchTimer
   *
   * @description
   * The pending application of the typed search, or null.
   *
   * @type {ReturnType<typeof setTimeout> | null}
   */
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Makes the store follow the address's search, and drops a pending search with the page.
   *
   * @constructor
   */
  public constructor() {
    this.store.followQuery(this.q);
    inject(DestroyRef).onDestroy((): void => {
      if (this.searchTimer !== null) clearTimeout(this.searchTimer);
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method refresh
   *
   * @description
   * Reads the catalog again when the window regains focus.
   */
  protected refresh(): void {
    void this.store.refresh();
  }

  /**
   * Method search
   *
   * @description
   * Shows what is typed and applies it to the address after a pause in typing.
   *
   * @param {Event} event - The field's input event.
   */
  protected search(event: Event): void {
    const text: string = (event.target as HTMLInputElement).value;
    this.searchText.set(text);
    if (this.searchTimer !== null) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout((): void => {
      this.searchTimer = null;
      const query: string = text.trim();
      if (query === (this.q() ?? '').trim()) return;
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { q: query === '' ? null : query },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }, SEARCH_DELAY_MS);
  }

  /**
   * Method create
   *
   * @description
   * `New document`: creates it, then opens it in edit mode.
   *
   * @returns {Promise<void>} Resolves once settled.
   */
  protected async create(): Promise<void> {
    const outcome: DocumentCreateOutcome = await this.store.create();
    if (outcome.kind === 'created') await this.navigateTo(outcome.id, true);
  }

  /**
   * Method open
   *
   * @description
   * Opens a row's document.
   *
   * @param {DocumentRow} row - The row.
   * @returns {Promise<void>} Resolves once navigated.
   */
  protected async open(row: DocumentRow): Promise<void> {
    await this.navigateTo(row.document.id, false);
  }

  /**
   * Method edit
   *
   * @description
   * Opens a row's document in edit mode.
   *
   * @param {DocumentRow} row - The row.
   * @returns {Promise<void>} Resolves once navigated.
   */
  protected async edit(row: DocumentRow): Promise<void> {
    await this.navigateTo(row.document.id, true);
  }

  /**
   * Method copyLink
   *
   * @description
   * Copies a row's document address.
   *
   * @param {DocumentRow} row - The row.
   * @returns {Promise<void>} Resolves once the clipboard answered.
   */
  protected async copyLink(row: DocumentRow): Promise<void> {
    await copyDocumentLink(
      this.document,
      this.workspace.organization().slug,
      row.document.id,
      this.toasts,
    );
  }

  /**
   * Method askDelete
   *
   * @description
   * Opens the delete confirmation for a row.
   *
   * @param {DocumentRow} row - The row.
   */
  protected askDelete(row: DocumentRow): void {
    this.deleteTarget.set(row);
    this.deleteOpen.set(true);
  }

  /**
   * Method confirmDelete
   *
   * @description
   * Deletes the confirmed row's document, then closes the confirmation, whatever the gateway
   * answered (the store's toast says which).
   *
   * @returns {Promise<void>} Resolves once settled.
   */
  protected async confirmDelete(): Promise<void> {
    const row: DocumentRow | null = this.deleteTarget();
    if (row === null) return;
    await this.store.remove(row);
    this.deleteOpen.set(false);
  }

  /**
   * Method navigateTo
   *
   * @description
   * Opens a document of the organization, in edit mode or not.
   *
   * @param {string} id - The document.
   * @param {boolean} editing - Whether to open it in edit mode.
   * @returns {Promise<void>} Resolves once navigated.
   */
  private async navigateTo(id: string, editing: boolean): Promise<void> {
    await this.router.navigate(
      ['/', this.workspace.organization().slug, 'd', id],
      editing ? { queryParams: { mode: 'edit' } } : {},
    );
  }
  // #endregion
}
