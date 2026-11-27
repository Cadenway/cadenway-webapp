import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  linkedSignal,
  signal,
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
import { CwAlert, CwAlertActions, CwAlertDescription } from '@cadenway/ui/components/alert';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwCard,
  CwCardContent,
  CwCardDescription,
  CwCardHeader,
  CwCardTitle,
} from '@cadenway/ui/components/card';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { CwToastService } from '@cadenway/ui/components/toast';
import { NgIcon } from '@ng-icons/core';

import type { PresenceStatus } from '@core/realtime';
import { SignOut } from '@features/auth';
import {
  WORKSPACE_REFRESH,
  type WorkspaceRefreshPort,
} from '@features/workspace/ports/workspace-refresh';
import { DiscardChangesDialog } from '@features/workspace/ui/dialogs/discard-changes-dialog';
import { type UnsavedChanges, warnBeforeUnload } from '@shared/unsaved-changes';

import type {
  AccountProfile,
  AvatarOutcome,
  DeletionResult,
  MyOrganization,
  ProfileChange,
  ProfileField,
  ProfileFieldRefusal,
  ProfileForm as ProfileFormValue,
  ProfileSaveResult,
  TimeZoneOption,
} from '../../../models/profile/profile.interface';
import { timeZoneOptions } from '../../../models/profile/time-zone.util';
import type { PresencePort } from '../../../ports/presence/presence-port.interface';
import { PRESENCE } from '../../../ports/presence/presence.token';
import { ProfileStore } from '../../../state/profile/profile.store';
import {
  type PresenceChoice,
  PresencePicker,
} from '../../components/presence-picker/presence-picker.component';
import { ProfileForm } from '../../components/profile-form/profile-form.component';
import { ProfilePhoto } from '../../components/profile-photo/profile-photo.component';
import {
  AccountDeletionDialog,
  listNames,
} from '../../dialogs/account-deletion-dialog/account-deletion-dialog.component';
import { EmailChangeDialog } from '../../dialogs/email-change-dialog/email-change-dialog.component';

/**
 * Constant NAME_LIMIT
 *
 * @description
 * The longest full name or job title the contract accepts, in characters.
 *
 * @type {number}
 */
const NAME_LIMIT: number = 120;

/**
 * Constant DISPLAY_NAME_LIMIT
 *
 * @description
 * The longest display name the contract accepts, in characters.
 *
 * @type {number}
 */
const DISPLAY_NAME_LIMIT: number = 60;

/**
 * Constant FORM_FIELDS
 *
 * @description
 * The fields of the `Personal information` form, merged one by one.
 *
 * @type {readonly ProfileField[]}
 */
const FORM_FIELDS: readonly ProfileField[] = ['name', 'displayName', 'jobTitle', 'timeZone'];

/**
 * Constant PRESENCE_REFUSAL_WINDOW
 *
 * @description
 * How long after a presence picked here a return of `ownStatus` to the presence before it counts
 * as the gateway's refusal, in milliseconds. `PRESENCE` reports no acknowledgement, so a later
 * change (another tab, the presence snapshot) is not taken for a refusal.
 *
 * @type {number}
 */
const PRESENCE_REFUSAL_WINDOW: number = 10_000;

/**
 * Interface PendingPresence
 *
 * @description
 * A presence picked on this page, watched for a refusal.
 */
interface PendingPresence {
  // #region Properties
  /**
   * Property status
   *
   * @description
   * The presence picked.
   *
   * @type {PresenceStatus}
   * @readonly
   */
  readonly status: PresenceStatus;

  /**
   * Property previous
   *
   * @description
   * The presence before the pick, which `ownStatus` returns to when the gateway refuses it.
   *
   * @type {PresenceStatus | null}
   * @readonly
   */
  readonly previous: PresenceStatus | null;

  /**
   * Property until
   *
   * @description
   * When the watch ends, in milliseconds since the epoch.
   *
   * @type {number}
   * @readonly
   */
  readonly until: number;
  // #endregion
}

/**
 * Interface Snapshot
 *
 * @description
 * The saved account as the form shows it: the draft's base.
 */
interface Snapshot {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * The account, or null while none is read.
   *
   * @type {string | null}
   * @readonly
   */
  readonly id: string | null;

  /**
   * Property value
   *
   * @description
   * Its form value.
   *
   * @type {ProfileFormValue}
   * @readonly
   */
  readonly value: ProfileFormValue;
  // #endregion
}

/**
 * Function formOf
 *
 * @description
 * The form value of a saved account, empty while none is read.
 *
 * @param {AccountProfile | null} profile - The saved account.
 * @returns {ProfileFormValue} What the form starts from.
 */
function formOf(profile: AccountProfile | null): ProfileFormValue {
  return {
    name: profile?.name ?? '',
    displayName: profile?.displayName ?? '',
    jobTitle: profile?.jobTitle ?? '',
    timeZone: profile?.timeZone ?? null,
  };
}

/**
 * Function sameValue
 *
 * @description
 * Whether two values of a field mean the same: texts are compared trimmed, as they are sent.
 *
 * @param {ProfileFormValue} a - A form value.
 * @param {ProfileFormValue} b - Another form value.
 * @param {ProfileField} field - The field.
 * @returns {boolean} True when the field means the same in both.
 */
function sameValue(a: ProfileFormValue, b: ProfileFormValue, field: ProfileField): boolean {
  const left: string | null = a[field];
  const right: string | null = b[field];
  return typeof left === 'string' && typeof right === 'string'
    ? left.trim() === right.trim()
    : left === right;
}

/**
 * Function sameForm
 *
 * @description
 * Whether two form values are exactly equal, so a read that changes only the photo, the address or
 * the version is no change of the base.
 *
 * @param {ProfileFormValue} a - A value.
 * @param {ProfileFormValue} b - Another value.
 * @returns {boolean} True when every field is equal.
 */
function sameForm(a: ProfileFormValue, b: ProfileFormValue): boolean {
  return FORM_FIELDS.every((field: ProfileField): boolean => a[field] === b[field]);
}

/**
 * Function mergeDraft
 *
 * @description
 * The draft once the saved account moved from `base` to `fresh`: a field the person changed from
 * the base keeps their edit, any other takes the fresh value.
 *
 * @param {ProfileFormValue} base - The saved value the draft started from.
 * @param {ProfileFormValue} draft - The draft.
 * @param {ProfileFormValue} fresh - The saved value now.
 * @returns {ProfileFormValue} The merged draft.
 */
function mergeDraft(
  base: ProfileFormValue,
  draft: ProfileFormValue,
  fresh: ProfileFormValue,
): ProfileFormValue {
  const pick: <K extends ProfileField>(field: K) => ProfileFormValue[K] = <K extends ProfileField>(
    field: K,
  ): ProfileFormValue[K] => (sameValue(draft, base, field) ? fresh[field] : draft[field]);
  return {
    name: pick('name'),
    displayName: pick('displayName'),
    jobTitle: pick('jobTitle'),
    timeZone: pick('timeZone'),
  };
}

/**
 * Function collisions
 *
 * @description
 * The fields both the person and someone else changed from the base, to different values.
 *
 * @param {ProfileFormValue} base - The saved value the draft started from.
 * @param {ProfileFormValue} draft - The draft.
 * @param {ProfileFormValue} fresh - The saved value now.
 * @returns {readonly ProfileField[]} The colliding fields.
 */
function collisions(
  base: ProfileFormValue,
  draft: ProfileFormValue,
  fresh: ProfileFormValue,
): readonly ProfileField[] {
  return FORM_FIELDS.filter(
    (field: ProfileField): boolean =>
      !sameValue(draft, base, field) &&
      !sameValue(fresh, base, field) &&
      !sameValue(fresh, draft, field),
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
 * What the form changes from the saved account: the name trimmed, an empty display name or job
 * title as null, and the time zone once one is chosen.
 *
 * @param {AccountProfile | null} saved - The saved account.
 * @param {ProfileFormValue} edited - The form value.
 * @returns {ProfileChange} The members that differ; empty when nothing does.
 */
function changeBetween(saved: AccountProfile | null, edited: ProfileFormValue): ProfileChange {
  if (saved === null) return {};
  const name: string = edited.name.trim();
  const displayName: string | null = optional(edited.displayName);
  const jobTitle: string | null = optional(edited.jobTitle);
  return {
    ...(name === saved.name ? {} : { name }),
    ...(displayName === saved.displayName ? {} : { displayName }),
    ...(jobTitle === saved.jobTitle ? {} : { jobTitle }),
    ...(edited.timeZone === null || edited.timeZone === saved.timeZone
      ? {}
      : { timeZone: edited.timeZone }),
  };
}

/**
 * Component ProfilePage
 *
 * @description
 * The account settings section `Profile` (mockup `Compte.dc.html` lines 139-265, dialogs lines
 * 593-635 and 748-755, logic lines 1534-1591). It shows the parts the contract serves:
 *
 * - `Photo` (`ProfilePhoto`): the photo applies at once, as in the mockup: a PNG, JPEG or WebP of
 *   at most 5 MiB is uploaded and toasts `Photo updated` with its file name, `Remove` toasts
 *   `Photo removed`, a refused file toasts why, and the file input takes the focus afterwards.
 * - `Personal information` (`ProfileForm`): `Full name`, `Display name`, the read-only address
 *   with `Change the address` (`EmailChangeDialog`), `Job title (optional)` and `Time zone`, and the
 *   `Unsaved changes` footer with `Cancel` and `Save`. `Save` sends only what changed and toasts
 *   `Profile saved`, then asks the workspace to verify the person again (`WORKSPACE_REFRESH`) so
 *   the shell shows a new name, as a confirmed address does.
 * - `Status and availability` (`PresencePicker`): a picked presence applies at once through
 *   Account's `PRESENCE` and toasts `Status: <presence>`; a presence the gateway refuses, which
 *   `ownStatus` then leaves, toasts the failure; while realtime is off the cards are disabled. The
 *   status message (gap B3) is not rendered.
 * - `Delete my account`: `Delete the account` reads the person's organizations, then asks through
 *   `AccountDeletionDialog`, typing the name; the deletion runs through the reauthentication, and
 *   once scheduled the person is signed out (the signed-out screen). An organization the person
 *   still owns (`409 account.organization-owner`) toasts that it must first have another owner.
 *
 * The draft is kept apart from the saved account it started from. When a read brings a newer
 * account (after a photo change, a stale version or a confirmed address), each field the person
 * changed keeps their edit and every other takes the new value; a field someone else changed to
 * another value meanwhile toasts the conflict instead of the photo's success. The draft starts over
 * only after a successful save, `Cancel`, or for another account.
 *
 * While the account loads, a skeleton of the section shows (`Loading the section`); a failed read
 * reaches the route's error boundary, whose `Retry` runs the route again. A reread after a write
 * that fails never does: the last confirmed account and the draft stay, and an inline alert says
 * the profile could not be refreshed, with `Retry`. The route guards the unsaved edits with
 * `unsavedChangesGuard`, which asks through `cw-discard-changes-dialog` once a save on its way has
 * settled (never once the deletion is scheduled), and the page asks the browser to confirm closing
 * or reloading the tab while they last. Below 768 px the fields and the status cards take one
 * column and the rows wrap.
 */
@Component({
  selector: 'cw-profile-page',
  imports: [
    AccountDeletionDialog,
    CwAlert,
    CwAlertActions,
    CwAlertDescription,
    CwButton,
    CwCard,
    CwCardContent,
    CwCardDescription,
    CwCardHeader,
    CwCardTitle,
    CwSkeleton,
    DiscardChangesDialog,
    EmailChangeDialog,
    NgIcon,
    PresencePicker,
    ProfileForm,
    ProfilePhoto,
  ],
  providers: [ProfileStore],
  templateUrl: './profile-page.component.html',
})
export class ProfilePage implements UnsavedChanges {
  // #region Properties
  /**
   * Property store
   *
   * @description
   * The account, its photo and their changes.
   *
   * @type {InstanceType<typeof ProfileStore>}
   * @readonly
   */
  protected readonly store: InstanceType<typeof ProfileStore> = inject(ProfileStore);

  /**
   * Property presence
   *
   * @description
   * The person's own presence.
   *
   * @type {PresencePort}
   * @readonly
   */
  protected readonly presence: PresencePort = inject(PRESENCE);

  /**
   * Property workspaceRefresh
   *
   * @description
   * Asks the workspace to verify the person again after a save or a new address.
   *
   * @type {WorkspaceRefreshPort}
   * @readonly
   */
  private readonly workspaceRefresh: WorkspaceRefreshPort = inject(WORKSPACE_REFRESH);

  /**
   * Property toasts
   *
   * @description
   * Toasts of the settings shell.
   *
   * @type {CwToastService}
   * @readonly
   */
  private readonly toasts: CwToastService = inject(CwToastService);

  /**
   * Property signOut
   *
   * @description
   * Opens the signed-out screen once the deletion is scheduled.
   *
   * @type {SignOut}
   * @readonly
   */
  private readonly signOut: SignOut = inject(SignOut);

  /**
   * Property router
   *
   * @description
   * Opens the signed-out screen when the sign-out request itself fails.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property destroyRef
   *
   * @description
   * Tells whether the page is still shown once a write ends.
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
   * Property photoControl
   *
   * @description
   * The photo row, focused once a photo change ends.
   *
   * @type {Signal<ProfilePhoto | undefined>}
   * @readonly
   */
  private readonly photoControl: Signal<ProfilePhoto | undefined> = viewChild(ProfilePhoto);

  /**
   * Property emailDialog
   *
   * @description
   * The e-mail change dialog.
   *
   * @type {Signal<EmailChangeDialog | undefined>}
   * @readonly
   */
  private readonly emailDialog: Signal<EmailChangeDialog | undefined> =
    viewChild(EmailChangeDialog);

  /**
   * Property deletionOpen
   *
   * @description
   * Whether the deletion confirmation is open.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly deletionOpen: WritableSignal<boolean> = signal(false);

  /**
   * Property organizations
   *
   * @description
   * The person's organizations, read when the deletion is asked for.
   *
   * @type {WritableSignal<readonly MyOrganization[]>}
   * @readonly
   */
  protected readonly organizations: WritableSignal<readonly MyOrganization[]> = signal<
    readonly MyOrganization[]
  >([]);

  /**
   * Property checkingOrganizations
   *
   * @description
   * Whether the organizations are read before the confirmation opens.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly checkingOrganizations: WritableSignal<boolean> = signal(false);

  /**
   * Property pendingPresence
   *
   * @description
   * The last presence picked here, watched for `PRESENCE_REFUSAL_WINDOW`: when `ownStatus` returns
   * to the presence before it meanwhile, the gateway refused it; any other change ends the watch
   * silently.
   *
   * @type {PendingPresence | null}
   */
  private pendingPresence: PendingPresence | null = null;

  /**
   * Property saveUnconfirmed
   *
   * @description
   * Whether the last save lost its answer and the rereads never showed it: the draft stays unsaved
   * with a note, until the next save, `Cancel` or a successful save.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly saveUnconfirmed: WritableSignal<boolean> = signal(false);

  /**
   * Property presenceAvailable
   *
   * @description
   * Whether a picked presence can reach the gateway (realtime is on).
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly presenceAvailable: Signal<boolean> = computed(
    (): boolean => this.presence.status() !== 'disabled',
  );

  /**
   * Property messages
   *
   * @description
   * The field errors, shared by the form's rules and the gateway's refusals.
   *
   * @type {{ readonly name: string; readonly nameTooLong: string; readonly displayName: string; readonly jobTitle: string; readonly timeZone: string }}
   * @readonly
   */
  private readonly messages: {
    readonly name: string;
    readonly nameTooLong: string;
    readonly displayName: string;
    readonly jobTitle: string;
    readonly timeZone: string;
  } = {
    name: $localize`:@@account.profile.name-required:Enter your full name.`,
    nameTooLong: $localize`:@@account.profile.name-too-long:Use 120 characters at most.`,
    displayName: $localize`:@@account.profile.display-name-too-long:Use 60 characters at most.`,
    jobTitle: $localize`:@@account.profile.job-title-too-long:Use 120 characters at most.`,
    timeZone: $localize`:@@account.profile.time-zone-invalid:Choose one of the time zones.`,
  };

  /**
   * Property snapshot
   *
   * @description
   * The saved account as the form shows it, the draft's base; a read that changes only the photo,
   * the address or the version leaves it equal.
   *
   * @type {Signal<Snapshot>}
   * @readonly
   */
  private readonly snapshot: Signal<Snapshot> = computed(
    (): Snapshot => {
      const profile: AccountProfile | null = this.store.current();
      return { id: profile?.id ?? null, value: formOf(profile) };
    },
    { equal: (a: Snapshot, b: Snapshot): boolean => a.id === b.id && sameForm(a.value, b.value) },
  );

  /**
   * Property model
   *
   * @description
   * The draft. It starts from the saved account, starts over for another account, and otherwise
   * merges a newer saved account field by field (`mergeDraft`).
   *
   * @type {WritableSignal<ProfileFormValue>}
   * @readonly
   */
  private readonly model: WritableSignal<ProfileFormValue> = linkedSignal<
    Snapshot,
    ProfileFormValue
  >({
    source: this.snapshot,
    computation: (
      next: Snapshot,
      previous?: { source: Snapshot; value: ProfileFormValue },
    ): ProfileFormValue =>
      previous === undefined || next.id === null || previous.source.id !== next.id
        ? next.value
        : mergeDraft(previous.source.value, previous.value, next.value),
  });

  /**
   * Property profileForm
   *
   * @description
   * The `Personal information` form; its fields are disabled while a save runs.
   *
   * @type {FieldTree<ProfileFormValue>}
   * @readonly
   */
  protected readonly profileForm: FieldTree<ProfileFormValue> = form(this.model, (path) => {
    disabled(path, { when: (): boolean => this.store.saving() });
    validate(path.name, (context: FieldContext<string>) => {
      const name: string = context.value().trim();
      if (name === '') return { kind: 'required', message: this.messages.name };
      return name.length > NAME_LIMIT
        ? { kind: 'maxLength', message: this.messages.nameTooLong }
        : undefined;
    });
    validate(path.displayName, (context: FieldContext<string>) =>
      context.value().trim().length > DISPLAY_NAME_LIMIT
        ? { kind: 'maxLength', message: this.messages.displayName }
        : undefined,
    );
    validate(path.jobTitle, (context: FieldContext<string>) =>
      context.value().trim().length > NAME_LIMIT
        ? { kind: 'maxLength', message: this.messages.jobTitle }
        : undefined,
    );
    validate(path.timeZone, (context: FieldContext<string | null>) =>
      context.value() === null ? { kind: 'required', message: this.messages.timeZone } : undefined,
    );
  });

  /**
   * Property timeZones
   *
   * @description
   * The options of `Time zone`, with their offsets as the page opened, the saved zone included.
   *
   * @type {Signal<readonly TimeZoneOption[]>}
   * @readonly
   */
  protected readonly timeZones: Signal<readonly TimeZoneOption[]> = computed(
    (): readonly TimeZoneOption[] =>
      timeZoneOptions(this.store.current()?.timeZone ?? null, new Date()),
  );

  /**
   * Property change
   *
   * @description
   * What a save would send.
   *
   * @type {Signal<ProfileChange>}
   * @readonly
   */
  private readonly change: Signal<ProfileChange> = computed((): ProfileChange =>
    changeBetween(this.store.current(), this.model()),
  );

  /**
   * Property dirty
   *
   * @description
   * Whether the edits differ from the saved account; typing a value back makes it clean.
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
   * Asks the browser to confirm leaving the tab while edits are unsaved or a photo change runs, and
   * reports a refused presence: when `ownStatus` returns to the presence before a pick made here
   * within `PRESENCE_REFUSAL_WINDOW`, an error toast says so.
   *
   * @constructor
   */
  public constructor() {
    warnBeforeUnload((): boolean => this.hasUnsavedChanges());
    effect((): void => {
      const status: PresenceStatus | null = this.presence.ownStatus();
      const pending: PendingPresence | null = this.pendingPresence;
      if (pending === null || status === pending.status) return;
      this.pendingPresence = null;
      if (Date.now() > pending.until || status === null || status !== pending.previous) return;
      this.toasts.error(
        $localize`:@@account.profile.status-failed:The status could not be changed`,
        {
          description: $localize`:@@account.profile.status-failed-text:The server refused it. Try again in a moment.`,
        },
      );
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method hasUnsavedChanges
   *
   * @description
   * Whether leaving would lose edits or a photo change on its way; never once the deletion is
   * scheduled.
   *
   * @returns {boolean} True while the form differs from the saved account or a photo change runs.
   */
  public hasUnsavedChanges(): boolean {
    return (this.dirty() || this.store.avatarChange() !== null) && !this.store.deleted();
  }

  /**
   * Method confirmDiscard
   *
   * @description
   * Asks whether to discard the unsaved edits. A save or a photo change already on its way may
   * still be applied, so the page first waits for it to settle (a photo the page left would be
   * dropped otherwise): once nothing is unsaved the navigation goes; otherwise the person is asked.
   *
   * @returns {Promise<boolean>} Resolves true on `Discard` or once the edits are saved; false on
   * `Keep editing`.
   */
  public async confirmDiscard(): Promise<boolean> {
    await this.store.sent();
    if (!this.hasUnsavedChanges()) return true;
    return this.discard().ask();
  }

  /**
   * Method cancel
   *
   * @description
   * Drops the edits and shows the saved account again.
   */
  protected cancel(): void {
    this.saveUnconfirmed.set(false);
    this.restart();
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
        fields: FieldTree<ProfileFormValue>,
      ): Promise<ValidationError.WithOptionalFieldTree[] | undefined> => {
        this.saveUnconfirmed.set(false);
        const result: ProfileSaveResult = await this.store.save(this.change());
        switch (result.outcome) {
          case 'saved':
            this.restart();
            this.toasts.success($localize`:@@account.profile.saved:Profile saved`, {
              description: $localize`:@@account.profile.saved-text:Your colleagues will see the changes right away.`,
            });
            void this.workspaceRefresh.refresh();
            return undefined;
          case 'refused':
            return result.refusals.map(
              (refusal: ProfileFieldRefusal): ValidationError.WithOptionalFieldTree => ({
                kind: 'server',
                message: this.refusalMessage(refusal.field),
                fieldTree: fields[refusal.field],
              }),
            );
          case 'outdated':
            this.toastConflict();
            return undefined;
          case 'failed':
            this.toasts.error(
              $localize`:@@account.profile.save-failed:The profile could not be saved`,
              {
                description: $localize`:@@account.profile.save-failed-text:Your edits are kept. Try again in a moment.`,
              },
            );
            return undefined;
          case 'unconfirmed':
            this.saveUnconfirmed.set(true);
            return undefined;
          case 'unreconciled':
          case 'skipped':
          case 'cancelled':
            return undefined;
        }
      },
      onInvalid: (fields: FieldTree<ProfileFormValue>): void => {
        this.focusFirstError(fields);
      },
    });
    if (!this.destroyRef.destroyed) this.focusFirstError(this.profileForm);
  }

  /**
   * Method pickPhoto
   *
   * @description
   * Uploads a picked photo and toasts the outcome, or the conflict when the account read
   * afterwards changed a field the person also edited.
   *
   * @param {File} file - The picked file.
   * @returns {Promise<void>} Resolves once the change ended.
   */
  protected async pickPhoto(file: File): Promise<void> {
    const base: ProfileFormValue = this.snapshot().value;
    const outcome: AvatarOutcome = await this.store.uploadAvatar(file);
    if (outcome === 'updated' && !this.collided(base)) {
      this.toasts.success($localize`:@@account.profile.photo-updated:Photo updated`, {
        description: $localize`:@@account.profile.photo-updated-text:${file.name}:file: is visible to the members of your organizations.`,
      });
    } else if (outcome !== 'updated') {
      this.toastPhotoFailure(outcome);
    }
    this.afterPhotoChange(outcome);
  }

  /**
   * Method removePhoto
   *
   * @description
   * Removes the photo and toasts the outcome, or the conflict when the account read afterwards
   * changed a field the person also edited.
   *
   * @returns {Promise<void>} Resolves once the change ended.
   */
  protected async removePhoto(): Promise<void> {
    const base: ProfileFormValue = this.snapshot().value;
    const outcome: AvatarOutcome = await this.store.removeAvatar();
    if (outcome === 'removed' && !this.collided(base)) {
      this.toasts.success($localize`:@@account.profile.photo-removed:Photo removed`, {
        description: $localize`:@@account.profile.photo-removed-text:Your initials show instead.`,
      });
    } else if (outcome !== 'removed') {
      this.toastPhotoFailure(outcome);
    }
    this.afterPhotoChange(outcome);
  }

  /**
   * Method refreshAgain
   *
   * @description
   * Reads the account again after a failed reread (`Retry`); the draft keeps the person's edits,
   * and the conflict is toasted when someone else changed one of them.
   *
   * @returns {Promise<void>} Resolves once the read ended.
   */
  protected async refreshAgain(): Promise<void> {
    const base: ProfileFormValue = this.snapshot().value;
    if (!(await this.store.retryRefresh()) || this.destroyRef.destroyed) return;
    this.collided(base);
  }

  /**
   * Method pickPresence
   *
   * @description
   * Sets the picked presence and confirms it with a toast, as the mockup does; nothing is set while
   * realtime is off.
   *
   * @param {PresenceChoice} choice - The picked card.
   */
  protected pickPresence(choice: PresenceChoice): void {
    if (!this.presenceAvailable() || choice.status === this.presence.ownStatus()) return;
    this.pendingPresence = {
      status: choice.status,
      previous: this.presence.ownStatus(),
      until: Date.now() + PRESENCE_REFUSAL_WINDOW,
    };
    this.presence.setPresence(choice.status);
    this.toasts.show($localize`:@@account.profile.status-toast:Status: ${choice.label}:status:`, {
      description: $localize`:@@account.profile.status-toast-text:${choice.hint}:hint:.`,
    });
  }

  /**
   * Method changeEmail
   *
   * @description
   * Opens the e-mail change dialog.
   */
  protected changeEmail(): void {
    this.emailDialog()?.show();
  }

  /**
   * Method emailChanged
   *
   * @description
   * Asks the workspace to verify the person again once the account holds a new address.
   */
  protected emailChanged(): void {
    void this.workspaceRefresh.refresh();
  }

  /**
   * Method askDeletion
   *
   * @description
   * Reads the person's organizations, which the confirmation counts and names, then opens it; a
   * failed read toasts and opens nothing.
   *
   * @returns {Promise<void>} Resolves once the confirmation opened or the read failed.
   */
  protected async askDeletion(): Promise<void> {
    if (
      this.checkingOrganizations() ||
      this.store.deleting() ||
      this.store.saving() ||
      this.store.avatarChange() !== null
    ) {
      return;
    }
    this.checkingOrganizations.set(true);
    const organizations: readonly MyOrganization[] | null = await this.store.organizations();
    this.checkingOrganizations.set(false);
    if (this.destroyRef.destroyed) return;
    if (organizations === null) {
      this.toasts.error(
        $localize`:@@account.profile.delete-check-failed:Your organizations could not be loaded`,
        {
          description: $localize`:@@account.profile.delete-check-failed-text:Try again in a moment.`,
        },
      );
      return;
    }
    this.organizations.set(organizations);
    this.deletionOpen.set(true);
  }

  /**
   * Method confirmDeletion
   *
   * @description
   * Schedules the deletion once confirmed. Scheduled: the person is signed out and the signed-out
   * screen opens. An organization still owned closes the confirmation and toasts the organizations
   * to hand over; a deletion whose answer was lost and that the account rereads cannot confirm
   * closes the confirmation and asks the person to sign in again to check; another failure toasts
   * and keeps the confirmation; a closed reauthentication keeps it silently.
   *
   * @returns {Promise<void>} Resolves once the deletion ended.
   */
  protected async confirmDeletion(): Promise<void> {
    const result: DeletionResult = await this.store.scheduleDeletion();
    switch (result.outcome) {
      case 'scheduled':
        this.deletionOpen.set(false);
        if (!(await this.signOut.run())) {
          await this.router.navigateByUrl('/logged-out?reason=signed-out', { replaceUrl: true });
        }
        return;
      case 'owner': {
        this.deletionOpen.set(false);
        const owned: readonly string[] = this.ownedNames(result.organizationIds);
        const names: string = listNames(owned);
        this.toasts.error(
          $localize`:@@account.profile.delete-owner-failed:The account could not be deleted`,
          {
            description:
              owned.length === 0
                ? $localize`:@@account.profile.delete-owner-failed-any:Each organization you own must first have another owner.`
                : $localize`:@@account.profile.delete-owner-failed-text:Transfer the ownership of ${names}:names: first.`,
          },
        );
        return;
      }
      case 'failed':
        this.toasts.error(
          $localize`:@@account.profile.delete-failed:The account could not be deleted`,
          { description: $localize`:@@account.profile.delete-failed-text:Try again in a moment.` },
        );
        return;
      case 'unconfirmed':
        this.deletionOpen.set(false);
        this.toasts.warning(
          $localize`:@@account.profile.delete-unconfirmed:The deletion could not be confirmed`,
          {
            description: $localize`:@@account.profile.delete-unconfirmed-text:Sign in again to check your account. If its deletion was scheduled, signing in cancels it.`,
          },
        );
        return;
      case 'cancelled':
        return;
    }
  }

  /**
   * Method ownedNames
   *
   * @description
   * The names of the organizations a refusal lists, from the organizations read; those not read
   * yet are left out.
   *
   * @param {readonly string[]} ids - The organizations the refusal lists.
   * @returns {readonly string[]} Their names.
   */
  private ownedNames(ids: readonly string[]): readonly string[] {
    const known: readonly MyOrganization[] = this.organizations();
    const listed: readonly string[] =
      ids.length > 0
        ? known
            .filter((organization: MyOrganization) => ids.includes(organization.id))
            .map((organization: MyOrganization) => organization.name)
        : [];
    return listed.length > 0
      ? listed
      : known
          .filter((organization: MyOrganization) => organization.owned)
          .map((organization: MyOrganization) => organization.name);
  }

  /**
   * Method restart
   *
   * @description
   * Starts the draft over from the saved account, untouched.
   */
  private restart(): void {
    this.model.set(this.snapshot().value);
    this.profileForm().reset();
  }

  /**
   * Method collided
   *
   * @description
   * Toasts the conflict when the saved account, read again since `base`, changed a field the draft
   * also changed, to another value.
   *
   * @param {ProfileFormValue} base - The saved value before the write.
   * @returns {boolean} True when a conflict was toasted.
   */
  private collided(base: ProfileFormValue): boolean {
    if (collisions(base, this.model(), this.snapshot().value).length === 0) return false;
    this.toastConflict();
    return true;
  }

  /**
   * Method afterPhotoChange
   *
   * @description
   * Once a photo change ended on the page shown, the file input takes the focus back.
   *
   * @param {AvatarOutcome} outcome - How the change ended.
   */
  private afterPhotoChange(outcome: AvatarOutcome): void {
    if (this.destroyRef.destroyed || outcome === 'skipped' || outcome === 'cancelled') return;
    this.photoControl()?.focus();
  }

  /**
   * Method toastConflict
   *
   * @description
   * Toasts that the profile changed elsewhere; the fields the person did not change show the
   * latest version.
   */
  private toastConflict(): void {
    this.toasts.error($localize`:@@account.profile.conflict:Your profile changed in the meantime`, {
      description: $localize`:@@account.profile.conflict-text:Its latest version shows where you changed nothing: check your edits, then save.`,
    });
  }

  /**
   * Method toastPhotoFailure
   *
   * @description
   * Toasts why a photo change did not apply; a skipped or cancelled change toasts nothing.
   *
   * @param {AvatarOutcome} outcome - How the change ended.
   */
  private toastPhotoFailure(outcome: AvatarOutcome): void {
    switch (outcome) {
      case 'unsupported':
        this.toasts.error($localize`:@@account.profile.photo-unsupported:Unsupported format`, {
          description: $localize`:@@account.profile.photo-unsupported-text:Choose a PNG, JPEG or WebP image.`,
        });
        break;
      case 'unreadable':
        this.toasts.error($localize`:@@account.profile.photo-unreadable:Import failed`, {
          description: $localize`:@@account.profile.photo-unreadable-text:Your browser could not read this file.`,
        });
        break;
      case 'too-large':
        this.toasts.error($localize`:@@account.profile.photo-too-large:File too large`, {
          description: $localize`:@@account.profile.photo-too-large-text:Choose an image of 5 MB at most.`,
        });
        break;
      case 'invalid-image':
        this.toasts.error($localize`:@@account.profile.photo-invalid:Image refused`, {
          description: $localize`:@@account.profile.photo-invalid-text:Choose a square still image of 256 to 4,096 px per side.`,
        });
        break;
      case 'outdated':
        this.toasts.error(
          $localize`:@@account.profile.conflict:Your profile changed in the meantime`,
          {
            description: $localize`:@@account.profile.photo-conflict-text:Its latest version is shown: change the photo again.`,
          },
        );
        break;
      case 'failed':
        this.toasts.error(
          $localize`:@@account.profile.photo-failed:The photo could not be changed`,
          { description: $localize`:@@account.profile.photo-failed-text:Try again in a moment.` },
        );
        break;
      case 'unconfirmed':
        this.toasts.warning(
          $localize`:@@account.profile.photo-unconfirmed:The photo change could not be confirmed`,
          {
            description: $localize`:@@account.profile.photo-unconfirmed-text:It may still apply: check your photo in a moment.`,
          },
        );
        break;
      case 'updated':
      case 'removed':
      case 'unreconciled':
      case 'skipped':
      case 'cancelled':
        break;
    }
  }

  /**
   * Method refusalMessage
   *
   * @description
   * The error a field the gateway refused shows: the field's rule.
   *
   * @param {ProfileField} field - The refused field.
   * @returns {string} The message.
   */
  private refusalMessage(field: ProfileField): string {
    const messages: Readonly<Record<ProfileField, string>> = {
      name: this.messages.name,
      displayName: this.messages.displayName,
      jobTitle: this.messages.jobTitle,
      timeZone: this.messages.timeZone,
    };
    return messages[field];
  }

  /**
   * Method focusFirstError
   *
   * @description
   * Focuses the first field showing an error.
   *
   * @param {FieldTree<ProfileFormValue>} fields - The form.
   */
  private focusFirstError(fields: FieldTree<ProfileFormValue>): void {
    fields().errorSummary().at(0)?.fieldTree().focusBoundControl();
  }
  // #endregion
}
