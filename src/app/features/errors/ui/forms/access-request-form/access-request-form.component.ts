import {
  Component,
  input,
  type InputSignal,
  output,
  type OutputEmitterRef,
  signal,
  type WritableSignal,
} from '@angular/core';
import { type FieldTree, form, FormField, maxLength } from '@angular/forms/signals';
import { CwButton } from '@cadenway/ui/components/button';
import { CwTextarea } from '@cadenway/ui/components/textarea';
import { NgIcon } from '@ng-icons/core';

/**
 * Interface AccessRequestModel
 *
 * @description
 * Value of the access request form.
 */
interface AccessRequestModel {
  // #region Properties
  /**
   * Property message
   *
   * @description
   * Optional message to the owner, 500 characters at most.
   *
   * @type {string}
   */
  message: string;
  // #endregion
}

/**
 * Component AccessRequestForm
 *
 * @description
 * The access request of the access-denied state (mockup `App.dc.html` lines 1508-1518): the
 * optional message `Message for <first name> (optional)`, then the row with `Request access`
 * and the projected secondary action. Submitting a valid message emits it as typed; the page trims
 * and sends it. While `sending`, the button shows its spinner and ignores clicks.
 */
@Component({
  selector: 'cw-access-request-form',
  imports: [CwButton, CwTextarea, FormField, NgIcon],
  host: { class: 'flex w-full flex-col items-center gap-5' },
  templateUrl: './access-request-form.component.html',
})
export class AccessRequestForm {
  // #region Properties
  /**
   * Property ownerFirstName
   *
   * @description
   * First name of the owner the message goes to, or null when unknown.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly ownerFirstName: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property sending
   *
   * @description
   * Whether the request is being sent.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly sending: InputSignal<boolean> = input(false);

  /**
   * Property submitted
   *
   * @description
   * Message typed by the person, emitted when they ask for access with a valid message.
   *
   * @type {OutputEmitterRef<string>}
   * @readonly
   */
  public readonly submitted: OutputEmitterRef<string> = output<string>();

  /**
   * Property model
   *
   * @description
   * Value of the form.
   *
   * @type {WritableSignal<AccessRequestModel>}
   * @readonly
   */
  protected readonly model: WritableSignal<AccessRequestModel> = signal({ message: '' });

  /**
   * Property requestForm
   *
   * @description
   * The form: the optional message, limited as the gateway limits it.
   *
   * @type {FieldTree<AccessRequestModel>}
   * @readonly
   */
  protected readonly requestForm: FieldTree<AccessRequestModel> = form(this.model, (path) => {
    maxLength(path.message, 500);
  });
  // #endregion

  // #region Methods
  /**
   * Method submit
   *
   * @description
   * Emits the message when the form is valid and nothing is being sent.
   */
  protected submit(): void {
    if (this.sending() || this.requestForm().invalid()) return;
    this.submitted.emit(this.model().message);
  }
  // #endregion
}
