import {
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  type InputSignal,
  linkedSignal,
  LOCALE_ID,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CwEmpty,
  CwEmptyDescription,
  CwEmptyHeader,
  CwEmptyMedia,
  CwEmptyTitle,
} from '@cadenway/ui/components/empty';
import { CwButton } from '@cadenway/ui/components/button';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { CwTab, CwTabPanel, CwTabs, CwTabsList } from '@cadenway/ui/components/tabs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CwToastService } from '@cadenway/ui/components/toast';
import { NgIcon } from '@ng-icons/core';

import { OrganizationPin } from '@core/api';

import {
  SPACE_DIRECTORY,
  type SpaceDirectoryEntry,
  type SpaceDirectoryPort,
} from '@features/spaces/ports/space-directory';
import { TaskDetailOpener } from '@features/task';

import type { ArchivedListItem } from '../../../models/archived-list/archived-list.interface';
import type { ArchivedTaskItem } from '../../../models/archived-task/archived-task.interface';
import type { RestoreOutcome } from '../../../models/restore-outcome/restore-outcome.type';
import { ArchivesStore } from '../../../state/archives/archives.store';
import { ArchiveRow } from '../../components/archive-row/archive-row.component';

/**
 * Type ArchivesTab
 *
 * @description
 * The two tabs of the page; `?tab=tasks` selects the second, anything else the first.
 *
 * @type {'lists' | 'tasks'}
 */
type ArchivesTab = 'lists' | 'tasks';

/**
 * Interface ArchiveRowView
 *
 * @description
 * What a row of either tab shows, with the item it restores.
 */
interface ArchiveRowView<T> {
  // #region Properties
  /**
   * Property item
   *
   * @description
   * The archived list or task.
   *
   * @type {T}
   * @readonly
   */
  readonly item: T;

  /**
   * Property key
   *
   * @description
   * The row's key (`list:<id>`, `task:<KEY>`), written on its element so focus can leave it.
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;

  /**
   * Property restorable
   *
   * @description
   * Whether `Restore` is offered.
   *
   * @type {boolean}
   * @readonly
   */
  readonly restorable: boolean;

  /**
   * Property icon
   *
   * @description
   * Bold Phosphor icon of its kind.
   *
   * @type {string}
   * @readonly
   */
  readonly icon: string;

  /**
   * Property meta
   *
   * @description
   * Its meta line.
   *
   * @type {string}
   * @readonly
   */
  readonly meta: string;

  /**
   * Property restoreLabel
   *
   * @description
   * Accessible name of its `Restore`.
   *
   * @type {string}
   * @readonly
   */
  readonly restoreLabel: string;
  // #endregion
}

/**
 * Constant SEPARATOR
 *
 * @description
 * Separator of the parts of a meta line, as the mockup writes it.
 *
 * @type {string}
 */
const SEPARATOR: string = ' · ';

/**
 * Component ArchivesPage
 *
 * @description
 * The archives screen (`App.dc.html` lines 1999-2022, logic `fxArchives` 5453-5503): the title,
 * the summary of both totals, the `Lists` and `Tasks` tabs with their counts (`?tab=tasks`
 * selects the second; picking a tab rewrites that parameter in place), one row per archived list
 * or task with `Restore`, and an empty state per tab. A list names its space through Spaces' space
 * directory (gap G-A1), or no space while it is unknown; the `by` names a member, or is left out
 * for another actor or while the names are not known. The mockup draws no loading state: rows
 * skeletons stand in while the first read runs. A failed first read throws into the route's
 * `RouteErrorBoundary` (the unavailable state with `Retry`). A tab holding fewer rows than its
 * total says so under its rows, with `Show more` while the gateway has more (each click reads
 * up to 1,000 more items from where the tab stopped). `Restore` is offered only on the
 * lists the caller may edit. Each restore shows the mockup's toast once confirmed (`Open` opens a
 * restored task's detail, only in the organization it was restored in), a neutral notice when its
 * outcome could not be confirmed, a toast for a missing `edit` right, a failure toast for another
 * refusal, and nothing when the organization changed or the page left meanwhile. Before a
 * restored row leaves, focus moves from it to the nearest following `Restore`, else the nearest
 * preceding one, else the tab's panel. The page's toasts are dismissed when it is destroyed and
 * when the organization changes. The `h1` is the route focus target. The page provides its
 * `ArchivesStore`.
 */
@Component({
  selector: 'cw-archives-page',
  imports: [
    ArchiveRow,
    CwButton,
    CwEmpty,
    CwEmptyDescription,
    CwEmptyHeader,
    CwEmptyMedia,
    CwEmptyTitle,
    CwSkeleton,
    CwTab,
    CwTabPanel,
    CwTabs,
    CwTabsList,
    NgIcon,
  ],
  providers: [ArchivesStore],
  host: { class: 'flex min-h-0 flex-1 flex-col overflow-y-auto' },
  templateUrl: './archives-page.component.html',
})
export class ArchivesPage {
  // #region Properties
  /**
   * Property tab
   *
   * @description
   * The `tab` query parameter: `tasks` selects the `Tasks` tab.
   *
   * @type {InputSignal<string | undefined>}
   * @readonly
   */
  public readonly tab: InputSignal<string | undefined> = input<string | undefined>();

  /**
   * Property store
   *
   * @description
   * The page's archives.
   *
   * @type {InstanceType<typeof ArchivesStore>}
   * @readonly
   */
  protected readonly store: InstanceType<typeof ArchivesStore> = inject(ArchivesStore);

  /**
   * Property spaces
   *
   * @description
   * Spaces' directory, which names the space of an archived list; absent outside a workspace.
   *
   * @type {SpaceDirectoryPort | null}
   * @readonly
   */
  private readonly spaces: SpaceDirectoryPort | null = inject(SPACE_DIRECTORY, { optional: true });

  /**
   * Property opener
   *
   * @description
   * Opens the detail of a restored task from its toast.
   *
   * @type {TaskDetailOpener}
   * @readonly
   */
  private readonly opener: TaskDetailOpener = inject(TaskDetailOpener);

  /**
   * Property toasts
   *
   * @description
   * The shell's toasts.
   *
   * @type {CwToastService}
   * @readonly
   */
  private readonly toasts: CwToastService = inject(CwToastService);

  /**
   * Property pin
   *
   * @description
   * The workspace organization, which each restore and its toast are bound to.
   *
   * @type {OrganizationPin}
   * @readonly
   */
  private readonly pin: OrganizationPin = inject(OrganizationPin);

  /**
   * Property host
   *
   * @description
   * The page element, where focus is moved off a leaving row.
   *
   * @type {ElementRef<HTMLElement>}
   * @readonly
   */
  private readonly host: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * Property document
   *
   * @description
   * The document, whose active element tells whether focus is on a leaving row.
   *
   * @type {Document}
   * @readonly
   */
  private readonly document: Document = inject(DOCUMENT);

  /**
   * Property shownToasts
   *
   * @description
   * Ids of the toasts this page raised, dismissed with the page or the organization.
   *
   * @type {Set<string>}
   * @readonly
   */
  private readonly shownToasts: Set<string> = new Set<string>();

  /**
   * Property destroyed
   *
   * @description
   * Whether the page is gone; a restore ending afterwards shows nothing.
   *
   * @type {boolean}
   */
  private destroyed: boolean = false;

  /**
   * Property router
   *
   * @description
   * Rewrites `?tab` when a tab is picked.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property route
   *
   * @description
   * The page's route, the base of the `?tab` rewrite.
   *
   * @type {ActivatedRoute}
   * @readonly
   */
  private readonly route: ActivatedRoute = inject(ActivatedRoute);

  /**
   * Property locale
   *
   * @description
   * Application locale, for dates and plurals.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);

  /**
   * Property plurals
   *
   * @description
   * Plural rules of the locale: `one` covers 0 and 1 in French, as the mockup writes it, and only
   * 1 in English.
   *
   * @type {Intl.PluralRules}
   * @readonly
   */
  private readonly plurals: Intl.PluralRules = new Intl.PluralRules(this.locale);

  /**
   * Property dates
   *
   * @description
   * Day and short month of an archiving (`Nov 3`, `3 nov.`).
   *
   * @type {Intl.DateTimeFormat}
   * @readonly
   */
  private readonly dates: Intl.DateTimeFormat = new Intl.DateTimeFormat(this.locale, {
    day: 'numeric',
    month: 'short',
  });

  /**
   * Property selected
   *
   * @description
   * The shown tab: follows `?tab`, and changes at once when a tab is picked.
   *
   * @type {WritableSignal<ArchivesTab>}
   * @readonly
   */
  protected readonly selected: WritableSignal<ArchivesTab> = linkedSignal<ArchivesTab>(() =>
    this.tab() === 'tasks' ? 'tasks' : 'lists',
  );

  /**
   * Property spaceNames
   *
   * @description
   * Space names by id, from the space directory.
   *
   * @type {Signal<ReadonlyMap<string, string>>}
   * @readonly
   */
  private readonly spaceNames: Signal<ReadonlyMap<string, string>> = computed(
    () =>
      new Map<string, string>(
        (this.spaces?.spaces() ?? []).map((space: SpaceDirectoryEntry) => [space.id, space.name]),
      ),
  );

  /**
   * Property summary
   *
   * @description
   * The summary under the title (`App.dc.html` line 5465).
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly summary: Signal<string> = computed((): string => {
    const listCount: number = this.store.listCount();
    const taskCount: number = this.store.taskCount();
    const lists: string = this.isOne(listCount)
      ? $localize`:@@archives.header.lists-one:${listCount}:count: list`
      : $localize`:@@archives.header.lists-other:${listCount}:count: lists`;
    const tasks: string = this.isOne(taskCount)
      ? $localize`:@@archives.header.tasks-one:${taskCount}:count: archived task`
      : $localize`:@@archives.header.tasks-other:${taskCount}:count: archived tasks`;
    return $localize`:@@archives.header.summary:${lists}:lists: and ${tasks}:tasks:. Nothing is erased: everything can be restored in one click.`;
  });

  /**
   * Property listRows
   *
   * @description
   * The rows of the `Lists` tab.
   *
   * @type {Signal<readonly ArchiveRowView<ArchivedListItem>[]>}
   * @readonly
   */
  protected readonly listRows: Signal<readonly ArchiveRowView<ArchivedListItem>[]> = computed(
    () => {
      const spaces: ReadonlyMap<string, string> = this.spaceNames();
      const names: ReadonlyMap<string, string> = this.store.memberNames();
      return this.store.lists().map((list: ArchivedListItem): ArchiveRowView<ArchivedListItem> => {
        const count: number = list.taskCount;
        const parts: string[] = [];
        const space: string | undefined = spaces.get(list.spaceId);
        if (space !== undefined) parts.push(space);
        parts.push(
          this.isOne(count)
            ? $localize`:@@archives.list.task-count-one:${count}:count: task`
            : $localize`:@@archives.list.task-count-other:${count}:count: tasks`,
        );
        const archived: string | null = this.archivedLine(list.archivedAt, list.archivedBy, names);
        if (archived !== null) parts.push(archived);
        return {
          item: list,
          key: `list:${list.id}`,
          restorable: list.restorable,
          icon: list.sprint ? 'phosphorLightningBold' : 'phosphorListBulletsBold',
          meta: parts.join(SEPARATOR),
          restoreLabel: $localize`:@@archives.list.restore-label:Restore the list ${list.name}:name:`,
        };
      });
    },
  );

  /**
   * Property taskRows
   *
   * @description
   * The rows of the `Tasks` tab.
   *
   * @type {Signal<readonly ArchiveRowView<ArchivedTaskItem>[]>}
   * @readonly
   */
  protected readonly taskRows: Signal<readonly ArchiveRowView<ArchivedTaskItem>[]> = computed(
    () => {
      const names: ReadonlyMap<string, string> = this.store.memberNames();
      return this.store.tasks().map((task: ArchivedTaskItem): ArchiveRowView<ArchivedTaskItem> => {
        const parts: string[] = [
          task.listArchived
            ? $localize`:@@archives.task.archived-list:Archived list`
            : task.listName,
        ];
        const archived: string | null = this.archivedLine(task.archivedAt, task.archivedBy, names);
        if (archived !== null) parts.push(archived);
        return {
          item: task,
          key: `task:${task.key}`,
          restorable: true,
          icon: 'phosphorCheckSquareBold',
          meta: parts.join(SEPARATOR),
          restoreLabel: $localize`:@@archives.task.restore-label:Restore ${task.key}:key:`,
        };
      });
    },
  );
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Dismisses the page's toasts when the organization changes and when the page is destroyed.
   *
   * @constructor
   */
  public constructor() {
    this.pin.organizationChanges.pipe(takeUntilDestroyed()).subscribe((): void => {
      this.dismissToasts();
    });
    inject(DestroyRef).onDestroy((): void => {
      this.destroyed = true;
      this.dismissToasts();
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method pick
   *
   * @description
   * Shows a tab and writes it to the address in place: `?tab=tasks`, or no parameter for `Lists`.
   *
   * @param {string} value - The picked tab.
   */
  protected pick(value: string): void {
    const tab: ArchivesTab = value === 'tasks' ? 'tasks' : 'lists';
    this.selected.set(tab);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'tasks' ? 'tasks' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /**
   * Method truncated
   *
   * @description
   * The notice of a tab holding fewer rows than its total.
   *
   * @param {number} shown - Rows shown.
   * @param {number} total - Items the gateway counted.
   * @returns {string} The notice.
   */
  protected truncated(shown: number, total: number): string {
    return $localize`:@@archives.tabs.truncated:Only the ${shown}:shown: most recently archived are shown, out of ${total}:total:.`;
  }

  /**
   * Method showMore
   *
   * @description
   * Reads the next pages of a tab (`Show more`); a failure is reported and the button stays.
   *
   * @param {ArchivesTab} tab - The tab.
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async showMore(tab: ArchivesTab): Promise<void> {
    if (this.store.moreLoading(tab)) return;
    const organizationId: string | null = this.pin.current();
    const outcome: 'shown' | 'failed' | 'stale' = await this.store.showMore(tab);
    if (outcome === 'failed' && this.stillHere(organizationId)) {
      this.toast(
        'error',
        $localize`:@@archives.tabs.show-more-failed:The next archived items could not be loaded`,
      );
    }
  }

  /**
   * Method restoreList
   *
   * @description
   * Restores a list, then shows `Sprint restored` or `List restored` with the space it is back in
   * (`App.dc.html` line 5487), or the notice of an unconfirmed outcome, a missing right or a
   * refusal.
   *
   * @param {ArchivedListItem} list - The archived list.
   * @param {string} key - Its row's key.
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async restoreList(list: ArchivedListItem, key: string): Promise<void> {
    const organizationId: string | null = this.pin.current();
    const space: string | undefined = this.spaceNames().get(list.spaceId);
    const outcome: RestoreOutcome = await this.store.restoreList(list, (): void => {
      this.handOffFocus(key);
    });
    if (!this.stillHere(organizationId)) return;
    switch (outcome) {
      case 'restored':
        this.toast(
          'show',
          list.sprint
            ? $localize`:@@archives.list.sprint-restored:Sprint restored`
            : $localize`:@@archives.list.list-restored:List restored`,
          {
            description:
              space === undefined
                ? $localize`:@@archives.list.back-in-own-space:${list.name}:name: is back in its space.`
                : $localize`:@@archives.list.back-in-space:${list.name}:name: is back in ${space}:space:.`,
          },
        );
        return;
      case 'unconfirmed':
        this.toast(
          'show',
          $localize`:@@archives.list.unconfirmed:The restore of ${list.name}:name: could not be confirmed`,
          { description: this.unconfirmedDetail() },
        );
        return;
      case 'forbidden':
        this.toast(
          'error',
          $localize`:@@archives.list.forbidden:You cannot restore ${list.name}:name:`,
          { description: this.forbiddenDetail() },
        );
        return;
      case 'refused':
        this.toast(
          'error',
          list.sprint
            ? $localize`:@@archives.list.sprint-restore-failed:The sprint could not be restored`
            : $localize`:@@archives.list.restore-failed:The list could not be restored`,
        );
        return;
      case 'stale':
        return;
    }
  }

  /**
   * Method restoreTask
   *
   * @description
   * Restores a task, then shows `<KEY> restored` / `Back in its list.` with `Open`, which opens
   * its detail (`App.dc.html` line 5498) while the organization is the one it was restored in, or
   * the notice of an unconfirmed outcome, a missing right or a refusal.
   *
   * @param {ArchivedTaskItem} task - The archived root.
   * @param {string} key - Its row's key.
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async restoreTask(task: ArchivedTaskItem, key: string): Promise<void> {
    const organizationId: string | null = this.pin.current();
    const outcome: RestoreOutcome = await this.store.restoreTask(task, (): void => {
      this.handOffFocus(key);
    });
    if (!this.stillHere(organizationId)) return;
    switch (outcome) {
      case 'restored':
        this.toast('show', $localize`:@@archives.task.restored:${task.key}:key: restored`, {
          description: $localize`:@@archives.task.back-in-list:Back in its list.`,
          action: {
            label: $localize`:@@archives.task.open:Open`,
            run: (): void => {
              if (this.pin.current() !== organizationId) return;
              void this.opener.open(task.key, {
                key: task.key,
                name: task.name,
                status: task.status,
                milestone: task.milestone,
              });
            },
          },
        });
        return;
      case 'unconfirmed':
        this.toast(
          'show',
          $localize`:@@archives.task.unconfirmed:The restore of ${task.key}:key: could not be confirmed`,
          { description: this.unconfirmedDetail() },
        );
        return;
      case 'forbidden':
        this.toast(
          'error',
          $localize`:@@archives.task.forbidden:You cannot restore ${task.key}:key:`,
          {
            description: this.forbiddenDetail(),
          },
        );
        return;
      case 'refused':
        this.toast(
          'error',
          $localize`:@@archives.task.restore-failed:${task.key}:key: could not be restored`,
        );
        return;
      case 'stale':
        return;
    }
  }

  /**
   * Method stillHere
   *
   * @description
   * Whether a restore's answer may still be shown: the page is alive and the organization is the
   * one the restore started in.
   *
   * @param {string | null} organizationId - Organization when the restore started.
   * @returns {boolean} Whether to show it.
   */
  private stillHere(organizationId: string | null): boolean {
    return !this.destroyed && organizationId !== null && this.pin.current() === organizationId;
  }

  /**
   * Method toast
   *
   * @description
   * Raises a toast and remembers it, so it goes with the page or the organization.
   *
   * @param {'show' | 'error'} tone - Neutral or failure.
   * @param {string} title - Its title.
   * @param {Parameters<CwToastService['show']>[1]} [options] - Its description and action.
   */
  private toast(
    tone: 'show' | 'error',
    title: string,
    options?: Parameters<CwToastService['show']>[1],
  ): void {
    this.shownToasts.add(
      tone === 'show' ? this.toasts.show(title, options) : this.toasts.error(title, options),
    );
  }

  /**
   * Method dismissToasts
   *
   * @description
   * Dismisses every toast the page raised.
   */
  private dismissToasts(): void {
    for (const id of this.shownToasts) this.toasts.dismiss(id);
    this.shownToasts.clear();
  }

  /**
   * Method unconfirmedDetail
   *
   * @description
   * Description of the notice of an unconfirmed restore.
   *
   * @returns {string} The description.
   */
  private unconfirmedDetail(): string {
    return $localize`:@@archives.restore.unconfirmed-detail:The archives were read again: check whether it is back.`;
  }

  /**
   * Method forbiddenDetail
   *
   * @description
   * Description of the toast of a restore refused for a missing right.
   *
   * @returns {string} The description.
   */
  private forbiddenDetail(): string {
    return $localize`:@@archives.restore.forbidden-detail:Restoring takes the edit right on the list.`;
  }

  /**
   * Method handOffFocus
   *
   * @description
   * Moves focus off a row about to leave, when focus is inside it: to the nearest following
   * `Restore`, else the nearest preceding one, else the tab's panel (which then holds the empty
   * state). Focus elsewhere is left alone.
   *
   * @param {string} key - The leaving row's key.
   */
  private handOffFocus(key: string): void {
    const row: Element | undefined = Array.from(
      this.host.nativeElement.querySelectorAll('[data-archive-key]'),
    ).find((element: Element) => element.getAttribute('data-archive-key') === key);
    const active: Element | null = this.document.activeElement;
    if (!row || !active || !row.contains(active)) return;
    let target: HTMLElement | null = null;
    for (let next: Element | null = row.nextElementSibling; next && !target;) {
      target = next.querySelector<HTMLElement>('[data-archive-restore]');
      next = next.nextElementSibling;
    }
    for (let previous: Element | null = row.previousElementSibling; previous && !target;) {
      target = previous.querySelector<HTMLElement>('[data-archive-restore]');
      previous = previous.previousElementSibling;
    }
    (target ?? row.closest<HTMLElement>('[data-archives-panel]'))?.focus();
  }

  /**
   * Method isOne
   *
   * @description
   * Whether a count takes the singular in the locale.
   *
   * @param {number} count - The count.
   * @returns {boolean} Whether it is `one`.
   */
  private isOne(count: number): boolean {
    return this.plurals.select(count) === 'one';
  }

  /**
   * Method archivedLine
   *
   * @description
   * `archived on <date> by <name>`, without `by` when no member name is known.
   *
   * @param {string | null} archivedAt - When it was archived.
   * @param {string | null} archivedBy - The account of who archived it.
   * @param {ReadonlyMap<string, string>} names - Member names by account id.
   * @returns {string | null} The part, or null without a date.
   */
  private archivedLine(
    archivedAt: string | null,
    archivedBy: string | null,
    names: ReadonlyMap<string, string>,
  ): string | null {
    if (archivedAt === null) return null;
    const time: number = Date.parse(archivedAt);
    if (Number.isNaN(time)) return null;
    const date: string = this.dates.format(time);
    const name: string | undefined = archivedBy === null ? undefined : names.get(archivedBy);
    return name === undefined
      ? $localize`:@@archives.row.archived-on:archived on ${date}:date:`
      : $localize`:@@archives.row.archived-by:archived on ${date}:date: by ${name}:name:`;
  }
  // #endregion
}
