import {
  Component,
  computed,
  input,
  type InputSignal,
  output,
  type OutputEmitterRef,
  type Signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CwAvatar, CwAvatarGroup } from '@cadenway/ui/components/avatar';
import {
  CwBreadcrumb,
  CwBreadcrumbLink,
  CwBreadcrumbPage,
} from '@cadenway/ui/components/breadcrumb';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwMenu,
  CwMenuItem,
  CwMenuSeparator,
  CwMenuTriggerFor,
} from '@cadenway/ui/components/menu';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { NgIcon } from '@ng-icons/core';

import type { ListDialog } from '../../../models/list-dialog/list-dialog.type';
import type { ListMembers } from '../../../models/list-member/list-member.interface';
import type { Space } from '../../../models/space/space.interface';
import type { ListCounts, TaskList } from '../../../models/task-list/task-list.interface';
import { listIconName, lookIconName, lookTone } from '../../../utils/look/look.util';

/**
 * Component ListHeader
 *
 * @description
 * The header of a list page (`App.dc.html` lines 277-334): the breadcrumb row (the sidebar's
 * expand toggle while the sidebar is collapsed, the space's badge in its color, the list), the
 * list's icon in its color, a button that opens the list dialog, its title, the favorite toggle,
 * the description line (`Sprint of Nov 3 – 17 · 98 tasks · 25% done`), the sprint goal,
 * the members' avatars from 768 px and the `…` menu: edit the list or sprint, edit the space,
 * duplicate with tasks, export CSV, copy link, archive and delete. The openers of `Share`,
 * `Sprint report`, `Space statuses` and `Automations` show only for the released dialogs
 * (`dialogs`) and emit `dialogRequested`, in the mockup's places (lines 309, 317, 324-325).
 * Presentational: every action is an output; the page confirms the deletion.
 */
@Component({
  selector: 'cw-list-header',
  imports: [
    CwAvatar,
    CwAvatarGroup,
    CwBreadcrumb,
    CwBreadcrumbLink,
    CwBreadcrumbPage,
    CwButton,
    CwMenu,
    CwMenuItem,
    CwMenuSeparator,
    CwMenuTriggerFor,
    CwSkeleton,
    NgIcon,
    RouterLink,
  ],
  host: { class: 'flex flex-col gap-3' },
  templateUrl: './list-header.component.html',
})
export class ListHeader {
  // #region Properties
  /**
   * Property list
   *
   * @description
   * The list.
   *
   * @type {InputSignal<TaskList>}
   * @readonly
   */
  public readonly list: InputSignal<TaskList> = input.required<TaskList>();

  /**
   * Property space
   *
   * @description
   * Its space, or null while read.
   *
   * @type {InputSignal<Space | null>}
   * @readonly
   */
  public readonly space: InputSignal<Space | null> = input<Space | null>(null);

  /**
   * Property spaceFailed
   *
   * @description
   * Whether the breadcrumb read failed.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly spaceFailed: InputSignal<boolean> = input(false);

  /**
   * Property countsFailed
   *
   * @description
   * Whether the counts read failed.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly countsFailed: InputSignal<boolean> = input(false);

  /**
   * Property spaceLink
   *
   * @description
   * Address of the space overview.
   *
   * @type {InputSignal<readonly string[]>}
   * @readonly
   */
  public readonly spaceLink: InputSignal<readonly string[]> = input.required<readonly string[]>();

  /**
   * Property counts
   *
   * @description
   * Counts of the description line, or null while read.
   *
   * @type {InputSignal<ListCounts | null>}
   * @readonly
   */
  public readonly counts: InputSignal<ListCounts | null> = input<ListCounts | null>(null);

  /**
   * Property sprintRange
   *
   * @description
   * Formatted sprint range, or null for a plain list.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly sprintRange: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property favorite
   *
   * @description
   * Whether the list is a favorite.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly favorite: InputSignal<boolean> = input(false);

  /**
   * Property exportDisabled
   *
   * @description
   * Prevents exporting until the requested saved filters have been applied.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly exportDisabled: InputSignal<boolean> = input(false);

  /**
   * Property members
   *
   * @description
   * The people the list is shared with, or null when unknown.
   *
   * @type {InputSignal<ListMembers | null>}
   * @readonly
   */
  public readonly members: InputSignal<ListMembers | null> = input<ListMembers | null>(null);

  /**
   * Property showSidebarToggle
   *
   * @description
   * Whether the breadcrumb row shows the sidebar's expand toggle.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly showSidebarToggle: InputSignal<boolean> = input(false);

  /**
   * Property spaceEditable
   *
   * @description
   * Whether `Edit the space` is offered: the space is read and the caller has `edit` on it.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly spaceEditable: InputSignal<boolean> = input(false);

  /**
   * Property dialogs
   *
   * @description
   * The released header dialogs whose openers show: `Share` beside the `…` menu, `Sprint
   * report` on a sprint's goal line, `Space statuses` and `Automations` in the menu.
   *
   * @type {InputSignal<readonly ListDialog[]>}
   * @readonly
   */
  public readonly dialogs: InputSignal<readonly ListDialog[]> = input<readonly ListDialog[]>([]);

  /**
   * Property automationsEditable
   *
   * @description
   * Whether `Automations` is enabled: the organization's rules are for its admins and owners.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly automationsEditable: InputSignal<boolean> = input(false);

  /**
   * Property dialogRequested
   *
   * @description
   * Emits the dialog an opener asks for; the page hosts it.
   *
   * @type {OutputEmitterRef<ListDialog>}
   * @readonly
   */
  public readonly dialogRequested: OutputEmitterRef<ListDialog> = output<ListDialog>();

  /**
   * Property sidebarToggled
   *
   * @description
   * Emits on the expand toggle.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly sidebarToggled: OutputEmitterRef<void> = output();

  /**
   * Property editRequested
   *
   * @description
   * Emits on the list's icon and on `Edit the list` or `Edit the sprint`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly editRequested: OutputEmitterRef<void> = output();

  /**
   * Property spaceEditRequested
   *
   * @description
   * Emits on `Edit the space`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly spaceEditRequested: OutputEmitterRef<void> = output();

  /**
   * Property favoriteToggled
   *
   * @description
   * Emits on the star.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly favoriteToggled: OutputEmitterRef<void> = output();

  /**
   * Property duplicated
   *
   * @description
   * Emits on `Duplicate with the tasks`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly duplicated: OutputEmitterRef<void> = output();

  /**
   * Property exported
   *
   * @description
   * Emits on `Export as CSV`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly exported: OutputEmitterRef<void> = output();

  /**
   * Property linkCopied
   *
   * @description
   * Emits on `Copy the link`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly linkCopied: OutputEmitterRef<void> = output();

  /**
   * Property archived
   *
   * @description
   * Emits on `Archive the list`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly archived: OutputEmitterRef<void> = output();

  /**
   * Property deleteRequested
   *
   * @description
   * Emits on `Delete the list`; the page asks for the typed name.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly deleteRequested: OutputEmitterRef<void> = output();

  /**
   * Property icon
   *
   * @description
   * Bold icon of the list.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly icon: Signal<string> = computed((): string => listIconName(this.list()));

  /**
   * Property tone
   *
   * @description
   * Color class of the list's badge, the foreground for the default gray.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly tone: Signal<string> = computed((): string =>
    this.list().color === 'gris' ? 'text-foreground' : lookTone(this.list().color),
  );

  /**
   * Property percent
   *
   * @description
   * Rounded done percentage, cancelled tasks left out.
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly percent: Signal<number> = computed((): number => {
    const counts: ListCounts | null = this.counts();
    if (!counts) return 0;
    const live: number = counts.total - counts.cancelled;
    return live > 0 ? Math.round((counts.done / live) * 100) : 0;
  });

  /**
   * Property renameLabel
   *
   * @description
   * `Edit the sprint` or `Edit the list`.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly renameLabel: Signal<string> = computed((): string =>
    this.list().sprint
      ? $localize`:@@spaces.header.rename-sprint:Edit the sprint`
      : $localize`:@@spaces.header.rename-list:Edit the list`,
  );

  /**
   * Property favoriteLabel
   *
   * @description
   * Name of the star.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly favoriteLabel: Signal<string> = computed((): string =>
    this.favorite()
      ? $localize`:@@spaces.header.favorite-remove:Remove from favorites`
      : $localize`:@@spaces.header.favorite-add:Add to favorites`,
  );

  /**
   * Property membersLabel
   *
   * @description
   * Name of the avatar group (`4 members on this list`).
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly membersLabel: Signal<string> = computed((): string => {
    const total: number = this.members()?.total ?? 0;
    return $localize`:@@spaces.header.members:${total}:count: members on this list`;
  });
  // #endregion

  // #region Methods
  /**
   * Method spaceIcon
   *
   * @description
   * Icon name of the space's mark, or null for its initial.
   *
   * @param {Space} space - The space.
   * @returns {string | null} The icon name.
   */
  protected spaceIcon(space: Space): string | null {
    return space.icon ? lookIconName(space.icon) : null;
  }

  /**
   * Method spaceTone
   *
   * @description
   * Color class of the space's badge in the breadcrumb, the foreground for the default gray.
   *
   * @param {Space} space - The space.
   * @returns {string} The class.
   */
  protected spaceTone(space: Space): string {
    return space.color === 'gris' ? 'text-foreground' : lookTone(space.color);
  }
  // #endregion
}
