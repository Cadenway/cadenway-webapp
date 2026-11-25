import {
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  inject,
  input,
  type InputSignal,
  LOCALE_ID,
  type Signal,
  signal,
  untracked,
  type WritableSignal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import {
  CwAlertDialog,
  CwAlertDialogAction,
  CwAlertDialogCancel,
  CwAlertDialogDescription,
  CwAlertDialogMedia,
  CwAlertDialogTitle,
} from '@cadenway/ui/components/alert-dialog';
import { CwButton } from '@cadenway/ui/components/button';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { CwToastService } from '@cadenway/ui/components/toast';
import { NgIcon } from '@ng-icons/core';

import { SHELL_SIDEBAR, type ShellSidebar } from '@shared/layout-slot';

import { layoutLabels, statusLabels } from '../../../constants/view-labels/view-labels.constants';
import type { ListExport } from '../../../data-access/services/lists-api/lists-api.service';
import type { StatusKey } from '../../../models/list-view-config/list-view-config.interface';
import type {
  SavedView,
  SavedViewDraft,
  ViewLayout,
} from '../../../models/saved-view/saved-view.interface';
import type { Space, SpaceStatusOption } from '../../../models/space/space.interface';
import type { TaskList } from '../../../models/task-list/task-list.interface';
import type { ListMember } from '../../../models/list-member/list-member.interface';
import type { ViewOption } from '../../../models/view-option/view-option.interface';
import { ListPageStore } from '../../../state/list-page/list-page.store';
import { ListViewStore } from '../../../state/list-view/list-view.store';
import { SpacesNavigationStore } from '../../../state/spaces-navigation/spaces-navigation.store';
import { formatSprintRange } from '../../../utils/calendar-date/calendar-date.util';
import { saveTextFile } from '../../../utils/file-download/file-download.util';
import { layoutIconName } from '../../../utils/look/look.util';
import { viewSummary } from '../../../utils/view-summary/view-summary.util';
import { injectOrganizationSlug } from '../../../utils/workspace-route/workspace-route.util';
import { ListHeader } from '../../components/list-header/list-header.component';
import { ViewTabs } from '../../components/view-tabs/view-tabs.component';
import { ViewTools } from '../../components/view-tools/view-tools.component';
import { SaveViewDialog } from '../../dialogs/save-view-dialog/save-view-dialog.component';

/**
 * Constant BUILT_LAYOUTS
 *
 * @description
 * View layouts that have a route in step 4a; the other eight come in step 4b.
 *
 * @type {readonly ViewLayout[]}
 */
const BUILT_LAYOUTS: readonly ViewLayout[] = ['list'];

/**
 * Function csvRecordCount
 *
 * @description
 * Rows of a CSV file, header left out; line breaks inside quoted fields do not count.
 *
 * @param {string} content - CSV text.
 * @returns {number} The row count.
 */
function csvRecordCount(content: string): number {
  let quoted: boolean = false;
  let records: number = 0;
  let filled: boolean = false;
  for (const character of content) {
    if (character === '"') quoted = !quoted;
    if (character === '\n' && !quoted) {
      if (filled) records += 1;
      filled = false;
    } else if (character !== '\r') {
      filled = true;
    }
  }
  if (filled) records += 1;
  return Math.max(0, records - 1);
}

/**
 * Component ListPage
 *
 * @description
 * The frame of a list at `/:org/l/:listId` (`App.dc.html` lines 277-500): the header, the view
 * tabs with the saved views, the view tools and active filters, then the routed view. The list is
 * the primary read: reading its value in the template lets its typed failure reach the route's
 * error boundary. The page claims the shell's sidebar toggle for its breadcrumb row, follows
 * `?savedView=` (applying the view once the saved views are read, leaving it when the parameter
 * goes) and starts the view configuration over for another list. Writes confirm with the mockup's
 * toasts and failures show an error toast; deleting the list asks for its typed name.
 */
@Component({
  selector: 'cw-list-page',
  imports: [
    CwAlertDialog,
    CwAlertDialogAction,
    CwAlertDialogCancel,
    CwAlertDialogDescription,
    CwAlertDialogMedia,
    CwAlertDialogTitle,
    CwButton,
    CwSkeleton,
    ListHeader,
    NgIcon,
    RouterOutlet,
    SaveViewDialog,
    ViewTabs,
    ViewTools,
  ],
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  templateUrl: './list-page.component.html',
})
export class ListPage {
  // #region Properties
  /**
   * Property listId
   *
   * @description
   * The list of the route.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly listId: InputSignal<string> = input.required<string>();

  /**
   * Property savedView
   *
   * @description
   * The `?savedView=` of the address, or undefined.
   *
   * @type {InputSignal<string | undefined>}
   * @readonly
   */
  public readonly savedView: InputSignal<string | undefined> = input<string | undefined>();

  /**
   * Property store
   *
   * @description
   * The open list.
   *
   * @type {InstanceType<typeof ListPageStore>}
   * @readonly
   */
  protected readonly store: InstanceType<typeof ListPageStore> = inject(ListPageStore);

  /**
   * Property view
   *
   * @description
   * The view configuration.
   *
   * @type {InstanceType<typeof ListViewStore>}
   * @readonly
   */
  protected readonly view: InstanceType<typeof ListViewStore> = inject(ListViewStore);

  /**
   * Property navigation
   *
   * @description
   * The workspace's spaces navigation, for the favorite and the sidebar's refresh.
   *
   * @type {InstanceType<typeof SpacesNavigationStore>}
   * @readonly
   */
  private readonly navigation: InstanceType<typeof SpacesNavigationStore> =
    inject(SpacesNavigationStore);

  /**
   * Property sidebar
   *
   * @description
   * The hosting shell's sidebar, or null outside a shell.
   *
   * @type {ShellSidebar | null}
   * @readonly
   */
  protected readonly sidebar: ShellSidebar | null = inject(SHELL_SIDEBAR, { optional: true });

  /**
   * Property toasts
   *
   * @description
   * The shell's toaster.
   *
   * @type {CwToastService}
   * @readonly
   */
  private readonly toasts: CwToastService = inject(CwToastService);

  /**
   * Property router
   *
   * @description
   * Router of the tabs and of the moves after an archive or a deletion.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property route
   *
   * @description
   * The list's route, which the view segments are relative to.
   *
   * @type {ActivatedRoute}
   * @readonly
   */
  private readonly route: ActivatedRoute = inject(ActivatedRoute);

  /**
   * Property document
   *
   * @description
   * Document of the downloads and of the clipboard.
   *
   * @type {Document}
   * @readonly
   */
  private readonly document: Document = inject(DOCUMENT);

  /**
   * Property locale
   *
   * @description
   * Application locale.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);

  /**
   * Property slug
   *
   * @description
   * Organization slug of the route.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly slug: Signal<string> = injectOrganizationSlug();

  /**
   * Property layouts
   *
   * @description
   * The standard views with a route.
   *
   * @type {readonly ViewLayout[]}
   * @readonly
   */
  protected readonly layouts: readonly ViewLayout[] = BUILT_LAYOUTS;

  /**
   * Property editing
   *
   * @description
   * Whether the title is being edited.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly editing: WritableSignal<boolean> = signal(false);

  /**
   * Property renaming
   *
   * @description
   * Whether a rename is being recorded.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly renaming: WritableSignal<boolean> = signal(false);

  /**
   * Property deleteOpen
   *
   * @description
   * Whether the deletion is being confirmed.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly deleteOpen: WritableSignal<boolean> = signal(false);

  /**
   * Property deleting
   *
   * @description
   * Whether the deletion is being recorded.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly deleting: WritableSignal<boolean> = signal(false);

  /**
   * Property dialogOpen
   *
   * @description
   * Whether the save-view dialog shows.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly dialogOpen: WritableSignal<boolean> = signal(false);

  /**
   * Property dialogView
   *
   * @description
   * The saved view being renamed, or null to save the current view.
   *
   * @type {WritableSignal<SavedView | null>}
   * @readonly
   */
  protected readonly dialogView: WritableSignal<SavedView | null> = signal<SavedView | null>(null);

  /**
   * Property dialogPending
   *
   * @description
   * Whether the dialog's submission is being recorded.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly dialogPending: WritableSignal<boolean> = signal(false);

  /**
   * Property layoutNames
   *
   * @description
   * Names of the layouts.
   *
   * @type {Readonly<Record<ViewLayout, string>>}
   * @readonly
   */
  protected readonly layoutNames: Readonly<Record<ViewLayout, string>> = layoutLabels();

  /**
   * Property people
   *
   * @description
   * Member choices and labels for assignee filters.
   *
   * @type {Signal<readonly ViewOption[]>}
   * @readonly
   */
  protected readonly people: Signal<readonly ViewOption[]> = computed((): readonly ViewOption[] =>
    this.store.organizationMembers.hasValue()
      ? this.store.organizationMembers
          .value()
          .filter((member: ListMember): boolean => member.name !== null)
          .map((member: ListMember): ViewOption => ({
            value: member.userId,
            label: member.name ?? '',
          }))
      : [],
  );

  /**
   * Property favorite
   *
   * @description
   * Whether the list is a favorite.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly favorite: Signal<boolean> = computed(
    (): boolean => this.navigation.favoriteOf('list', this.listId()) !== undefined,
  );

  /**
   * Property space
   *
   * @description
   * The list's space, or null while read or when its read failed.
   *
   * @type {Signal<Space | null>}
   * @readonly
   */
  protected readonly space: Signal<Space | null> = computed((): Space | null =>
    this.store.space.hasValue() ? this.store.space.value() : null,
  );

  /**
   * Property statuses
   *
   * @description
   * Statuses the « Filtrer » dialog offers: those the space shows, with its labels.
   *
   * @type {Signal<readonly ViewOption<StatusKey>[]>}
   * @readonly
   */
  protected readonly statuses: Signal<readonly ViewOption<StatusKey>[]> = computed(
    (): readonly ViewOption<StatusKey>[] => {
      const defaults: Readonly<Record<StatusKey, string>> = statusLabels();
      const options: readonly SpaceStatusOption[] =
        this.space()?.statuses ??
        (Object.keys(defaults) as StatusKey[]).map((key: StatusKey): SpaceStatusOption => ({
          key,
          name: null,
          hidden: false,
        }));
      return options
        .filter((status: SpaceStatusOption): boolean => !status.hidden)
        .map((status: SpaceStatusOption): ViewOption<StatusKey> => ({
          value: status.key,
          label: status.name ?? defaults[status.key],
        }));
    },
  );

  /**
   * Property canEdit
   *
   * @description
   * Whether the caller may change the list and its saved views.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly canEdit: Signal<boolean> = computed(
    (): boolean => this.store.list.hasValue() && this.store.list.value().canEdit,
  );

  /**
   * Property dialogSummary
   *
   * @description
   * Description line of the save-view dialog.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly dialogSummary: Signal<string> = computed((): string => {
    const renamed: SavedView | null = this.dialogView();
    const text: string = renamed
      ? viewSummary(renamed.layout, renamed.config, this.locale)
      : viewSummary(this.view.layout(), this.view.config(), this.locale);
    return `${text.charAt(0).toLocaleUpperCase(this.locale)}${text.slice(1)}.`;
  });

  /**
   * Property dialogPlaceholder
   *
   * @description
   * Suggested name of a new saved view (« Liste · filtrée »).
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly dialogPlaceholder: Signal<string> = computed((): string => {
    if (this.dialogView()) return '';
    const layout: string = this.layoutNames[this.view.layout()];
    return this.view.filterCount() > 0
      ? $localize`:@@spaces.save-view.placeholder-filtered:${layout}:layout: · filtered`
      : $localize`:@@spaces.save-view.placeholder-custom:${layout}:layout: · customized`;
  });

  /**
   * Property dialogLayout
   *
   * @description
   * Layout of the view the dialog saves or renames.
   *
   * @type {Signal<ViewLayout>}
   * @readonly
   */
  protected readonly dialogLayout: Signal<ViewLayout> = computed(
    (): ViewLayout => this.dialogView()?.layout ?? this.view.layout(),
  );
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the list, claims the sidebar toggle and follows `?savedView=`.
   *
   * @constructor
   */
  public constructor() {
    if (this.store.list.error()) this.store.list.reload();
    this.store.load(this.listId);
    this.sidebar?.claimToggle(inject(DestroyRef));

    let previousList: string | null = null;
    effect((): void => {
      const listId: string = this.listId();
      if (previousList !== null && previousList !== listId) {
        untracked((): void => {
          this.view.reset();
          this.editing.set(false);
        });
      }
      previousList = listId;
    });

    effect((): void => {
      const wanted: string | undefined = this.savedView();
      const views: readonly SavedView[] | undefined = this.store.savedViews.hasValue()
        ? this.store.savedViews.value()
        : undefined;
      untracked((): void => {
        const applied: SavedView | null = this.view.savedView();
        if (!wanted) {
          if (applied) this.view.leaveSaved();
          return;
        }
        if (!views) return;
        const found: SavedView | undefined = views.find((item: SavedView) => item.id === wanted);
        if (!found) {
          if (applied) this.view.leaveSaved();
        } else if (applied?.id !== found.id) {
          this.view.applySaved(found);
        }
      });
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method sprintRange
   *
   * @description
   * Range of a sprint, or null for a plain list.
   *
   * @param {TaskList} list - The list.
   * @returns {string | null} The range.
   */
  protected sprintRange(list: TaskList): string | null {
    return list.sprint
      ? formatSprintRange(list.sprint.startDate, list.sprint.endDate, this.locale)
      : null;
  }

  /**
   * Method spaceLink
   *
   * @description
   * Address of the list's space overview.
   *
   * @param {TaskList} list - The list.
   * @returns {readonly string[]} The link commands.
   */
  protected spaceLink(list: TaskList): readonly string[] {
    return ['/', this.slug(), 'spaces', list.spaceId];
  }

  /**
   * Method pickLayout
   *
   * @description
   * Opens a standard view, leaving any saved view.
   *
   * @param {ViewLayout} layout - Layout.
   */
  protected pickLayout(layout: ViewLayout): void {
    void this.router.navigate([BUILT_LAYOUTS.includes(layout) ? layout : 'list'], {
      relativeTo: this.route,
      queryParams: { savedView: null },
      queryParamsHandling: 'merge',
    });
  }

  /**
   * Method pickSaved
   *
   * @description
   * Opens a saved view through its address.
   *
   * @param {SavedView} saved - The view.
   */
  protected pickSaved(saved: SavedView): void {
    void this.router.navigate([BUILT_LAYOUTS.includes(saved.layout) ? saved.layout : 'list'], {
      relativeTo: this.route,
      queryParams: { savedView: saved.id },
      queryParamsHandling: 'merge',
    });
  }

  /**
   * Method rename
   *
   * @description
   * Renames the list; a refusal restores the name and shows the failure toast.
   *
   * @param {string} name - New name.
   */
  protected async rename(name: string): Promise<void> {
    this.renaming.set(true);
    const recorded: boolean = await this.store.rename(name);
    this.renaming.set(false);
    if (recorded) {
      this.navigation.refresh();
    } else {
      this.toasts.error($localize`:@@spaces.list.rename-failed:The list could not be renamed`);
    }
  }

  /**
   * Method toggleFavorite
   *
   * @description
   * Adds the list to the favorites or removes it, with the mockup's toast.
   *
   * @param {TaskList} list - The list.
   */
  protected async toggleFavorite(list: TaskList): Promise<void> {
    const on: boolean = !this.favorite();
    const recorded: boolean = await this.navigation.setFavorite('list', list.id, list.name, on);
    if (!recorded) {
      this.toasts.error($localize`:@@spaces.favorite.failed:The favorites could not be changed`);
      return;
    }
    this.toasts.show(
      on
        ? $localize`:@@spaces.favorite.added:Added to favorites`
        : $localize`:@@spaces.favorite.removed:Removed from favorites`,
      { description: list.name },
    );
  }

  /**
   * Method duplicate
   *
   * @description
   * Copies the list with its tasks and adds the copy to the sidebar.
   */
  protected async duplicate(): Promise<void> {
    const copy: { list: TaskList; taskCount: number } | null = await this.store.duplicate();
    if (!copy) {
      this.toasts.error(
        $localize`:@@spaces.list.duplicate-failed:The list could not be duplicated`,
      );
      return;
    }
    this.navigation.refresh();
    const name: string = copy.list.name;
    const count: number = copy.taskCount;
    this.toasts.show($localize`:@@spaces.list.duplicated:List duplicated`, {
      description: $localize`:@@spaces.list.duplicated-text:${name}:name: · ${count}:count: tasks`,
    });
  }

  /**
   * Method exportCsv
   *
   * @description
   * Downloads the tasks the view shows as a CSV file.
   */
  protected async exportCsv(): Promise<void> {
    const file: ListExport | null = await this.store.exportCsv(this.view.taskQuery());
    if (!file || !saveTextFile(this.document, file.fileName, file.content)) {
      this.toasts.error($localize`:@@spaces.list.export-failed:Export not possible here`);
      return;
    }
    const count: number = csvRecordCount(file.content);
    this.toasts.show($localize`:@@spaces.list.exported:CSV export ready`, {
      description: $localize`:@@spaces.list.exported-text:${count}:count: tasks exported.`,
    });
  }

  /**
   * Method copyLink
   *
   * @description
   * Copies the list's shareable address (`/<slug>/l/<listId>`).
   *
   * @param {TaskList} list - The list.
   */
  protected async copyLink(list: TaskList): Promise<void> {
    const view: Window | null = this.document.defaultView;
    const link: string = `${view?.location.origin ?? ''}/${this.slug()}/l/${list.id}`;
    try {
      await view?.navigator.clipboard.writeText(link);
      this.toasts.show($localize`:@@spaces.list.link-copied:List link copied`, {
        description: link,
      });
    } catch {
      this.toasts.error($localize`:@@spaces.list.link-failed:The link could not be copied`, {
        description: link,
      });
    }
  }

  /**
   * Method archive
   *
   * @description
   * Archives the list, then shows its space; the sidebar no longer lists it.
   *
   * @param {TaskList} list - The list.
   */
  protected async archive(list: TaskList): Promise<void> {
    if (!(await this.store.archive())) {
      this.toasts.error($localize`:@@spaces.list.archive-failed:The list could not be archived`);
      return;
    }
    this.navigation.refresh();
    const name: string = list.name;
    this.toasts.show($localize`:@@spaces.list.archived:List archived`, {
      description: $localize`:@@spaces.list.archived-text:${name}:name: no longer shows in the sidebar.`,
    });
    void this.router.navigate(['/', this.slug(), 'spaces', list.spaceId]);
  }

  /**
   * Method confirmDelete
   *
   * @description
   * Deletes the list once its name is typed, then opens the home screen.
   *
   * @param {TaskList} list - The list.
   */
  protected async confirmDelete(list: TaskList): Promise<void> {
    const count: number = this.store.counts.hasValue() ? this.store.counts.value().counts.total : 0;
    this.deleting.set(true);
    const recorded: boolean = await this.store.remove();
    this.deleting.set(false);
    this.deleteOpen.set(false);
    if (!recorded) {
      this.toasts.error($localize`:@@spaces.list.delete-failed:The list could not be deleted`);
      return;
    }
    this.navigation.refresh();
    const name: string = list.name;
    this.toasts.show($localize`:@@spaces.list.deleted:List “${name}:name:” deleted`, {
      description:
        count > 0
          ? $localize`:@@spaces.list.deleted-text:${count}:count: tasks in the trash, restorable for 30 days.`
          : $localize`:@@spaces.list.deleted-empty:No task to move.`,
    });
    void this.router.navigate(['/', this.slug()]);
  }

  /**
   * Method deleteTitle
   *
   * @description
   * Question of the deletion (« Supprimer la liste « Bugs » ? »).
   *
   * @param {TaskList} list - The list.
   * @returns {string} The title.
   */
  protected deleteTitle(list: TaskList): string {
    return $localize`:@@spaces.list.delete-title:Delete the list “${list.name}:name:”?`;
  }

  /**
   * Method deleteText
   *
   * @description
   * Consequences of the deletion, counted.
   *
   * @returns {string} The description.
   */
  protected deleteText(): string {
    const count: number = this.store.counts.hasValue() ? this.store.counts.value().counts.total : 0;
    return $localize`:@@spaces.list.delete-text:${count}:count: tasks go to the trash; the list and its saved views are deleted. To keep it aside, archive it instead.`;
  }

  /**
   * Method openSaveDialog
   *
   * @description
   * Opens « Enregistrer la vue » for the current view.
   */
  protected openSaveDialog(): void {
    this.dialogView.set(null);
    this.dialogOpen.set(true);
  }

  /**
   * Method openRenameDialog
   *
   * @description
   * Opens « Renommer la vue ».
   *
   * @param {SavedView} saved - The view.
   */
  protected openRenameDialog(saved: SavedView): void {
    this.dialogView.set(saved);
    this.dialogOpen.set(true);
  }

  /**
   * Method submitDialog
   *
   * @description
   * Saves the current view under the typed name and opens it, or renames the saved view.
   *
   * @param {SavedViewDraft} draft - Name and icon.
   */
  protected async submitDialog(draft: SavedViewDraft): Promise<void> {
    const renamed: SavedView | null = this.dialogView();
    this.dialogPending.set(true);
    if (renamed) {
      const result: SavedView | null = await this.store.renameView(renamed, draft);
      this.dialogPending.set(false);
      if (!result) {
        this.toasts.error($localize`:@@spaces.saved.failed:The view could not be saved`);
        return;
      }
      this.dialogOpen.set(false);
      if (this.view.savedView()?.id === result.id) this.view.markSaved(result);
      this.toasts.show($localize`:@@spaces.saved.renamed:View renamed`, {
        description: result.name,
      });
      return;
    }
    const layout: ViewLayout = this.view.layout();
    const summary: string = viewSummary(layout, this.view.config(), this.locale);
    const created: SavedView | null = await this.store.createView(
      draft,
      layout,
      this.view.config(),
    );
    this.dialogPending.set(false);
    if (!created) {
      this.toasts.error($localize`:@@spaces.saved.failed:The view could not be saved`);
      return;
    }
    this.dialogOpen.set(false);
    this.view.markSaved(created);
    this.pickSaved(created);
    const name: string = created.name;
    this.toasts.show($localize`:@@spaces.saved.created:View saved`, {
      description: $localize`:@@spaces.saved.created-text:${name}:name: · ${summary}:summary:.`,
    });
  }

  /**
   * Method saveSettings
   *
   * @description
   * Saves the current configuration into the applied saved view (« Enregistrer »).
   */
  protected async saveSettings(): Promise<void> {
    const saved: SavedView | null = this.view.savedView();
    if (!saved) return;
    const updated: SavedView | null = await this.store.saveViewSettings(saved, this.view.config());
    if (!updated) {
      this.toasts.error($localize`:@@spaces.saved.failed:The view could not be saved`);
      return;
    }
    this.view.markSaved(updated);
    const name: string = updated.name;
    this.toasts.show($localize`:@@spaces.saved.created:View saved`, {
      description: $localize`:@@spaces.saved.updated-text:${name}:name: · settings updated.`,
    });
  }

  /**
   * Method duplicateView
   *
   * @description
   * Copies a saved view after its source.
   *
   * @param {SavedView} saved - The view.
   */
  protected async duplicateView(saved: SavedView): Promise<void> {
    const copy: SavedView | null = await this.store.duplicateView(saved);
    if (!copy) {
      this.toasts.error($localize`:@@spaces.saved.failed:The view could not be saved`);
      return;
    }
    this.toasts.show($localize`:@@spaces.saved.duplicated:View duplicated`, {
      description: copy.name,
    });
  }

  /**
   * Method deleteView
   *
   * @description
   * Deletes a saved view; the applied one goes back to the standard tab.
   *
   * @param {SavedView} saved - The view.
   */
  protected async deleteView(saved: SavedView): Promise<void> {
    const applied: boolean = this.view.savedView()?.id === saved.id;
    if (applied) this.pickLayout('list');
    if (!(await this.store.deleteView(saved))) {
      this.toasts.error($localize`:@@spaces.saved.delete-failed:The view could not be deleted`);
      return;
    }
    this.toasts.show($localize`:@@spaces.saved.deleted:View deleted`, { description: saved.name });
  }

  /**
   * Method revert
   *
   * @description
   * Puts back what a saved view saved.
   *
   * @param {SavedView} saved - The view.
   */
  protected revert(saved: SavedView): void {
    if (this.view.savedView()?.id === saved.id) this.view.revert();
  }

  /**
   * Method dialogIcon
   *
   * @description
   * Icon of the dialog's layout choice.
   *
   * @returns {string} The icon name.
   */
  protected dialogIcon(): string {
    return layoutIconName(this.dialogLayout());
  }
  // #endregion
}
