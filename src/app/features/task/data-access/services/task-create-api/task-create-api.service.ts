import { inject, Service } from '@angular/core';
import {
  type CreateTaskClientResult,
  type GetSpaceClientResult,
  type ListLabelsClientResult,
  type ListListsClientResult,
  type ListMembersClientResult,
  ListsService,
  type ListSpacesClientResult,
  type ListTaskTemplatesClientResult,
  MembersService,
  SpacesService,
  TasksService,
} from '@cadenway/api-client';
import { EMPTY, expand, forkJoin, map, type Observable, of, reduce, switchMap } from 'rxjs';

import type { Person } from '../../../models/person/person.interface';
import type {
  CreatedTask,
  ListDestination,
  SpaceSetup,
  TaskDraft,
  TaskTemplateOption,
} from '../../../models/task-create/task-create.interface';
import { toPerson } from '../../adapters/person/person.adapter';
import { toStatusOptions } from '../../adapters/status-option/status-option.adapter';
import {
  toCreatedTask,
  toListDestination,
  toSubtaskCreation,
  toTaskCreation,
  toTaskTemplateOption,
} from '../../adapters/task-create/task-create.adapter';

/**
 * Constant PAGE_SIZE
 *
 * @description
 * Items asked per page when the dialog reads a whole collection.
 *
 * @type {number}
 */
const PAGE_SIZE: number = 100;

/**
 * Interface CursorPage
 *
 * @description
 * The shape every cursor-paginated gateway collection shares.
 */
interface CursorPage<T> {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * Items of the page.
   *
   * @type {readonly T[]}
   * @readonly
   */
  readonly items: readonly T[];

  /**
   * Property nextCursor
   *
   * @description
   * Cursor of the next page, or null on the last one.
   *
   * @type {string | null}
   * @readonly
   */
  readonly nextCursor: string | null;
  // #endregion
}

/**
 * Function readAll
 *
 * @description
 * Follows the cursors of a collection until its last page and gathers every item.
 *
 * @param {(cursor: string | undefined) => Observable<CursorPage<T>>} page - Reads one page.
 * @returns {Observable<readonly T[]>} Every item, in page order.
 */
function readAll<T>(
  page: (cursor: string | undefined) => Observable<CursorPage<T>>,
): Observable<readonly T[]> {
  return page(undefined).pipe(
    expand((current: CursorPage<T>) =>
      current.nextCursor === null ? EMPTY : page(current.nextCursor),
    ),
    reduce((items: readonly T[], current: CursorPage<T>) => [...items, ...current.items], []),
  );
}

/**
 * Service TaskCreateApi
 *
 * @description
 * What the task create dialog reads and writes: the lists it can create in, the statuses and the
 * next key of their space, the space's templates, the members to assign, the labels, and the
 * creation itself. Every method returns display models.
 */
@Service()
export class TaskCreateApi {
  // #region Properties
  /**
   * Property spaces
   *
   * @description
   * Generated space operations.
   *
   * @type {SpacesService}
   * @readonly
   */
  private readonly spaces: SpacesService = inject(SpacesService);

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
   * Property members
   *
   * @description
   * Generated member operations.
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
  // #endregion

  // #region Methods
  /**
   * Method destinations
   *
   * @description
   * Every list of every space the person sees, space by space in the gateway's order.
   *
   * @returns {Observable<readonly ListDestination[]>} The destinations.
   */
  public destinations(): Observable<readonly ListDestination[]> {
    return readAll((cursor: string | undefined) =>
      this.spaces.listSpaces({ limit: PAGE_SIZE, cursor }),
    ).pipe(
      switchMap((spaces: readonly ListSpacesClientResult['items'][number][]) =>
        spaces.length === 0
          ? of([])
          : forkJoin(
              spaces.map((space: ListSpacesClientResult['items'][number]) =>
                readAll((cursor: string | undefined) =>
                  this.lists.listLists(space.id, { limit: PAGE_SIZE, cursor }),
                ).pipe(
                  map((lists: readonly ListListsClientResult['items'][number][]) =>
                    lists.map((list: ListListsClientResult['items'][number]) =>
                      toListDestination(space, list),
                    ),
                  ),
                ),
              ),
            ),
      ),
      map((groups: readonly (readonly ListDestination[])[]) => groups.flat()),
    );
  }

  /**
   * Method space
   *
   * @description
   * The statuses and the next task key of a space, read without the HTTP cache so the key is
   * current after each creation.
   *
   * @param {string} spaceId - Id of the space.
   * @returns {Observable<SpaceSetup>} The space's setup.
   */
  public space(spaceId: string): Observable<SpaceSetup> {
    return this.spaces.getSpace(spaceId, { cache: 'no-store' }).pipe(
      map((space: GetSpaceClientResult): SpaceSetup => ({
        spaceId: space.id,
        nextKey: space.nextKey,
        statuses: toStatusOptions(space.statuses),
      })),
    );
  }

  /**
   * Method templates
   *
   * @description
   * The templates saved in a space.
   *
   * @param {string} spaceId - Id of the space.
   * @returns {Observable<readonly TaskTemplateOption[]>} The templates.
   */
  public templates(spaceId: string): Observable<readonly TaskTemplateOption[]> {
    return readAll((cursor: string | undefined) =>
      this.spaces.listTaskTemplates(spaceId, { limit: PAGE_SIZE, cursor }),
    ).pipe(
      map((templates: readonly ListTaskTemplatesClientResult['items'][number][]) =>
        templates.map(toTaskTemplateOption),
      ),
    );
  }

  /**
   * Method people
   *
   * @description
   * The members a task can be assigned to: every member of the organization but its guests, who
   * the gateway refuses as assignees (`422 task.assignee-invalid`).
   *
   * @returns {Observable<readonly Person[]>} The people, in the gateway's order.
   */
  public people(): Observable<readonly Person[]> {
    return readAll((cursor: string | undefined) =>
      this.members.listMembers({ limit: PAGE_SIZE, cursor, role: ['owner', 'admin', 'member'] }),
    ).pipe(
      map((members: readonly ListMembersClientResult['items'][number][]) => members.map(toPerson)),
    );
  }

  /**
   * Method labels
   *
   * @description
   * The label names of the organization.
   *
   * @returns {Observable<readonly string[]>} The names.
   */
  public labels(): Observable<readonly string[]> {
    return readAll((cursor: string | undefined) =>
      this.tasks.listLabels({ limit: PAGE_SIZE, cursor }),
    ).pipe(
      map((labels: readonly ListLabelsClientResult['items'][number][]) =>
        labels.map((label: ListLabelsClientResult['items'][number]) => label.name),
      ),
    );
  }

  /**
   * Method create
   *
   * @description
   * Creates a task in a list, with its drafted subtasks, under an `Idempotency-Key`: a retry with
   * the same key and body answers the first creation instead of creating a second task.
   *
   * @param {string} listId - Destination list.
   * @param {TaskDraft} draft - Submitted draft.
   * @param {string} idempotencyKey - Key of this creation attempt.
   * @returns {Observable<CreatedTask>} The created task.
   */
  public create(listId: string, draft: TaskDraft, idempotencyKey: string): Observable<CreatedTask> {
    return this.tasks
      .createTask(listId, toTaskCreation(draft), {
        headers: { 'Idempotency-Key': idempotencyKey },
      })
      .pipe(map((task: CreateTaskClientResult) => toCreatedTask(task, draft.subtasks.length)));
  }

  /**
   * Method createSubtask
   *
   * @description
   * Creates the draft as a subtask of a task, in the parent's list, with retry protection.
   *
   * @param {string} parentKey - Key of the parent task.
   * @param {TaskDraft} draft - Submitted draft.
   * @param {string} idempotencyKey - Key reused for retries of the same draft.
   * @returns {Observable<CreatedTask>} The created subtask.
   */
  public createSubtask(
    parentKey: string,
    draft: TaskDraft,
    idempotencyKey: string,
  ): Observable<CreatedTask> {
    return this.tasks
      .createSubtask(parentKey, toSubtaskCreation(draft), {
        headers: { 'Idempotency-Key': idempotencyKey },
      })
      .pipe(map((task: CreateTaskClientResult) => toCreatedTask(task, 0)));
  }
  // #endregion
}
