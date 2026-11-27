import { DOCUMENT } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  linkedSignal,
  type Signal,
  viewChild,
  type WritableSignal,
} from '@angular/core';
import {
  disabled,
  type FieldContext,
  type FieldTree,
  form,
  submit,
  validate,
  type ValidationError,
} from '@angular/forms/signals';
import { Router } from '@angular/router';
import { CwCard, CwCardContent, CwCardHeader, CwCardTitle } from '@cadenway/ui/components/card';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { CwToastService } from '@cadenway/ui/components/toast';

import { DiscardChangesDialog } from '@features/workspace/ui/dialogs/discard-changes-dialog';
import { type UnsavedChanges, warnBeforeUnload } from '@shared/unsaved-changes';

import type {
  OrganizationField,
  OrganizationFieldRefusal,
  OrganizationLanguageOption,
  OrganizationLogoOutcome,
  OrganizationProfile,
  OrganizationProfileChange,
  OrganizationProfileForm,
  OrganizationSaveResult,
} from '../../../models/organization/organization-profile.interface';
import { OrganizationProfileStore } from '../../../state/organization-profile/organization-profile.store';
import { OrganizationForm } from '../../components/organization-form/organization-form.component';
import { OrganizationLogo } from '../../components/organization-logo/organization-logo.component';

/**
 * Constant DESCRIPTION_LIMIT
 *
 * @description
 * The longest description the contract accepts, in characters.
 *
 * @type {number}
 */
const DESCRIPTION_LIMIT: number = 280;

/**
 * Constant NAME_LIMIT
 *
 * @description
 * The longest name the contract accepts, in characters.
 *
 * @type {number}
 */
const NAME_LIMIT: number = 120;

/**
 * Constant WEBSITE_LIMIT
 *
 * @description
 * The longest website the contract accepts, in characters.
 *
 * @type {number}
 */
const WEBSITE_LIMIT: number = 2048;

/**
 * Constant SLUG_PATTERN
 *
 * @description
 * An address of 2 to 63 lowercase letters, digits and single dashes (`Slug`).
 *
 * @type {RegExp}
 */
const SLUG_PATTERN: RegExp = /^(?=.{2,63}$)[a-z0-9]+(-[a-z0-9]+)*$/u;

/**
 * Function formOf
 *
 * @description
 * The form value of a saved organization, empty while none is read.
 *
 * @param {OrganizationProfile | null} profile - The saved organization.
 * @returns {OrganizationProfileForm} What the form starts from.
 */
function formOf(profile: OrganizationProfile | null): OrganizationProfileForm {
  return {
    name: profile?.name ?? '',
    slug: profile?.slug ?? '',
    description: profile?.description ?? '',
    website: profile?.website ?? '',
    defaultLanguage: profile?.defaultLanguage ?? null,
  };
}

/**
 * Function sameForm
 *
 * @description
 * Whether two form values are equal, so a read that changes only the logo or the version keeps the
 * edits.
 *
 * @param {OrganizationProfileForm} a - A value.
 * @param {OrganizationProfileForm} b - Another value.
 * @returns {boolean} True when every field is equal.
 */
function sameForm(a: OrganizationProfileForm, b: OrganizationProfileForm): boolean {
  return (
    a.name === b.name &&
    a.slug === b.slug &&
    a.description === b.description &&
    a.website === b.website &&
    a.defaultLanguage === b.defaultLanguage
  );
}

/**
 * Function optional
 *
 * @description
 * An optional text as sent: trimmed, null when empty.
 *
 * @param {string} value - The text as typed.
 * @returns {string | null} The text to send.
 */
function optional(value: string): string | null {
  const trimmed: string = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Function changeBetween
 *
 * @description
 * What the form changes from the saved organization: the name and address trimmed, an empty
 * description or website as null, and the language once one is picked.
 *
 * @param {OrganizationProfile | null} saved - The saved organization.
 * @param {OrganizationProfileForm} edited - The form value.
 * @returns {OrganizationProfileChange} The members that differ; empty when nothing does.
 */
function changeBetween(
  saved: OrganizationProfile | null,
  edited: OrganizationProfileForm,
): OrganizationProfileChange {
  if (saved === null) return {};
  const name: string = edited.name.trim();
  const slug: string = edited.slug.trim();
  const description: string | null = optional(edited.description);
  const website: string | null = optional(edited.website);
  return {
    ...(name === saved.name ? {} : { name }),
    ...(slug === saved.slug ? {} : { slug }),
    ...(description === saved.description ? {} : { description }),
    ...(website === saved.website ? {} : { website }),
    ...(edited.defaultLanguage === null || edited.defaultLanguage === saved.defaultLanguage
      ? {}
      : { defaultLanguage: edited.defaultLanguage }),
  };
}

/**
 * Function isWebAddress
 *
 * @description
 * Whether a text is an absolute `https` or `http` address, the only schemes the contract accepts.
 *
 * @param {string} value - The text.
 * @returns {boolean} True for an absolute web address.
 */
function isWebAddress(value: string): boolean {
  if (!URL.canParse(value)) return false;
  const url: URL = new URL(value);
  return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname !== '';
}

/**
 * Component GeneralPage
 *
 * @description
 * The organization settings section `Organization profile` (mockup `Organisation.dc.html` lines
 * 130-180, logic lines 1751-1789), for the owner and administrators. It shows the part the
 * contract serves, the `Identity` card: the logo (`OrganizationLogo`), then the form
 * (`OrganizationForm`) with `Name`, `Address`, `Description (optional)`, `Website` and
 * `Default language`, and the `Unsaved changes` footer with `Cancel` and `Save`. The verified
 * domains card (gap B10) and the danger zone (transfer and deletion, gap B12) are not rendered.
 *
 * The logo applies at once, as in the mockup: a PNG or SVG of at most 5 MiB is uploaded and
 * toasts `Logo updated` with its file name, `Remove` toasts `Logo removed` with the initials, and
 * a refused file toasts why. `Save` sends only what changed through the page's
 * `OrganizationProfileStore` and toasts `Organization updated`; a new address then opens
 * `/<new slug>/organization/general`, keeping the query. An invalid submit shows the errors and
 * focuses the first invalid field; an address used by another organization or kept by the
 * application, and a field the gateway refuses, show on that field; a stale version toasts the
 * conflict and shows the latest organization; any other refusal toasts the failure and keeps the
 * edits; a changed organization context and a switch to another organization keep them silently.
 *
 * While the organization loads, a skeleton of the card shows (`Loading the section`); a failed
 * read reaches the route's error boundary, whose `Retry` runs the route again. The route guards
 * the unsaved edits with `unsavedChangesGuard`, which asks through `cw-discard-changes-dialog`
 * once a save on its way has settled, and the page asks the browser to confirm closing or
 * reloading the tab while they last.
 */
@Component({
  selector: 'cw-organization-general-page',
  imports: [
    CwCard,
    CwCardContent,
    CwCardHeader,
    CwCardTitle,
    CwSkeleton,
    DiscardChangesDialog,
    OrganizationForm,
    OrganizationLogo,
  ],
  providers: [OrganizationProfileStore],
  templateUrl: './general-page.component.html',
})
export class GeneralPage implements UnsavedChanges {
  // #region Properties
  /**
   * Property store
   *
   * @description
   * The current organization, its logo and their changes.
   *
   * @type {InstanceType<typeof OrganizationProfileStore>}
   * @readonly
   */
  protected readonly store: InstanceType<typeof OrganizationProfileStore> =
    inject(OrganizationProfileStore);

  /**
   * Property toasts
   *
   * @description
   * Toasts of the settings shell, for the outcome of a save or a logo change.
   *
   * @type {CwToastService}
   * @readonly
   */
  private readonly toasts: CwToastService = inject(CwToastService);

  /**
   * Property router
   *
   * @description
   * Opens the section at its new address after a slug change.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property destroyRef
   *
   * @description
   * Tells whether the page is still shown once a submit ends.
   *
   * @type {DestroyRef}
   * @readonly
   */
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /**
   * Property discard
   *
   * @description
   * The confirmation shown before unsaved edits are lost.
   *
   * @type {Signal<DiscardChangesDialog>}
   * @readonly
   */
  private readonly discard: Signal<DiscardChangesDialog> = viewChild.required(DiscardChangesDialog);

  /**
   * Property host
   *
   * @description
   * The page host shown before the slug, as the organization row shows it.
   *
   * @type {string}
   * @readonly
   */
  protected readonly host: string = inject(DOCUMENT).location.host;

  /**
   * Property descriptionLimit
   *
   * @description
   * The longest description, shown in the count.
   *
   * @type {number}
   * @readonly
   */
  protected readonly descriptionLimit: number = DESCRIPTION_LIMIT;

  /**
   * Property languages
   *
   * @description
   * The options of `Default language`, in the mockup's order (`LANG_OPTS`), each in its own
   * language.
   *
   * @type {readonly OrganizationLanguageOption[]}
   * @readonly
   */
  protected readonly languages: readonly OrganizationLanguageOption[] = [
    { value: 'fr', label: $localize`:@@organization.general.language-fr:Français`, flag: 'flagFr' },
    { value: 'en', label: $localize`:@@organization.general.language-en:English`, flag: 'flagGb' },
    { value: 'de', label: $localize`:@@organization.general.language-de:Deutsch`, flag: 'flagDe' },
  ];

  /**
   * Property messages
   *
   * @description
   * The field errors, shared by the form's rules and the gateway's refusals.
   *
   * @type {{ readonly name: string; readonly nameTooLong: string; readonly slug: string; readonly slugTaken: string; readonly slugReserved: string; readonly description: string; readonly website: string; readonly language: string }}
   * @readonly
   */
  private readonly messages: {
    readonly name: string;
    readonly nameTooLong: string;
    readonly slug: string;
    readonly slugTaken: string;
    readonly slugReserved: string;
    readonly description: string;
    readonly website: string;
    readonly language: string;
  } = {
    name: $localize`:@@organization.general.name-required:Enter the name of the organization.`,
    nameTooLong: $localize`:@@organization.general.name-too-long:Use 120 characters at most.`,
    slug: $localize`:@@organization.general.slug-invalid:Use 2 to 63 lowercase letters, digits and single dashes.`,
    slugTaken: $localize`:@@organization.general.slug-taken:This address is already used by another organization.`,
    slugReserved: $localize`:@@organization.general.slug-reserved:This address is reserved: choose another one.`,
    description: $localize`:@@organization.general.description-too-long:Use 280 characters at most.`,
    website: $localize`:@@organization.general.website-invalid:Enter a full address starting with https://, such as https://example.com.`,
    language: $localize`:@@organization.general.language-invalid:Choose one of the languages.`,
  };

  /**
   * Property saved
   *
   * @description
   * The form value of the saved organization; a read that changes only the logo or the version
   * leaves it equal, so it does not reset the edits.
   *
   * @type {Signal<OrganizationProfileForm>}
   * @readonly
   */
  private readonly saved: Signal<OrganizationProfileForm> = computed(
    (): OrganizationProfileForm => formOf(this.store.current()),
    { equal: sameForm },
  );

  /**
   * Property model
   *
   * @description
   * The form value, reset to the saved organization whenever a read or a save changes its fields,
   * an organization switch included.
   *
   * @type {WritableSignal<OrganizationProfileForm>}
   * @readonly
   */
  private readonly model: WritableSignal<OrganizationProfileForm> = linkedSignal(
    (): OrganizationProfileForm => this.saved(),
  );

  /**
   * Property profileForm
   *
   * @description
   * The `Identity` form; its fields are disabled while a save runs.
   *
   * @type {FieldTree<OrganizationProfileForm>}
   * @readonly
   */
  protected readonly profileForm: FieldTree<OrganizationProfileForm> = form(this.model, (path) => {
    disabled(path, { when: (): boolean => this.store.saving() });
    validate(path.name, (context: FieldContext<string>) => {
      const name: string = context.value().trim();
      if (name === '') return { kind: 'required', message: this.messages.name };
      return name.length > NAME_LIMIT
        ? { kind: 'maxLength', message: this.messages.nameTooLong }
        : undefined;
    });
    validate(path.slug, (context: FieldContext<string>) =>
      SLUG_PATTERN.test(context.value().trim())
        ? undefined
        : { kind: 'pattern', message: this.messages.slug },
    );
    validate(path.description, (context: FieldContext<string>) =>
      context.value().trim().length > DESCRIPTION_LIMIT
        ? { kind: 'maxLength', message: this.messages.description }
        : undefined,
    );
    validate(path.website, (context: FieldContext<string>) => {
      const website: string = context.value().trim();
      return website === '' || (website.length <= WEBSITE_LIMIT && isWebAddress(website))
        ? undefined
        : { kind: 'url', message: this.messages.website };
    });
  });

  /**
   * Property change
   *
   * @description
   * What a save would send.
   *
   * @type {Signal<OrganizationProfileChange>}
   * @readonly
   */
  private readonly change: Signal<OrganizationProfileChange> = computed(
    (): OrganizationProfileChange => changeBetween(this.store.current(), this.model()),
  );

  /**
   * Property dirty
   *
   * @description
   * Whether the edits differ from the saved organization; typing a value back makes it clean.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly dirty: Signal<boolean> = computed(
    (): boolean => Object.keys(this.change()).length > 0,
  );
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Asks the browser to confirm leaving the tab while edits are unsaved.
   *
   * @constructor
   */
  public constructor() {
    warnBeforeUnload((): boolean => this.dirty());
  }
  // #endregion

  // #region Methods
  /**
   * Method hasUnsavedChanges
   *
   * @description
   * Whether leaving would lose edits.
   *
   * @returns {boolean} True while the form differs from the saved organization.
   */
  public hasUnsavedChanges(): boolean {
    return this.dirty();
  }

  /**
   * Method confirmDiscard
   *
   * @description
   * Asks whether to discard the unsaved edits. A save already on its way may still be applied, so
   * the page first waits for it to settle: once accepted, nothing is unsaved and the navigation
   * goes; once refused, the person is asked.
   *
   * @returns {Promise<boolean>} Resolves true on `Discard` or once the edits are saved, false on
   * `Keep editing`.
   */
  public async confirmDiscard(): Promise<boolean> {
    await this.store.sent();
    if (!this.dirty()) return true;
    return this.discard().ask();
  }

  /**
   * Method cancel
   *
   * @description
   * Drops the edits and shows the saved organization again.
   */
  protected cancel(): void {
    this.model.set(this.saved());
    this.profileForm().reset();
  }

  /**
   * Method save
   *
   * @description
   * Submits the form: an invalid one shows its errors and focuses the first, a valid one sends the
   * change and toasts its outcome; refused fields show their error and the first is focused.
   *
   * @returns {Promise<void>} Resolves once the submit ended.
   */
  protected async save(): Promise<void> {
    await submit(this.profileForm, {
      action: async (
        fields: FieldTree<OrganizationProfileForm>,
      ): Promise<ValidationError.WithOptionalFieldTree[] | undefined> => {
        const result: OrganizationSaveResult = await this.store.save(this.change());
        switch (result.outcome) {
          case 'saved':
            this.toasts.success($localize`:@@organization.general.saved:Organization updated`, {
              description: $localize`:@@organization.general.saved-text:Members see the new name and address.`,
            });
            if (result.slugChanged) await this.openAt(result.slug);
            return undefined;
          case 'refused':
            return result.refusals.map(
              (refusal: OrganizationFieldRefusal): ValidationError.WithOptionalFieldTree => ({
                kind: 'server',
                message: this.refusalMessage(refusal),
                fieldTree: fields[refusal.field],
              }),
            );
          case 'outdated':
            this.toasts.error(
              $localize`:@@organization.general.conflict:The organization changed in the meantime`,
              {
                description: $localize`:@@organization.general.conflict-text:Its latest version is shown.`,
              },
            );
            return undefined;
          case 'failed':
            this.toasts.error(
              $localize`:@@organization.general.save-failed:The organization could not be saved`,
            );
            return undefined;
          case 'skipped':
          case 'cancelled':
          case 'context-changed':
            return undefined;
        }
      },
      onInvalid: (fields: FieldTree<OrganizationProfileForm>): void => {
        this.focusFirstError(fields);
      },
    });
    if (!this.destroyRef.destroyed) this.focusFirstError(this.profileForm);
  }

  /**
   * Method pickLogo
   *
   * @description
   * Uploads a picked logo and toasts the outcome.
   *
   * @param {File} file - The picked file.
   * @returns {Promise<void>} Resolves once the change ended.
   */
  protected async pickLogo(file: File): Promise<void> {
    const outcome: OrganizationLogoOutcome = await this.store.uploadLogo(file);
    if (outcome === 'updated') {
      this.toasts.success($localize`:@@organization.general.logo-updated:Logo updated`, {
        description: $localize`:@@organization.general.logo-updated-text:${file.name}:file: shows in the sidebar and emails.`,
      });
      return;
    }
    this.toastLogoFailure(outcome);
  }

  /**
   * Method removeLogo
   *
   * @description
   * Removes the logo and toasts the outcome with the initials shown instead.
   *
   * @returns {Promise<void>} Resolves once the change ended.
   */
  protected async removeLogo(): Promise<void> {
    const outcome: OrganizationLogoOutcome = await this.store.removeLogo();
    if (outcome === 'removed') {
      const initials: string = this.store.current()?.initials ?? '';
      this.toasts.success($localize`:@@organization.general.logo-removed:Logo removed`, {
        description: $localize`:@@organization.general.logo-removed-text:The initials ${initials}:initials: show instead.`,
      });
      return;
    }
    this.toastLogoFailure(outcome);
  }

  /**
   * Method toastLogoFailure
   *
   * @description
   * Toasts why a logo change did not apply; a skipped or cancelled change and a changed
   * organization context, which the workspace recovery handles, toast nothing.
   *
   * @param {OrganizationLogoOutcome} outcome - How the change ended.
   */
  private toastLogoFailure(outcome: OrganizationLogoOutcome): void {
    switch (outcome) {
      case 'unsupported':
        this.toasts.error($localize`:@@organization.general.logo-unsupported:Unsupported format`, {
          description: $localize`:@@organization.general.logo-unsupported-text:Choose a PNG or SVG image.`,
        });
        break;
      case 'unreadable':
        this.toasts.error($localize`:@@organization.general.logo-unreadable:Import failed`, {
          description: $localize`:@@organization.general.logo-unreadable-text:The browser could not read this file.`,
        });
        break;
      case 'too-large':
        this.toasts.error($localize`:@@organization.general.logo-too-large:File too large`, {
          description: $localize`:@@organization.general.logo-too-large-text:Choose an image of 5 MB at most.`,
        });
        break;
      case 'invalid-image':
        this.toasts.error($localize`:@@organization.general.logo-invalid:Image refused`, {
          description: $localize`:@@organization.general.logo-invalid-text:Choose a square still image of 4,096 px per side at most.`,
        });
        break;
      case 'outdated':
        this.toasts.error(
          $localize`:@@organization.general.conflict:The organization changed in the meantime`,
          {
            description: $localize`:@@organization.general.logo-conflict-text:Its latest version is shown: change the logo again.`,
          },
        );
        break;
      case 'failed':
        this.toasts.error(
          $localize`:@@organization.general.logo-failed:The logo could not be changed`,
          {
            description: $localize`:@@organization.general.logo-failed-text:Try again in a moment.`,
          },
        );
        break;
      case 'updated':
      case 'removed':
      case 'skipped':
      case 'cancelled':
      case 'context-changed':
        break;
    }
  }

  /**
   * Method refusalMessage
   *
   * @description
   * The error a refused field shows: the address's own reasons, else the field's rule.
   *
   * @param {OrganizationFieldRefusal} refusal - The refusal.
   * @returns {string} The message.
   */
  private refusalMessage(refusal: OrganizationFieldRefusal): string {
    if (refusal.reason === 'slug-taken') return this.messages.slugTaken;
    if (refusal.reason === 'slug-reserved') return this.messages.slugReserved;
    const messages: Readonly<Record<OrganizationField, string>> = {
      name: this.messages.name,
      slug: this.messages.slug,
      description: this.messages.description,
      website: this.messages.website,
      defaultLanguage: this.messages.language,
    };
    return messages[refusal.field];
  }

  /**
   * Method focusFirstError
   *
   * @description
   * Focuses the first field showing an error.
   *
   * @param {FieldTree<OrganizationProfileForm>} fields - The form.
   */
  private focusFirstError(fields: FieldTree<OrganizationProfileForm>): void {
    fields().errorSummary().at(0)?.fieldTree().focusBoundControl();
  }

  /**
   * Method openAt
   *
   * @description
   * Opens the section at the organization's new address, replacing the old one in the history
   * (it no longer opens the organization), keeping the query (`?lang=fr`).
   *
   * @param {string} slug - The new address.
   * @returns {Promise<void>} Resolves once the navigation ended.
   */
  private async openAt(slug: string): Promise<void> {
    if (this.destroyRef.destroyed) return;
    await this.router.navigate(['/', slug, 'organization', 'general'], {
      queryParamsHandling: 'preserve',
      replaceUrl: true,
    });
  }
  // #endregion
}
