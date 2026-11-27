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
import { CwInput } from '@cadenway/ui/components/input';
import {
  CwInputGroup,
  CwInputGroupAddon,
  CwInputGroupInput,
  CwInputGroupText,
} from '@cadenway/ui/components/input-group';
import { CwSelect, CwSelectOption } from '@cadenway/ui/components/select';
import { CwTextarea } from '@cadenway/ui/components/textarea';
import { NgIcon } from '@ng-icons/core';

import type {
  OrganizationLanguageOption,
  OrganizationProfileForm,
} from '../../../models/organization/organization-profile.interface';

/**
 * Component OrganizationForm
 *
 * @description
 * The fields and footer of the `Identity` card (mockup `Organisation.dc.html` lines 147-179),
 * rendered inside the page's `cw-card` (`display: contents`): `Name`; `Address`, the slug after
 * the page host (`app.cadenway.example/`); `Description (optional)` with `Shown on the invitation
 * page.` and its `N / 280` count; `Website`; `Default language` with flags; then the footer with
 * the `Unsaved changes` dot while `dirty`, `Cancel` and `Save`. Two columns from `sm`, one below.
 *
 * The page owns the Signal Form and passes it as `form`; each field shows its first error once
 * touched or after a submit, linked through `aria-describedby`. `Save` submits the form and emits
 * `submitted`; it is disabled while nothing changed or while `blocked` (a logo change runs), and
 * shows its pending state while `saving`. `Cancel`, disabled while clean or saving, emits
 * `cancelled`. A language this version does not know shows the placeholder `Choose a language`.
 */
@Component({
  selector: 'cw-organization-form',
  imports: [
    CwButton,
    CwCardContent,
    CwCardFooter,
    CwInput,
    CwInputGroup,
    CwInputGroupAddon,
    CwInputGroupInput,
    CwInputGroupText,
    CwSelect,
    CwSelectOption,
    CwTextarea,
    FormField,
    NgIcon,
  ],
  host: { class: 'contents' },
  templateUrl: './organization-form.component.html',
})
export class OrganizationForm {
  // #region Properties
  /**
   * Property form
   *
   * @description
   * The `Identity` form the page owns.
   *
   * @type {InputSignal<FieldTree<OrganizationProfileForm>>}
   * @readonly
   */
  public readonly form: InputSignal<FieldTree<OrganizationProfileForm>> =
    input.required<FieldTree<OrganizationProfileForm>>();

  /**
   * Property host
   *
   * @description
   * The page host shown before the slug (`app.cadenway.example`).
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly host: InputSignal<string> = input.required<string>();

  /**
   * Property languages
   *
   * @description
   * The options of `Default language`, in the mockup's order.
   *
   * @type {InputSignal<readonly OrganizationLanguageOption[]>}
   * @readonly
   */
  public readonly languages: InputSignal<readonly OrganizationLanguageOption[]> =
    input.required<readonly OrganizationLanguageOption[]>();

  /**
   * Property descriptionLimit
   *
   * @description
   * The longest description the contract accepts, shown in the count.
   *
   * @type {InputSignal<number>}
   * @readonly
   */
  public readonly descriptionLimit: InputSignal<number> = input<number>(280);

  /**
   * Property dirty
   *
   * @description
   * Whether the form differs from the saved organization.
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
   * Whether `Save` waits for another write (a logo change).
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
   * Property descriptionLength
   *
   * @description
   * The characters of the description as it is sent, trimmed, as the count shows them.
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly descriptionLength: Signal<number> = computed(
    (): number => this.form().description().value().trim().length,
  );
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
  // #endregion
}
