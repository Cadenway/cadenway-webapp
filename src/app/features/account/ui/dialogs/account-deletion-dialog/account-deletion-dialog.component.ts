import {
  Component,
  computed,
  input,
  type InputSignal,
  model,
  type ModelSignal,
  output,
  type OutputEmitterRef,
  type Signal,
} from '@angular/core';
import {
  CwAlertDialog,
  CwAlertDialogAction,
  CwAlertDialogCancel,
  CwAlertDialogDescription,
  CwAlertDialogMedia,
  CwAlertDialogTitle,
  provideCwAlertDialogLabels,
} from '@cadenway/ui/components/alert-dialog';
import { CwButton } from '@cadenway/ui/components/button';
import { NgIcon } from '@ng-icons/core';

import type { MyOrganization } from '../../../models/profile/profile.interface';

/**
 * Function listNames
 *
 * @description
 * Names joined as a sentence lists them in the current locale (`Atelier Nord and Lumen`).
 *
 * @param {readonly string[]} values - The names.
 * @returns {string} The list.
 */
export function listNames(values: readonly string[]): string {
  return new Intl.ListFormat($localize.locale ?? 'en', { type: 'conjunction' }).format(values);
}

/**
 * Component AccountDeletionDialog
 *
 * @description
 * The confirmation of `Delete the account` (mockup `Compte.dc.html` lines 748-755, description
 * line 1543), a `cw-alert-dialog` (`destructive`): `Delete the account of <name>?`, then
 * `You will leave <n> organizations.` and, for the organizations the person owns,
 * `<names> must first have another owner.`; the person types their name to confirm
 * (`confirmText`), and `Delete the account` emits `confirmed`.
 *
 * It holds no state: `name` is the saved full name, `organizations` the person's organizations,
 * `pending` keeps the dialog open with the action's spinner while the deletion runs (the page
 * closes it through `open`). `Cancel` and Escape close it, unless pending.
 */
@Component({
  selector: 'cw-account-deletion-dialog',
  imports: [
    CwAlertDialog,
    CwAlertDialogAction,
    CwAlertDialogCancel,
    CwAlertDialogDescription,
    CwAlertDialogMedia,
    CwAlertDialogTitle,
    CwButton,
    NgIcon,
  ],
  providers: [
    provideCwAlertDialogLabels(() => ({
      confirm: $localize`:@@account.profile.delete-confirm-label:Type your name,`,
    })),
  ],
  template: `
    <cw-alert-dialog
      variant="destructive"
      data-testid="account-deletion-dialog"
      [(open)]="open"
      [confirmText]="name()"
      [pending]="pending()"
      (confirm)="confirmed.emit()"
    >
      <cw-alert-dialog-media>
        <ng-icon name="phosphorTrashBold" aria-hidden="true" />
      </cw-alert-dialog-media>
      <h2 cwAlertDialogTitle i18n="@@account.profile.delete-title">
        Delete the account of {{ name() }}?
      </h2>
      <p cwAlertDialogDescription data-testid="account-deletion-description">
        {{ leaving() }}
        @if (owned(); as names) {
          {{ names }}
        }
      </p>
      <button cwButton cwAlertDialogCancel variant="outline" i18n="@@account.profile.cancel">
        Cancel
      </button>
      <button
        cwButton
        cwAlertDialogAction
        variant="destructive"
        data-testid="account-deletion-confirm"
        [loading]="pending()"
      >
        <ng-icon name="phosphorTrashBold" aria-hidden="true" />
        <ng-container i18n="@@account.profile.delete-confirm">Delete the account</ng-container>
      </button>
    </cw-alert-dialog>
  `,
})
export class AccountDeletionDialog {
  // #region Properties
  /**
   * Property open
   *
   * @description
   * Whether the confirmation is open.
   *
   * @type {ModelSignal<boolean>}
   * @readonly
   */
  public readonly open: ModelSignal<boolean> = model<boolean>(false);

  /**
   * Property name
   *
   * @description
   * The saved full name, typed to confirm.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly name: InputSignal<string> = input.required<string>();

  /**
   * Property organizations
   *
   * @description
   * The person's organizations.
   *
   * @type {InputSignal<readonly MyOrganization[]>}
   * @readonly
   */
  public readonly organizations: InputSignal<readonly MyOrganization[]> = input<
    readonly MyOrganization[]
  >([]);

  /**
   * Property pending
   *
   * @description
   * Whether the deletion runs.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly pending: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property confirmed
   *
   * @description
   * Emits once the person typed their name and confirmed.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly confirmed: OutputEmitterRef<void> = output();

  /**
   * Property leaving
   *
   * @description
   * `You will leave <n> organization(s).`, singular or plural by `Intl.PluralRules`.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly leaving: Signal<string> = computed((): string => {
    const count: number = this.organizations().length;
    return new Intl.PluralRules($localize.locale ?? 'en').select(count) === 'one'
      ? $localize`:@@account.profile.delete-leave-one:You will leave ${count}:count: organization.`
      : $localize`:@@account.profile.delete-leave-other:You will leave ${count}:count: organizations.`;
  });

  /**
   * Property owned
   *
   * @description
   * `<names> must first have another owner.` for the organizations the person owns, or an empty
   * text when there are none.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly owned: Signal<string> = computed((): string => {
    const owned: readonly string[] = this.organizations()
      .filter((organization: MyOrganization) => organization.owned)
      .map((organization: MyOrganization) => organization.name);
    if (owned.length === 0) return '';
    const names: string = listNames(owned);
    return owned.length === 1
      ? $localize`:@@account.profile.delete-owner-one:${names}:names: must first have another owner.`
      : $localize`:@@account.profile.delete-owner-other:${names}:names: must first have another owner each.`;
  });
  // #endregion
}
