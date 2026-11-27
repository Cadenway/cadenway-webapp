import {
  afterRenderEffect,
  Component,
  effect,
  type ElementRef,
  input,
  type InputSignal,
  output,
  type OutputEmitterRef,
  signal,
  type Signal,
  untracked,
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
import { CwCheckbox } from '@cadenway/ui/components/checkbox';
import {
  CwDialog,
  CwDialogDescription,
  CwDialogFooter,
  CwDialogHeader,
  CwDialogTitle,
} from '@cadenway/ui/components/dialog';
import { CwFieldLegend, CwFieldSet } from '@cadenway/ui/components/field';
import { CwInput } from '@cadenway/ui/components/input';
import {
  CwInputGroup,
  CwInputGroupAddon,
  CwInputGroupButton,
  CwInputGroupInput,
} from '@cadenway/ui/components/input-group';
import { CwSelect, CwSelectOption } from '@cadenway/ui/components/select';
import { NgIcon } from '@ng-icons/core';

import type {
  ApiTokenDraft,
  ApiTokenExpiration,
  ApiTokenScope,
} from '../../../models/api-token/api-token.interface';

/**
 * Constant NAME_MAX_LENGTH
 *
 * @description
 * Longest token name the contract accepts.
 *
 * @type {number}
 */
const NAME_MAX_LENGTH: number = 100;

/**
 * Interface ScopeOption
 *
 * @description
 * A scope checkbox of the dialog: the scope, shown in mono, and what it allows.
 */
interface ScopeOption {
  // #region Properties
  /**
   * Property scope
   *
   * @description
   * The scope.
   *
   * @type {ApiTokenScope}
   * @readonly
   */
  readonly scope: ApiTokenScope;

  /**
   * Property hint
   *
   * @description
   * What the scope allows.
   *
   * @type {string}
   * @readonly
   */
  readonly hint: string;
  // #endregion
}

/**
 * Interface ExpirationOption
 *
 * @description
 * An option of the `Expiration` select.
 */
interface ExpirationOption {
  // #region Properties
  /**
   * Property value
   *
   * @description
   * The expiration sent.
   *
   * @type {ApiTokenExpiration}
   * @readonly
   */
  readonly value: ApiTokenExpiration;

  /**
   * Property label
   *
   * @description
   * The option's label.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;
  // #endregion
}

/**
 * Interface TokenCreateModel
 *
 * @description
 * Value of the create form.
 */
interface TokenCreateModel {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * Name of the token, as typed.
   *
   * @type {string}
   */
  name: string;

  /**
   * Property expiration
   *
   * @description
   * How long the token works.
   *
   * @type {ApiTokenExpiration}
   */
  expiration: ApiTokenExpiration;

  /**
   * Property scopes
   *
   * @description
   * Whether each scope is granted.
   *
   * @type {Record<ApiTokenScope, boolean>}
   */
  scopes: Record<ApiTokenScope, boolean>;
  // #endregion
}

/**
 * Function emptyModel
 *
 * @description
 * The form as the dialog opens: no name, 30 days, `tasks:read` only (`Compte.dc.html` line 1686).
 *
 * @returns {TokenCreateModel} The initial value.
 */
function emptyModel(): TokenCreateModel {
  return {
    name: '',
    expiration: '30-days',
    scopes: {
      'tasks:read': true,
      'tasks:write': false,
      'members:read': false,
      'webhooks:manage': false,
    },
  };
}

/**
 * Component TokenCreateDialog
 *
 * @description
 * The `Create a token` dialog of the `API tokens` section (`Compte.dc.html` lines 695-746). Its
 * form asks for a `Name`, an `Expiration` (30 days by default, 90 days, 1 year, no expiration)
 * and the `Scopes` (`tasks:read` checked by default). `Create the token` stays enabled while the
 * form is invalid, as the forms rule asks: an invalid submit shows the errors (a blank name, a
 * name over 100 characters, no scope) and focuses the first faulty field; a valid one emits
 * `submitted` with the trimmed name. While `pending` the button shows its spinner and the dialog
 * cannot be closed. Once the page passes the `secret`, the dialog shows it once, read-only, with
 * `Copy the token` (`copyRequested`) and `I have copied the token`, and focus moves to the secret
 * field, since the form that held it is gone; a backdrop click no longer closes it there, so the
 * secret is not lost by accident. Every close request (`Cancel`, Escape, the backdrop, the last
 * button) emits `dismissed`; `detached` follows once the exit animation ended, so the page keeps
 * the secret step on screen while it leaves and clears the secret then. The form starts over at
 * each opening. It holds no state of its own beyond the form and never stores the secret.
 */
@Component({
  selector: 'cw-token-create-dialog',
  imports: [
    CwButton,
    CwCheckbox,
    CwDialog,
    CwDialogDescription,
    CwDialogFooter,
    CwDialogHeader,
    CwDialogTitle,
    CwFieldLegend,
    CwFieldSet,
    CwInput,
    CwInputGroup,
    CwInputGroupAddon,
    CwInputGroupButton,
    CwInputGroupInput,
    CwSelect,
    CwSelectOption,
    FormField,
    NgIcon,
  ],
  templateUrl: './token-create-dialog.component.html',
})
export class TokenCreateDialog {
  // #region Properties
  /**
   * Property open
   *
   * @description
   * Whether the dialog is open.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly open: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property pending
   *
   * @description
   * Whether the creation is in progress.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly pending: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property secret
   *
   * @description
   * The secret of the token just created, which switches the dialog to its `Token created` step;
   * null for the form.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly secret: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property submitted
   *
   * @description
   * Emits the valid draft on `Create the token`.
   *
   * @type {OutputEmitterRef<ApiTokenDraft>}
   * @readonly
   */
  public readonly submitted: OutputEmitterRef<ApiTokenDraft> = output<ApiTokenDraft>();

  /**
   * Property copyRequested
   *
   * @description
   * Emits on `Copy the token`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly copyRequested: OutputEmitterRef<void> = output();

  /**
   * Property dismissed
   *
   * @description
   * Emits when the dialog closes, whatever closed it.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly dismissed: OutputEmitterRef<void> = output();

  /**
   * Property detached
   *
   * @description
   * Emits once the closed dialog left the screen, after its exit animation.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly detached: OutputEmitterRef<void> = output();

  /**
   * Property secretField
   *
   * @description
   * The read-only field of the secret, present in the `Token created` step only.
   *
   * @type {Signal<ElementRef<HTMLInputElement> | undefined>}
   * @readonly
   */
  private readonly secretField: Signal<ElementRef<HTMLInputElement> | undefined> =
    viewChild<ElementRef<HTMLInputElement>>('secretField');

  /**
   * Property scopeOptions
   *
   * @description
   * The scope checkboxes, in the contract's order.
   *
   * @type {readonly ScopeOption[]}
   * @readonly
   */
  protected readonly scopeOptions: readonly ScopeOption[] = [
    {
      scope: 'tasks:read',
      hint: $localize`:@@account.api-tokens.scope-tasks-read:Read tasks, lists and spaces`,
    },
    {
      scope: 'tasks:write',
      hint: $localize`:@@account.api-tokens.scope-tasks-write:Create and edit tasks`,
    },
    {
      scope: 'members:read',
      hint: $localize`:@@account.api-tokens.scope-members-read:Read the organization's members`,
    },
    {
      scope: 'webhooks:manage',
      hint: $localize`:@@account.api-tokens.scope-webhooks-manage:Create and delete webhooks`,
    },
  ];

  /**
   * Property expirationOptions
   *
   * @description
   * The options of the `Expiration` select (`Compte.dc.html` line 823).
   *
   * @type {readonly ExpirationOption[]}
   * @readonly
   */
  protected readonly expirationOptions: readonly ExpirationOption[] = [
    { value: '30-days', label: $localize`:@@account.api-tokens.expiration-30-days:30 days` },
    { value: '90-days', label: $localize`:@@account.api-tokens.expiration-90-days:90 days` },
    { value: '1-year', label: $localize`:@@account.api-tokens.expiration-1-year:1 year` },
    { value: 'never', label: $localize`:@@account.api-tokens.expiration-never:No expiration` },
  ];

  /**
   * Property model
   *
   * @description
   * Value of the create form.
   *
   * @type {WritableSignal<TokenCreateModel>}
   * @readonly
   */
  private readonly model: WritableSignal<TokenCreateModel> = signal(emptyModel());

  /**
   * Property createForm
   *
   * @description
   * The create form: a name that is not blank, of 100 characters at most, and one scope at least.
   *
   * @type {FieldTree<TokenCreateModel>}
   * @readonly
   */
  protected readonly createForm: FieldTree<TokenCreateModel> = form(this.model, (path) => {
    validate(path.name, (context: FieldContext<string>) =>
      context.value().trim() === ''
        ? {
            kind: 'required',
            message: $localize`:@@account.api-tokens.name-required:Enter a name for the token.`,
          }
        : undefined,
    );
    maxLength(path.name, NAME_MAX_LENGTH, {
      message: $localize`:@@account.api-tokens.name-too-long:Use 100 characters at most.`,
    });
    validate(path.scopes, (context: FieldContext<Record<ApiTokenScope, boolean>>) =>
      Object.values(context.value()).some(Boolean)
        ? undefined
        : {
            kind: 'scopes',
            message: $localize`:@@account.api-tokens.scopes-required:Choose at least one scope.`,
          },
    );
  });
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Starts the form over each time the dialog opens, and moves focus to the secret field once
   * the `Token created` step replaced the form.
   *
   * @constructor
   */
  public constructor() {
    effect((): void => {
      if (!this.open()) return;
      untracked((): void => {
        this.createForm().reset(emptyModel());
      });
    });
    let shown: boolean = false;
    afterRenderEffect((): void => {
      const field: ElementRef<HTMLInputElement> | undefined = this.secretField();
      const showing: boolean = this.secret() !== null && field !== undefined;
      if (showing && !shown) field?.nativeElement.focus();
      shown = showing;
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method send
   *
   * @description
   * Emits the draft of a valid form, or shows the errors and focuses the first faulty field (the
   * first scope for a missing scope).
   *
   * @param {Event} event - The form submission.
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async send(event: Event): Promise<void> {
    event.preventDefault();
    if (this.pending()) return;
    await submit(this.createForm, {
      action: (): Promise<void> => {
        const value: TokenCreateModel = this.model();
        this.submitted.emit({
          name: value.name.trim(),
          scopes: this.scopeOptions
            .map((option: ScopeOption): ApiTokenScope => option.scope)
            .filter((scope: ApiTokenScope): boolean => value.scopes[scope]),
          expiration: value.expiration,
        });
        return Promise.resolve();
      },
      onInvalid: (fields: FieldTree<TokenCreateModel>): void => {
        if (fields.name().invalid()) fields.name().focusBoundControl();
        else if (fields.scopes().invalid()) fields.scopes['tasks:read']().focusBoundControl();
      },
    });
  }

  /**
   * Method scopeId
   *
   * @description
   * Id of a scope checkbox, for its label.
   *
   * @param {number} index - Position of the scope.
   * @returns {string} The id.
   */
  protected scopeId(index: number): string {
    return `token-scope-${String(index)}`;
  }

  /**
   * Method openChanged
   *
   * @description
   * Reports a close of the dialog itself (Escape, the backdrop).
   *
   * @param {boolean} open - The dialog's new open state.
   */
  protected openChanged(open: boolean): void {
    if (!open) this.dismissed.emit();
  }

  /**
   * Method dismiss
   *
   * @description
   * `Cancel` or `I have copied the token`; ignored while the creation runs.
   */
  protected dismiss(): void {
    if (!this.pending()) this.dismissed.emit();
  }
  // #endregion
}
