import {
  Component,
  type ElementRef,
  input,
  type InputSignal,
  output,
  type OutputEmitterRef,
  type Signal,
  viewChild,
} from '@angular/core';
import { CwButton } from '@cadenway/ui/components/button';
import { CwSpinner } from '@cadenway/ui/components/spinner';
import { NgIcon } from '@ng-icons/core';

/**
 * Component ProfilePhoto
 *
 * @description
 * The row of the `Photo` card (mockup `Compte.dc.html` lines 145-155): a round 64 px tile with the
 * photo, or the initials without one, then `Import a photo` (`Change photo` once there is one), a
 * hidden `input type=file` behind its label, and `Remove`, disabled without a photo.
 *
 * It holds no state: `photoUrl` is the image to show, `initials` the fallback, `hasPhoto` whether
 * there is a photo to change or remove, `busy` the change under way (`upload` shows a spinner on the
 * import button, `remove` on `Remove`). While a change runs, or while `disabled`, both actions stay
 * focusable with `aria-disabled="true"` and do nothing, so the focus is never lost. Picking a file
 * emits `picked` with it, unchecked, and clears the input so the same file can be picked again;
 * `Remove` emits `removed`. `focus()` moves the focus to the file input, for the page to call once
 * a change ended. The tile is decorative: the buttons and the card's text carry the meaning.
 */
@Component({
  selector: 'cw-profile-photo',
  imports: [CwButton, CwSpinner, NgIcon],
  template: `
    <div class="flex flex-wrap items-center gap-4">
      <span
        class="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-lg leading-none font-semibold text-secondary-foreground"
        aria-hidden="true"
        data-testid="profile-photo-tile"
      >
        @if (photoUrl(); as url) {
          <img [src]="url" alt="" class="size-full object-cover" />
        } @else {
          {{ initials() }}
        }
      </span>
      <div class="relative flex flex-wrap items-center gap-2">
        <input
          #file
          id="profile-photo-file"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          class="peer sr-only"
          aria-describedby="profile-photo-hint"
          data-testid="profile-photo-input"
          [attr.aria-disabled]="locked() ? 'true' : null"
          (click)="refuseWhileLocked($event)"
          (change)="pick(file)"
        />
        <label
          for="profile-photo-file"
          class="relative isolate inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-lg border border-input px-2.5 text-sm font-medium whitespace-nowrap transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background peer-aria-disabled:pointer-events-none peer-aria-disabled:opacity-50 hover:bg-accent"
        >
          @if (busy() === 'upload') {
            <svg cwSpinner aria-hidden="true"></svg>
          } @else {
            <ng-icon name="phosphorUploadSimpleBold" class="size-4 shrink-0" aria-hidden="true" />
          }
          @if (hasPhoto()) {
            <span i18n="@@account.profile.photo-change">Change photo</span>
          } @else {
            <span i18n="@@account.profile.photo-import">Import a photo</span>
          }
        </label>
        <button
          cwButton
          variant="ghost"
          type="button"
          data-testid="profile-photo-remove"
          [disabled]="!hasPhoto()"
          [attr.aria-disabled]="locked() ? 'true' : null"
          [loading]="busy() === 'remove'"
          (click)="remove()"
          i18n="@@account.profile.photo-remove"
        >
          Remove
        </button>
      </div>
    </div>
  `,
})
export class ProfilePhoto {
  // #region Properties
  /**
   * Property photoUrl
   *
   * @description
   * The image of the photo, or null to show the initials.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly photoUrl: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property hasPhoto
   *
   * @description
   * Whether the account has a photo, which `Remove` removes, even while its image is not shown.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly hasPhoto: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property initials
   *
   * @description
   * Initials shown without a photo (`CM`).
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly initials: InputSignal<string> = input.required<string>();

  /**
   * Property busy
   *
   * @description
   * The photo change under way.
   *
   * @type {InputSignal<'upload' | 'remove' | null>}
   * @readonly
   */
  public readonly busy: InputSignal<'upload' | 'remove' | null> = input<'upload' | 'remove' | null>(
    null,
  );

  /**
   * Property disabled
   *
   * @description
   * Whether both actions are disabled, while another write runs.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly disabled: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property picked
   *
   * @description
   * Emits the file the person picked.
   *
   * @type {OutputEmitterRef<File>}
   * @readonly
   */
  public readonly picked: OutputEmitterRef<File> = output<File>();

  /**
   * Property removed
   *
   * @description
   * Emits when the person asks to remove the photo.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly removed: OutputEmitterRef<void> = output();

  /**
   * Property fileInput
   *
   * @description
   * The hidden file input, which `focus()` focuses.
   *
   * @type {Signal<ElementRef<HTMLInputElement>>}
   * @readonly
   */
  private readonly fileInput: Signal<ElementRef<HTMLInputElement>> =
    viewChild.required<ElementRef<HTMLInputElement>>('file');
  // #endregion

  // #region Methods
  /**
   * Method focus
   *
   * @description
   * Moves the focus to the file input, the import button's control.
   */
  public focus(): void {
    this.fileInput().nativeElement.focus();
  }

  /**
   * Method locked
   *
   * @description
   * Whether both actions are disabled.
   *
   * @returns {boolean} True while a change runs or while disabled.
   */
  protected locked(): boolean {
    return this.disabled() || this.busy() !== null;
  }

  /**
   * Method refuseWhileLocked
   *
   * @description
   * Keeps the file picker closed while the actions are locked.
   *
   * @param {Event} event - The input's click.
   */
  protected refuseWhileLocked(event: Event): void {
    if (this.locked()) event.preventDefault();
  }

  /**
   * Method remove
   *
   * @description
   * Emits `removed`, unless the actions are locked.
   */
  protected remove(): void {
    if (!this.locked()) this.removed.emit();
  }

  /**
   * Method pick
   *
   * @description
   * Emits the picked file, then clears the input.
   *
   * @param {HTMLInputElement} input - The file input.
   */
  protected pick(input: HTMLInputElement): void {
    const file: File | undefined = input.files?.[0];
    input.value = '';
    if (file !== undefined) this.picked.emit(file);
  }
  // #endregion
}
