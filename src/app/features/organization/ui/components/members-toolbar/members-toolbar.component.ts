import {
  Component,
  computed,
  input,
  type InputSignal,
  output,
  type OutputEmitterRef,
  type Signal,
} from '@angular/core';
import {
  CwInputGroup,
  CwInputGroupAddon,
  CwInputGroupInput,
} from '@cadenway/ui/components/input-group';
import { CwTab, CwTabs, CwTabsList } from '@cadenway/ui/components/tabs';
import { NgIcon } from '@ng-icons/core';

import type {
  MemberPresenceFilter,
  MemberRoleCounts,
  MemberRoleFilter,
} from '../../../models/member/member.interface';

/**
 * Constant ROLE_FILTERS
 *
 * @description
 * Keys of the role tabs, in the mockup's order.
 *
 * @type {readonly MemberRoleFilter[]}
 */
const ROLE_FILTERS: readonly MemberRoleFilter[] = ['all', 'admin', 'member', 'guest'];

/**
 * Constant PRESENCE_FILTERS
 *
 * @description
 * Keys of the presence tabs, in the mockup's order.
 *
 * @type {readonly MemberPresenceFilter[]}
 */
const PRESENCE_FILTERS: readonly MemberPresenceFilter[] = ['all', 'online', 'offline'];

/**
 * Component MembersToolbar
 *
 * @description
 * The toolbar of the members section (`Organisation.dc.html` lines 234-250): the search field
 * `Search for a member` (full width on a phone, 256 px from `sm`), the role tabs `Filter by role`
 * (`All`, `Administrators` counting the owner, `Members`, `Guests`, each with its count), the
 * presence tabs `Filter by presence` (`All`, `Online` with a jade dot, `Offline`) and
 * `<n> online`, announced politely. It wraps on a narrow screen. Presentational: the page owns the
 * filters and passes them in; each change is emitted.
 */
@Component({
  selector: 'cw-members-toolbar',
  imports: [CwInputGroup, CwInputGroupAddon, CwInputGroupInput, CwTab, CwTabs, CwTabsList, NgIcon],
  host: { class: 'flex flex-wrap items-center gap-2' },
  templateUrl: './members-toolbar.component.html',
})
export class MembersToolbar {
  // #region Properties
  /**
   * Property search
   *
   * @description
   * Text of the search field.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly search: InputSignal<string> = input<string>('');

  /**
   * Property role
   *
   * @description
   * Active role tab.
   *
   * @type {InputSignal<MemberRoleFilter>}
   * @readonly
   */
  public readonly role: InputSignal<MemberRoleFilter> = input<MemberRoleFilter>('all');

  /**
   * Property presence
   *
   * @description
   * Active presence tab.
   *
   * @type {InputSignal<MemberPresenceFilter>}
   * @readonly
   */
  public readonly presence: InputSignal<MemberPresenceFilter> = input<MemberPresenceFilter>('all');

  /**
   * Property counts
   *
   * @description
   * Members by role, whatever the filters; null hides the counts.
   *
   * @type {InputSignal<MemberRoleCounts | null>}
   * @readonly
   */
  public readonly counts: InputSignal<MemberRoleCounts | null> = input<MemberRoleCounts | null>(
    null,
  );

  /**
   * Property onlineCount
   *
   * @description
   * Members online, away or not to be disturbed.
   *
   * @type {InputSignal<number>}
   * @readonly
   */
  public readonly onlineCount: InputSignal<number> = input<number>(0);

  /**
   * Property searchChanged
   *
   * @description
   * Emits the text of the search field on each input.
   *
   * @type {OutputEmitterRef<string>}
   * @readonly
   */
  public readonly searchChanged: OutputEmitterRef<string> = output<string>();

  /**
   * Property roleChanged
   *
   * @description
   * Emits the role tab picked.
   *
   * @type {OutputEmitterRef<MemberRoleFilter>}
   * @readonly
   */
  public readonly roleChanged: OutputEmitterRef<MemberRoleFilter> = output<MemberRoleFilter>();

  /**
   * Property presenceChanged
   *
   * @description
   * Emits the presence tab picked.
   *
   * @type {OutputEmitterRef<MemberPresenceFilter>}
   * @readonly
   */
  public readonly presenceChanged: OutputEmitterRef<MemberPresenceFilter> =
    output<MemberPresenceFilter>();

  /**
   * Property everyone
   *
   * @description
   * Members of every role; null without counts.
   *
   * @type {Signal<number | null>}
   * @readonly
   */
  protected readonly everyone: Signal<number | null> = computed((): number | null => {
    const counts: MemberRoleCounts | null = this.counts();
    return counts === null ? null : counts.owner + counts.admin + counts.member + counts.guest;
  });

  /**
   * Property roleCounts
   *
   * @description
   * Count of each role tab; `Administrators` counts the owner.
   *
   * @type {Signal<Readonly<Record<MemberRoleFilter, number | undefined>>>}
   * @readonly
   */
  protected readonly roleCounts: Signal<Readonly<Record<MemberRoleFilter, number | undefined>>> =
    computed((): Readonly<Record<MemberRoleFilter, number | undefined>> => {
      const counts: MemberRoleCounts | null = this.counts();
      return {
        all: this.everyone() ?? undefined,
        admin: counts === null ? undefined : counts.owner + counts.admin,
        member: counts?.member,
        guest: counts?.guest,
      };
    });

  /**
   * Property presenceCounts
   *
   * @description
   * Count of each presence tab.
   *
   * @type {Signal<Readonly<Record<MemberPresenceFilter, number | undefined>>>}
   * @readonly
   */
  protected readonly presenceCounts: Signal<
    Readonly<Record<MemberPresenceFilter, number | undefined>>
  > = computed((): Readonly<Record<MemberPresenceFilter, number | undefined>> => {
    const everyone: number | null = this.everyone();
    return {
      all: everyone ?? undefined,
      online: this.onlineCount(),
      offline: everyone === null ? undefined : Math.max(0, everyone - this.onlineCount()),
    };
  });

  /**
   * Property onlineSummary
   *
   * @description
   * `<n> online`.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly onlineSummary: Signal<string> = computed(
    (): string =>
      $localize`:@@organization.members.online-summary:${this.onlineCount()}:count: online`,
  );
  // #endregion

  // #region Methods
  /**
   * Method typed
   *
   * @description
   * Emits the text of the search field.
   *
   * @param {Event} event - Input event of the field.
   */
  protected typed(event: Event): void {
    this.searchChanged.emit((event.target as HTMLInputElement).value);
  }

  /**
   * Method pickRole
   *
   * @description
   * Emits a role tab picked by the tabs, ignoring an unknown value.
   *
   * @param {string} value - Value of the tab.
   */
  protected pickRole(value: string): void {
    const role: MemberRoleFilter | undefined = ROLE_FILTERS.find(
      (key: MemberRoleFilter): boolean => key === value,
    );
    if (role !== undefined) this.roleChanged.emit(role);
  }

  /**
   * Method pickPresence
   *
   * @description
   * Emits a presence tab picked by the tabs, ignoring an unknown value.
   *
   * @param {string} value - Value of the tab.
   */
  protected pickPresence(value: string): void {
    const presence: MemberPresenceFilter | undefined = PRESENCE_FILTERS.find(
      (key: MemberPresenceFilter): boolean => key === value,
    );
    if (presence !== undefined) this.presenceChanged.emit(presence);
  }
  // #endregion
}
