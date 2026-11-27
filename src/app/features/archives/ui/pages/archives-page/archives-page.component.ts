import {
  Component,
  computed,
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
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { CwTab, CwTabPanel, CwTabs, CwTabsList } from '@cadenway/ui/components/tabs';
import { CwToastService } from '@cadenway/ui/components/toast';
import { NgIcon } from '@ng-icons/core';

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
 * `RouteErrorBoundary` (the unavailable state with `Retry`). Each restore shows the mockup's toast
 * once confirmed (`Open` opens a restored task's detail), a failure toast for a refusal, and
 * nothing for an unknown outcome or a restore that started in another organization. The `h1` is
 * the route focus target. The page provides its `ArchivesStore`.
 */
@Component({
  selector: 'cw-archives-page',
  imports: [
    ArchiveRow,
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
          icon: 'phosphorCheckSquareBold',
          meta: parts.join(SEPARATOR),
          restoreLabel: $localize`:@@archives.task.restore-label:Restore ${task.key}:key:`,
        };
      });
    },
  );
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
   * Method restoreList
   *
   * @description
   * Restores a list, then shows `Sprint restored` or `List restored` with the space it is back in
   * (`App.dc.html` line 5487), or the failure of a refusal.
   *
   * @param {ArchivedListItem} list - The archived list.
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async restoreList(list: ArchivedListItem): Promise<void> {
    const space: string | undefined = this.spaceNames().get(list.spaceId);
    const outcome: RestoreOutcome = await this.store.restoreList(list);
    if (outcome === 'restored') {
      this.toasts.show(
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
    } else if (outcome === 'refused') {
      this.toasts.error(
        list.sprint
          ? $localize`:@@archives.list.sprint-restore-failed:The sprint could not be restored`
          : $localize`:@@archives.list.restore-failed:The list could not be restored`,
      );
    }
  }

  /**
   * Method restoreTask
   *
   * @description
   * Restores a task, then shows `<KEY> restored` / `Back in its list.` with `Open`, which opens
   * its detail (`App.dc.html` line 5498), or the failure of a refusal.
   *
   * @param {ArchivedTaskItem} task - The archived root.
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async restoreTask(task: ArchivedTaskItem): Promise<void> {
    const outcome: RestoreOutcome = await this.store.restoreTask(task);
    if (outcome === 'restored') {
      this.toasts.show($localize`:@@archives.task.restored:${task.key}:key: restored`, {
        description: $localize`:@@archives.task.back-in-list:Back in its list.`,
        action: {
          label: $localize`:@@archives.task.open:Open`,
          run: (): void => {
            void this.opener.open(task.key, {
              key: task.key,
              name: task.name,
              status: task.status,
              milestone: task.milestone,
            });
          },
        },
      });
    } else if (outcome === 'refused') {
      this.toasts.error(
        $localize`:@@archives.task.restore-failed:${task.key}:key: could not be restored`,
      );
    }
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
