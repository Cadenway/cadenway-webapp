import {
  Component,
  computed,
  inject,
  input,
  type InputSignal,
  LOCALE_ID,
  model,
  type ModelSignal,
  output,
  type OutputEmitterRef,
  type Signal,
  viewChild,
} from '@angular/core';
import type { CwMentionSearch } from '@cadenway/ui/components/block-editor';
import {
  type CwAttachmentDraft,
  CwCommentComposer,
  type CwCommentSubmit,
  type CwPerson,
} from '@cadenway/ui/components/comment-composer';

import {
  codePointLength,
  COMMENT_MAX_LENGTH,
} from '../../../utils/task-detail-sections/task-detail-sections.util';

/**
 * Component TaskCommentsComposer
 *
 * @description
 * The comment composer pinned under the `Comments` tab (`App.dc.html` lines 2338-2366):
 * `cw-comment-composer` (marks, link, list, code, `@` mentions from `mentionSearch`, `/` blocks,
 * attached files whose upload the tabs run and report through `attachments`), sent with its
 * button or Ctrl (Cmd) Enter, which the brick allows only with text and no file still uploading;
 * and the counter `<n> / 5,000`, in the destructive tone past the limit, when `submitted` is not
 * emitted. `error` shows the brick's message with `Retry`, the text kept. Without the comment
 * right it shows the brick's disabled line.
 */
@Component({
  selector: 'cw-task-comments-composer',
  imports: [CwCommentComposer],
  host: { class: 'flex shrink-0 flex-col gap-1 border-t border-border px-4 py-3' },
  template: `
    <cw-comment-composer
      [author]="author()"
      [mentionSearch]="mentionSearch()"
      [disabled]="disabled()"
      [sending]="sending()"
      [error]="error()"
      [(value)]="value"
      [(attachments)]="attachments"
      (submit)="send($event)"
      (filesAdded)="filesAdded.emit($event)"
      (attachmentRemove)="attachmentRemoved.emit($event)"
      (retry)="retried.emit()"
    />
    @if (!disabled()) {
      <span
        class="self-end text-xs whitespace-nowrap tabular-nums"
        [class.text-muted-foreground]="!tooLong()"
        [class.text-destructive]="tooLong()"
        data-testid="task-comment-count"
        >{{ count() }}</span
      >
    }
  `,
})
export class TaskCommentsComposer {
  // #region Properties
  /**
   * Property value
   *
   * @description
   * The Markdown being written (the tabs prefill it for `Reply` and empty it once sent).
   *
   * @type {ModelSignal<string>}
   * @readonly
   */
  public readonly value: ModelSignal<string> = model<string>('');

  /**
   * Property attachments
   *
   * @description
   * The files joined to the comment and their upload state.
   *
   * @type {ModelSignal<readonly CwAttachmentDraft[]>}
   * @readonly
   */
  public readonly attachments: ModelSignal<readonly CwAttachmentDraft[]> = model<
    readonly CwAttachmentDraft[]
  >([]);

  /**
   * Property author
   *
   * @description
   * The caller, drawn next to the field.
   *
   * @type {InputSignal<CwPerson | null>}
   * @readonly
   */
  public readonly author: InputSignal<CwPerson | null> = input<CwPerson | null>(null);

  /**
   * Property mentionSearch
   *
   * @description
   * Looks up the people a comment may mention.
   *
   * @type {InputSignal<CwMentionSearch | null>}
   * @readonly
   */
  public readonly mentionSearch: InputSignal<CwMentionSearch | null> =
    input<CwMentionSearch | null>(null);

  /**
   * Property disabled
   *
   * @description
   * Whether the caller may not comment.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly disabled: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property sending
   *
   * @description
   * Whether the comment is being posted.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly sending: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property error
   *
   * @description
   * Why the last post failed, or null.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly error: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property submitted
   *
   * @description
   * Emits the comment to post, within the length limit.
   *
   * @type {OutputEmitterRef<CwCommentSubmit>}
   * @readonly
   */
  public readonly submitted: OutputEmitterRef<CwCommentSubmit> = output<CwCommentSubmit>();

  /**
   * Property filesAdded
   *
   * @description
   * Emits the files joined to the comment.
   *
   * @type {OutputEmitterRef<File[]>}
   * @readonly
   */
  public readonly filesAdded: OutputEmitterRef<File[]> = output<File[]>();

  /**
   * Property attachmentRemoved
   *
   * @description
   * Emits the id of a file taken off the comment.
   *
   * @type {OutputEmitterRef<string>}
   * @readonly
   */
  public readonly attachmentRemoved: OutputEmitterRef<string> = output<string>();

  /**
   * Property retried
   *
   * @description
   * Emits when the error's `Retry` is pressed.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly retried: OutputEmitterRef<void> = output();

  /**
   * Property length
   *
   * @description
   * Length of the text in code points.
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly length: Signal<number> = computed((): number => codePointLength(this.value()));

  /**
   * Property tooLong
   *
   * @description
   * Whether the text is over the limit.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly tooLong: Signal<boolean> = computed(
    (): boolean => this.length() > COMMENT_MAX_LENGTH,
  );

  /**
   * Property count
   *
   * @description
   * `<n> / 5,000` in the active locale.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly count: Signal<string> = computed((): string => {
    const format: Intl.NumberFormat = new Intl.NumberFormat(this.locale);
    return `${format.format(this.length())} / ${format.format(COMMENT_MAX_LENGTH)}`;
  });

  /**
   * Property locale
   *
   * @description
   * The active locale, for the counter.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);

  /**
   * Property composer
   *
   * @description
   * The composer brick, to give it the focus.
   *
   * @type {Signal<CwCommentComposer | undefined>}
   * @readonly
   */
  private readonly composer: Signal<CwCommentComposer | undefined> = viewChild(CwCommentComposer);
  // #endregion

  // #region Methods
  /**
   * Method focus
   *
   * @description
   * Gives the focus to the text (after `Reply`).
   */
  public focus(): void {
    this.composer()?.focus();
  }

  /**
   * Method send
   *
   * @description
   * Emits the comment unless it is over the limit.
   *
   * @param {CwCommentSubmit} comment - What the composer submitted.
   */
  protected send(comment: CwCommentSubmit): void {
    if (codePointLength(comment.markdown) > COMMENT_MAX_LENGTH) return;
    this.submitted.emit(comment);
  }
  // #endregion
}
