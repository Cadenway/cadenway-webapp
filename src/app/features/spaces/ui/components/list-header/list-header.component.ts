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
import { RouterLink } from '@angular/router';
import { CwAvatar, CwAvatarGroup } from '@cadenway/ui/components/avatar';
import {
  CwBreadcrumb,
  CwBreadcrumbLink,
  CwBreadcrumbPage,
} from '@cadenway/ui/components/breadcrumb';
import { CwButton } from '@cadenway/ui/components/button';
import { CwInlineEdit } from '@cadenway/ui/components/inline-edit';
import {
  CwMenu,
  CwMenuItem,
  CwMenuSeparator,
  CwMenuTriggerFor,
} from '@cadenway/ui/components/menu';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { NgIcon } from '@ng-icons/core';

import type { ListMembers } from '../../../models/list-member/list-member.interface';
import type { Space } from '../../../models/space/space.interface';
import type { ListCounts, TaskList } from '../../../models/task-list/task-list.interface';
import { listIconName, lookIconName, lookTone } from '../../../utils/look/look.util';

/**
 * Component ListHeader
 *
 * @description
 * The header of a list page (`App.dc.html` lines 277-334): the breadcrumb row (the sidebar's
 * expand toggle while the sidebar is collapsed, the space, the list), the list's icon, its title
 * as an inline edit (`[(editing)]` lets « Modifier la liste » open it), the favorite toggle, the
 * description line (« Sprint du 3 – 17 nov. · 98 tâches · 25 % terminé »), the sprint goal, the
 * members' avatars and the « … » menu: rename, duplicate with tasks, export CSV, copy link, archive
 * and delete. « Partager », « Rapport de sprint » and the space dialogs come in step 4b.
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
    CwInlineEdit,
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
   * Property saving
   *
   * @description
   * Whether a rename is being recorded.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly saving: InputSignal<boolean> = input(false);

  /**
   * Property editing
   *
   * @description
   * Whether the title is being edited; `[(editing)]`.
   *
   * @type {ModelSignal<boolean>}
   * @readonly
   */
  public readonly editing: ModelSignal<boolean> = model(false);

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
   * Property renamed
   *
   * @description
   * Emits a new, trimmed, non-empty name.
   *
   * @type {OutputEmitterRef<string>}
   * @readonly
   */
  public readonly renamed: OutputEmitterRef<string> = output<string>();

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
   * Emits on « Dupliquer avec les tâches ».
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly duplicated: OutputEmitterRef<void> = output();

  /**
   * Property exported
   *
   * @description
   * Emits on « Exporter en CSV ».
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly exported: OutputEmitterRef<void> = output();

  /**
   * Property linkCopied
   *
   * @description
   * Emits on « Copier le lien ».
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly linkCopied: OutputEmitterRef<void> = output();

  /**
   * Property archived
   *
   * @description
   * Emits on « Archiver la liste ».
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly archived: OutputEmitterRef<void> = output();

  /**
   * Property deleteRequested
   *
   * @description
   * Emits on « Supprimer la liste »; the page asks for the typed name.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly deleteRequested: OutputEmitterRef<void> = output();

  /**
   * Property icon
   *
   * @description
   * Fill icon of the list.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly icon: Signal<string> = computed((): string => listIconName(this.list(), true));

  /**
   * Property tone
   *
   * @description
   * Color class of the list's icon.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly tone: Signal<string> = computed((): string =>
    this.list().color === 'gris' ? 'text-primary' : lookTone(this.list().color),
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
   * « Modifier le sprint » or « Modifier la liste ».
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
   * Name of the avatar group (« 4 membres sur cette liste »).
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
   * Method save
   *
   * @description
   * Emits a changed, non-empty name.
   *
   * @param {string} value - Validated text.
   */
  protected save(value: string): void {
    const name: string = value.trim();
    if (name && name !== this.list().name) this.renamed.emit(name);
  }
  // #endregion
}
