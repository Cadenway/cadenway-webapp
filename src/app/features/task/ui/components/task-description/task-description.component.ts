import {
  Component,
  input,
  type InputSignal,
  linkedSignal,
  output,
  type OutputEmitterRef,
  type WritableSignal,
} from '@angular/core';
import { CwBlockEditor, type CwMentionSearch } from '@cadenway/ui/components/block-editor';
import { CwButton } from '@cadenway/ui/components/button';

/**
 * Component TaskDescription
 *
 * @description
 * The `Description` of `Details` (`App.dc.html` lines 2136-2138): `cw-block-editor` with its
 * formatting toolbar, block types, `/` menu, Markdown shortcuts and keys (the brick's own), its
 * value the description's Markdown. While the focus is inside, the text is the caller's: each
 * change emits `edited` (the tabs save it after a pause) and a newer confirmed description does
 * not replace it; leaving the editor emits `committed` (saved at once), and the next confirmed
 * text shows again. A normalization the editor makes without the focus is never emitted. Typing
 * `@` opens the people menu of `mentionSearch` (the task's participants), which writes
 * `@[Name](id)` tokens the owner sends as mention spans. Without edit rights the editor is
 * disabled. With `restored` (a draft of this task kept on the device after a failed save), a
 * notice says so above the editor and its `Discard` emits `discarded`; with `changedSince` too
 * (the task's description changed since the draft was typed), the notice says so and offers
 * `Keep my version`, which emits `kept`.
 */
@Component({
  selector: 'cw-task-description',
  imports: [CwBlockEditor, CwButton],
  host: {
    class: 'flex flex-col gap-2 px-2',
    '(focusin)': 'editing = true',
    '(focusout)': 'left($event)',
  },
  template: `
    <h3 class="text-base font-semibold" i18n="@@task.description.title">Description</h3>
    @if (restored()) {
      <div
        role="status"
        class="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground"
        data-testid="task-description-restored"
      >
        @if (changedSince()) {
          <span i18n="@@task.description.restored-changed"
            >The task changed since; your unsaved changes are restored from this device.</span
          >
          <button cwButton type="button" variant="link" size="xs" (click)="kept.emit()">
            <ng-container i18n="@@task.description.keep">Keep my version</ng-container>
          </button>
        } @else {
          <span i18n="@@task.description.restored">Unsaved changes restored from this device.</span>
        }
        <button cwButton type="button" variant="link" size="xs" (click)="discarded.emit()">
          <ng-container i18n="@@task.description.discard">Discard</ng-container>
        </button>
      </div>
    }
    <cw-block-editor
      variant="document"
      toolbar
      ariaLabel="Description"
      i18n-ariaLabel="@@task.description.title"
      [disabled]="!canEdit()"
      [mentionSearch]="mentionSearch()"
      [value]="draft()"
      (valueChange)="changed($event)"
    />
  `,
})
export class TaskDescription {
  // #region Properties
  /**
   * Property markdown
   *
   * @description
   * The confirmed (or pending) description, empty when there is none.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly markdown: InputSignal<string> = input.required<string>();

  /**
   * Property canEdit
   *
   * @description
   * Whether the caller may edit the description.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly canEdit: InputSignal<boolean> = input<boolean>(true);

  /**
   * Property mentionSearch
   *
   * @description
   * Looks up the people the description may mention; no `@` menu without it.
   *
   * @type {InputSignal<CwMentionSearch | null>}
   * @readonly
   */
  public readonly mentionSearch: InputSignal<CwMentionSearch | null> =
    input<CwMentionSearch | null>(null);

  /**
   * Property restored
   *
   * @description
   * Whether the editor shows a draft restored from the device rather than the confirmed text.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly restored: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property discarded
   *
   * @description
   * Emits when the caller discards the restored draft.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly discarded: OutputEmitterRef<void> = output();

  /**
   * Property changedSince
   *
   * @description
   * Whether the task's description changed since the restored draft was typed.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly changedSince: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property kept
   *
   * @description
   * Emits when the caller keeps the restored draft over a description that changed since.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly kept: OutputEmitterRef<void> = output();

  /**
   * Property edited
   *
   * @description
   * Emits the Markdown after each change the caller makes.
   *
   * @type {OutputEmitterRef<string>}
   * @readonly
   */
  public readonly edited: OutputEmitterRef<string> = output<string>();

  /**
   * Property committed
   *
   * @description
   * Emits when the focus leaves the editor.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly committed: OutputEmitterRef<void> = output();

  /**
   * Property editing
   *
   * @description
   * Whether the focus is inside the editor (its toolbar and menus included).
   *
   * @type {boolean}
   */
  protected editing: boolean = false;

  /**
   * Property draft
   *
   * @description
   * The text in the editor: the confirmed description, kept as typed while the caller edits.
   *
   * @type {WritableSignal<string>}
   * @readonly
   */
  protected readonly draft: WritableSignal<string> = linkedSignal<string, string>({
    source: this.markdown,
    computation: (next: string, previous: { readonly value: string } | undefined): string =>
      this.editing && previous ? previous.value : next,
  });
  // #endregion

  // #region Methods
  /**
   * Method changed
   *
   * @description
   * Keeps and emits a change the caller made.
   *
   * @param {string} markdown - The editor's Markdown.
   */
  protected changed(markdown: string): void {
    if (!this.editing || markdown === this.draft()) return;
    this.draft.set(markdown);
    this.edited.emit(markdown);
  }

  /**
   * Method left
   *
   * @description
   * Ends the edit once the focus leaves the editor for good.
   *
   * @param {FocusEvent} event - The focus event.
   */
  protected left(event: FocusEvent): void {
    const host: EventTarget | null = event.currentTarget;
    const next: Node | null = event.relatedTarget as Node | null;
    if (host instanceof Node && next && host.contains(next)) return;
    this.editing = false;
    this.committed.emit();
  }
  // #endregion
}
