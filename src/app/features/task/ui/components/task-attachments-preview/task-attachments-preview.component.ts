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
} from '@angular/core';
import { CwButton } from '@cadenway/ui/components/button';
import { CwDialog, CwDialogHeader, CwDialogTitle } from '@cadenway/ui/components/dialog';
import { NgIcon } from '@ng-icons/core';

import type { Person } from '../../../models/person/person.interface';
import type { TaskAttachment } from '../../../models/task-detail-sections/task-detail-sections.interface';
import {
  fileSize,
  firstName,
  isPreviewableImage,
  relativeInstant,
} from '../../../utils/task-detail-sections/task-detail-sections.util';

/**
 * Component TaskAttachmentsPreview
 *
 * @description
 * The preview of an attachment (`App.dc.html` lines 2644-2673, 5021-5034): a full-size dialog
 * with the name, `<size> · <first name> · <when>`, the position `<i> / <n>`, `Download` and
 * `Close the preview`; `Previous file` and `Next file` (disabled at the ends, also ArrowLeft and
 * ArrowRight), Escape closes (the dialog brick). A raster image shows from its signed address
 * (`imageUrl`, given by the tabs); any other file, and an SVG (never rendered inline), says
 * `Preview unavailable for this type of file.` with `Download · <size>`. `index` is the shown
 * attachment, null while closed.
 */
@Component({
  selector: 'cw-task-attachments-preview',
  imports: [CwButton, CwDialog, CwDialogHeader, CwDialogTitle, NgIcon],
  host: { '(document:keydown)': 'key($event)' },
  templateUrl: './task-attachments-preview.component.html',
})
export class TaskAttachmentsPreview {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * The attachments, in the section's order.
   *
   * @type {InputSignal<readonly TaskAttachment[]>}
   * @readonly
   */
  public readonly items: InputSignal<readonly TaskAttachment[]> =
    input.required<readonly TaskAttachment[]>();

  /**
   * Property people
   *
   * @description
   * The member directory, by account.
   *
   * @type {InputSignal<ReadonlyMap<string, Person>>}
   * @readonly
   */
  public readonly people: InputSignal<ReadonlyMap<string, Person>> = input<
    ReadonlyMap<string, Person>
  >(new Map());

  /**
   * Property imageUrl
   *
   * @description
   * Signed address of the shown image, or null while it is signed or for another file.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly imageUrl: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property index
   *
   * @description
   * Position of the shown attachment, null while closed.
   *
   * @type {ModelSignal<number | null>}
   * @readonly
   */
  public readonly index: ModelSignal<number | null> = model<number | null>(null);

  /**
   * Property downloaded
   *
   * @description
   * Emits the attachment to download.
   *
   * @type {OutputEmitterRef<TaskAttachment>}
   * @readonly
   */
  public readonly downloaded: OutputEmitterRef<TaskAttachment> = output<TaskAttachment>();

  /**
   * Property shown
   *
   * @description
   * The shown attachment, or null.
   *
   * @type {Signal<TaskAttachment | null>}
   * @readonly
   */
  protected readonly shown: Signal<TaskAttachment | null> = computed((): TaskAttachment | null => {
    const index: number | null = this.index();
    return index === null ? null : (this.items()[index] ?? null);
  });

  /**
   * Property image
   *
   * @description
   * Whether the shown file is an image the preview draws.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly image: Signal<boolean> = computed((): boolean => {
    const shown: TaskAttachment | null = this.shown();
    return shown !== null && isPreviewableImage(shown.contentType);
  });

  /**
   * Property size
   *
   * @description
   * Size of the shown file.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly size: Signal<string> = computed((): string => {
    const shown: TaskAttachment | null = this.shown();
    return shown ? fileSize(shown.size, this.locale) : '';
  });

  /**
   * Property meta
   *
   * @description
   * `<size> · <first name> · <when>` of the shown file.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly meta: Signal<string> = computed((): string => {
    const shown: TaskAttachment | null = this.shown();
    if (!shown) return '';
    const author: Person | undefined = shown.authorId
      ? this.people().get(shown.authorId)
      : undefined;
    return [
      this.size(),
      author ? firstName(author.name) : null,
      relativeInstant(shown.uploadedAt, new Date(), this.locale),
    ]
      .filter((part: string | null): part is string => part !== null && part !== '')
      .join(' · ');
  });

  /**
   * Property locale
   *
   * @description
   * The active locale, for sizes and dates.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);
  // #endregion

  // #region Methods
  /**
   * Method step
   *
   * @description
   * Shows the previous or next file, staying within the list.
   *
   * @param {number} delta - -1 for the previous file, 1 for the next one.
   */
  protected step(delta: number): void {
    const index: number | null = this.index();
    if (index === null) return;
    const next: number = index + delta;
    if (next >= 0 && next < this.items().length) this.index.set(next);
  }

  /**
   * Method key
   *
   * @description
   * ArrowLeft and ArrowRight move between the files while the preview is open (the dialog
   * renders in an overlay, so the keys are read on the document).
   *
   * @param {KeyboardEvent} event - A key event of the page.
   */
  protected key(event: KeyboardEvent): void {
    if (this.shown() === null || event.defaultPrevented) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.step(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.step(1);
    }
  }

  /**
   * Method openChanged
   *
   * @description
   * Closing the dialog clears the shown file.
   *
   * @param {boolean} open - Whether the dialog is open.
   */
  protected openChanged(open: boolean): void {
    if (!open) this.index.set(null);
  }
  // #endregion
}
