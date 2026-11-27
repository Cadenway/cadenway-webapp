import {
  afterNextRender,
  Component,
  computed,
  inject,
  Injector,
  input,
  type InputSignal,
  LOCALE_ID,
  signal,
  type Signal,
  viewChild,
  type WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CwAlertDialog,
  CwAlertDialogAction,
  CwAlertDialogCancel,
  CwAlertDialogDescription,
  CwAlertDialogTitle,
} from '@cadenway/ui/components/alert-dialog';
import { CwButton } from '@cadenway/ui/components/button';
import { provideCwChartLabels } from '@cadenway/ui/components/chart';
import { provideCwMeterLabels } from '@cadenway/ui/components/meter';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { CwStat, CwStatGroup, provideCwStatLabels } from '@cadenway/ui/components/stat';
import { CwTab, CwTabs, CwTabsList } from '@cadenway/ui/components/tabs';

import { LIST_DIRECTORY, type ListDirectoryEntry } from '@features/spaces/ports/list-directory';
import {
  defaultStatusOptions,
  type StatusOption,
  TaskCancelDialog,
  TaskMenu,
  type TaskMoveTarget,
  TaskRowActionsStore,
  type TaskRowActionsStoreInstance,
  type TaskSummary,
} from '@features/task';

import type { LateTaskRow } from '../../../models/late-task-row/late-task-row.interface';
import type { DashboardWeeks } from '../../../models/team-dashboard/team-dashboard.interface';
import {
  DashboardStore,
  type DashboardStoreInstance,
} from '../../../state/dashboard/dashboard.store';
import { todayIso, toLocalDate } from '../../../utils/calendar-week/calendar-week.util';
import {
  CompletionChart,
  type CompletionView,
} from '../../components/completion-chart/completion-chart.component';
import { LateTasks } from '../../components/late-tasks/late-tasks.component';
import { StatusBreakdown } from '../../components/status-breakdown/status-breakdown.component';
import { WorkloadCard } from '../../components/workload-card/workload-card.component';

/**
 * Constant NO_LISTS
 *
 * @description
 * The lists outside a workspace, where Spaces provides no directory.
 *
 * @type {readonly ListDirectoryEntry[]}
 */
const NO_LISTS: readonly ListDirectoryEntry[] = [];

/**
 * Component DashboardPage
 *
 * @description
 * The team dashboard at `/:org/dashboards` (`App.dc.html` lines 1791-1892, skeleton 1524-1569):
 * the title over `All spaces · data as of <date>`, the `Period` tabs (`8 weeks`, `12 weeks`,
 * kept in `?weeks=12`, 8 by default), the four counters (2 × 2 below 1024 px; `Late` is
 * negative when above 0), then, side by side from 1024 px, the completions per week with their
 * table and the workload per person over the tasks per status, and the late tasks. A late row
 * opens its task's detail; its context menu is Task's `cw-task-menu`, written through the route's
 * `TaskRowActionsStore`, with the cancel reason dialog and the delete confirmation; each settled
 * write reads the dashboard again. The header stays while the rest shows its skeleton
 * (`Loading the dashboard`), so the title is always the route focus target. The first read and a
 * read of another period that fail are caught by the route's error boundary (`Could not load this
 * page`, `Retry`); another period keeps the shown figures, marked as refreshing, until it answers.
 * `DashboardStore` reads again in the background on focus, a closed or changed detail and a
 * realtime reconnection, and never shows another organization's read.
 */
@Component({
  selector: 'cw-dashboard-page',
  imports: [
    CompletionChart,
    CwAlertDialog,
    CwAlertDialogAction,
    CwAlertDialogCancel,
    CwAlertDialogDescription,
    CwAlertDialogTitle,
    CwButton,
    CwSkeleton,
    CwStat,
    CwStatGroup,
    CwTab,
    CwTabs,
    CwTabsList,
    LateTasks,
    StatusBreakdown,
    TaskCancelDialog,
    TaskMenu,
    WorkloadCard,
  ],
  providers: [
    DashboardStore,
    provideCwChartLabels(() => ({
      emptyText: $localize`:@@dashboards.chart.empty:No data for the period`,
      categoryHeader: $localize`:@@dashboards.chart.week:Week`,
      capacityLabel: $localize`:@@dashboards.chart.capacity:Capacity`,
      othersLabel: $localize`:@@dashboards.chart.others:Others`,
      marker: (label: string, category: string): string =>
        $localize`:@@dashboards.chart.marker:${label}:label:: ${category}:category:`,
    })),
    provideCwStatLabels(() => ({
      up: $localize`:@@dashboards.stats.up:up`,
      down: $localize`:@@dashboards.stats.down:down`,
      flat: $localize`:@@dashboards.stats.flat:steady`,
      refreshing: $localize`:@@dashboards.stats.refreshing:Refreshing`,
      goalOf: $localize`:@@dashboards.stats.goal-of:of`,
    })),
    provideCwMeterLabels(() => ({
      free: $localize`:@@dashboards.workload.free:Free`,
      unmeasured: $localize`:@@dashboards.workload.unmeasured:No measure`,
      threshold: $localize`:@@dashboards.workload.threshold:Capacity`,
    })),
  ],
  host: { class: 'flex min-h-0 flex-1 flex-col overflow-y-auto' },
  templateUrl: './dashboard-page.component.html',
})
export class DashboardPage {
  // #region Properties
  /**
   * Property weeks
   *
   * @description
   * The `?weeks=` query parameter: `12` selects 12 weeks, anything else 8.
   *
   * @type {InputSignal<string | undefined>}
   * @readonly
   */
  public readonly weeks: InputSignal<string | undefined> = input<string | undefined>(undefined);

  /**
   * Property store
   *
   * @description
   * The dashboard read, its members and its refreshes.
   *
   * @type {DashboardStoreInstance}
   * @readonly
   */
  protected readonly store: DashboardStoreInstance = inject(DashboardStore);

  /**
   * Property rowActions
   *
   * @description
   * The task menu's writes for the late rows, provided by the route.
   *
   * @type {TaskRowActionsStoreInstance}
   * @readonly
   */
  protected readonly rowActions: TaskRowActionsStoreInstance = inject(TaskRowActionsStore);

  /**
   * Property router
   *
   * @description
   * Writes the period into the address.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property route
   *
   * @description
   * The page's route, which the period navigation stays on.
   *
   * @type {ActivatedRoute}
   * @readonly
   */
  private readonly route: ActivatedRoute = inject(ActivatedRoute);

  /**
   * Property locale
   *
   * @description
   * The running locale, for the date of the subtitle.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);

  /**
   * Property lists
   *
   * @description
   * The workspace's lists from the sidebar, which name the late tasks' lists and the menu's
   * `Move to`.
   *
   * @type {Signal<readonly ListDirectoryEntry[]>}
   * @readonly
   */
  private readonly lists: Signal<readonly ListDirectoryEntry[]> =
    inject(LIST_DIRECTORY, { optional: true })?.lists ?? signal(NO_LISTS);

  /**
   * Property period
   *
   * @description
   * The period of the address.
   *
   * @type {Signal<DashboardWeeks>}
   * @readonly
   */
  protected readonly period: Signal<DashboardWeeks> = computed((): DashboardWeeks =>
    this.weeks() === '12' ? 12 : 8,
  );

  /**
   * Property completionView
   *
   * @description
   * Whether the completions show as bars or as a table.
   *
   * @type {WritableSignal<CompletionView>}
   * @readonly
   */
  protected readonly completionView: WritableSignal<CompletionView> =
    signal<CompletionView>('chart');

  /**
   * Property statuses
   *
   * @description
   * The statuses of the task menu: the default ones, since the tasks come from every space.
   *
   * @type {readonly StatusOption[]}
   * @readonly
   */
  protected readonly statuses: readonly StatusOption[] = defaultStatusOptions();

  /**
   * Property subtitle
   *
   * @description
   * `All spaces · data as of Sunday, November 8`, from the day the dashboard was computed for.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly subtitle: Signal<string> = computed((): string => {
    const date: string = new Intl.DateTimeFormat(this.locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(toLocalDate(this.store.dashboard()?.today ?? todayIso()));
    return $localize`:@@dashboards.header.subtitle:All spaces · data as of ${date}:date:`;
  });

  /**
   * Property moveTargets
   *
   * @description
   * The lists of the menu's `Move to`.
   *
   * @type {Signal<readonly TaskMoveTarget[]>}
   * @readonly
   */
  protected readonly moveTargets: Signal<readonly TaskMoveTarget[]> = computed(
    (): readonly TaskMoveTarget[] =>
      this.lists().map((list: ListDirectoryEntry): TaskMoveTarget => ({
        listId: list.id,
        name: list.name,
        spaceName: list.spaceName,
        icon: list.icon,
        tone: list.tone,
      })),
  );

  /**
   * Property listNames
   *
   * @description
   * The name of each list of the directory, by id.
   *
   * @type {Signal<ReadonlyMap<string, string>>}
   * @readonly
   */
  private readonly listNames: Signal<ReadonlyMap<string, string>> = computed(
    (): ReadonlyMap<string, string> =>
      new Map<string, string>(
        this.lists().map((list: ListDirectoryEntry): [string, string] => [list.id, list.name]),
      ),
  );

  /**
   * Property lateRows
   *
   * @description
   * The late tasks as the menu's writes show them (a deleted one left out), with their list and
   * assignees.
   *
   * @type {Signal<readonly LateTaskRow[]>}
   * @readonly
   */
  protected readonly lateRows: Signal<readonly LateTaskRow[]> = computed(
    (): readonly LateTaskRow[] => {
      const read: ReadonlyMap<string, TaskSummary> = new Map<string, TaskSummary>(
        this.store.lateTasks().map((task: TaskSummary): [string, TaskSummary] => [task.key, task]),
      );
      return this.rowActions.rows(this.store.lateTasks()).map((task: TaskSummary): LateTaskRow => {
        const source: TaskSummary = read.get(task.key) ?? task;
        return {
          task,
          source,
          status: this.rowActions.displayedStatus(source),
          listName: this.listNames().get(task.listId) ?? '',
          people: task.assigneeIds.map((userId: string) => this.store.personOf(userId)),
        };
      });
    },
  );

  /**
   * Property menuKey
   *
   * @description
   * Key of the late task whose context menu opened last, or null.
   *
   * @type {WritableSignal<string | null>}
   * @readonly
   */
  protected readonly menuKey: WritableSignal<string | null> = signal<string | null>(null);

  /**
   * Property menuTask
   *
   * @description
   * The read copy of that task, looked up when the menu acts, so every write and `Undo` starts
   * from the dashboard's confirmed values; null once the dashboard no longer holds it.
   *
   * @type {Signal<TaskSummary | null>}
   * @readonly
   */
  protected readonly menuTask: Signal<TaskSummary | null> = computed(
    (): TaskSummary | null =>
      this.store.lateTasks().find((task: TaskSummary): boolean => task.key === this.menuKey()) ??
      null,
  );

  /**
   * Property lateSection
   *
   * @description
   * The late section, which takes the focus back after a deletion.
   *
   * @type {Signal<LateTasks | undefined>}
   * @readonly
   */
  private readonly lateSection: Signal<LateTasks | undefined> = viewChild(LateTasks);

  /**
   * Property injector
   *
   * @description
   * Schedules the focus after the render that follows a deletion.
   *
   * @type {Injector}
   * @readonly
   */
  private readonly injector: Injector = inject(Injector);

  /**
   * Property deleteKey
   *
   * @description
   * Key of the task whose deletion the confirmation asks for.
   *
   * @type {string | null}
   */
  private deleteKey: string | null = null;

  /**
   * Property menuTasks
   *
   * @description
   * The menu's target, as the writes show it.
   *
   * @type {Signal<readonly TaskSummary[]>}
   * @readonly
   */
  protected readonly menuTasks: Signal<readonly TaskSummary[]> = computed(
    (): readonly TaskSummary[] => {
      const task: TaskSummary | null = this.menuTask();
      return task ? [this.rowActions.displayedTask(task)] : [];
    },
  );
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Follows the period of the address, hands the late tasks to the row writes and reads the
   * dashboard again once one of them settles.
   *
   * @constructor
   */
  public constructor() {
    this.store.follow(this.period);
    this.rowActions.sync(this.store.lateTasks);
    this.rowActions.changed.pipe(takeUntilDestroyed()).subscribe((): void => {
      this.store.refresh();
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method askDelete
   *
   * @description
   * `Delete the task` of the menu: remembers the task, then opens the confirmation.
   *
   * @param {TaskSummary} task - The read copy of the task.
   */
  protected askDelete(task: TaskSummary): void {
    this.deleteKey = task.key;
    this.rowActions.askDelete(task);
  }

  /**
   * Method confirmDelete
   *
   * @description
   * The confirmation's action: moves the task to the trash, then gives the focus to the row that
   * took its place, else the one before it, else the `Late` heading; a refused deletion brings
   * the row back, which then takes the focus.
   *
   * @returns {Promise<void>} Resolves once the focus moved.
   */
  protected async confirmDelete(): Promise<void> {
    const key: string | null = this.deleteKey;
    const keys: readonly string[] = this.lateRows().map((row: LateTaskRow): string => row.task.key);
    const index: number = key === null ? -1 : keys.indexOf(key);
    const candidates: readonly string[] = [
      ...(key === null ? [] : [key]),
      ...(index >= 0 ? keys.slice(index + 1, index + 2) : []),
      ...(index > 0 ? keys.slice(index - 1, index) : []),
    ];
    await this.rowActions.trash();
    this.deleteKey = null;
    afterNextRender(
      (): void => {
        this.lateSection()?.focusFirst(candidates);
      },
      { injector: this.injector },
    );
  }

  /**
   * Method completedHint
   *
   * @description
   * The hint of `Completed`: `last 8 weeks`.
   *
   * @param {number} weeks - Weeks the count covers.
   * @returns {string} The hint.
   */
  protected completedHint(weeks: number): string {
    return $localize`:@@dashboards.stats.completed-hint:last ${weeks}:count: weeks`;
  }

  /**
   * Method pickPeriod
   *
   * @description
   * Writes the picked period into the address (`?weeks=12`, nothing for 8 weeks), which reads it.
   *
   * @param {string} value - The picked tab, `8` or `12`.
   */
  protected pickPeriod(value: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { weeks: value === '12' ? 12 : null },
      queryParamsHandling: 'merge',
    });
  }

  /**
   * Method moveTo
   *
   * @description
   * `Move to` of the menu: moves the task whose menu is open to the picked list of the directory.
   *
   * @param {TaskSummary} task - The task.
   * @param {string} listId - The picked list.
   */
  protected moveTo(task: TaskSummary, listId: string): void {
    const target: TaskMoveTarget | undefined = this.moveTargets().find(
      (list: TaskMoveTarget): boolean => list.listId === listId,
    );
    if (target) void this.rowActions.moveTo(task, target);
  }
  // #endregion
}
