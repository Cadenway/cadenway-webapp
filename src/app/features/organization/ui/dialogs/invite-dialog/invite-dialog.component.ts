import {
  Component,
  computed,
  effect,
  input,
  linkedSignal,
  type InputSignal,
  model,
  type ModelSignal,
  output,
  type OutputEmitterRef,
  type Signal,
  signal,
  untracked,
  type WritableSignal,
} from '@angular/core';
import {
  type FieldContext,
  type FieldTree,
  form,
  FormField,
  submit,
  validate,
  type ValidationError,
} from '@angular/forms/signals';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwDialog,
  CwDialogClose,
  CwDialogDescription,
  CwDialogFooter,
  CwDialogHeader,
  CwDialogTitle,
} from '@cadenway/ui/components/dialog';
import { CwSelect, CwSelectOption } from '@cadenway/ui/components/select';
import { CwTextarea } from '@cadenway/ui/components/textarea';
import { NgIcon } from '@ng-icons/core';

import type { AssignableMemberRole } from '../../../models/member/member.interface';
import { takesSingular } from '../../../models/member/plural-form.util';

/**
 * Constant EMAIL_PATTERN
 *
 * @description
 * A valid address as the contract checks it: the pattern of zod 4's `email()`, which
 * `@cadenway/contracts` applies to `InvitationBatch.emails` (`validators/public/members.js`).
 *
 * @type {RegExp}
 */
const EMAIL_PATTERN: RegExp =
  /^(?:[A-Za-z0-9_'+-]+\.)*[A-Za-z0-9_'+-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/u;

/**
 * Constant EMAIL_MAX_LENGTH
 *
 * @description
 * Longest address the contract accepts (`Email`, 254 characters).
 *
 * @type {number}
 */
const EMAIL_MAX_LENGTH: number = 254;

/**
 * Constant MAX_ADDRESSES
 *
 * @description
 * Addresses one batch may invite (`InvitationBatch.emails`, 1 to 50).
 *
 * @type {number}
 */
const MAX_ADDRESSES: number = 50;

/**
 * Interface InviteModel
 *
 * @description
 * The fields of the invite form.
 */
interface InviteModel {
  // #region Properties
  /**
   * Property emails
   *
   * @description
   * Addresses as typed, separated by spaces, commas, semicolons or line breaks.
   *
   * @type {string}
   */
  emails: string;

  /**
   * Property role
   *
   * @description
   * Role of every address.
   *
   * @type {AssignableMemberRole}
   */
  role: AssignableMemberRole;
  // #endregion
}

/**
 * Interface ParsedAddresses
 *
 * @description
 * The typed addresses, split and checked.
 */
interface ParsedAddresses {
  // #region Properties
  /**
   * Property valid
   *
   * @description
   * Valid addresses, each once (compared without regard to case), in the order typed.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly valid: readonly string[];

  /**
   * Property invalid
   *
   * @description
   * Parts that are not a valid address.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly invalid: readonly string[];
  // #endregion
}

/**
 * Interface InviteRequest
 *
 * @description
 * What the dialog submits.
 */
export interface InviteRequest {
  // #region Properties
  /**
   * Property emails
   *
   * @description
   * Distinct valid addresses, 1 to 50.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly emails: readonly string[];

  /**
   * Property role
   *
   * @description
   * Role of every address.
   *
   * @type {AssignableMemberRole}
   * @readonly
   */
  readonly role: AssignableMemberRole;
  // #endregion
}

/**
 * Interface RoleOption
 *
 * @description
 * A choice of the `Role` select.
 */
interface RoleOption {
  // #region Properties
  /**
   * Property value
   *
   * @description
   * The role.
   *
   * @type {AssignableMemberRole}
   * @readonly
   */
  readonly value: AssignableMemberRole;

  /**
   * Property label
   *
   * @description
   * The role and what it gives.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;
  // #endregion
}

/**
 * Function parseAddresses
 *
 * @description
 * Splits what is typed on spaces, commas and semicolons, as the contract asks, and sorts the
 * addresses the contract accepts (zod's `email()`, at most 254 characters) from the rest.
 *
 * @param {string} text - The typed text.
 * @returns {ParsedAddresses} The addresses.
 */
export function parseAddresses(text: string): ParsedAddresses {
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen: Set<string> = new Set<string>();
  for (const part of text.split(/[\s,;]+/u)) {
    if (part === '') continue;
    if (part.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(part)) {
      invalid.push(part);
      continue;
    }
    const key: string = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    valid.push(part);
  }
  return { valid, invalid };
}

/**
 * Function focusFirstError
 *
 * @description
 * Moves focus to the first invalid field after an invalid submit.
 *
 * @template T
 * @param {FieldTree<T>} fields - The submitted form.
 */
function focusFirstError<T>(fields: FieldTree<T>): void {
  const first: ValidationError.WithFieldTree | undefined = fields().errorSummary().at(0);
  first?.fieldTree().focusBoundControl();
}

/**
 * Component InviteDialog
 *
 * @description
 * The dialog `Invite members` (`Organisation.dc.html` lines 661-670, logic lines 1874-1886):
 * `<n> seats available on the <plan> plan.` when the seats are known (an owner's), the
 * `Email addresses` text area with the count of valid addresses under it (`Separate the addresses
 * with a comma or a line break.`, then `<n> valid addresses ·` and the seats left, `guests do not
 * take a seat`, or the shortage), the `Role` select (`Member`, `Administrator`, `Guest`, each with
 * what it gives) and `Cancel` / `Invite`. `Invite` stays enabled: an invalid submit shows the error
 * (no address, an invalid or refused one, more than 50, or more members than free seats) and
 * focuses the field. While `pending` the dialog cannot be closed and `Invite` shows its spinner.
 * The form starts empty, as a member, each time the dialog opens. Presentational: a valid submit
 * emits
 * `submitted`; the page sends it and closes the dialog on success.
 */
@Component({
  selector: 'cw-invite-dialog',
  imports: [
    CwButton,
    CwDialog,
    CwDialogClose,
    CwDialogDescription,
    CwDialogFooter,
    CwDialogHeader,
    CwDialogTitle,
    CwSelect,
    CwSelectOption,
    CwTextarea,
    FormField,
    NgIcon,
  ],
  templateUrl: './invite-dialog.component.html',
})
export class InviteDialog {
  // #region Properties
  /**
   * Property open
   *
   * @description
   * Whether the dialog is open, `[(open)]`.
   *
   * @type {ModelSignal<boolean>}
   * @readonly
   */
  public readonly open: ModelSignal<boolean> = model<boolean>(false);

  /**
   * Property seatsFree
   *
   * @description
   * Seats left on the plan; null when the person may not read them (anyone but the owner).
   *
   * @type {InputSignal<number | null>}
   * @readonly
   */
  public readonly seatsFree: InputSignal<number | null> = input<number | null>(null);

  /**
   * Property planName
   *
   * @description
   * Name of the plan (`Team`), for the seats line.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly planName: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property pending
   *
   * @description
   * Whether the invitations are being sent.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly pending: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property refused
   *
   * @description
   * Addresses the API refused as invalid on the last submit; the field names them while they stay.
   *
   * @type {InputSignal<readonly string[]>}
   * @readonly
   */
  public readonly refused: InputSignal<readonly string[]> = input<readonly string[]>([]);

  /**
   * Property submitted
   *
   * @description
   * Emits the addresses and the role of a valid submit.
   *
   * @type {OutputEmitterRef<InviteRequest>}
   * @readonly
   */
  public readonly submitted: OutputEmitterRef<InviteRequest> = output<InviteRequest>();

  /**
   * Property roles
   *
   * @description
   * Choices of the `Role` select (`Organisation.dc.html` line 886).
   *
   * @type {readonly RoleOption[]}
   * @readonly
   */
  protected readonly roles: readonly RoleOption[] = [
    {
      value: 'member',
      label: $localize`:@@organization.members.invite-role-member:Member — access to the shared spaces`,
    },
    {
      value: 'admin',
      label: $localize`:@@organization.members.invite-role-admin:Administrator — manages members and settings`,
    },
    {
      value: 'guest',
      label: $localize`:@@organization.members.invite-role-guest:Guest — access to specific lists, free`,
    },
  ];

  /**
   * Property refusedShown
   *
   * @description
   * The refused addresses the field names: those of `refused`, until the addresses change or the
   * dialog opens again.
   *
   * @type {WritableSignal<readonly string[]>}
   * @readonly
   */
  protected readonly refusedShown: WritableSignal<readonly string[]> = linkedSignal<
    readonly string[]
  >((): readonly string[] => this.refused());

  /**
   * Property model
   *
   * @description
   * Values of the form.
   *
   * @type {WritableSignal<InviteModel>}
   * @readonly
   */
  protected readonly model: WritableSignal<InviteModel> = signal<InviteModel>({
    emails: '',
    role: 'member',
  });

  /**
   * Property parsed
   *
   * @description
   * The typed addresses, split and checked.
   *
   * @type {Signal<ParsedAddresses>}
   * @readonly
   */
  protected readonly parsed: Signal<ParsedAddresses> = computed((): ParsedAddresses =>
    parseAddresses(this.model().emails),
  );

  /**
   * Property inviteForm
   *
   * @description
   * The form: the addresses must hold at least one valid address (the contract's e-mail check, 254
   * characters at most), no invalid or refused one, at most 50, and, when the seats are known, no
   * more members or administrators than free seats.
   *
   * @type {FieldTree<InviteModel>}
   * @readonly
   */
  protected readonly inviteForm: FieldTree<InviteModel> = form(this.model, (path) => {
    validate(path.emails, (context: FieldContext<string>) => {
      const { valid, invalid }: ParsedAddresses = parseAddresses(context.value());
      const refused: ReadonlySet<string> = new Set<string>(
        this.refusedShown().map((email: string): string => email.toLowerCase()),
      );
      const wrong: readonly string[] = [
        ...invalid,
        ...valid.filter((email: string): boolean => refused.has(email.toLowerCase())),
      ];
      if (wrong.length > 0) {
        const list: string = wrong.join(', ');
        return {
          kind: 'incomplete',
          message: $localize`:@@organization.members.invite-invalid:Check these addresses: ${list}:list:.`,
        };
      }
      if (valid.length === 0) {
        return {
          kind: 'required',
          message: $localize`:@@organization.members.invite-required:Enter at least one email address.`,
        };
      }
      if (valid.length > MAX_ADDRESSES) {
        return {
          kind: 'too-many',
          message: $localize`:@@organization.members.invite-too-many:Invite at most 50 addresses at a time.`,
        };
      }
      const free: number | null = this.seatsFree();
      if (free !== null && this.model().role !== 'guest' && valid.length > free) {
        return {
          kind: 'seats',
          message: $localize`:@@organization.members.invite-no-seats:Not enough free seats: add some from Billing.`,
        };
      }
      return undefined;
    });
  });

  /**
   * Property seatsLine
   *
   * @description
   * `<n> seats available on the <plan> plan.`; null when the seats are not known.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  protected readonly seatsLine: Signal<string | null> = computed((): string | null => {
    const free: number | null = this.seatsFree();
    const plan: string | null = this.planName();
    if (free === null || plan === null) return null;
    return takesSingular(free)
      ? $localize`:@@organization.members.invite-seats-one:${free}:count: seat available on the ${plan}:plan: plan.`
      : $localize`:@@organization.members.invite-seats:${free}:count: seats available on the ${plan}:plan: plan.`;
  });

  /**
   * Property hint
   *
   * @description
   * The line under the addresses (`Organisation.dc.html` lines 1878-1881): how to separate them,
   * or the valid count followed by what the seats allow when they are known.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly hint: Signal<string> = computed((): string => {
    const count: number = this.parsed().valid.length;
    if (count === 0) {
      return $localize`:@@organization.members.invite-hint:Separate the addresses with a comma or a line break.`;
    }
    const valid: string = takesSingular(count)
      ? $localize`:@@organization.members.invite-valid-one:${count}:count: valid address`
      : $localize`:@@organization.members.invite-valid:${count}:count: valid addresses`;
    if (this.model().role === 'guest') {
      const guests: string = $localize`:@@organization.members.invite-guests-free:guests do not take a seat`;
      return `${valid} · ${guests}`;
    }
    const free: number | null = this.seatsFree();
    if (free === null) return valid;
    if (count > free) {
      const only: string = takesSingular(free)
        ? $localize`:@@organization.members.invite-only-one:only ${free}:count: free seat: add some from Billing`
        : $localize`:@@organization.members.invite-only:only ${free}:count: free seats: add some from Billing`;
      return `${valid} · ${only}`;
    }
    const left: number = free - count;
    const after: string = takesSingular(left)
      ? $localize`:@@organization.members.invite-left-one:${left}:count: seat left afterwards`
      : $localize`:@@organization.members.invite-left:${left}:count: seats left afterwards`;
    return `${valid} · ${after}`;
  });

  /**
   * Property error
   *
   * @description
   * Message of the addresses field once touched or submitted; null otherwise.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  protected readonly error: Signal<string | null> = computed((): string | null =>
    this.inviteForm.emails().touched()
      ? (this.inviteForm.emails().errors()[0]?.message ?? null)
      : null,
  );
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Empties the form, as a member, each time the dialog opens, and forgets the refused
   * addresses then and whenever the addresses change.
   *
   * @constructor
   */
  public constructor() {
    effect((): void => {
      if (!this.open()) return;
      untracked((): void => {
        this.model.set({ emails: '', role: 'member' });
        this.refusedShown.set([]);
        this.inviteForm().reset();
      });
    });
    let typed: string | null = null;
    effect((): void => {
      const emails: string = this.model().emails;
      untracked((): void => {
        if (typed !== null && typed !== emails) this.refusedShown.set([]);
        typed = emails;
      });
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method send
   *
   * @description
   * Emits a valid submit, or shows the error and focuses the field.
   *
   * @param {Event} event - The form submission.
   * @returns {Promise<void>} Resolves once checked.
   */
  protected async send(event: Event): Promise<void> {
    event.preventDefault();
    if (this.pending()) return;
    await submit(this.inviteForm, {
      action: (): Promise<void> => {
        this.submitted.emit({ emails: this.parsed().valid, role: this.model().role });
        return Promise.resolve();
      },
      onInvalid: (fields: FieldTree<InviteModel>): void => {
        focusFirstError(fields);
      },
    });
  }
  // #endregion
}
