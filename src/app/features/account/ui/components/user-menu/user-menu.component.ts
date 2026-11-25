import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  type Signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { CwAppRailItem } from '@cadenway/ui/components/app-rail';
import {
  CwAvatar,
  provideCwAvatarLabels,
  type CwAvatarPresence,
} from '@cadenway/ui/components/avatar';
import {
  CwMenu,
  CwMenuItem,
  CwMenuItemRadio,
  CwMenuRadioGroup,
  CwMenuSeparator,
  CwMenuTriggerFor,
} from '@cadenway/ui/components/menu';
import { CwToastService } from '@cadenway/ui/components/toast';
import { NgIcon } from '@ng-icons/core';

import type { PresenceStatus } from '@core/realtime';
import { ThemeService } from '@core/theme';
import { SignOut } from '@features/auth';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import type { PresencePort } from '../../../ports/presence/presence-port.interface';
import { PRESENCE } from '../../../ports/presence/presence.token';
import { PresenceDot } from '../presence-dot/presence-dot.component';

/**
 * Interface PresenceOption
 *
 * @description
 * One choice of the « Statut » submenu.
 */
interface PresenceOption {
  // #region Properties
  /**
   * Property status
   *
   * @description
   * Presence the choice sets.
   *
   * @type {PresenceStatus}
   * @readonly
   */
  readonly status: PresenceStatus;

  /**
   * Property label
   *
   * @description
   * Name of the presence (« Actif »).
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property hint
   *
   * @description
   * What the presence means for the others (« Vous apparaissez en ligne »).
   *
   * @type {string}
   * @readonly
   */
  readonly hint: string;
  // #endregion
}

/**
 * Type AccountSection
 *
 * @description
 * Account settings sections the menu opens.
 *
 * @type {'profile' | 'security' | 'notifications'}
 */
type AccountSection = 'profile' | 'security' | 'notifications';

/**
 * Constant PRESENCE_OPTIONS
 *
 * @description
 * The choices of the « Statut » submenu, in the mockup's order (`USER_STATUSES` without « Hors
 * ligne », which is never chosen).
 *
 * @type {readonly PresenceOption[]}
 */
const PRESENCE_OPTIONS: readonly PresenceOption[] = [
  {
    status: 'online',
    label: $localize`:@@account.user-menu.status-online:Active`,
    hint: $localize`:@@account.user-menu.status-online-hint:You appear online`,
  },
  {
    status: 'do-not-disturb',
    label: $localize`:@@account.user-menu.status-dnd:Do not disturb`,
    hint: $localize`:@@account.user-menu.status-dnd-hint:Notifications paused`,
  },
  {
    status: 'away',
    label: $localize`:@@account.user-menu.status-away:Away`,
    hint: $localize`:@@account.user-menu.status-away-hint:You appear away`,
  },
  {
    status: 'invisible',
    label: $localize`:@@account.user-menu.status-invisible:Invisible`,
    hint: $localize`:@@account.user-menu.status-invisible-hint:Signed in, but shown offline`,
  },
];

/**
 * Component UserMenu
 *
 * @description
 * The account button at the bottom of the rail and its menu (mockup `App.dc.html` lines 65-68 and
 * 93-136): the person's initials with their presence dot, without a tooltip; a header with their name and address;
 * the « Statut » submenu (Actif, Ne pas déranger, Absent, Invisible) writing `PRESENCE` and
 * confirming with a toast; « Mon profil », « Sécurité et connexions » and « Notifications », which
 * open `/<slug>/account/<section>`; the « Thème » submenu (Clair, Sombre) driving `ThemeService`
 * from the button's centre; and « Se déconnecter », which goes through Auth's `SignOut` to
 * `/logged-out?reason=signed-out` and shows an error toast when the gateway refuses.
 * « Définir un message de statut » is left out: the backend has no status message yet. It is a
 * slot contribution acting as a widget, so it injects the services it drives. Its host is
 * `display: contents`, so the item joins the rail footer's layout.
 */
@Component({
  selector: 'cw-user-menu',
  imports: [
    CwAppRailItem,
    CwAvatar,
    CwMenu,
    CwMenuItem,
    CwMenuItemRadio,
    CwMenuRadioGroup,
    CwMenuSeparator,
    CwMenuTriggerFor,
    NgIcon,
    PresenceDot,
  ],
  providers: [
    provideCwAvatarLabels(() => ({
      unknown: $localize`:@@account.user-menu.avatar-unknown:Unknown user`,
      online: $localize`:@@account.user-menu.avatar-online:online`,
      away: $localize`:@@account.user-menu.avatar-away:away`,
      dnd: $localize`:@@account.user-menu.avatar-dnd:do not disturb`,
      invisible: $localize`:@@account.user-menu.avatar-invisible:invisible`,
      disabled: $localize`:@@account.user-menu.avatar-disabled:deactivated`,
    })),
  ],
  host: { class: 'contents' },
  templateUrl: './user-menu.component.html',
})
export class UserMenu {
  // #region Properties
  /**
   * Property workspace
   *
   * @description
   * Workspace context whose person the menu shows.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  protected readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property presenceOptions
   *
   * @description
   * Choices of the « Statut » submenu.
   *
   * @type {readonly PresenceOption[]}
   * @readonly
   */
  protected readonly presenceOptions: readonly PresenceOption[] = PRESENCE_OPTIONS;

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
   * Property theme
   *
   * @description
   * App-wide theme preference.
   *
   * @type {ThemeService}
   * @readonly
   */
  protected readonly theme: ThemeService = inject(ThemeService);

  /**
   * Property router
   *
   * @description
   * Router opening the account sections.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property signOut
   *
   * @description
   * Auth's sign-out.
   *
   * @type {SignOut}
   * @readonly
   */
  private readonly signOut: SignOut = inject(SignOut);

  /**
   * Property toasts
   *
   * @description
   * Toasts of the shell's toaster.
   *
   * @type {CwToastService}
   * @readonly
   */
  private readonly toasts: CwToastService = inject(CwToastService);

  /**
   * Property menu
   *
   * @description
   * The account menu, closed after a submenu choice.
   *
   * @type {Signal<CwMenu | undefined>}
   * @readonly
   */
  private readonly menu: Signal<CwMenu | undefined> = viewChild<CwMenu>('accountMenu');

  /**
   * Property trigger
   *
   * @description
   * The account button, from whose centre the theme transition spreads.
   *
   * @type {Signal<ElementRef<HTMLElement> | undefined>}
   * @readonly
   */
  private readonly trigger: Signal<ElementRef<HTMLElement> | undefined> = viewChild<
    string,
    ElementRef<HTMLElement>
  >('trigger', { read: ElementRef });

  /**
   * Property current
   *
   * @description
   * The option of the presence chosen in this tab, or null before a choice: the saved preference
   * is not known here, so nothing is checked and no dot is drawn until then.
   *
   * @type {Signal<PresenceOption | null>}
   * @readonly
   */
  protected readonly current: Signal<PresenceOption | null> = computed(
    (): PresenceOption | null =>
      PRESENCE_OPTIONS.find(
        (option: PresenceOption) => option.status === this.presence.ownStatus(),
      ) ?? null,
  );

  /**
   * Property avatarPresence
   *
   * @description
   * The current presence in the avatar's vocabulary, or null before it is known.
   *
   * @type {Signal<CwAvatarPresence | null>}
   * @readonly
   */
  protected readonly avatarPresence: Signal<CwAvatarPresence | null> = computed(() => {
    const status: PresenceStatus | null = this.presence.ownStatus();
    return status === 'do-not-disturb' ? 'dnd' : status;
  });

  /**
   * Property presenceAvailable
   *
   * @description
   * Whether a chosen presence can reach the gateway: false when realtime is disabled (no
   * `realtimeUrl`), in which case « Statut » is disabled with a hint and nothing is confirmed.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly presenceAvailable: Signal<boolean> = computed(
    (): boolean => this.presence.status() !== 'disabled',
  );

  /**
   * Property pendingPresence
   *
   * @description
   * The last presence chosen here, watched until it is replaced: if `ownStatus` leaves it without a
   * new choice, the gateway refused it.
   *
   * @type {PresenceStatus | null}
   */
  private pendingPresence: PresenceStatus | null = null;

  /**
   * Property label
   *
   * @description
   * Accessible name of the rail button, which has no tooltip: the person and, once chosen, their
   * presence.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly label: Signal<string> = computed((): string => {
    const current: PresenceOption | null = this.current();
    const name: string = this.workspace.user().name;
    return current
      ? $localize`:@@account.user-menu.label:Account of ${name}:name:, status: ${current.label}:status:`
      : $localize`:@@account.user-menu.label-no-status:Account of ${name}:name:`;
  });

  /**
   * Property themeName
   *
   * @description
   * Name of the effective theme, shown after « Thème ».
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly themeName: Signal<string> = computed((): string =>
    this.theme.resolved() === 'dark'
      ? $localize`:@@account.user-menu.theme-dark:Dark`
      : $localize`:@@account.user-menu.theme-light:Light`,
  );
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Reports a refused presence: when `ownStatus` returns to the confirmed value instead of the
   * presence chosen here, an error toast says so.
   *
   * @constructor
   */
  public constructor() {
    effect((): void => {
      const status: PresenceStatus | null = this.presence.ownStatus();
      if (this.pendingPresence === null || status === this.pendingPresence) return;
      this.pendingPresence = null;
      this.toasts.error(
        $localize`:@@account.user-menu.status-failed:The status could not be changed`,
        {
          description: $localize`:@@account.user-menu.status-failed-text:The server refused it. Try again in a moment.`,
        },
      );
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method choosePresence
   *
   * @description
   * Sets the chosen presence, closes the menu and confirms with a toast; choosing the current
   * presence only closes the menu, and nothing is set while realtime is disabled.
   *
   * @param {string | undefined} value - Value of the chosen radio.
   */
  protected choosePresence(value: string | undefined): void {
    const option: PresenceOption | undefined = PRESENCE_OPTIONS.find(
      (candidate: PresenceOption) => candidate.status === value,
    );
    if (!option) return;
    this.menu()?.close();
    if (!this.presenceAvailable() || option.status === this.presence.ownStatus()) return;
    this.pendingPresence = option.status;
    this.presence.setPresence(option.status);
    this.toasts.show($localize`:@@account.user-menu.status-toast:Status: ${option.label}:status:`, {
      description: $localize`:@@account.user-menu.status-toast-text:${option.hint}:hint:.`,
    });
  }

  /**
   * Method chooseTheme
   *
   * @description
   * Closes the menu and applies the chosen theme, spreading from the centre of the account button.
   *
   * @param {string | undefined} value - `light` or `dark`.
   */
  protected chooseTheme(value: string | undefined): void {
    if (value !== 'light' && value !== 'dark') return;
    const box: DOMRect | undefined = this.trigger()?.nativeElement.getBoundingClientRect();
    this.menu()?.close();
    this.theme.set(
      value,
      box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : undefined,
    );
  }

  /**
   * Method open
   *
   * @description
   * Opens an account settings section of the current organization.
   *
   * @param {AccountSection} section - Section to open.
   */
  protected open(section: AccountSection): void {
    void this.router.navigate(['/', this.workspace.organization().slug, 'account', section]);
  }

  /**
   * Method leave
   *
   * @description
   * Signs out; a refusal keeps the person here with an error toast.
   *
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async leave(): Promise<void> {
    if (await this.signOut.run()) return;
    this.toasts.error($localize`:@@account.user-menu.sign-out-failed:Sign-out failed`, {
      description: $localize`:@@account.user-menu.sign-out-failed-text:The server did not answer. Try again in a moment.`,
    });
  }
  // #endregion
}
