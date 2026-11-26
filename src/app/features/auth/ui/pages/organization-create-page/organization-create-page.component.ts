import { DOCUMENT, formatNumber } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  LOCALE_ID,
  type Signal,
  signal,
  type WritableSignal,
} from '@angular/core';
import {
  type FieldContext,
  type FieldTree,
  form,
  FormField,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { CwAlert, CwAlertDescription } from '@cadenway/ui/components/alert';
import { CwButton } from '@cadenway/ui/components/button';
import { CwCard } from '@cadenway/ui/components/card';
import { CwInput } from '@cadenway/ui/components/input';
import { CwRadioGroup, CwRadioGroupItem } from '@cadenway/ui/components/radio-group';
import { CwSelect, CwSelectOption } from '@cadenway/ui/components/select';
import { CwTextarea } from '@cadenway/ui/components/textarea';
import { NgIcon } from '@ng-icons/core';

import type { PrimaryUse, TeamSize } from '../../../models/organization/organization.interface';
import {
  type CreationResult,
  OrganizationCreateStore,
} from '../../../state/organization-create/organization-create.store';
import { focusFirstError, serverError } from '../../../utils/form-focus/form-focus.util';
import { initials } from '../../../utils/initials/initials.util';
import { slugFromName } from '../../../utils/slug/slug.util';

/**
 * Constant MAX_LOGO_BYTES
 *
 * @description
 * Largest logo the gateway accepts: 5 MiB.
 *
 * @type {number}
 */
const MAX_LOGO_BYTES: number = 5 * 1024 * 1024;

/**
 * Constant LOGO_TYPES
 *
 * @description
 * Logo formats the gateway accepts.
 *
 * @type {readonly string[]}
 */
const LOGO_TYPES: readonly string[] = ['image/png', 'image/svg+xml'];

/**
 * Constant EMAIL_PATTERN
 *
 * @description
 * Shape of one invited address, as loose as the mockup's checks.
 *
 * @type {RegExp}
 */
const EMAIL_PATTERN: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;

/**
 * Function splitEmails
 *
 * @description
 * Splits the invitation field on spaces, commas and semicolons and drops repeats, as the contract
 * asks of the web application.
 *
 * @param {string} value - The field text.
 * @returns {string[]} The distinct addresses, in order.
 */
function splitEmails(value: string): string[] {
  const seen: Set<string> = new Set<string>();
  return value
    .split(/[\s,;]+/u)
    .filter((item: string) => item !== '')
    .filter((item: string) => {
      const key: string = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * Interface CreateModel
 *
 * @description
 * Values of the creation form.
 */
interface CreateModel {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * Organization name.
   *
   * @type {string}
   */
  name: string;

  /**
   * Property teamSize
   *
   * @description
   * Team size.
   *
   * @type {TeamSize}
   */
  teamSize: TeamSize;

  /**
   * Property primaryUse
   *
   * @description
   * Main use.
   *
   * @type {PrimaryUse}
   */
  primaryUse: PrimaryUse;

  /**
   * Property invites
   *
   * @description
   * Addresses to invite, separated by spaces, commas or semicolons.
   *
   * @type {string}
   */
  invites: string;
  // #endregion
}

/**
 * Component OrganizationCreatePage
 *
 * @description
 * Organization creation of `Organisations.dc.html` (`/organizations/new`): logo, name with the
 * generated address preview `app.<domain>/<slug>`, team size, main use and invitations. The
 * gateway's address refusals (`organization.slug-invalid`, `organization.slug-reserved`,
 * `organization.slug-taken`) show on the name. Once created, the session moves to the new
 * organization, its logo is uploaded, and `/<slug>` opens; when the logo could not be uploaded it
 * opens `/<slug>?notice=logo-upload-failed`, which the home screen explains.
 */
@Component({
  selector: 'cw-organization-create-page',
  imports: [
    CwAlert,
    CwAlertDescription,
    CwButton,
    CwCard,
    CwInput,
    CwRadioGroup,
    CwRadioGroupItem,
    CwSelect,
    CwSelectOption,
    CwTextarea,
    FormField,
    NgIcon,
    RouterLink,
  ],
  providers: [OrganizationCreateStore],
  templateUrl: './organization-create-page.component.html',
})
export class OrganizationCreatePage {
  // #region Properties
  /**
   * Property store
   *
   * @description
   * Creation state.
   *
   * @type {OrganizationCreateStore}
   * @readonly
   */
  protected readonly store: OrganizationCreateStore = inject(OrganizationCreateStore);

  /**
   * Property router
   *
   * @description
   * Opens the new workspace.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property destroyRef
   *
   * @description
   * Revokes the logo preview and keeps a late answer from navigating after the page closed.
   *
   * @type {DestroyRef}
   * @readonly
   */
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /**
   * Property initials
   *
   * @description
   * The mark of the draft name, shown in the empty logo box (`Aa` while the name is blank).
   *
   * @type {(name: string) => string}
   * @readonly
   */
  protected readonly initials: (name: string) => string = initials;

  /**
   * Property host
   *
   * @description
   * Host of the application, the prefix of the address preview.
   *
   * @type {string}
   * @readonly
   */
  protected readonly host: string = inject(DOCUMENT).location.host;

  /**
   * Property locale
   *
   * @description
   * Locale of the page, for the logo size's decimal separator.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);

  /**
   * Property slugInvalidMessage
   *
   * @description
   * Refusal of an address shorter than 2 characters.
   *
   * @type {string}
   * @readonly
   */
  private readonly slugInvalidMessage: string = $localize`:@@auth.organization-create.slug-invalid:This name gives no valid address: use at least 2 letters or digits.`;

  /**
   * Property placeholderSlug
   *
   * @description
   * Address shown while the name gives none.
   *
   * @type {string}
   * @readonly
   */
  protected readonly placeholderSlug: string = $localize`:@@auth.organization-create.slug-placeholder:your-organization`;

  /**
   * Property model
   *
   * @description
   * Form values.
   *
   * @type {WritableSignal<CreateModel>}
   * @readonly
   */
  protected readonly model: WritableSignal<CreateModel> = signal({
    name: '',
    teamSize: '6-20',
    primaryUse: 'product-engineering',
    invites: '',
  });

  /**
   * Property createForm
   *
   * @description
   * Requires a name whose address has 2 characters at least, and valid invited addresses.
   *
   * @type {FieldTree<CreateModel>}
   * @readonly
   */
  protected readonly createForm: FieldTree<CreateModel> = form(this.model, (path) => {
    required(path.name, {
      message: $localize`:@@auth.organization-create.name-required:Enter the name of the organization.`,
    });
    validate(path.name, (context: FieldContext<string>) =>
      context.value().trim() !== '' && slugFromName(context.value()).length < 2
        ? { kind: 'slug', message: this.slugInvalidMessage }
        : undefined,
    );
    validate(path.invites, (context: FieldContext<string>) =>
      splitEmails(context.value()).some((item: string) => !EMAIL_PATTERN.test(item))
        ? {
            kind: 'emails',
            message: $localize`:@@auth.organization-create.invites-invalid:Check the addresses: one of them is not an email address.`,
          }
        : undefined,
    );
  });

  /**
   * Property slug
   *
   * @description
   * Address derived from the name, as the gateway derives it.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly slug: Signal<string> = computed(() => slugFromName(this.model().name));

  /**
   * Property logo
   *
   * @description
   * Chosen logo and its preview URL, or null.
   *
   * @type {WritableSignal<{ readonly file: File; readonly url: string } | null>}
   * @readonly
   */
  protected readonly logo: WritableSignal<{ readonly file: File; readonly url: string } | null> =
    signal(null);

  /**
   * Property logoError
   *
   * @description
   * Whether the last chosen file was refused.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly logoError: WritableSignal<boolean> = signal(false);

  /**
   * Property unavailable
   *
   * @description
   * Whether the last creation failed for another reason than a field.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly unavailable: WritableSignal<boolean> = signal(false);

  /**
   * Property sizes
   *
   * @description
   * Team size choices, in mockup order.
   *
   * @type {readonly { readonly value: TeamSize; readonly label: string; readonly hint: string; readonly icon: string }[]}
   * @readonly
   */
  protected readonly sizes: readonly {
    readonly value: TeamSize;
    readonly label: string;
    readonly hint: string;
    readonly icon: string;
  }[] = [
    {
      value: '1-5',
      label: '1–5',
      hint: $localize`:@@auth.organization-create.size-small:Small team`,
      icon: 'phosphorUserBold',
    },
    {
      value: '6-20',
      label: '6–20',
      hint: $localize`:@@auth.organization-create.size-team:Team`,
      icon: 'phosphorUsersBold',
    },
    {
      value: '21-100',
      label: '21–100',
      hint: $localize`:@@auth.organization-create.size-teams:Several teams`,
      icon: 'phosphorUsersThreeBold',
    },
    {
      value: 'over-100',
      label: '100+',
      hint: $localize`:@@auth.organization-create.size-company:Company`,
      icon: 'phosphorBuildingsBold',
    },
  ];

  /**
   * Property uses
   *
   * @description
   * Main use choices, in mockup order.
   *
   * @type {readonly { readonly value: PrimaryUse; readonly label: string }[]}
   * @readonly
   */
  protected readonly uses: readonly { readonly value: PrimaryUse; readonly label: string }[] = [
    {
      value: 'product-engineering',
      label: $localize`:@@auth.organization-create.use-product:Product and engineering`,
    },
    {
      value: 'agency-client-projects',
      label: $localize`:@@auth.organization-create.use-agency:Agency and client projects`,
    },
    {
      value: 'marketing-content',
      label: $localize`:@@auth.organization-create.use-marketing:Marketing and content`,
    },
    {
      value: 'operations-support',
      label: $localize`:@@auth.organization-create.use-operations:Operations and support`,
    },
    { value: 'other', label: $localize`:@@auth.organization-create.use-other:Other` },
  ];
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Revokes the logo preview with the page.
   *
   * @constructor
   */
  public constructor() {
    this.destroyRef.onDestroy(() => {
      this.revokeLogo();
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method pickLogo
   *
   * @description
   * Keeps a PNG or SVG of at most 5 MiB and previews it; refuses anything else.
   *
   * @param {Event} event - The file input change.
   */
  protected pickLogo(event: Event): void {
    const input: EventTarget | null = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const file: File | undefined = input.files?.[0];
    if (file === undefined) return;
    if (!LOGO_TYPES.includes(file.type) || file.size > MAX_LOGO_BYTES) {
      this.logoError.set(true);
      input.value = '';
      return;
    }
    this.revokeLogo();
    this.logo.set({ file, url: URL.createObjectURL(file) });
    this.logoError.set(false);
  }

  /**
   * Method removeLogo
   *
   * @description
   * Drops the chosen logo.
   *
   * @param {HTMLInputElement} input - The file input, focused again.
   */
  protected removeLogo(input: HTMLInputElement): void {
    this.revokeLogo();
    this.logo.set(null);
    this.logoError.set(false);
    input.value = '';
    input.focus();
  }

  /**
   * Method logoAlt
   *
   * @description
   * Alternative text of the logo preview.
   *
   * @param {File} file - The logo.
   * @returns {string} The text.
   */
  protected logoAlt(file: File): string {
    return $localize`:@@auth.organization-create.logo-alt:Logo preview: ${file.name}:name:`;
  }

  /**
   * Method logoSize
   *
   * @description
   * Size of the logo for its caption, as `Organisations.dc.html` writes it: bytes below 1 KiB,
   * whole kilobytes below 1 MiB, megabytes with one decimal above, in the page's locale.
   *
   * @param {File} file - The logo.
   * @returns {string} The localized size.
   */
  protected logoSize(file: File): string {
    const bytes: number = file.size;
    if (bytes < 1024) {
      return $localize`:@@auth.organization-create.size-bytes:${bytes}:count: bytes`;
    }
    if (bytes < 1_048_576) {
      const kilobytes: number = Math.round(bytes / 1024);
      return $localize`:@@auth.organization-create.size-kb:${kilobytes}:count: KB`;
    }
    const megabytes: string = formatNumber(bytes / 1_048_576, this.locale, '1.1-1');
    return $localize`:@@auth.organization-create.size-mb:${megabytes}:count: MB`;
  }

  /**
   * Method create
   *
   * @description
   * Creates the organization and opens its workspace.
   *
   * @param {Event} event - The submit event.
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async create(event: Event): Promise<void> {
    event.preventDefault();
    this.unavailable.set(false);
    await submit(this.createForm, {
      action: async (fields: FieldTree<CreateModel>) => {
        const value: CreateModel = this.model();
        const result: CreationResult = await this.store.create({
          name: value.name.trim(),
          teamSize: value.teamSize,
          primaryUse: value.primaryUse,
          inviteEmails: splitEmails(value.invites),
          logo: this.logo()?.file ?? null,
        });
        if (result.ok) {
          await this.open(
            result.logoFailed && result.destination !== '/organizations'
              ? `${result.destination}?notice=logo-upload-failed`
              : result.destination,
          );
          return undefined;
        }
        if (result.created !== null) {
          await this.open('/organizations');
          return undefined;
        }
        switch (result.problem.code) {
          case 'organization.slug-invalid':
            return serverError(fields.name, this.slugInvalidMessage);
          case 'organization.slug-reserved':
            return serverError(
              fields.name,
              $localize`:@@auth.organization-create.slug-reserved:This address is reserved: choose another name.`,
            );
          case 'organization.slug-taken':
            return serverError(
              fields.name,
              $localize`:@@auth.organization-create.slug-taken:This address is already used: choose another name.`,
            );
          case 'invitation.daily-limit-reached':
            return serverError(
              fields.invites,
              $localize`:@@auth.organization-create.invites-limit:Too many invitations today: invite fewer people, or invite them later from the settings.`,
            );
          default:
            this.unavailable.set(true);
            return undefined;
        }
      },
      onInvalid: (fields: FieldTree<CreateModel>) => {
        focusFirstError(fields);
      },
    });
    if (!this.destroyRef.destroyed) focusFirstError(this.createForm);
  }

  /**
   * Method open
   *
   * @description
   * Opens a path unless the page closed meanwhile.
   *
   * @param {string} path - The application path.
   * @returns {Promise<void>} Resolves once navigated.
   */
  private async open(path: string): Promise<void> {
    if (!this.destroyRef.destroyed) await this.router.navigateByUrl(path, { replaceUrl: true });
  }

  /**
   * Method revokeLogo
   *
   * @description
   * Releases the preview URL of the chosen logo.
   */
  private revokeLogo(): void {
    const current: { readonly file: File; readonly url: string } | null = this.logo();
    if (current !== null) URL.revokeObjectURL(current.url);
  }
  // #endregion
}
