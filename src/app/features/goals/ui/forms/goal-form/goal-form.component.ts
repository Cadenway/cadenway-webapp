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
import { CwSelect, CwSelectOption } from '@cadenway/ui/components/select';
import { CwToggleGroup, CwToggleGroupItem } from '@cadenway/ui/components/toggle-group';
import { NgIcon } from '@ng-icons/core';

import type { Person } from '@features/task';

import type { GoalDraft, GoalSpaceOption } from '../../../models/goal/goal.interface';
import { LABEL_MAX_LENGTH, targetOf } from '../key-result-form/key-result-form.component';

/**
 * Interface GoalFormModel
 *
 * @description
 * What the goal form edits.
 */
interface GoalFormModel {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * The goal's name, as typed.
   *
   * @type {string}
   */
  name: string;

  /**
   * Property owner
   *
   * @description
   * Account of the chosen owner, or null when none is chosen.
   *
   * @type {string | null}
   */
  owner: string | null;

  /**
   * Property space
   *
   * @description
   * The chosen space, empty while none is; used only when the form asks for one.
   *
   * @type {string}
   */
  space: string;

  /**
   * Property result
   *
   * @description
   * Label of the optional first key result, as typed.
   *
   * @type {string}
   */
  result: string;

  /**
   * Property target
   *
   * @description
   * Target of the first key result, as typed: digits only, optional.
   *
   * @type {string}
   */
  target: string;
  // #endregion
}

/**
 * Component GoalForm
 *
 * @description
 * The `New goal` form (`App.dc.html` lines 1581-1588): `Goal`, `Owner` (a radio group of member
 * chips, the caller chosen first), `First key result (optional)` and its `Target`, then `Cancel`
 * and `Create the goal`. When `spaces` is a list (a member, gap G-G3), a required `Space` select
 * comes after `Owner`; the copy is not in the mockup. It focuses its name when it opens. `Create
 * the goal` stays enabled: an invalid submit shows the errors and focuses the first invalid field;
 * it is busy while `pending`. A key result typed without a target aims at 1, as the mockup does.
 * Escape or `Cancel` emits `cancelled`.
 */
@Component({
  selector: 'cw-goal-form',
  imports: [
    CwButton,
    CwInput,
    CwSelect,
    CwSelectOption,
    CwToggleGroup,
    CwToggleGroupItem,
    FormField,
    NgIcon,
  ],
  templateUrl: './goal-form.component.html',
})
export class GoalForm {
  // #region Properties
  /**
   * Property owners
   *
   * @description
   * The people who may own the goal.
   *
   * @type {InputSignal<readonly Person[]>}
   * @readonly
   */
  public readonly owners: InputSignal<readonly Person[]> = input.required<readonly Person[]>();

  /**
   * Property userId
   *
   * @description
   * The caller, chosen as owner when the form opens.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly userId: InputSignal<string> = input.required<string>();

  /**
   * Property spaces
   *
   * @description
   * The spaces the goal may be created in, or null for a goal of the organization.
   *
   * @type {InputSignal<readonly GoalSpaceOption[] | null>}
   * @readonly
   */
  public readonly spaces: InputSignal<readonly GoalSpaceOption[] | null> = input<
    readonly GoalSpaceOption[] | null
  >(null);

  /**
   * Property pending
   *
   * @description
   * Whether the submitted goal is on its way.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly pending: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property submitted
   *
   * @description
   * Emits the goal to create.
   *
   * @type {OutputEmitterRef<GoalDraft>}
   * @readonly
   */
  public readonly submitted: OutputEmitterRef<GoalDraft> = output<GoalDraft>();

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
   * Property nameField
   *
   * @description
   * The name input, focused when the form opens.
   *
   * @type {Signal<ElementRef<HTMLInputElement> | undefined>}
   * @readonly
   */
  private readonly nameField: Signal<ElementRef<HTMLInputElement> | undefined> =
    viewChild<ElementRef<HTMLInputElement>>('nameField');

  /**
   * Property model
   *
   * @description
   * The values typed.
   *
   * @type {WritableSignal<GoalFormModel>}
   * @readonly
   */
  private readonly model: WritableSignal<GoalFormModel> = signal<GoalFormModel>({
    name: '',
    owner: null,
    space: '',
    result: '',
    target: '',
  });

  /**
   * Property goalForm
   *
   * @description
   * The form, with its rules.
   *
   * @type {FieldTree<GoalFormModel>}
   * @readonly
   */
  protected readonly goalForm: FieldTree<GoalFormModel> = form(this.model, (path) => {
    validate(path.name, (context: FieldContext<string>) =>
      context.value().trim() === ''
        ? {
            kind: 'required',
            message: $localize`:@@goals.form.name-required:Enter a name for the goal.`,
          }
        : undefined,
    );
    maxLength(path.name, LABEL_MAX_LENGTH, {
      message: $localize`:@@goals.form.name-too-long:Use 300 characters at most.`,
    });
    validate(path.owner, (context: FieldContext<string | null>) =>
      context.value() === null
        ? {
            kind: 'required',
            message: $localize`:@@goals.form.owner-required:Choose an owner.`,
          }
        : undefined,
    );
    validate(path.space, (context: FieldContext<string>) =>
      this.spaces() !== null && context.value() === ''
        ? {
            kind: 'required',
            message: $localize`:@@goals.form.space-required:Choose a space.`,
          }
        : undefined,
    );
    maxLength(path.result, LABEL_MAX_LENGTH, {
      message: $localize`:@@goals.form.result-too-long:Use 300 characters at most.`,
    });
    validate(path.target, (context: FieldContext<string>) =>
      /^\d{0,9}$/u.test(context.value().trim())
        ? undefined
        : {
            kind: 'digits',
            message: $localize`:@@goals.form.target-digits:Enter a whole number.`,
          },
    );
  });
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Chooses the caller as owner and focuses the name once the form is rendered.
   *
   * @constructor
   */
  public constructor() {
    afterNextRender((): void => {
      this.model.update((value: GoalFormModel): GoalFormModel => ({
        ...value,
        owner: value.owner ?? this.userId(),
      }));
      this.nameField()?.nativeElement.focus();
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method send
   *
   * @description
   * Submits the form: emits the goal when valid, otherwise focuses the first invalid field.
   *
   * @param {Event} event - The submit event.
   * @returns {Promise<void>} Settles once handled.
   */
  protected async send(event: Event): Promise<void> {
    event.preventDefault();
    if (this.pending()) return;
    await submit(this.goalForm, {
      action: (): Promise<void> => {
        const value: GoalFormModel = this.model();
        const result: string = value.result.trim();
        this.submitted.emit({
          name: value.name.trim(),
          ownerUserId: value.owner ?? this.userId(),
          spaceId: this.spaces() === null ? null : value.space,
          firstResult:
            result === '' ? null : { label: result, target: targetOf(value.target.trim()) },
        });
        return Promise.resolve();
      },
      onInvalid: (fields: FieldTree<GoalFormModel>): void => {
        if (fields.name().invalid()) fields.name().focusBoundControl();
        else if (fields.owner().invalid()) fields.owner().focusBoundControl();
        else if (fields.space().invalid()) fields.space().focusBoundControl();
        else if (fields.result().invalid()) fields.result().focusBoundControl();
        else fields.target().focusBoundControl();
      },
    });
  }
  // #endregion
}
