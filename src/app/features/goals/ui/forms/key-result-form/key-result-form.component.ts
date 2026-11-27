import {
  afterNextRender,
  Component,
  type ElementRef,
  input,
  type InputSignal,
  output,
  type OutputEmitterRef,
  type Signal,
  signal,
  viewChild,
  type WritableSignal,
} from '@angular/core';
import {
  type FieldContext,
  type FieldTree,
  form,
  FormField,
  maxLength,
  submit,
  validate,
} from '@angular/forms/signals';
import { CwButton } from '@cadenway/ui/components/button';
import { CwInput } from '@cadenway/ui/components/input';
import { NgIcon } from '@ng-icons/core';

import type { KeyResultDraft } from '../../../models/goal/goal.interface';

/**
 * Constant LABEL_MAX_LENGTH
 *
 * @description
 * Longest key result label the contract accepts (`GoalResultLabel`).
 *
 * @type {number}
 */
export const LABEL_MAX_LENGTH: number = 300;

/**
 * Interface KeyResultFormModel
 *
 * @description
 * What the key result form edits.
 */
interface KeyResultFormModel {
  // #region Properties
  /**
   * Property label
   *
   * @description
   * The key result's label, as typed.
   *
   * @type {string}
   */
  label: string;

  /**
   * Property target
   *
   * @description
   * The target, as typed: digits only.
   *
   * @type {string}
   */
  target: string;
  // #endregion
}

/**
 * Function targetOf
 *
 * @description
 * The target the mockup creates for a typed one: its whole number, 1 for 0 (`App.dc.html` lines
 * 5184 and 5203, `parseInt(target, 10) || 1`).
 *
 * @param {string} typed - The digits typed.
 * @returns {number} The target.
 */
export function targetOf(typed: string): number {
  return Number.parseInt(typed, 10) || 1;
}

/**
 * Component KeyResultForm
 *
 * @description
 * The `New key result` form of an open goal (`App.dc.html` lines 1621-1626): `Key result` and
 * `Target`, then `Add` and `Cancel`. It focuses its label when it opens. `Add` stays enabled: an
 * invalid submit shows the errors (a label and a whole-number target are required) and focuses the
 * first invalid field; it is busy while `pending`. A valid submit emits a number key result from 0
 * towards the target. Escape or `Cancel` emits `cancelled`.
 */
@Component({
  selector: 'cw-key-result-form',
  imports: [CwButton, CwInput, FormField, NgIcon],
  templateUrl: './key-result-form.component.html',
})
export class KeyResultForm {
  // #region Properties
  /**
   * Property formId
   *
   * @description
   * Prefix of the field ids, unique per goal.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly formId: InputSignal<string> = input.required<string>();

  /**
   * Property pending
   *
   * @description
   * Whether the submitted key result is on its way.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly pending: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property submitted
   *
   * @description
   * Emits the key result to add.
   *
   * @type {OutputEmitterRef<KeyResultDraft>}
   * @readonly
   */
  public readonly submitted: OutputEmitterRef<KeyResultDraft> = output<KeyResultDraft>();

  /**
   * Property cancelled
   *
   * @description
   * Emits when the form is dismissed.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly cancelled: OutputEmitterRef<void> = output();

  /**
   * Property labelField
   *
   * @description
   * The label input, focused when the form opens.
   *
   * @type {Signal<ElementRef<HTMLInputElement> | undefined>}
   * @readonly
   */
  private readonly labelField: Signal<ElementRef<HTMLInputElement> | undefined> =
    viewChild<ElementRef<HTMLInputElement>>('labelField');

  /**
   * Property model
   *
   * @description
   * The values typed.
   *
   * @type {WritableSignal<KeyResultFormModel>}
   * @readonly
   */
  private readonly model: WritableSignal<KeyResultFormModel> = signal<KeyResultFormModel>({
    label: '',
    target: '',
  });

  /**
   * Property resultForm
   *
   * @description
   * The form, with its rules.
   *
   * @type {FieldTree<KeyResultFormModel>}
   * @readonly
   */
  protected readonly resultForm: FieldTree<KeyResultFormModel> = form(this.model, (path) => {
    validate(path.label, (context: FieldContext<string>) =>
      context.value().trim() === ''
        ? {
            kind: 'required',
            message: $localize`:@@goals.result-form.label-required:Enter the key result.`,
          }
        : undefined,
    );
    maxLength(path.label, LABEL_MAX_LENGTH, {
      message: $localize`:@@goals.result-form.label-too-long:Use 300 characters at most.`,
    });
    validate(path.target, (context: FieldContext<string>) => {
      const value: string = context.value().trim();
      if (value === '')
        return {
          kind: 'required',
          message: $localize`:@@goals.result-form.target-required:Enter a target.`,
        };
      return /^\d{1,9}$/u.test(value)
        ? undefined
        : {
            kind: 'digits',
            message: $localize`:@@goals.result-form.target-digits:Enter a whole number.`,
          };
    });
  });
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Focuses the label once the form is rendered.
   *
   * @constructor
   */
  public constructor() {
    afterNextRender((): void => {
      this.labelField()?.nativeElement.focus();
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method send
   *
   * @description
   * Submits the form: emits the key result when valid, otherwise focuses the first invalid field.
   *
   * @param {Event} event - The submit event.
   * @returns {Promise<void>} Settles once handled.
   */
  protected async send(event: Event): Promise<void> {
    event.preventDefault();
    if (this.pending()) return;
    await submit(this.resultForm, {
      action: (): Promise<void> => {
        const value: KeyResultFormModel = this.model();
        this.submitted.emit({ label: value.label.trim(), target: targetOf(value.target.trim()) });
        return Promise.resolve();
      },
      onInvalid: (fields: FieldTree<KeyResultFormModel>): void => {
        if (fields.label().invalid()) fields.label().focusBoundControl();
        else fields.target().focusBoundControl();
      },
    });
  }

  /**
   * Method fieldId
   *
   * @description
   * The id of one of the form's fields.
   *
   * @param {string} name - Name of the field.
   * @returns {string} Its id.
   */
  protected fieldId(name: string): string {
    return `${this.formId()}-${name}`;
  }
  // #endregion
}
