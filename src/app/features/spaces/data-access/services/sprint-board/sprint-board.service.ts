import { HttpErrorResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import {
  OrganizationsService,
  SpacesService,
  TaskQueriesService,
  TasksService,
} from '@cadenway/api-client';
import type {
  CountTaskGroupsClientResult,
  GetSpaceClientResult,
  ListTasksClientResult,
} from '@cadenway/api-client';
import { STATUS_KEYS, type StatusKey } from '@cadenway/contracts';
import { withSessionLock } from '@features/auth';
import { catchError, EMPTY, forkJoin, map, of, switchMap, throwError, type Observable } from 'rxjs';

import {
  BOARD_PAGE_SIZE,
  BOARD_STATUS_LABELS,
} from '../../../constants/sprint-board/sprint-board.constants';
import { BoardOrganizationChanged } from '../../../models/sprint-board/sprint-board.model';
import type {
  BoardCard,
  BoardCardPage,
  BoardColumn,
  BoardLocation,
  BoardMoveStatus,
} from '../../../models/sprint-board/sprint-board.model';

/**
 * Function toBoardCard
 *
 * @description
 * Keeps only the fields the card needs and copies the task's write version.
 *
 * @param {ListTasksClientResult['items'][number]} task - A task summary returned by the gateway.
 * @returns {BoardCard} A display model bound to the reported version.
 */
function toBoardCard(task: ListTasksClientResult['items'][number]): BoardCard {
  return {
    key: task.key,
    name: task.name,
    status: task.status,
    version: task.version,
    milestone: task.milestone === true,
    priority: task.priority,
    dueDate: task.dueDate,
    labels: task.labels,
    subtaskCounts: task.subtaskCounts,
  };
}

/**
 * Function rejectBoardRequest
 *
 * @description
 * Maps a failed organization precondition to the board's context-change state.
 *
 * @param {unknown} error - The request failure.
 * @returns {Observable<never>} A stream rejecting with the matching board error.
 */
function rejectBoardRequest(error: unknown): Observable<never> {
  if (error instanceof HttpErrorResponse && error.status === 412) {
    const problem: unknown = error.error;
    if (
      problem &&
      typeof problem === 'object' &&
      'code' in problem &&
      problem.code === 'organization.context-changed'
    ) {
      return throwError(() => new BoardOrganizationChanged());
    }
  }
  return throwError(() => error);
}

/**
 * Class SprintBoardApi
 *
 * @description
 * Reads one page of each workflow column and updates cards through the published Task client.
 */
@Service()
export class SprintBoardApi {
  // #region Properties
  /**
   * Property organizations
   *
   * @description
   * Confirms the current organization within the lock shared by session-changing operations.
   *
   * @type {OrganizationsService}
   * @readonly
   */
  private readonly organizations: OrganizationsService = inject(OrganizationsService);

  /**
   * Property spaces
   *
   * @description
   * Reads the display configuration for the space that owns the list.
   *
   * @type {SpacesService}
   * @readonly
   */
  private readonly spaces: SpacesService = inject(SpacesService);

  /**
   * Property queries
   *
   * @description
   * Reads counts and independent pages scoped to the verified list.
   *
   * @type {TaskQueriesService}
   * @readonly
   */
  private readonly queries: TaskQueriesService = inject(TaskQueriesService);

  /**
   * Property tasks
   *
   * @description
   * Sends a versioned status change for one task.
   *
   * @type {TasksService}
   * @readonly
   */
  private readonly tasks: TasksService = inject(TasksService);
  // #endregion

  // #region Methods
  /**
   * Method load
   *
   * @description
   * Reads the workflow and group counts first, then fetches only non-empty visible columns.
   *
   * @param {BoardLocation} location - The verified owning space and list in the current session.
   * @returns {Observable<readonly BoardColumn[]>} The visible workflow with its initial card pages.
   */
  public load(location: BoardLocation): Observable<readonly BoardColumn[]> {
    const options: { cache: 'no-store'; headers: Record<string, string> } = {
      cache: 'no-store',
      headers: { 'If-Organization-Match': location.organizationId },
    };
    return withSessionLock(
      () =>
        forkJoin({
          space: this.spaces.getSpace(location.spaceId, options),
          groups: this.queries.countTaskGroups(
            location.listId,
            { groupBy: 'status', limit: STATUS_KEYS.length },
            options,
          ),
        }).pipe(
          switchMap(
            ({
              space,
              groups,
            }: {
              space: GetSpaceClientResult;
              groups: CountTaskGroupsClientResult;
            }) => {
              const counts: Map<string, number> = new Map<string, number>(
                groups.items.map((group) => [group.value, group.count]),
              );
              const columns: Observable<BoardColumn>[] = STATUS_KEYS.filter(
                (status) => !space.statuses[status].hidden,
              ).map((status) => {
                const label: string = space.statuses[status].name ?? BOARD_STATUS_LABELS[status];
                const count: number = counts.get(status) ?? 0;
                const page: Observable<BoardCardPage> = count
                  ? this.readPage(location, status)
                  : of({ cards: [], count, nextCursor: null });
                return page.pipe(
                  map((value): BoardColumn => ({
                    ...value,
                    status,
                    label,
                    hasPreviousPage: false,
                  })),
                );
              });
              return columns.length ? forkJoin(columns) : of([]);
            },
          ),
          catchError(rejectBoardRequest),
        ),
      'shared',
    );
  }

  /**
   * Method loadPage
   *
   * @description
   * Replaces one status page using the gateway's opaque continuation.
   *
   * @param {BoardLocation} location - The route retained when opening the board.
   * @param {StatusKey} status - The group filter that owns the cursor.
   * @param {string | undefined} cursor - The next page token or absence for the first page.
   * @returns {Observable<BoardCardPage>} The requested slice of cards.
   */
  public loadPage(
    location: BoardLocation,
    status: StatusKey,
    cursor?: string,
  ): Observable<BoardCardPage> {
    return this.readPage(location, status, cursor).pipe(catchError(rejectBoardRequest));
  }

  /**
   * Method changeStatus
   *
   * @description
   * Requires both the last task version and the route's expected organization to match.
   *
   * @param {BoardLocation} location - The route that owns the card.
   * @param {BoardCard} card - The last confirmed card snapshot.
   * @param {BoardMoveStatus} status - The selected destination.
   * @returns {Observable<BoardCard>} The committed version and card fields.
   */
  public changeStatus(
    location: BoardLocation,
    card: BoardCard,
    status: BoardMoveStatus,
  ): Observable<BoardCard> {
    return this.inOrganization(location, () =>
      this.tasks
        .updateTask(
          card.key,
          { status },
          {
            headers: {
              'If-Match': `"${card.version.toString()}"`,
              'If-Organization-Match': location.organizationId,
            },
          },
        )
        .pipe(map(toBoardCard), catchError(rejectBoardRequest)),
    );
  }

  /**
   * Method readPage
   *
   * @description
   * Reads one group's roots with the route's expected organization.
   *
   * @param {BoardLocation} location - Identifies the list containing the group.
   * @param {StatusKey} status - Filters the result to one workflow status.
   * @param {string | undefined} cursor - Optional continuation returned for the same filter.
   * @returns {Observable<BoardCardPage>} The next bounded card page and its total.
   */
  private readPage(
    location: BoardLocation,
    status: StatusKey,
    cursor?: string,
  ): Observable<BoardCardPage> {
    return this.queries
      .listTasks(
        location.listId,
        { status: [status], limit: BOARD_PAGE_SIZE, cursor, sort: 'manual' },
        {
          cache: 'no-store',
          headers: { 'If-Organization-Match': location.organizationId },
        },
      )
      .pipe(
        map((result: ListTasksClientResult) => ({
          cards: result.items.map(toBoardCard),
          count: result.total,
          nextCursor: result.nextCursor,
        })),
      );
  }

  /**
   * Method inOrganization
   *
   * @description
   * Keeps a cooperating tab from changing the session while a verified board request is dispatched.
   *
   * @template T
   * @param {BoardLocation} location - The expected organization resolved when opening the route.
   * @param {(signal: AbortSignal) => Observable<T>} operation - The gateway request under the lock.
   * @returns {Observable<T>} The result or the verification error before any board request.
   */
  private inOrganization<T>(
    location: BoardLocation,
    operation: (signal: AbortSignal) => Observable<T>,
  ): Observable<T> {
    return withSessionLock((signal) =>
      this.organizations.getCurrentOrganization({ cache: 'no-store' }).pipe(
        switchMap((organization) => {
          if (signal.aborted) return EMPTY;
          if (organization.id !== location.organizationId) {
            return throwError(() => new BoardOrganizationChanged());
          }
          return operation(signal);
        }),
      ),
    );
  }
  // #endregion
}
