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
 * disabled.
 */
@Component({
  selector: 'cw-task-description',
  imports: [CwBlockEditor],
  host: {
    class: 'flex flex-col gap-2 px-2',
    '(focusin)': 'editing = true',
    '(focusout)': 'left($event)',
  },
  template: `
    <h3 class="text-base font-semibold" i18n="@@task.description.title">Description</h3>
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
