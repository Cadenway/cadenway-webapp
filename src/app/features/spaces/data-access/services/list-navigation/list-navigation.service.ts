import { Service, inject } from '@angular/core';
import { ListsService, SpacesService, TaskQueriesService } from '@cadenway/api-client';
import type {
  GetListClientResult,
  ListListsClientResult,
  ListSpacesClientResult,
  ListTasksClientResult,
  ListTasksParams,
} from '@cadenway/api-client';
import { map, of, switchMap } from 'rxjs';
import type { Observable } from 'rxjs';

import type {
  SpacesPageData,
  SpacesPageRequest,
} from '../../../models/list-navigation/list-navigation.model';

/**
 * Constant PAGE_SIZE
 *
 * @description
 * Caps the number of links or task rows shown per request.
 *
 * @type {number}
 */
const PAGE_SIZE: number = 50;

/**
 * Service ListNavigation
 *
 * @description
 * Loads the current organization's visible spaces, lists and tasks through the published Gateway client.
 */
@Service()
export class ListNavigation {
  // #region Properties
  /**
   * Property spaces
   *
   * @description
   * Reads spaces visible to the current session.
   *
   * @type {SpacesService}
   * @readonly
   */
  private readonly spaces: SpacesService = inject(SpacesService);

  /**
   * Property lists
   *
   * @description
   * Reads list links and the metadata that identifies a sprint.
   *
   * @type {ListsService}
   * @readonly
   */
  private readonly lists: ListsService = inject(ListsService);

  /**
   * Property tasks
   *
   * @description
   * Reads tasks of a verified list.
   *
   * @type {TaskQueriesService}
   * @readonly
   */
  private readonly tasks: TaskQueriesService = inject(TaskQueriesService);
  // #endregion

  // #region Methods
  /**
   * Method load
   *
   * @description
   * Loads one page for the selected route and forwards the cursor unchanged.
   *
   * @param {SpacesPageRequest} request - The current destination and continuation.
   * @returns {Observable<SpacesPageData>} The visible display models.
   */
  public load(request: SpacesPageRequest): Observable<SpacesPageData> {
    const params: Pick<ListTasksParams, 'limit' | 'cursor'> = {
      limit: PAGE_SIZE,
      cursor: request.cursor,
    };

    switch (request.kind) {
      case 'spaces':
        return this.spaces.listSpaces(params).pipe(
          map((result: ListSpacesClientResult) => ({
            kind: 'spaces',
            page: {
              items: result.items.map((space) => ({ id: space.id, name: space.name })),
              nextCursor: result.nextCursor,
            },
          })),
        );
      case 'lists':
        return this.lists.listLists(request.spaceId, params).pipe(
          map((result: ListListsClientResult) => ({
            kind: 'lists',
            spaceId: request.spaceId,
            page: {
              items: result.items.map((list) => ({ id: list.id, name: list.name })),
              nextCursor: result.nextCursor,
            },
          })),
        );
      case 'tasks':
        return this.lists.getList(request.listId, { cache: 'no-store' }).pipe(
          switchMap((list: GetListClientResult) => {
            if (list.spaceId !== request.spaceId || list.archivedAt != null) {
              throw new Error('The selected list is unavailable in this space.');
            }
            const details: Pick<
              Extract<SpacesPageData, { kind: 'tasks' }>,
              'listName' | 'sprint'
            > = {
              listName: list.name,
              sprint:
                list.sprint === null
                  ? null
                  : {
                      startDate: list.sprint.startDate,
                      endDate: list.sprint.endDate,
                      goal: list.sprint.goal,
                    },
            };
            if (request.view === 'board') {
              return of<SpacesPageData>({
                kind: 'board',
                ...details,
                listId: request.listId,
                spaceId: request.spaceId,
                mayEdit: list.callerRole === 'edit' || list.callerRole === undefined,
              });
            }
            return this.tasks.listTasks(request.listId, { ...params, sort: 'manual' }).pipe(
              map((result: ListTasksClientResult): SpacesPageData => ({
                kind: 'tasks',
                ...details,
                page: {
                  items: result.items.map((task) => ({
                    key: task.key,
                    name: task.name,
                    status: task.status,
                    assigneeCount: task.assignees.length,
                    dueDate: task.dueDate,
                  })),
                  nextCursor: result.nextCursor,
                },
              })),
            );
          }),
        );
    }
  }
  // #endregion
}
