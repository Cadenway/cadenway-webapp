import { Component, computed, DestroyRef, inject, type Signal } from '@angular/core';
import { Router } from '@angular/router';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwCommandDialog,
  CwCommandEmpty,
  type CwCommandFilter,
  CwCommandFooter,
  CwCommandGroup,
  CwCommandInput,
  CwCommandItem,
  CwCommandList,
  CwCommandLoading,
  provideCwCommandLabels,
} from '@cadenway/ui/components/command';
import { CwKbd, injectCwKbdLabels, type CwKbdLabels } from '@cadenway/ui/components/kbd';
import { CwStatusIcon } from '@cadenway/ui/components/status-icon';
import { CwToastService } from '@cadenway/ui/components/toast';
import { NgIcon } from '@ng-icons/core';

import { ShortcutsService } from '@core/shortcuts';
import { ThemeService } from '@core/theme';
import { SignOut } from '@features/auth';
import {
  LIST_DIRECTORY,
  type ListDirectoryEntry,
  type ListDirectoryPort,
} from '@features/spaces/ports/list-directory';
import { TaskCreate, TaskDetailOpener } from '@features/task';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import type {
  ListSearchResult,
  TaskSearchResult,
} from '../../../models/search-result/search-result.interface';
import { CommandPalette } from '../../../services/command-palette/command-palette.service';
import { RecentTasks } from '../../../services/recent-tasks/recent-tasks.service';
import { CommandPaletteStore } from '../../../state/command-palette/command-palette.store';

/**
 * Constant SERVER_RESULT
 *
 * @description
 * Keyword marking the matches the gateway already filtered, which the palette's filter keeps.
 *
 * @type {string}
 */
const SERVER_RESULT: string = 'cw-search-server-result';

/**
 * Constant SEARCH_TOKEN
 *
 * @description
 * The token `cw-command-empty` replaces with the typed text; passed as a placeholder so the
 * catalogs do not read its braces as an ICU expression.
 *
 * @type {string}
 */
const SEARCH_TOKEN: string = '{search}';

/**
 * Constant IDLE_LIST_COUNT
 *
 * @description
 * Lists of the workspace `Lists` shows before anything is typed (`App.dc.html` line 6935).
 *
 * @type {number}
 */
const IDLE_LIST_COUNT: number = 4;

/**
 * Constant MATCHED_LIST_COUNT
 *
 * @description
 * Lists of the workspace whose name matches the typed text that `Lists` shows at most
 * (`App.dc.html` line 6935).
 *
 * @type {number}
 */
const MATCHED_LIST_COUNT: number = 20;

/**
 * Function paletteFilter
 *
 * @description
 * The palette's filter, as in the mockup: a local item stays when its label contains the typed
 * text, ignoring case; a server match always stays, since `GET /v1/search` already filtered it.
 *
 * @param {string} value - The item's value (its label).
 * @param {string} search - The typed text.
 * @param {readonly string[]} keywords - The item's keywords.
 * @returns {number} 1 to keep the item, 0 to hide it.
 */
const paletteFilter: CwCommandFilter = (
  value: string,
  search: string,
  keywords: readonly string[],
): number =>
  keywords.includes(SERVER_RESULT) ||
  value.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
    ? 1
    : 0;

/**
 * Component CommandPaletteDialog
 *
 * @description
 * The Ctrl K command palette of mockup `App.dc.html` (lines 2778-2820, logic near line 6916), on
 * `cw-command-dialog`. Ctrl K (⌘ K) opens it through `ShortcutsService`, except while typing in a
 * field (line 4377); the rail item and the sidebar button open it through `CommandPalette`. Its
 * groups: `Suggestions` (`Create a task`, which opens Task's creation dialog, with its
 * shortcut N), `Recent tasks`
 * (`RecentTasks`, empty until tasks are opened from here), `Go to` (`Home`, `My tasks`,
 * `Dashboards` and `Documents`, lines 6921-6924), `Lists` (the workspace's lists from Spaces' `LIST_DIRECTORY`: the first four
 * before anything is typed, then those whose name contains the text, followed by the server's other
 * list matches), `Tasks` from `GET /v1/search` (debounced, the latest text winning, with the
 * loading row and an inline error with `Retry`), `Settings` (`Profile and
 * security`, `Organization settings`, `Switch organization`) and `Actions` (the
 * light and dark themes, `Sign out`). Local items are filtered by their label; nothing
 * matching shows `No results for “…”.` as text only, without the brick's icon (line 2810). The
 * footer names the arrows and Enter only, in the dense `sm` keys of line 2815: the mockup's Esc hint
 * sits in the header, which `cw-command-dialog` reserves for the input. The arrows and Enter follow the brick;
 * Escape first clears a typed text, then closes (the brick's behavior). It provides
 * its own `CommandPaletteStore` and is an `overlays` slot contribution.
 */
@Component({
  selector: 'cw-command-palette',
  imports: [
    CwButton,
    CwCommandDialog,
    CwCommandEmpty,
    CwCommandFooter,
    CwCommandGroup,
    CwCommandInput,
    CwCommandItem,
    CwCommandList,
    CwCommandLoading,
    CwKbd,
    CwStatusIcon,
    NgIcon,
  ],
  providers: [
    CommandPaletteStore,
    provideCwCommandLabels(() => ({
      dialogLabel: $localize`:@@search.palette.label:Command palette`,
      emptyText: $localize`:@@search.palette.empty:No results for “${SEARCH_TOKEN}:search:”.`,
      listLabel: $localize`:@@search.palette.results:Results`,
      loadingLabel: $localize`:@@search.palette.loading:Searching…`,
      resultsNone: $localize`:@@search.palette.results-none:No results`,
      resultsOne: $localize`:@@search.palette.results-one:1 result`,
      resultsMany: (count: number): string =>
        $localize`:@@search.palette.results-many:${count}:count: results`,
    })),
  ],
  templateUrl: './command-palette.component.html',
})
export class CommandPaletteDialog {
  // #region Properties
  /**
   * Property workspace
   *
   * @description
   * Workspace context whose organization the palette's addresses and history belong to.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  protected readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property filter
   *
   * @description
   * Filter of the palette's items.
   *
   * @type {CwCommandFilter}
   * @readonly
   */
  protected readonly filter: CwCommandFilter = paletteFilter;

  /**
   * Property keyLabels
   *
   * @description
   * Key names of the footer (`Enter`), from the application's kbd labels.
   *
   * @type {CwKbdLabels}
   * @readonly
   */
  protected readonly keyLabels: CwKbdLabels = injectCwKbdLabels();

  /**
   * Property serverResult
   *
   * @description
   * Keywords of the server matches, which the filter keeps.
   *
   * @type {readonly string[]}
   * @readonly
   */
  protected readonly serverResult: readonly string[] = [SERVER_RESULT];

  /**
   * Property palette
   *
   * @description
   * Open state shared with the triggers.
   *
   * @type {CommandPalette}
   * @readonly
   */
  protected readonly palette: CommandPalette = inject(CommandPalette);

  /**
   * Property store
   *
   * @description
   * Server search of the palette.
   *
   * @type {InstanceType<typeof CommandPaletteStore>}
   * @readonly
   */
  protected readonly store: InstanceType<typeof CommandPaletteStore> = inject(CommandPaletteStore);

  /**
   * Property listDirectory
   *
   * @description
   * Spaces' lists of the workspace, which the sidebar already read; absent outside a workspace.
   *
   * @type {ListDirectoryPort | null}
   * @readonly
   */
  private readonly listDirectory: ListDirectoryPort | null = inject(LIST_DIRECTORY, {
    optional: true,
  });

  /**
   * Property recentTasks
   *
   * @description
   * History of the tasks opened from the palette.
   *
   * @type {RecentTasks}
   * @readonly
   */
  private readonly recentTasks: RecentTasks = inject(RecentTasks);

  /**
   * Property theme
   *
   * @description
   * App-wide theme preference.
   *
   * @type {ThemeService}
   * @readonly
   */
  private readonly theme: ThemeService = inject(ThemeService);

  /**
   * Property router
   *
   * @description
   * Router opening the chosen place.
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
   * Property taskCreate
   *
   * @description
   * Task's creation dialog, opened by `Create a task`.
   *
   * @type {TaskCreate}
   * @readonly
   */
  private readonly taskCreate: TaskCreate = inject(TaskCreate);

  /**
   * Property taskDetail
   *
   * @description
   * Task's detail, opened over the current page by a task result.
   *
   * @type {TaskDetailOpener}
   * @readonly
   */
  private readonly taskDetail: TaskDetailOpener = inject(TaskDetailOpener);

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
   * Property darkTheme
   *
   * @description
   * Whether the effective theme is dark.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly darkTheme: Signal<boolean> = computed(
    (): boolean => this.theme.resolved() === 'dark',
  );

  /**
   * Property themeLabel
   *
   * @description
   * The theme action, named after the theme it switches to.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly themeLabel: Signal<string> = computed((): string =>
    this.darkTheme()
      ? $localize`:@@search.palette.theme-light:Switch to the light theme`
      : $localize`:@@search.palette.theme-dark:Switch to the dark theme`,
  );

  /**
   * Property recent
   *
   * @description
   * Recent tasks of the person in the current organization.
   *
   * @type {Signal<readonly TaskSearchResult[]>}
   * @readonly
   */
  protected readonly recent: Signal<readonly TaskSearchResult[]> = computed(
    (): readonly TaskSearchResult[] =>
      this.recentTasks.list(this.workspace.user().id, this.workspace.organization().id),
  );

  /**
   * Property localLists
   *
   * @description
   * The workspace's lists `Lists` shows, as in the mockup: the first four before anything is
   * typed, then up to twenty whose name contains the text, ignoring case.
   *
   * @type {Signal<readonly ListDirectoryEntry[]>}
   * @readonly
   */
  protected readonly localLists: Signal<readonly ListDirectoryEntry[]> = computed(
    (): readonly ListDirectoryEntry[] => {
      const lists: readonly ListDirectoryEntry[] = this.listDirectory?.lists() ?? [];
      const query: string = this.store.query().toLocaleLowerCase();
      if (query === '') return lists.slice(0, IDLE_LIST_COUNT);
      return lists
        .filter((list: ListDirectoryEntry): boolean =>
          list.name.toLocaleLowerCase().includes(query),
        )
        .slice(0, MATCHED_LIST_COUNT);
    },
  );

  /**
   * Property serverLists
   *
   * @description
   * The server's list matches that `Lists` does not already show from the workspace's lists.
   *
   * @type {Signal<readonly ListSearchResult[]>}
   * @readonly
   */
  protected readonly serverLists: Signal<readonly ListSearchResult[]> = computed(
    (): readonly ListSearchResult[] => {
      const shown: ReadonlySet<string> = new Set(
        this.localLists().map((list: ListDirectoryEntry): string => list.id),
      );
      return this.store
        .lists()
        .filter((list: ListSearchResult): boolean => !shown.has(list.listId));
    },
  );
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds Ctrl K (⌘ K) to opening the palette, outside fields, until the shell is destroyed; an
   * open palette stays open.
   *
   * @constructor
   */
  public constructor() {
    inject(ShortcutsService).register(
      {
        keys: 'mod+k',
        handler: (): void => {
          this.palette.setOpen(true);
        },
      },
      inject(DestroyRef),
    );
  }
  // #endregion

  // #region Methods
  /**
   * Method createTask
   *
   * @description
   * Closes the palette, then opens Task's creation dialog from the current screen's defaults.
   */
  protected createTask(): void {
    this.palette.setOpen(false);
    this.taskCreate.open();
  }

  /**
   * Method openTask
   *
   * @description
   * Remembers the task, closes the palette and opens the task's detail over the current page
   * (`?task=<key>`).
   *
   * @param {TaskSearchResult} task - The chosen task.
   */
  protected openTask(task: TaskSearchResult): void {
    this.recentTasks.remember(this.workspace.user().id, this.workspace.organization().id, task);
    this.palette.setOpen(false);
    void this.taskDetail.open(task.key, {
      key: task.key,
      name: task.name,
      status: task.status,
      milestone: false,
    });
  }

  /**
   * Method openList
   *
   * @description
   * Closes the palette and opens `/<slug>/l/<listId>`.
   *
   * @param {ListSearchResult} list - The chosen list.
   */
  protected openList(list: ListSearchResult): void {
    this.go(['l', list.listId]);
  }

  /**
   * Method openDirectoryList
   *
   * @description
   * Closes the palette and opens `/<slug>/l/<id>` for a list of the workspace.
   *
   * @param {ListDirectoryEntry} list - The chosen list.
   */
  protected openDirectoryList(list: ListDirectoryEntry): void {
    this.go(['l', list.id]);
  }

  /**
   * Method go
   *
   * @description
   * Closes the palette and opens a path of the current workspace.
   *
   * @param {readonly string[]} segments - Segments below `/<slug>`; none for the home screen.
   */
  protected go(segments: readonly string[]): void {
    this.palette.setOpen(false);
    void this.router.navigate(['/', this.workspace.organization().slug, ...segments]);
  }

  /**
   * Method chooseOrganization
   *
   * @description
   * Closes the palette and opens the organization choice.
   */
  protected chooseOrganization(): void {
    this.palette.setOpen(false);
    void this.router.navigateByUrl('/organizations');
  }

  /**
   * Method toggleTheme
   *
   * @description
   * Closes the palette and switches to the other theme, as the mockup's one theme action does.
   */
  protected toggleTheme(): void {
    this.palette.setOpen(false);
    this.theme.toggle();
  }

  /**
   * Method leave
   *
   * @description
   * Closes the palette and signs out; a refusal keeps the person here with an error toast.
   *
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async leave(): Promise<void> {
    this.palette.setOpen(false);
    if (await this.signOut.run()) return;
    this.toasts.error($localize`:@@search.palette.sign-out-failed:Sign-out failed`, {
      description: $localize`:@@search.palette.sign-out-failed-text:The server did not answer. Try again in a moment.`,
    });
  }
  // #endregion
}
