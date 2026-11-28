import {
  afterNextRender,
  Component,
  computed,
  inject,
  Injector,
  input,
  type InputSignal,
  LOCALE_ID,
  type Signal,
  signal,
  viewChild,
  type WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { PriorityKey, StatusKey } from '@cadenway/contracts';
import { CwAlert, CwAlertDescription } from '@cadenway/ui/components/alert';
import {
  CwAlertDialog,
  CwAlertDialogAction,
  CwAlertDialogCancel,
  CwAlertDialogDescription,
  CwAlertDialogTitle,
} from '@cadenway/ui/components/alert-dialog';
import { CwButton } from '@cadenway/ui/components/button';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { NgIcon } from '@ng-icons/core';

import { InboxDigest } from '@features/inbox';
import {
  type Person,
  TaskCancelDialog,
  TaskCreate,
  TaskMenu,
  type TaskMoveTarget,
  TaskRowActionsStore,
  type TaskRowActionsStoreInstance,
  type TaskSummary,
} from '@features/task';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import type { HomeList, HomeRead } from '../../../models/home-read/home-read.interface';
import type { HomeListRow, HomePriorityRow } from '../../../models/home-rows/home-rows.interface';
import { HomeStore, type HomeStoreInstance } from '../../../state/home/home.store';
import { HomeLists } from '../../components/home-lists/home-lists.component';
import { HomePriorities } from '../../components/home-priorities/home-priorities.component';
import { HomeSprintCard } from '../../components/home-sprint-card/home-sprint-card.component';
import { HomeStats } from '../../components/home-stats/home-stats.component';

/**
 * Constant ARCHIVED_LIST
 *
 * @description
 * The list of a priority whose list is not in the sidebar although the sidebar holds lists of
 * its space, which it reads with all their live lists: it was archived (gap G-T1, until
 * `TaskSummary` carries its list's name).
 *
 * @type {string}
 */
const ARCHIVED_LIST: string = $localize`:@@home.priorities.archived-list:Archived list`;

/**
 * Constant SKELETON_ROWS
 *
 * @description
 * The widths of the names of the skeleton's priority lines (`skRows` of `App.dc.html`, line 4184).
 *
 * @type {readonly string[]}
 */
const SKELETON_ROWS: readonly string[] = ['w-2/5', 'w-2/3', 'w-3/5', 'w-1/3', 'w-4/5'];

/**
 * Constant SKELETON_SIDE
 *
 * @description
 * The widths of the lines of the skeleton's two aside cards (`skSide` of `App.dc.html`, line 4185).
 *
 * @type {readonly (readonly string[])[]}
 */
const SKELETON_SIDE: readonly (readonly string[])[] = [
  ['w-3/5', 'w-1/3', 'w-4/5', 'w-3/4'],
  ['w-3/4', 'w-7/12', 'w-1/2'],
];

/**
 * Component HomePage
 *
 * @description
 * The home screen of a workspace (`App.dc.html` lines 1683-1747). Its header holds today's date in
 * the application locale, the greeting with the signed-in person's first name (the `h1`, route
 * focus target, rendered at once) and `Create a task` (the create dialog with its defaults).
 * `?notice=logo-upload-failed`, set by Auth after an organization creation whose logo could not be
 * uploaded, shows a dismissible notice pointing to the organization settings. Below come the
 * counters, `My priorities` (Task's `cw-task-line`; a click opens the task detail, the context
 * gestures open Task's `cw-task-menu`, whose writes run through the route's `TaskRowActionsStore`
 * with the cancel reason dialog and the deletion confirmation rendered here), and an aside with
 * the current sprint (hidden when none is current), `Mentions and activity` (Inbox's digest, a
 * secondary read with its own inline error) and `Lists` (hidden when there is none). Below
 * 1024 px the aside stacks under the priorities and the counters form a 2×2 grid; below 640 px the
 * lines drop their priority. While the first read runs, the header stays and a skeleton stands for
 * the rest (`Loading the home page`); its failure reaches the route's error boundary through the
 * template's read. The page reads again after each settled write (`changed`); `HomeStore` also
 * reads on focus, on a realtime reconnection, after the detail or the create dialog (gap G-R1). A
 * failed refresh keeps the values with an inline error and `Retry`.
 */
@Component({
  selector: 'cw-home-page',
  imports: [
    CwAlert,
    CwAlertDescription,
    CwAlertDialog,
    CwAlertDialogAction,
    CwAlertDialogCancel,
    CwAlertDialogDescription,
    CwAlertDialogTitle,
    CwButton,
    CwSkeleton,
    HomeLists,
    HomePriorities,
    HomeSprintCard,
    HomeStats,
    InboxDigest,
    NgIcon,
    TaskCancelDialog,
    TaskMenu,
  ],
  providers: [HomeStore],
  host: { class: 'flex min-h-0 flex-1 flex-col overflow-y-auto' },
  templateUrl: './home-page.component.html',
})
export class HomePage {
  // #region Properties
  /**
   * Property notice
   *
   * @description
   * The `?notice=` query parameter; only `logo-upload-failed` is known.
   *
   * @type {InputSignal<string | undefined>}
   * @readonly
   */
  public readonly notice: InputSignal<string | undefined> = input<string | undefined>();

  /**
   * Property store
   *
   * @description
   * The page's reads.
   *
   * @type {HomeStoreInstance}
   * @readonly
   */
  protected readonly store: HomeStoreInstance = inject(HomeStore);

  /**
   * Property rowActions
   *
   * @description
   * The task menu's writes, provided on the route.
   *
   * @type {TaskRowActionsStoreInstance}
   * @readonly
   */
  protected readonly rowActions: TaskRowActionsStoreInstance = inject(TaskRowActionsStore);

  /**
   * Property skeletonRows
   *
   * @description
   * The skeleton's priority line widths.
   *
   * @type {readonly string[]}
   * @readonly
   */
  protected readonly skeletonRows: readonly string[] = SKELETON_ROWS;

  /**
   * Property skeletonSide
   *
   * @description
   * The skeleton's aside card line widths.
   *
   * @type {readonly (readonly string[])[]}
   * @readonly
   */
  protected readonly skeletonSide: readonly (readonly string[])[] = SKELETON_SIDE;

  /**
   * Property noticeDismissed
   *
   * @description
   * Whether the person closed the notice.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly noticeDismissed: WritableSignal<boolean> = signal(false);

  /**
   * Property logoFailed
   *
   * @description
   * Whether to tell the person the new organization's logo could not be uploaded.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly logoFailed: Signal<boolean> = computed(
    (): boolean => this.notice() === 'logo-upload-failed' && !this.noticeDismissed(),
  );

  /**
   * Property closeLabel
   *
   * @description
   * Accessible name of the notice's close button.
   *
   * @type {string}
   * @readonly
   */
  protected readonly closeLabel: string = $localize`:@@home.notice.close:Close`;

  /**
   * Property workspace
   *
   * @description
   * Workspace context of the enclosing `/:org` route.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  private readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property taskCreate
   *
   * @description
   * Opens the create dialog.
   *
   * @type {TaskCreate}
   * @readonly
   */
  private readonly taskCreate: TaskCreate = inject(TaskCreate);

  /**
   * Property firstName
   *
   * @description
   * First name of the signed-in person, greeted by the heading.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly firstName: Signal<string> = computed(
    (): string => this.workspace.user().firstName,
  );

  /**
   * Property today
   *
   * @description
   * Weekday, day and month of the day the page opened, as the locale writes a full weekday date
   * (`Sunday, November 8` in English, the mockup's `Dimanche 8 novembre` in French), capitalized as
   * the mockup's date line.
   *
   * @type {string}
   * @readonly
   */
  protected readonly today: string = capitalize(
    new Intl.DateTimeFormat(inject(LOCALE_ID), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(Date.now()),
  );

  /**
   * Property base
   *
   * @description
   * The address of the workspace (`/<slug>`), the start of the page's links.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly base: Signal<string> = computed(
    (): string => `/${this.workspace.organization().slug}`,
  );

  /**
   * Property priorities
   *
   * @description
   * The lines of `My priorities` as the writes show them (a deleted task is hidden at once, a
   * pending value is drawn), each with its list's name; the status drawn is the one the writes
   * show over the read copy.
   *
   * @type {Signal<readonly HomePriorityRow[]>}
   * @readonly
   */
  protected readonly priorities: Signal<readonly HomePriorityRow[]> = computed(
    (): readonly HomePriorityRow[] => {
      const read: HomeRead | undefined = this.store.read();
      if (!read) return [];
      const copies: ReadonlyMap<string, TaskSummary> = new Map<string, TaskSummary>(
        read.priorities.map((task: TaskSummary): [string, TaskSummary] => [task.key, task]),
      );
      return this.rowActions.rows(read.priorities).map((task: TaskSummary): HomePriorityRow => ({
        task,
        status: this.rowActions.displayedStatus(copies.get(task.key) ?? task),
        listName: this.listName(task),
      }));
    },
  );

  /**
   * Property lists
   *
   * @description
   * The rows of `Lists`, with their space's name and address.
   *
   * @type {Signal<readonly HomeListRow[]>}
   * @readonly
   */
  protected readonly lists: Signal<readonly HomeListRow[]> = computed(
    (): readonly HomeListRow[] => {
      const read: HomeRead | undefined = this.store.read();
      if (!read) return [];
      const spaces: ReadonlyMap<string, string> = this.store.spaceNames();
      return read.lists.map((list: HomeList): HomeListRow => ({
        id: list.id,
        name: list.name,
        spaceName: spaces.get(list.spaceId) ?? '',
        open: list.open,
        link: `${this.base()}/l/${list.id}`,
      }));
    },
  );

  /**
   * Property menuKey
   *
   * @description
   * Key of the task whose line opened the menu last.
   *
   * @type {WritableSignal<string | null>}
   * @readonly
   */
  protected readonly menuKey: WritableSignal<string | null> = signal<string | null>(null);

  /**
   * Property menuTask
   *
   * @description
   * The read copy of the task the menu acts on, looked up by key, so every write and its `Undo`
   * start from the values the page read, never from a value still waiting for its write; null
   * once the read no longer holds it.
   *
   * @type {Signal<TaskSummary | null>}
   * @readonly
   */
  protected readonly menuTask: Signal<TaskSummary | null> = computed((): TaskSummary | null => {
    const key: string | null = this.menuKey();
    if (key === null) return null;
    return this.store.tasks().find((task: TaskSummary): boolean => task.key === key) ?? null;
  });

  /**
   * Property menuTasks
   *
   * @description
   * What the menu checks: the one task of the line as the writes show it, or nothing.
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

  /**
   * Property menuStatus
   *
   * @description
   * The status the menu checks.
   *
   * @type {Signal<StatusKey | null>}
   * @readonly
   */
  protected readonly menuStatus: Signal<StatusKey | null> = computed((): StatusKey | null => {
    const task: TaskSummary | null = this.menuTask();
    return task ? this.rowActions.displayedStatus(task) : null;
  });

  /**
   * Property prioritiesSection
   *
   * @description
   * `My priorities`, which takes the focus back after a deletion.
   *
   * @type {Signal<HomePriorities | undefined>}
   * @readonly
   */
  private readonly prioritiesSection: Signal<HomePriorities | undefined> =
    viewChild(HomePriorities);

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
   * Key of the task whose deletion the confirmation asks for, or null.
   *
   * @type {string | null}
   */
  private deleteKey: string | null = null;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the row writes to the read priorities and reads the page again after each settled
   * write.
   *
   * @constructor
   */
  public constructor() {
    this.rowActions.sync(this.store.tasks);
    this.rowActions.changed.pipe(takeUntilDestroyed()).subscribe((): void => {
      this.store.refresh();
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method create
   *
   * @description
   * `Create a task`: the create dialog with its defaults.
   */
  protected create(): void {
    this.taskCreate.open();
  }

  /**
   * Method openMenu
   *
   * @description
   * Remembers the task of the line that opened the menu, and reads the members for `Assign` the
   * first time, or again when they could not be read.
   *
   * @param {TaskSummary} task - The task.
   */
  protected openMenu(task: TaskSummary): void {
    this.menuKey.set(task.key);
    this.store.loadPeople();
  }

  /**
   * Method pickStatus
   *
   * @description
   * `Status` of the menu.
   *
   * @param {StatusKey} status - The status.
   */
  protected pickStatus(status: StatusKey): void {
    const task: TaskSummary | null = this.menuTask();
    if (task) this.rowActions.setStatus(task, status);
  }

  /**
   * Method pickPriority
   *
   * @description
   * `Priority` of the menu.
   *
   * @param {PriorityKey} priority - The priority.
   */
  protected pickPriority(priority: PriorityKey): void {
    const task: TaskSummary | null = this.menuTask();
    if (task) void this.rowActions.setPriority(task, priority);
  }

  /**
   * Method toggleAssignee
   *
   * @description
   * `Assign` of the menu.
   *
   * @param {string} userId - The person toggled.
   */
  protected toggleAssignee(userId: string): void {
    const task: TaskSummary | null = this.menuTask();
    const person: Person | undefined = this.store
      .people()
      .find((candidate: Person): boolean => candidate.id === userId);
    if (task && person) void this.rowActions.toggleAssignee(task, person);
  }

  /**
   * Method move
   *
   * @description
   * `Move to` of the menu.
   *
   * @param {string} listId - The destination list.
   */
  protected move(listId: string): void {
    const task: TaskSummary | null = this.menuTask();
    const target: TaskMoveTarget | undefined = this.store
      .moveTargets()
      .find((list: TaskMoveTarget): boolean => list.listId === listId);
    if (task && target) void this.rowActions.moveTo(task, target);
  }

  /**
   * Method act
   *
   * @description
   * The menu's one-task actions without a value.
   *
   * @param {'remind' | 'duplicate' | 'copyLink' | 'copyKey' | 'delete'} action - The item.
   */
  protected act(action: 'remind' | 'duplicate' | 'copyLink' | 'copyKey' | 'delete'): void {
    const task: TaskSummary | null = this.menuTask();
    if (!task) return;
    switch (action) {
      case 'remind':
        void this.rowActions.remind(task);
        break;
      case 'duplicate':
        void this.rowActions.duplicate(task);
        break;
      case 'copyLink':
        void this.rowActions.copyLink(task);
        break;
      case 'copyKey':
        void this.rowActions.copyKey(task);
        break;
      case 'delete':
        this.deleteKey = task.key;
        this.rowActions.askDelete(task);
        break;
    }
  }

  /**
   * Method confirmDelete
   *
   * @description
   * The confirmation's action: moves the task to the trash, then gives the focus to the line that
   * took its place, else the one before it, else the `My priorities` heading or the empty
   * paragraph; a refused deletion brings the line back, which then takes the focus.
   *
   * @returns {Promise<void>} Resolves once the focus is scheduled.
   */
  protected async confirmDelete(): Promise<void> {
    const key: string | null = this.deleteKey;
    const keys: readonly string[] = this.priorities().map(
      (row: HomePriorityRow): string => row.task.key,
    );
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
        this.prioritiesSection()?.focusFirst(candidates);
      },
      { injector: this.injector },
    );
  }

  /**
   * Method listName
   *
   * @description
   * The list of a priority: the list's name, `Archived list` when the sidebar holds lists of the
   * task's space but not this one, empty when it holds none of that space (its overview failed or
   * is still read, so a live list may be missing).
   *
   * @param {TaskSummary} task - The task.
   * @returns {string} The text after the key.
   */
  private listName(task: TaskSummary): string {
    const name: string | undefined = this.store.listNames().get(task.listId);
    if (name !== undefined) return name;
    return this.store.spaceNames().has(task.spaceId) ? ARCHIVED_LIST : '';
  }
  // #endregion
}

/**
 * Function capitalize
 *
 * @description
 * Uppercases the first character of a formatted date, since some locales write weekday names in
 * lowercase.
 *
 * @param {string} text - Formatted date.
 * @returns {string} The text with an uppercase first character.
 */
function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}
