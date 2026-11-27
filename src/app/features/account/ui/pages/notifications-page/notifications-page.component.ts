import { Component, computed, inject, type Signal } from '@angular/core';
import { CwCard } from '@cadenway/ui/components/card';
import { CwRadioGroup, CwRadioGroupItem } from '@cadenway/ui/components/radio-group';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { CwSwitch } from '@cadenway/ui/components/switch';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import type {
  NotificationChannelChange,
  NotificationDigest,
  NotificationPreferences,
} from '../../../models/notification-preferences/notification-preferences.interface';
import {
  NotificationPreferencesStore,
  type NotificationPreferencesStoreInstance,
} from '../../../state/notification-preferences/notification-preferences.store';
import { NotificationMatrix } from '../../components/notification-matrix/notification-matrix.component';

/**
 * Interface DigestOption
 *
 * @description
 * An option of the `Email summary` group.
 */
interface DigestOption {
  // #region Properties
  /**
   * Property digest
   *
   * @description
   * The cadence.
   *
   * @type {NotificationDigest}
   * @readonly
   */
  readonly digest: NotificationDigest;

  /**
   * Property label
   *
   * @description
   * Name of the option.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property hint
   *
   * @description
   * What the option sends.
   *
   * @type {string}
   * @readonly
   */
  readonly hint: string;
  // #endregion
}

/**
 * Type DigestOptions
 *
 * @description
 * The four email cadences, in order: the template renders each radio by its position.
 *
 * @type {readonly [DigestOption, DigestOption, DigestOption, DigestOption]}
 */
type DigestOptions = readonly [DigestOption, DigestOption, DigestOption, DigestOption];

/**
 * Constant DIGEST_OPTIONS
 *
 * @description
 * The email cadences in the mockup's order (`Compte.dc.html` lines 1654-1657).
 *
 * @type {DigestOptions}
 */
const DIGEST_OPTIONS: DigestOptions = [
  {
    digest: 'each',
    label: $localize`:@@account.notifications.digest-each:Every notification`,
    hint: $localize`:@@account.notifications.digest-each-hint:One email per event selected above.`,
  },
  {
    digest: 'daily',
    label: $localize`:@@account.notifications.digest-daily:Daily summary`,
    hint: $localize`:@@account.notifications.digest-daily-hint:Every working day at 9:00, if there is anything new.`,
  },
  {
    digest: 'weekly',
    label: $localize`:@@account.notifications.digest-weekly:Weekly summary`,
    hint: $localize`:@@account.notifications.digest-weekly-hint:On Mondays at 9:00.`,
  },
  {
    digest: 'never',
    label: $localize`:@@account.notifications.digest-never:Never`,
    hint: $localize`:@@account.notifications.digest-never-hint:Only security emails.`,
  },
];

/**
 * Constant SKELETON_CARDS
 *
 * @description
 * Widths of the skeleton's cards: their title line, then their rows (`SK_SECTIONS.notifications`
 * of `Compte.dc.html`, lines 899-910: five rows, then three, each with a switch-sized control).
 *
 * @type {readonly { title: string; rows: readonly string[] }[]}
 */
const SKELETON_CARDS: readonly { title: string; rows: readonly string[] }[] = [
  { title: 'w-4/5', rows: ['w-2/5', 'w-2/3', 'w-3/5', 'w-1/3', 'w-4/5'] },
  { title: 'w-3/4', rows: ['w-1/3', 'w-4/5', 'w-3/4'] },
];

/**
 * Component NotificationsPage
 *
 * @description
 * The account settings section `Notifications` (mockup `Compte.dc.html` lines 355-403), in the
 * centred `max-w-3xl` column of the account settings: the header, the `Events` matrix
 * (`NotificationMatrix`), the `Email summary` radio group and the `Do not disturb` switch. Every
 * change applies at once, with no Save and no success toast, through its page-scoped
 * `NotificationPreferencesStore`, which saves it and puts the confirmed value back with an error
 * toast when the gateway refuses it. While the preferences load, the section skeleton shows
 * (`role="status"`, lines 82-121); a failed read throws from the template into the route's error
 * boundary, whose Retry runs the route again. The mention hint names the person's display name,
 * or their first name when they have none, as a mention would.
 */
@Component({
  selector: 'cw-notifications-page',
  imports: [CwCard, CwRadioGroup, CwRadioGroupItem, CwSkeleton, CwSwitch, NotificationMatrix],
  providers: [NotificationPreferencesStore],
  templateUrl: './notifications-page.component.html',
})
export class NotificationsPage {
  // #region Properties
  /**
   * Property store
   *
   * @description
   * The preferences, their read and their writes.
   *
   * @type {NotificationPreferencesStoreInstance}
   * @readonly
   */
  protected readonly store: NotificationPreferencesStoreInstance = inject(
    NotificationPreferencesStore,
  );

  /**
   * Property workspace
   *
   * @description
   * The signed-in person, whose mention handle the matrix names.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  private readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property preferences
   *
   * @description
   * The preferences shown, or null while they load. Reading it throws once the read failed, so
   * the route's error boundary replaces the page.
   *
   * @type {Signal<NotificationPreferences | null>}
   * @readonly
   */
  protected readonly preferences: Signal<NotificationPreferences | null> = computed(
    (): NotificationPreferences | null =>
      this.store.saved.value() === undefined ? null : this.store.preferences(),
  );

  /**
   * Property mentionHandle
   *
   * @description
   * The person's mention handle, without `@`.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly mentionHandle: Signal<string> = computed((): string => {
    return this.workspace.user().displayName ?? this.workspace.user().firstName;
  });

  /**
   * Property digestOptions
   *
   * @description
   * The email cadences.
   *
   * @type {DigestOptions}
   * @readonly
   */
  protected readonly digestOptions: DigestOptions = DIGEST_OPTIONS;

  /**
   * Property doNotDisturbLabel
   *
   * @description
   * Title of the quiet hours card, also the name of its switch.
   *
   * @type {string}
   * @readonly
   */
  protected readonly doNotDisturbLabel: string = $localize`:@@account.notifications.dnd-title:Do not disturb`;

  /**
   * Property skeletonCards
   *
   * @description
   * Widths of the skeleton's cards.
   *
   * @type {readonly { title: string; rows: readonly string[] }[]}
   * @readonly
   */
  protected readonly skeletonCards: readonly { title: string; rows: readonly string[] }[] =
    SKELETON_CARDS;
  // #endregion

  // #region Methods
  /**
   * Method changeChannel
   *
   * @description
   * Saves a box of the matrix.
   *
   * @param {NotificationChannelChange} change - The box ticked or cleared.
   */
  protected changeChannel(change: NotificationChannelChange): void {
    this.store.change(change);
  }

  /**
   * Method chooseDigest
   *
   * @description
   * Saves the chosen email cadence; any other value is ignored.
   *
   * @param {string | null} value - Value of the chosen option.
   */
  protected chooseDigest(value: string | null): void {
    const option: DigestOption | undefined = DIGEST_OPTIONS.find(
      (candidate: DigestOption) => candidate.digest === value,
    );
    if (option) this.store.change({ kind: 'digest', digest: option.digest });
  }

  /**
   * Method changeDoNotDisturb
   *
   * @description
   * Saves the quiet hours switch.
   *
   * @param {boolean} enabled - Whether quiet hours now apply.
   */
  protected changeDoNotDisturb(enabled: boolean): void {
    this.store.change({ kind: 'doNotDisturb', enabled });
  }
  // #endregion
}
