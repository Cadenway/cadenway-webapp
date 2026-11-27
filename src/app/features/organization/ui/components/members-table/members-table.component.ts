import {
  Component,
  computed,
  ElementRef,
  inject,
  input,
  type InputSignal,
  output,
  type OutputEmitterRef,
  type Signal,
} from '@angular/core';
import { type CwAvatarPresence, CwAvatar } from '@cadenway/ui/components/avatar';
import { CwBadge } from '@cadenway/ui/components/badge';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwEmpty,
  CwEmptyContent,
  CwEmptyDescription,
  CwEmptyHeader,
  CwEmptyMedia,
  CwEmptyTitle,
} from '@cadenway/ui/components/empty';
import { CwSelect, CwSelectOption } from '@cadenway/ui/components/select';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import {
  CwTable,
  CwTableBody,
  CwTableCell,
  CwTableContainer,
  CwTableHead,
  CwTableHeader,
  CwTableRow,
} from '@cadenway/ui/components/table';
import { CwTooltip } from '@cadenway/ui/components/tooltip';
import { NgIcon } from '@ng-icons/core';

import { memberRoleLabel } from '../../../models/member/member-role-label.util';
import { takesSingular } from '../../../models/member/plural-form.util';
import type {
  AssignableMemberRole,
  MemberRole,
  MemberRow,
} from '../../../models/member/member.interface';

/**
 * Interface MemberRoleChange
 *
 * @description
 * A role picked in a row's select.
 */
export interface MemberRoleChange {
  // #region Properties
  /**
   * Property member
   *
   * @description
   * The row whose role changes.
   *
   * @type {MemberRow}
   * @readonly
   */
  readonly member: MemberRow;

  /**
   * Property role
   *
   * @description
   * The role picked.
   *
   * @type {AssignableMemberRole}
   * @readonly
   */
  readonly role: AssignableMemberRole;
  // #endregion
}

/**
 * Constant ASSIGNABLE_ROLES
 *
 * @description
 * Choices of a row's role select, in the mockup's order (`Organisation.dc.html` line 887).
 *
 * @type {readonly AssignableMemberRole[]}
 */
const ASSIGNABLE_ROLES: readonly AssignableMemberRole[] = ['admin', 'member', 'guest'];

/**
 * Constant AVATAR_PRESENCE
 *
 * @description
 * The avatar dot of each presence: an offline member shows the hollow dot of `invisible`, which
 * the page's avatar labels read as offline.
 *
 * @type {Readonly<Record<MemberRow['presence'], CwAvatarPresence>>}
 */
const AVATAR_PRESENCE: Readonly<Record<MemberRow['presence'], CwAvatarPresence>> = {
  online: 'online',
  away: 'away',
  'do-not-disturb': 'dnd',
  offline: 'invisible',
};

/**
 * Component MembersTable
 *
 * @description
 * The table `Organization members` (`Organisation.dc.html` lines 251-279) and its pagination
 * `Members pagination` (`1–8 of 21 people`, `Previous`, `Next`). Columns: `Member` (avatar with
 * the live presence dot, name, `(you)` on the person's own row, address), `Role` (the owner's
 * `Owner` badge; for an editor a select `Administrator | Member | Guest` named `Role of <name>`,
 * otherwise the role as text), `Two-step` (`Set up` / `Not set up`, only with `showTwoStep`) and
 * the remove button `Remove <name> from the organization`, shown on row hover or focus from
 * 768 px and always on a phone. The avatar is hidden from screen readers, which hear
 * `Status: <presence>` then the name once. The owner's and the person's own rows cannot be
 * edited; a row with a write being sent is marked `aria-busy` and keeps its focus (the store
 * ignores its picks). `focusRow` moves the focus to another row after a removal. Below 768 px the header is hidden and each row becomes a card:
 * the member cell takes the full width, the actions go right. While `loading` without rows it
 * shows eight skeleton rows; a completed read without rows shows `No member matches`, with
 * `Clear filters` when `filtered`. The last-activity column of the mockup is left out: the
 * contract has no such field (gap M1). Presentational: every action is emitted.
 */
@Component({
  selector: 'cw-members-table',
  imports: [
    CwAvatar,
    CwBadge,
    CwButton,
    CwEmpty,
    CwEmptyContent,
    CwEmptyDescription,
    CwEmptyHeader,
    CwEmptyMedia,
    CwEmptyTitle,
    CwSelect,
    CwSelectOption,
    CwSkeleton,
    CwTable,
    CwTableBody,
    CwTableCell,
    CwTableContainer,
    CwTableHead,
    CwTableHeader,
    CwTableRow,
    CwTooltip,
    NgIcon,
  ],
  host: { class: 'flex flex-col gap-3' },
  templateUrl: './members-table.component.html',
})
export class MembersTable {
  // #region Properties
  /**
   * Property rows
   *
   * @description
   * Members of the page shown.
   *
   * @type {InputSignal<readonly MemberRow[]>}
   * @readonly
   */
  public readonly rows: InputSignal<readonly MemberRow[]> = input<readonly MemberRow[]>([]);

  /**
   * Property total
   *
   * @description
   * Members matching the filters, on every page.
   *
   * @type {InputSignal<number>}
   * @readonly
   */
  public readonly total: InputSignal<number> = input<number>(0);

  /**
   * Property rangeFirst
   *
   * @description
   * One-based position of the first row shown.
   *
   * @type {InputSignal<number>}
   * @readonly
   */
  public readonly rangeFirst: InputSignal<number> = input<number>(0);

  /**
   * Property rangeLast
   *
   * @description
   * One-based position of the last row shown.
   *
   * @type {InputSignal<number>}
   * @readonly
   */
  public readonly rangeLast: InputSignal<number> = input<number>(0);

  /**
   * Property hasPrevious
   *
   * @description
   * Whether `Previous` is enabled.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly hasPrevious: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property hasNext
   *
   * @description
   * Whether `Next` is enabled.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly hasNext: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property editable
   *
   * @description
   * Whether the person may change roles and remove members.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly editable: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property showTwoStep
   *
   * @description
   * Whether the `Two-step` column shows; the API tells it to the owner and administrators only.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly showTwoStep: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property loading
   *
   * @description
   * Whether a read is under way (`aria-busy`, skeleton rows without rows).
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly loading: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property filtered
   *
   * @description
   * Whether a filter narrows the list, which offers `Clear filters` when nothing matches.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly filtered: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property roleChanged
   *
   * @description
   * Emits a role picked in a row, other than the row's current one.
   *
   * @type {OutputEmitterRef<MemberRoleChange>}
   * @readonly
   */
  public readonly roleChanged: OutputEmitterRef<MemberRoleChange> = output<MemberRoleChange>();

  /**
   * Property removeRequested
   *
   * @description
   * Emits the row whose remove button was pressed; the page confirms.
   *
   * @type {OutputEmitterRef<MemberRow>}
   * @readonly
   */
  public readonly removeRequested: OutputEmitterRef<MemberRow> = output<MemberRow>();

  /**
   * Property previousPage
   *
   * @description
   * Emits on `Previous`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly previousPage: OutputEmitterRef<void> = output();

  /**
   * Property nextPage
   *
   * @description
   * Emits on `Next`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly nextPage: OutputEmitterRef<void> = output();

  /**
   * Property filtersCleared
   *
   * @description
   * Emits on `Clear filters`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly filtersCleared: OutputEmitterRef<void> = output();

  /**
   * Property roles
   *
   * @description
   * Choices of the role select.
   *
   * @type {readonly AssignableMemberRole[]}
   * @readonly
   */
  protected readonly roles: readonly AssignableMemberRole[] = ASSIGNABLE_ROLES;

  /**
   * Property skeleton
   *
   * @description
   * Keys of the skeleton rows shown while a read without rows is under way.
   *
   * @type {readonly number[]}
   * @readonly
   */
  protected readonly skeleton: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7];

  /**
   * Property host
   *
   * @description
   * The table's element, to move the focus between rows.
   *
   * @type {ElementRef<HTMLElement>}
   * @readonly
   */
  private readonly host: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * Property columns
   *
   * @description
   * Columns of the table, for a cell spanning them.
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly columns: Signal<number> = computed((): number => (this.showTwoStep() ? 4 : 3));

  /**
   * Property range
   *
   * @description
   * `<first>–<last> of <n> people`, `1–1 of 1 person` or `0 people`.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly range: Signal<string> = computed((): string => {
    const total: number = this.total();
    const first: number = this.rangeFirst();
    const last: number = this.rangeLast();
    if (total === 0 || first === 0) {
      return $localize`:@@organization.members.range-none:0 people`;
    }
    return takesSingular(total)
      ? $localize`:@@organization.members.range-one:${first}:first:–${last}:last: of ${total}:total: person`
      : $localize`:@@organization.members.range:${first}:first:–${last}:last: of ${total}:total: people`;
  });
  // #endregion

  // #region Methods
  /**
   * Method canEdit
   *
   * @description
   * Whether a row offers the role select and the remove button: the person may write, and the
   * row is neither the owner's nor the person's own.
   *
   * @param {MemberRow} member - The row.
   * @returns {boolean} Whether it can be edited.
   */
  protected canEdit(member: MemberRow): boolean {
    return this.editable() && member.role !== 'owner' && !member.me;
  }

  /**
   * Method avatarPresence
   *
   * @description
   * The avatar dot of a row.
   *
   * @param {MemberRow} member - The row.
   * @returns {CwAvatarPresence} The dot.
   */
  protected avatarPresence(member: MemberRow): CwAvatarPresence {
    return AVATAR_PRESENCE[member.presence];
  }

  /**
   * Method statusLabel
   *
   * @description
   * What a screen reader hears of a row's presence dot (`Organisation.dc.html` line 1843), the
   * name being read once, in the member cell.
   *
   * @param {MemberRow} member - The row.
   * @returns {string} `Status: Active`, `Away`, `Do not disturb` or `Offline`.
   */
  protected statusLabel(member: MemberRow): string {
    const status: string = {
      online: $localize`:@@organization.members.status-online:Active`,
      away: $localize`:@@organization.members.status-away:Away`,
      'do-not-disturb': $localize`:@@organization.members.status-dnd:Do not disturb`,
      offline: $localize`:@@organization.members.status-offline:Offline`,
    }[member.presence];
    return $localize`:@@organization.members.status:Status: ${status}:status:`;
  }

  /**
   * Method focusRow
   *
   * @description
   * Focuses the remove button of the row at a position (its first control when it has none), or
   * of the last row when fewer remain, after a removal took the focused row away.
   *
   * @param {number} index - Zero-based position of the row.
   * @returns {boolean} Whether a control took the focus; false without rows or controls.
   */
  public focusRow(index: number): boolean {
    const rows: HTMLElement[] = [
      ...this.host.nativeElement.querySelectorAll<HTMLElement>('[data-testid="member-row"]'),
    ];
    if (rows.length === 0) return false;
    const row: HTMLElement = rows[Math.min(index, rows.length - 1)];
    const control: HTMLElement | null =
      row.querySelector<HTMLElement>('[data-testid="member-remove"]') ??
      row.querySelector<HTMLElement>('button, [tabindex="0"]');
    control?.focus();
    return control !== null;
  }

  /**
   * Method roleName
   *
   * @description
   * The name of a role.
   *
   * @param {MemberRole} role - The role.
   * @returns {string} Its name.
   */
  protected roleName(role: MemberRole): string {
    return memberRoleLabel(role);
  }

  /**
   * Method roleLabel
   *
   * @description
   * Accessible name of a row's role select.
   *
   * @param {MemberRow} member - The row.
   * @returns {string} `Role of <name>`.
   */
  protected roleLabel(member: MemberRow): string {
    return $localize`:@@organization.members.role-of:Role of ${member.name}:name:`;
  }

  /**
   * Method removeLabel
   *
   * @description
   * Accessible name and tooltip of a row's remove button.
   *
   * @param {MemberRow} member - The row.
   * @returns {string} `Remove <name> from the organization`.
   */
  protected removeLabel(member: MemberRow): string {
    return $localize`:@@organization.members.remove-label:Remove ${member.name}:name: from the organization`;
  }

  /**
   * Method pickRole
   *
   * @description
   * Emits a role picked in a row, ignoring the current role and an unknown value.
   *
   * @param {MemberRow} member - The row.
   * @param {unknown} value - Value the select emitted.
   */
  protected pickRole(member: MemberRow, value: unknown): void {
    const role: AssignableMemberRole | undefined = ASSIGNABLE_ROLES.find(
      (option: AssignableMemberRole): boolean => option === value,
    );
    if (role !== undefined && role !== member.role) this.roleChanged.emit({ member, role });
  }
  // #endregion
}
