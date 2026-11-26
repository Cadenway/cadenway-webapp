import { HttpErrorResponse, type HttpResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import {
  AccessService,
  ArchivesService,
  type BulkTaskResult,
  type GrantPage,
  type LabelPage,
  type ListDuplication,
  ListsService,
  type ListSummary as ListSummaryDto,
  type MemberPage,
  MembersService,
  type SavedView as SavedViewDto,
  type SavedViewPage,
  type SavedViewPatch,
  TaskQueriesService,
  type TaskSummaryPage,
  TasksService,
} from '@cadenway/api-client';
import { firstValueFrom } from 'rxjs';

import type { BulkAction, BulkSelection } from '../../../models/bulk-action/bulk-action.interface';
import type { ListMember, ListMembers } from '../../../models/list-member/list-member.interface';
import type {
  ListTaskQuery,
  ListViewConfig,
  SheetExportSort,
} from '../../../models/list-view-config/list-view-config.interface';
import type { LookIcon } from '../../../models/look/look.type';
import type {
  SavedView,
  SavedViewCreationDraft,
} from '../../../models/saved-view/saved-view.interface';
import type {
  ListDraft,
  ListSummary,
  TaskList,
} from '../../../models/task-list/task-list.interface';
import { abortableRead } from '../../utils/abortable-read/abortable-read.util';
import { toRouteError } from '../../adapters/route-error/route-error.adapter';
import {
  toBulkTaskAction,
  toExportParams,
  toSavedView,
  toSavedViewConfiguration,
  toSavedViewConfigurationPatch,
} from '../../adapters/saved-view/saved-view.adapter';
import { toListSummary, toTaskList } from '../../adapters/space/space.adapter';

/**
 * Constant PAGE_LIMIT
 *
 * @description
 * Page size asked of the gateway when a read joins every page.
 *
 * @type {number}
 */
const PAGE_LIMIT: number = 100;

/**
 * Constant MEMBER_PREVIEW
 *
 * @description
 * Grants read for the header's avatars; the total counts the others.
 *
 * @type {number}
 */
const MEMBER_PREVIEW: number = 4;

/**
 * Interface ListExport
 *
 * @description
 * The CSV file of a list export.
 */
export interface ListExport {
  // #region Properties
  /**
   * Property fileName
   *
   * @description
   * Name the gateway gives the file, or one made from the list name.
   *
   * @type {string}
   * @readonly
   */
  readonly fileName: string;

  /**
   * Property content
   *
   * @description
   * UTF-8 CSV text.
   *
   * @type {string}
   * @readonly
   */
  readonly content: string;
  // #endregion
}

/**
 * Function ifMatch
 *
 * @description
 * The `If-Match` header of a version.
 *
 * @param {number} version - Version the change was made from.
 * @returns {Record<string, string>} The header.
 */
function ifMatch(version: number): Record<string, string> {
  return { 'If-Match': `"${String(version)}"` };
}

/**
 * Function fileNameOf
 *
 * @description
 * Reads the file name of a `Content-Disposition` header.
 *
 * @param {string | null} disposition - Header value.
 * @returns {string | null} The file name, or null.
 */
function fileNameOf(disposition: string | null): string | null {
  if (!disposition) return null;
  const encoded: string | undefined = /filename\*=UTF-8''([^;]+)/iu.exec(disposition)?.[1];
  if (encoded) return decodeURIComponent(encoded);
  return /filename="?([^";]+)"?/iu.exec(disposition)?.[1] ?? null;
}

/**
 * Function isUncertainBulkFailure
 *
 * @description
 * Distinguishes a missing or server response from a deterministic refusal.
 *
 * @param {unknown} error - The failed request.
 * @returns {boolean} Whether the request may have been applied.
 */
export function isUncertainBulkFailure(error: unknown): boolean {
  return !(error instanceof HttpErrorResponse) || error.status === 0 || error.status >= 500;
}

/**
 * Service ListsApi
 *
 * @description
 * The list page's access to `lists`, `archives`, `access`, `members`, `tasks` and `task queries`
 * of the gateway, mapped to display models: the list and its counts, its saved views, its writes
 * and the bulk actions of the selection.
 */
@Service()
export class ListsApi {
  // #region Properties
  /**
   * Property lists
   *
   * @description
   * Generated list operations.
   *
   * @type {ListsService}
   * @readonly
   */
  private readonly lists: ListsService = inject(ListsService);

  /**
   * Property archives
   *
   * @description
   * Generated archive operations.
   *
   * @type {ArchivesService}
   * @readonly
   */
  private readonly archives: ArchivesService = inject(ArchivesService);

  /**
   * Property access
   *
   * @description
   * Generated grant operations.
   *
   * @type {AccessService}
   * @readonly
   */
  private readonly access: AccessService = inject(AccessService);

  /**
   * Property members
   *
   * @description
   * Generated member directory operations.
   *
   * @type {MembersService}
   * @readonly
   */
  private readonly members: MembersService = inject(MembersService);

  /**
   * Property tasks
   *
   * @description
   * Generated task operations.
   *
   * @type {TasksService}
   * @readonly
   */
  private readonly tasks: TasksService = inject(TasksService);

  /**
   * Property queries
   *
   * @description
   * Generated task query operations.
   *
   * @type {TaskQueriesService}
   * @readonly
   */
  private readonly queries: TaskQueriesService = inject(TaskQueriesService);
  // #endregion

  // #region Methods
  /**
   * Method list
   *
   * @description
   * Reads a list, the primary read of its page.
   *
   * @param {string} listId - The list.
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<TaskList>} The list.
   * @throws {Error} The typed route error of the failure.
   */
  public async list(listId: string, signal?: AbortSignal): Promise<TaskList> {
    try {
      return toTaskList(await abortableRead(this.lists.getList(listId), signal));
    } catch (error: unknown) {
      throw toRouteError(error, 'list', listId);
    }
  }

  /**
   * Method counts
   *
   * @description
   * Reads the counts of a list for its header, bypassing the HTTP cache.
   *
   * @param {string} listId - The list.
   * @param {string} today - The caller's date, `YYYY-MM-DD`.
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<ListSummary>} The list with its counts.
   */
  public async counts(listId: string, today: string, signal?: AbortSignal): Promise<ListSummary> {
    const summary: ListSummaryDto = await abortableRead(
      this.lists.getListCounts(listId, { today }, { cache: 'no-store' }),
      signal,
    );
    return toListSummary(summary);
  }

  /**
   * Method milestoneCount
   *
   * @description
   * Counts the milestones of a list, subtasks included, for `Milestones n`.
   *
   * @param {string} listId - The list.
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<number>} The count.
   */
  public async milestoneCount(listId: string, signal?: AbortSignal): Promise<number> {
    const page: TaskSummaryPage = await abortableRead(
      this.queries.queryListTasks(listId, { milestone: true, level: 'all', limit: 1 }),
      signal,
    );
    return page.total;
  }

  /**
   * Method listMembers
   *
   * @description
   * Reads the first people the list is shared with and names them from the member directory;
   * a directory the caller may not read leaves the names unknown.
   *
   * @param {string} listId - The list.
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<ListMembers>} The members and their total.
   */
  public async listMembers(listId: string, signal?: AbortSignal): Promise<ListMembers> {
    const grants: GrantPage = await abortableRead(
      this.access.listListGrants(listId, { limit: MEMBER_PREVIEW }),
      signal,
    );
    const names: Map<string, string> = new Map<string, string>();
    try {
      const directory: MemberPage = await abortableRead(
        this.members.listMembers({ limit: PAGE_LIMIT }),
        signal,
      );
      for (const member of directory.items) names.set(member.userId, member.name);
    } catch {
      names.clear();
    }
    return {
      total: grants.total,
      items: grants.items.map((grant: GrantPage['items'][number]): ListMember => ({
        userId: grant.userId,
        name: names.get(grant.userId) ?? null,
      })),
    };
  }

  /**
   * Method organizationMembers
   *
   * @description
   * Reads every member for assignee choices and labels.
   *
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<readonly ListMember[]>} The member directory.
   */
  public async organizationMembers(signal?: AbortSignal): Promise<readonly ListMember[]> {
    const items: ListMember[] = [];
    let cursor: string | undefined;
    do {
      const page: MemberPage = await abortableRead(
        this.members.listMembers({ limit: PAGE_LIMIT, ...(cursor ? { cursor } : {}) }),
        signal,
      );
      items.push(
        ...page.items.map((member): ListMember => ({ userId: member.userId, name: member.name })),
      );
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return items;
  }

  /**
   * Method labels
   *
   * @description
   * Reads the labels of the tasks the caller sees, for the `Label` filter.
   *
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<readonly string[]>} The labels, alphabetically.
   */
  public async labels(signal?: AbortSignal): Promise<readonly string[]> {
    const items: string[] = [];
    let cursor: string | undefined;
    do {
      const page: LabelPage = await abortableRead(
        this.tasks.listLabels({ limit: PAGE_LIMIT, ...(cursor ? { cursor } : {}) }),
        signal,
      );
      items.push(...page.items.map((label: LabelPage['items'][number]): string => label.name));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return items;
  }

  /**
   * Method create
   *
   * @description
   * Creates a list, or a sprint when the draft has dates, after the other lists of a space. A
   * retry of the same creation reuses its idempotency key, so a lost answer creates nothing twice.
   *
   * @param {string} spaceId - The space.
   * @param {ListDraft} draft - The dialog's values.
   * @param {string} idempotencyKey - Key of this creation.
   * @returns {Promise<TaskList>} The list as recorded.
   */
  public async create(
    spaceId: string,
    draft: ListDraft,
    idempotencyKey: string,
  ): Promise<TaskList> {
    return toTaskList(
      await firstValueFrom(
        this.lists.createList(
          spaceId,
          { name: draft.name, icon: draft.icon, color: draft.color, sprint: draft.sprint },
          { headers: { 'Idempotency-Key': idempotencyKey } },
        ),
      ),
    );
  }

  /**
   * Method update
   *
   * @description
   * Changes a list from the version shown: its name, look and sprint (a null sprint makes a
   * sprint a list again).
   *
   * @param {TaskList} list - The list as shown.
   * @param {ListDraft} draft - The dialog's values.
   * @returns {Promise<TaskList>} The list as recorded.
   */
  public async update(list: TaskList, draft: ListDraft): Promise<TaskList> {
    return toTaskList(
      await firstValueFrom(
        this.lists.updateList(
          list.id,
          { name: draft.name, icon: draft.icon, color: draft.color, sprint: draft.sprint },
          { headers: ifMatch(list.version) },
        ),
      ),
    );
  }

  /**
   * Method duplicate
   *
   * @description
   * Copies a list with every live task (`Duplicate with the tasks`).
   *
   * @param {TaskList} list - The list as shown.
   * @returns {Promise<{ list: TaskList; taskCount: number }>} The copy and its task count.
   */
  public async duplicate(list: TaskList): Promise<{ list: TaskList; taskCount: number }> {
    const copy: ListDuplication = await firstValueFrom(
      this.lists.duplicateList(list.id, {}, { headers: ifMatch(list.version) }),
    );
    return { list: toTaskList(copy.list), taskCount: copy.taskCount };
  }

  /**
   * Method exportCsv
   *
   * @description
   * Downloads the tasks the view shows as CSV, with the gateway's file name, in the sheet's
   * own order when it has one.
   *
   * @param {TaskList} list - The list.
   * @param {ListTaskQuery} query - The view's task query.
   * @param {SheetExportSort | null} sheetSort - The sheet's sort, or null.
   * @returns {Promise<ListExport>} The file.
   */
  public async exportCsv(
    list: TaskList,
    query: ListTaskQuery,
    sheetSort: SheetExportSort | null = null,
  ): Promise<ListExport> {
    const response: HttpResponse<string> = await firstValueFrom(
      this.lists.exportListTasks(list.id, toExportParams(query, sheetSort), {
        observe: 'response',
      }),
    );
    return {
      fileName:
        fileNameOf(response.headers.get('Content-Disposition')) ??
        `${list.name.trim().replace(/\s+/gu, '-').toLowerCase()}.csv`,
      content: response.body ?? '',
    };
  }

  /**
   * Method archive
   *
   * @description
   * Archives a list: it leaves the sidebar and its writes are blocked.
   *
   * @param {string} listId - The list.
   * @returns {Promise<void>} Resolves once archived.
   */
  public async archive(listId: string): Promise<void> {
    await firstValueFrom(this.archives.archiveList(listId, {}));
  }

  /**
   * Method unarchive
   *
   * @description
   * Brings an archived list back to the sidebar, the undo of its archiving.
   *
   * @param {string} listId - The list.
   * @returns {Promise<TaskList>} The list as recorded.
   */
  public async unarchive(listId: string): Promise<TaskList> {
    return toTaskList(await firstValueFrom(this.archives.unarchiveList(listId, {})));
  }

  /**
   * Method remove
   *
   * @description
   * Deletes a list from the version shown; its tasks go to the trash.
   *
   * @param {TaskList} list - The list as shown.
   * @returns {Promise<void>} Resolves once deleted.
   */
  public async remove(list: TaskList): Promise<void> {
    await firstValueFrom(this.lists.deleteList(list.id, { headers: ifMatch(list.version) }));
  }

  /**
   * Method savedViews
   *
   * @description
   * Reads every saved view of a list, in creation order.
   *
   * @param {string} listId - The list.
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<readonly SavedView[]>} The views.
   */
  public async savedViews(listId: string, signal?: AbortSignal): Promise<readonly SavedView[]> {
    const items: SavedViewDto[] = [];
    let cursor: string | undefined;
    do {
      const page: SavedViewPage = await abortableRead(
        this.lists.listSavedViews(listId, { limit: PAGE_LIMIT, ...(cursor ? { cursor } : {}) }),
        signal,
      );
      items.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return items.map(toSavedView);
  }

  /**
   * Method createSavedView
   *
   * @description
   * Saves the current view under a name and an icon; a restored view keeps the presentation
   * values this client did not read (`unknownPresentation`).
   *
   * @param {string} listId - The list.
   * @param {SavedViewCreationDraft} view - What to save.
   * @returns {Promise<SavedView>} The saved view.
   */
  public async createSavedView(listId: string, view: SavedViewCreationDraft): Promise<SavedView> {
    return toSavedView(
      await firstValueFrom(
        this.lists.createSavedView(listId, {
          name: view.name,
          icon: view.icon,
          configuration: toSavedViewConfiguration(
            view.layout,
            view.config,
            view.unknownPresentation,
          ),
        }),
      ),
    );
  }

  /**
   * Method updateSavedView
   *
   * @description
   * Renames a saved view or replaces its settings, from the version shown, writing back the
   * presentation values this client did not read.
   *
   * @param {SavedView} view - The view as shown.
   * @param {{ name?: string; icon?: LookIcon; config?: ListViewConfig }} change - What changes.
   * @returns {Promise<SavedView>} The updated view.
   */
  public async updateSavedView(
    view: SavedView,
    change: { name?: string; icon?: LookIcon; config?: ListViewConfig },
  ): Promise<SavedView> {
    const patch: SavedViewPatch = {
      ...(change.name !== undefined ? { name: change.name } : {}),
      ...(change.icon !== undefined ? { icon: change.icon } : {}),
      ...(change.config
        ? {
            configuration: toSavedViewConfigurationPatch(
              view.layout,
              change.config,
              view.unknownPresentation,
            ),
          }
        : {}),
    };
    return toSavedView(
      await firstValueFrom(
        this.lists.updateSavedView(view.listId, view.id, patch, {
          headers: ifMatch(view.version),
        }),
      ),
    );
  }

  /**
   * Method duplicateSavedView
   *
   * @description
   * Copies a saved view after its source.
   *
   * @param {SavedView} view - The view.
   * @returns {Promise<SavedView>} The copy.
   */
  public async duplicateSavedView(view: SavedView): Promise<SavedView> {
    return toSavedView(
      await firstValueFrom(this.lists.duplicateSavedView(view.listId, view.id, {})),
    );
  }

  /**
   * Method deleteSavedView
   *
   * @description
   * Deletes a saved view.
   *
   * @param {SavedView} view - The view.
   * @returns {Promise<void>} Resolves once deleted.
   */
  public async deleteSavedView(view: SavedView): Promise<void> {
    await firstValueFrom(this.lists.deleteSavedView(view.listId, view.id));
  }

  /**
   * Method bulk
   *
   * @description
   * Applies one action to the selected tasks atomically: nothing changes when it is refused.
   *
   * @param {readonly BulkSelection[]} selection - Selected tasks, 1 to 50.
   * @param {BulkAction} action - Action.
   * @param {string} idempotencyKey - Stable key for retries of this chunk.
   * @returns {Promise<number>} Task rows affected, subtrees included.
   */
  public async bulk(
    selection: readonly BulkSelection[],
    action: BulkAction,
    idempotencyKey: string,
  ): Promise<number> {
    const result: BulkTaskResult = await firstValueFrom(
      this.tasks.executeBulkTaskAction(toBulkTaskAction(selection, action), {
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
    );
    return result.affectedCount;
  }
  // #endregion
}
