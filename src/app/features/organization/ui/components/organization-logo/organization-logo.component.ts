import { Component, input, type InputSignal, output, type OutputEmitterRef } from '@angular/core';
import { CwButton } from '@cadenway/ui/components/button';
import { CwSpinner } from '@cadenway/ui/components/spinner';
import { NgIcon } from '@ng-icons/core';

/**
 * Component OrganizationLogo
 *
 * @description
 * The logo row of the `Identity` card (mockup `Organisation.dc.html` lines 137-146): a 64 px tile
 * with the logo, or the initials without one, then `Import a logo` (`Change logo` once there is
 * one), a hidden `input type=file` behind its label, `Remove`, disabled without a logo, and the
 * hint `Square PNG or SVG, 512 px recommended. Shown in the sidebar and emails.`.
 *
 * It holds no state: `logoUrl` is the image to show, `initials` the fallback, `busy` the change
 * under way (`upload` shows a spinner on the import button, `remove` on `Remove`), during which
 * both actions are disabled, as they are while `disabled`. Picking a file emits `picked` with it,
 * unchecked, and clears the input so the same file can be picked again; `Remove` emits `removed`.
 * The tile is decorative: the buttons carry the meaning.
 */
@Component({
  selector: 'cw-organization-logo',
  imports: [CwButton, CwSpinner, NgIcon],
  template: `
    <div class="flex flex-wrap items-center gap-4">
      <span
        class="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sidebar-primary text-lg font-semibold text-sidebar-primary-foreground"
        aria-hidden="true"
        data-testid="organization-logo-tile"
      >
        @if (logoUrl(); as url) {
          <img
            [src]="url"
            alt=""
            class="size-full rounded-lg border border-border bg-background object-contain"
          />
        } @else {
          {{ initials() }}
        }
      </span>
      <div class="flex min-w-0 flex-col gap-1.5">
        <div class="relative flex flex-wrap items-center gap-2">
          <input
            #file
            id="organization-logo-file"
            type="file"
            accept="image/png,image/svg+xml"
            class="peer sr-only"
            aria-describedby="organization-logo-hint"
            data-testid="organization-logo-input"
            [disabled]="locked()"
            (change)="pick(file)"
          />
          <label
            for="organization-logo-file"
            class="relative isolate inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-lg border border-input px-2.5 text-sm font-medium whitespace-nowrap transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background peer-disabled:pointer-events-none peer-disabled:opacity-50 hover:bg-accent"
          >
            @if (busy() === 'upload') {
              <svg cwSpinner aria-hidden="true"></svg>
            } @else {
              <ng-icon name="phosphorUploadSimpleBold" class="size-4 shrink-0" aria-hidden="true" />
            }
            @if (logoUrl()) {
              <span i18n="@@organization.general.logo-change">Change logo</span>
            } @else {
              <span i18n="@@organization.general.logo-import">Import a logo</span>
            }
          </label>
          <button
            cwButton
            variant="ghost"
            type="button"
            data-testid="organization-logo-remove"
            [disabled]="!hasLogo() || locked()"
            [loading]="busy() === 'remove'"
            (click)="removed.emit()"
            i18n="@@organization.general.logo-remove"
          >
            Remove
          </button>
        </div>
        <p
          id="organization-logo-hint"
          class="text-xs text-muted-foreground"
          i18n="@@organization.general.logo-hint"
        >
          Square PNG or SVG, 512 px recommended. Shown in the sidebar and emails.
        </p>
      </div>
    </div>
  `,
})
export class OrganizationLogo {
  // #region Properties
  /**
   * Property logoUrl
   *
   * @description
   * The image of the logo, or null to show the initials.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly logoUrl: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property hasLogo
   *
   * @description
   * Whether the organization has a logo, which `Remove` removes, even while its image is not shown.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly hasLogo: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property initials
   *
   * @description
   * Initials shown without a logo (`AN`).
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly initials: InputSignal<string> = input.required<string>();

  /**
   * Property busy
   *
   * @description
   * The logo change under way.
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
   * Emits when the person asks to remove the logo.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly removed: OutputEmitterRef<void> = output();
  // #endregion

  // #region Methods
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
