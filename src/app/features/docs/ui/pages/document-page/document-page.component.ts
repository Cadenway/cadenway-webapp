import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  type InputSignal,
  LOCALE_ID,
  type Signal,
  signal,
  viewChild,
  type WritableSignal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  type FieldTree,
  form,
  FormField,
  maxLength,
  type SchemaPathTree,
} from '@angular/forms/signals';
import { Title } from '@angular/platform-browser';
import { type Event as RouterEvent, NavigationEnd, Router, RouterLink } from '@angular/router';
import {
  CwAlertDialog,
  CwAlertDialogAction,
  CwAlertDialogCancel,
  CwAlertDialogDescription,
  CwAlertDialogTitle,
} from '@cadenway/ui/components/alert-dialog';
import { CwBlockEditor } from '@cadenway/ui/components/block-editor';
import { CwButton } from '@cadenway/ui/components/button';
import { CwEmpty, CwEmptyDescription, CwEmptyHeader } from '@cadenway/ui/components/empty';
import { CwMarkdown } from '@cadenway/ui/components/markdown';
import { CwToastService } from '@cadenway/ui/components/toast';
import { NgIcon } from '@ng-icons/core';
import { filter, map } from 'rxjs';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';
import { type UnsavedChanges, warnBeforeUnload } from '@shared/unsaved-changes';

import {
  normalizedTitle,
  TITLE_MAX_LENGTH,
  untitledTitle,
} from '../../../constants/document-titles/document-titles.constants';
import type {
  DocumentDeleteOutcome,
  DocumentDetail,
  DocumentDraft,
  DocumentSaveOutcome,
} from '../../../models/document/document.interface';
import { DocumentStore } from '../../../state/document/document.store';
import { copyDocumentLink } from '../../../utils/document-link/document-link.util';
import { updatedLabel } from '../../../utils/updated-label/updated-label.util';
import { DocsSkeleton } from '../../components/docs-skeleton/docs-skeleton.component';
import { DocumentDeleteDialog } from '../../dialogs/document-delete-dialog/document-delete-dialog.component';

/**
 * Component DocumentPage
 *
 * @description
 * A document at its shareable address (mockup `App.dc.html` lines 1925-1959, `max-w-3xl`): the
 * `Documents` link back to the catalog, then the document in read mode or, for a caller who may
 * edit its space (gap G-C2), in edit mode. The page skeleton shows during the read; a missing
 * document renders the not found page and any other failure the unavailable state, through the
 * route's error boundary and the template's read of `current`. The document's title is the
 * page's title.
 *
 * Read mode: `Copy the document link` (`Document link copied`), and for an editor `Delete`, which
 * asks `DocumentDeleteDialog` and goes back to the catalog once deleted (gap G-C1, no `Undo`), and
 * `Edit`. The article shows the title, `<space> · Modified <when> by <author>` and the body
 * through `cw-markdown`, whose links open in a new tab and whose checkboxes are not clickable
 * (gap G-C5); an empty body shows the mockup's dashed line. The document is read again when the
 * window regains focus (gap G-C4), never while it is edited.
 *
 * Edit mode (`Edit`, or `?mode=edit` when the caller may edit): the title field (`Untitled` as
 * placeholder, Enter moves to the body; a never edited `Untitled` document starts empty),
 * `<space> · editing in progress`, the block editor with its toolbar, and `Add a block at the
 * end`. The draft is a Signal Forms model. `Cancel` drops it; `Done` saves it (an empty title
 * saves as `Untitled`) and goes back to read mode once the stored document is the draft. Every
 * other outcome keeps the draft in edit mode, the store's toast saying why. Focus moves to the
 * title field on entering edit mode and to `Edit` on leaving it.
 *
 * Leaving the page (`unsavedChangesGuard`) while the draft differs from the stored document or a
 * save is under way asks `Leave without saving?`; the browser asks before closing the tab
 * meanwhile.
 */
@Component({
  selector: 'cw-document-page',
  imports: [
    CwAlertDialog,
    CwAlertDialogAction,
    CwAlertDialogCancel,
    CwAlertDialogDescription,
    CwAlertDialogTitle,
    CwBlockEditor,
    CwButton,
    CwEmpty,
    CwEmptyDescription,
    CwEmptyHeader,
    CwMarkdown,
    DocsSkeleton,
    DocumentDeleteDialog,
    FormField,
    NgIcon,
    RouterLink,
  ],
  providers: [DocumentStore],
  host: {
    class: 'flex min-h-0 flex-1 flex-col overflow-y-auto',
    '(window:focus)': 'refresh()',
  },
  templateUrl: './document-page.component.html',
})
export class DocumentPage implements UnsavedChanges {
  // #region Properties
  /**
   * Property docId
   *
   * @description
   * The document of the address (`:docId`).
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly docId: InputSignal<string> = input.required<string>();

  /**
   * Property mode
   *
   * @description
   * The address's `?mode=`; `edit` opens the document in edit mode for a caller who may edit it.
   *
   * @type {InputSignal<string | undefined>}
   * @readonly
   */
  public readonly mode: InputSignal<string | undefined> = input<string | undefined>();

  /**
   * Property store
   *
   * @description
   * The document, its rights, its save and its deletion.
   *
   * @type {InstanceType<typeof DocumentStore>}
   * @readonly
   */
  protected readonly store: InstanceType<typeof DocumentStore> = inject(DocumentStore);

  /**
   * Property editing
   *
   * @description
   * Whether the document shows in edit mode.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly editing: WritableSignal<boolean> = signal(false);

  /**
   * Property draft
   *
   * @description
   * The edit mode's draft, the model of `draftForm`.
   *
   * @type {WritableSignal<DocumentDraft>}
   * @readonly
   */
  protected readonly draft: WritableSignal<DocumentDraft> = signal<DocumentDraft>({
    title: '',
    body: '',
  });

  /**
   * Property draftForm
   *
   * @description
   * The title field and the block editor, bound to `draft`; the title takes at most the
   * contract's 200 characters.
   *
   * @type {FieldTree<DocumentDraft>}
   * @readonly
   */
  protected readonly draftForm: FieldTree<DocumentDraft> = form(
    this.draft,
    (fields: SchemaPathTree<DocumentDraft>): void => {
      maxLength(fields.title, TITLE_MAX_LENGTH);
    },
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
   * Property discardOpen
   *
   * @description
   * Whether `Leave without saving?` is open.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly discardOpen: WritableSignal<boolean> = signal(false);

  /**
   * Property shown
   *
   * @description
   * The stored document, or undefined while read or after a failed read; unlike the store's
   * `current`, reading it never throws.
   *
   * @type {Signal<DocumentDetail | undefined>}
   * @readonly
   */
  protected readonly shown: Signal<DocumentDetail | undefined> = computed(
    (): DocumentDetail | undefined =>
      this.store.document.hasValue() ? this.store.document.value() : undefined,
  );

  /**
   * Property spaceName
   *
   * @description
   * Name of the document's space, or `—` while unknown.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly spaceName: Signal<string> = computed(
    (): string => this.store.space()?.name ?? '—',
  );

  /**
   * Property dirty
   *
   * @description
   * Whether the draft differs from the stored document, its title as it would save.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly dirty: Signal<boolean> = computed((): boolean => {
    const stored: DocumentDetail | undefined = this.shown();
    if (!this.editing() || stored === undefined) return false;
    const draft: DocumentDraft = this.draft();
    return normalizedTitle(draft.title) !== stored.title || draft.body !== stored.body;
  });

  /**
   * Property docsLink
   *
   * @description
   * Address of the catalog.
   *
   * @type {Signal<readonly string[]>}
   * @readonly
   */
  protected readonly docsLink: Signal<readonly string[]> = computed((): readonly string[] => [
    '/',
    this.workspace.organization().slug,
    'docs',
  ]);

  /**
   * Property workspace
   *
   * @description
   * The organization, whose slug starts the addresses.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  private readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property router
   *
   * @description
   * Goes back to the catalog after a deletion, and reports the navigations that title the page.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

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
   * Property injector
   *
   * @description
   * Runs the focus moves after the next render.
   *
   * @type {Injector}
   * @readonly
   */
  private readonly injector: Injector = inject(Injector);

  /**
   * Property titleField
   *
   * @description
   * The edit mode's title field.
   *
   * @type {Signal<ElementRef<HTMLTextAreaElement> | undefined>}
   * @readonly
   */
  private readonly titleField: Signal<ElementRef<HTMLTextAreaElement> | undefined> =
    viewChild<ElementRef<HTMLTextAreaElement>>('titleField');

  /**
   * Property bodyEditor
   *
   * @description
   * The edit mode's block editor.
   *
   * @type {Signal<CwBlockEditor | undefined>}
   * @readonly
   */
  private readonly bodyEditor: Signal<CwBlockEditor | undefined> = viewChild(CwBlockEditor);

  /**
   * Property editButton
   *
   * @description
   * The read mode's `Edit`, which takes focus when edit mode ends.
   *
   * @type {Signal<ElementRef<HTMLButtonElement> | undefined>}
   * @readonly
   */
  private readonly editButton: Signal<ElementRef<HTMLButtonElement> | undefined> = viewChild(
    'editButton',
    { read: ElementRef },
  );

  /**
   * Property editedFor
   *
   * @description
   * The document `?mode=edit` already opened in edit mode, so it does so once per document.
   *
   * @type {string | null}
   */
  private editedFor: string | null = null;

  /**
   * Property discardAnswer
   *
   * @description
   * Resolves the pending `confirmDiscard()`, or null.
   *
   * @type {((leave: boolean) => void) | null}
   */
  private discardAnswer: ((leave: boolean) => void) | null = null;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Makes the store follow the address's document; leaves edit mode for another document; opens
   * edit mode from `?mode=edit` once the caller's rights are known; titles the page with the
   * document's title after each navigation; and asks the browser to confirm closing the tab while
   * changes are unsaved.
   *
   * @constructor
   */
  public constructor() {
    this.store.followDocument(this.docId);
    const title: Title = inject(Title);
    const navigations: Signal<number> = toSignal(
      this.router.events.pipe(
        filter((event: RouterEvent): boolean => event instanceof NavigationEnd),
        map((_event: RouterEvent, index: number): number => index),
      ),
      { initialValue: -1 },
    );
    effect((): void => {
      const stored: DocumentDetail | undefined = this.shown();
      navigations();
      if (stored !== undefined) title.setTitle(`${stored.title} — Cadenway`);
    });
    effect((): void => {
      const stored: DocumentDetail | undefined = this.shown();
      if (stored?.id !== this.docId()) {
        this.editing.set(false);
        return;
      }
      if (this.mode() === 'edit' && this.store.canEdit() && this.editedFor !== stored.id) {
        this.editedFor = stored.id;
        this.startEditing();
      }
    });
    warnBeforeUnload((): boolean => this.hasUnsavedChanges());
  }
  // #endregion

  // #region Methods
  /**
   * Method hasUnsavedChanges
   *
   * @description
   * Whether leaving now could lose edits: the draft differs from the stored document, or a save
   * is under way.
   *
   * @returns {boolean} Whether to ask before leaving.
   */
  public hasUnsavedChanges(): boolean {
    return this.dirty() || this.store.saving();
  }

  /**
   * Method confirmDiscard
   *
   * @description
   * Asks `Leave without saving?`.
   *
   * @returns {Promise<boolean>} Resolves true to leave, false to keep editing.
   */
  public confirmDiscard(): Promise<boolean> {
    this.discardAnswer?.(false);
    return new Promise<boolean>((resolve: (leave: boolean) => void): void => {
      this.discardAnswer = resolve;
      this.discardOpen.set(true);
    });
  }

  /**
   * Method settleDiscard
   *
   * @description
   * Answers the pending `confirmDiscard()` and closes its dialog.
   *
   * @param {boolean} leave - Whether to leave.
   */
  protected settleDiscard(leave: boolean): void {
    const answer: ((leave: boolean) => void) | null = this.discardAnswer;
    this.discardAnswer = null;
    this.discardOpen.set(false);
    answer?.(leave);
  }

  /**
   * Method refresh
   *
   * @description
   * Reads the document again when the window regains focus, unless it is edited.
   */
  protected refresh(): void {
    if (this.editing()) return;
    void this.store.refresh();
  }

  /**
   * Method startEditing
   *
   * @description
   * Opens edit mode on the stored document, then gives focus to the title field. A document never
   * edited since its creation as `Untitled` starts with an empty title, as `New document` does in
   * the mockup.
   */
  protected startEditing(): void {
    const stored: DocumentDetail | undefined = this.shown();
    if (stored === undefined || !this.store.canEdit()) return;
    const fresh: boolean =
      stored.version === 1 && stored.title === untitledTitle() && stored.body === '';
    this.draft.set({ title: fresh ? '' : stored.title, body: stored.body });
    this.editing.set(true);
    afterNextRender(
      (): void => {
        this.titleField()?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  /**
   * Method cancel
   *
   * @description
   * `Cancel`: drops the draft and goes back to read mode.
   */
  protected cancel(): void {
    this.leaveEditing();
  }

  /**
   * Method done
   *
   * @description
   * `Done`: saves the draft, and goes back to read mode once the stored document is the draft
   * sent and nothing was typed since.
   *
   * @returns {Promise<void>} Resolves once settled.
   */
  protected async done(): Promise<void> {
    const sent: DocumentDraft = this.draft();
    const outcome: DocumentSaveOutcome = await this.store.save(sent);
    if (outcome === 'saved' && this.draft() === sent && this.editing()) this.leaveEditing();
  }

  /**
   * Method toBody
   *
   * @description
   * Enter in the title field moves to the body instead of breaking the line.
   *
   * @param {Event} event - The key event.
   */
  protected toBody(event: Event): void {
    event.preventDefault();
    this.focusBody();
  }

  /**
   * Method focusBody
   *
   * @description
   * Gives focus to the block editor (`Add a block at the end`; the brick has no way to place the
   * caret at the end, gap G-C5).
   */
  protected focusBody(): void {
    this.bodyEditor()?.focus();
  }

  /**
   * Method copyLink
   *
   * @description
   * `Copy the document link`.
   *
   * @param {string} id - The document.
   * @returns {Promise<void>} Resolves once the clipboard answered.
   */
  protected async copyLink(id: string): Promise<void> {
    await copyDocumentLink(this.document, this.workspace.organization().slug, id, this.toasts);
  }

  /**
   * Method confirmDelete
   *
   * @description
   * Deletes the document once confirmed, closes the confirmation, and goes back to the catalog
   * once it is deleted.
   *
   * @returns {Promise<void>} Resolves once settled.
   */
  protected async confirmDelete(): Promise<void> {
    const slug: string = this.workspace.organization().slug;
    const outcome: DocumentDeleteOutcome = await this.store.remove();
    this.deleteOpen.set(false);
    if (outcome === 'deleted') await this.router.navigate(['/', slug, 'docs']);
    else if (outcome === 'conflict') void this.store.refresh();
  }

  /**
   * Method meta
   *
   * @description
   * The read mode's `Modified <when> by <author>`, without the author while unknown.
   *
   * @param {DocumentDetail} doc - The document.
   * @returns {string} The text.
   */
  protected meta(doc: DocumentDetail): string {
    const when: string = updatedLabel(doc.updatedAt, this.locale, 'inline');
    const author: string | null = this.store.authorName();
    return author === null
      ? $localize`:@@docs.document.meta-no-author:Modified ${when}:when:`
      : $localize`:@@docs.document.meta:Modified ${when}:when: by ${author}:author:`;
  }

  /**
   * Method leaveEditing
   *
   * @description
   * Goes back to read mode and gives focus to `Edit`.
   */
  private leaveEditing(): void {
    this.editing.set(false);
    afterNextRender(
      (): void => {
        this.editButton()?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }
  // #endregion
}
