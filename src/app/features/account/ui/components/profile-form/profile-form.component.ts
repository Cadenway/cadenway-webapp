import {
  Component,
  computed,
  input,
  type InputSignal,
  output,
  type OutputEmitterRef,
  type Signal,
} from '@angular/core';
import { type FieldTree, FormField } from '@angular/forms/signals';
import { CwButton } from '@cadenway/ui/components/button';
import { CwCardContent, CwCardFooter } from '@cadenway/ui/components/card';
import {
  CwCombobox,
  CwComboboxOption,
  provideCwComboboxLabels,
} from '@cadenway/ui/components/combobox';
import { CwInput } from '@cadenway/ui/components/input';
import {
  CwInputGroup,
  CwInputGroupAddon,
  CwInputGroupInput,
} from '@cadenway/ui/components/input-group';
import { NgIcon } from '@ng-icons/core';

import type {
  ProfileForm as ProfileFormValue,
  TimeZoneOption,
} from '../../../models/profile/profile.interface';

/**
 * Component ProfileForm
 *
 * @description
 * The fields and footer of the `Personal information` card (mockup `Compte.dc.html` lines
 * 157-214), rendered inside the page's `cw-card` (`display: contents`): `Full name`;
 * `Display name` with `Used for mentions: @<display name>` (the first word of the name while no
 * display name is typed); the read-only `Email address` with its `Verified` badge and
 * `Change the address`; `Job title (optional)`; `Time zone`, a searchable combobox of `timeZones`;
 * then the footer with the `Unsaved changes` dot while `dirty`, `Cancel` and `Save`. Two columns
 * from `sm`, one below.
 *
 * The page owns the Signal Form and passes it as `form`; each field shows its first error once
 * touched or after a submit, linked through `aria-describedby`. `Save` submits the form and emits
 * `submitted`; it is disabled while nothing changed or while `blocked` (a photo change runs), and
 * shows its pending state while `saving`. `Cancel`, disabled while clean or saving, emits
 * `cancelled`. `Change the address` emits `emailChangeRequested`, unless a save runs (it then stays
 * focusable with `aria-disabled="true"`).
 */
@Component({
  selector: 'cw-profile-form',
  imports: [
    CwButton,
    CwCardContent,
    CwCardFooter,
    CwCombobox,
    CwComboboxOption,
    CwInput,
    CwInputGroup,
    CwInputGroupAddon,
    CwInputGroupInput,
    FormField,
    NgIcon,
  ],
  providers: [
    provideCwComboboxLabels(() => ({
      placeholder: $localize`:@@account.profile.time-zone-placeholder:Choose a time zone`,
      searchPlaceholder: $localize`:@@account.profile.time-zone-search:Search a time zone`,
      emptyText: $localize`:@@account.profile.time-zone-empty:No time zone found`,
      resultsLabel: (count: number): string =>
        $localize`:@@account.profile.time-zone-results:${count}:count: results`,
    })),
  ],
  host: { class: 'contents' },
  templateUrl: './profile-form.component.html',
})
export class ProfileForm {
  // #region Properties
  /**
   * Property form
   *
   * @description
   * The `Personal information` form the page owns.
   *
   * @type {InputSignal<FieldTree<ProfileFormValue>>}
   * @readonly
   */
  public readonly form: InputSignal<FieldTree<ProfileFormValue>> =
    input.required<FieldTree<ProfileFormValue>>();

  /**
   * Property email
   *
   * @description
   * The saved address of the account, shown read-only.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly email: InputSignal<string> = input.required<string>();

  /**
   * Property timeZones
   *
   * @description
   * The options of `Time zone`.
   *
   * @type {InputSignal<readonly TimeZoneOption[]>}
   * @readonly
   */
  public readonly timeZones: InputSignal<readonly TimeZoneOption[]> =
    input.required<readonly TimeZoneOption[]>();

  /**
   * Property dirty
   *
   * @description
   * Whether the form differs from the saved account.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly dirty: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property saving
   *
   * @description
   * Whether a save is on its way.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly saving: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property blocked
   *
   * @description
   * Whether `Save` waits for another write (a photo change).
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly blocked: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property submitted
   *
   * @description
   * Emits when the person submits the form.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly submitted: OutputEmitterRef<void> = output();

  /**
   * Property cancelled
   *
   * @description
   * Emits when the person drops the edits.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly cancelled: OutputEmitterRef<void> = output();

  /**
   * Property emailChangeRequested
   *
   * @description
   * Emits when the person asks to change the address.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly emailChangeRequested: OutputEmitterRef<void> = output();

  /**
   * Property mention
   *
   * @description
   * The name a mention shows, as typed: the display name, or the first word of the full name
   * without one.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly mention: Signal<string> = computed((): string => {
    const display: string = this.form().displayName().value().trim();
    if (display !== '') return display;
    return this.form().name().value().trim().split(/\s+/u)[0] ?? '';
  });
  // #endregion

  // #region Methods
  /**
   * Method shown
   *
   * @description
   * Whether a field shows its error: invalid once touched.
   *
   * @param {FieldTree<unknown>} field - The field.
   * @returns {boolean} True while its error shows.
   */
  protected shown(field: FieldTree<unknown>): boolean {
    return field().invalid() && field().touched();
  }

  /**
   * Method submit
   *
   * @description
   * Keeps the browser from submitting and emits `submitted`.
   *
   * @param {Event} event - The submit event.
   */
  protected submit(event: Event): void {
    event.preventDefault();
    this.submitted.emit();
  }

  /**
   * Method requestEmailChange
   *
   * @description
   * Emits `emailChangeRequested`, unless a save runs.
   */
  protected requestEmailChange(): void {
    if (!this.saving()) this.emailChangeRequested.emit();
  }
  // #endregion
}
