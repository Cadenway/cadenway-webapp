import { HttpContext, type HttpResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import {
  type CreateGoalResultClientResult,
  type GetGoalClientResult,
  type GetTaskClientResult,
  GoalsService,
  type ListGoalsClientResult,
  type ListMembersClientResult,
  MembersService,
  TasksService,
  type UpdateGoalResultClientResult,
} from '@cadenway/api-client';
import { catchError, EMPTY, expand, firstValueFrom, map, type Observable, of, reduce } from 'rxjs';

import { type ApiProblem, PASSIVE_REQUEST, readProblem } from '@core/api';
import { personOf, type Person } from '@features/task';

import type {
  Goal,
  GoalDraft,
  GoalList,
  KeyResult,
  KeyResultDraft,
  MilestoneState,
  Quarter,
} from '../../../models/goal/goal.interface';
import {
  ifMatch,
  toGoal,
  toGoalCreation,
  toKeyResult,
  toKeyResultCreation,
  toMilestoneTask,
  versionOfEtag,
} from '../../adapters/goal/goal.adapter';

/**
 * Constant PAGE_SIZE
 *
 * @description
 * Items asked per page when a whole collection is read.
 *
 * @type {number}
 */
const PAGE_SIZE: number = 100;

/**
 * Interface KeyResultWrite
 *
 * @description
 * A key result the gateway wrote, with the goal version its `ETag` named.
 */
export interface KeyResultWrite {
  // #region Properties
  /**
   * Property result
   *
   * @description
   * The key result as written, or null for a kind a later contract adds.
   *
   * @type {KeyResult | null}
   * @readonly
   */
  readonly result: KeyResult | null;

  /**
   * Property version
   *
   * @description
   * The goal's new version, or null without a readable `ETag`.
   *
   * @type {number | null}
   * @readonly
   */
  readonly version: number | null;
  // #endregion
}

/**
 * Function isUncertainWrite
 *
 * @description
 * Whether a failed write may still have been recorded: it got no answer (no HTTP status, a
 * timeout, any failure that is not a gateway answer) or a server failure (`5xx`), unlike a
 * refusal (`4xx`).
 *
 * @param {unknown} error - The failure.
 * @returns {boolean} Whether its outcome is unknown.
 */
export function isUncertainWrite(error: unknown): boolean {
  const problem: ApiProblem | null = readProblem(error);
  return problem === null || problem.status === 0 || problem.status >= 500;
}

/**
 * Function isVersionMismatch
 *
 * @description
 * Whether a write was refused because the goal changed since the version it was sent from
 * (`412 request.version-mismatch`).
 *
 * @param {unknown} error - The failure.
 * @returns {boolean} Whether the version was stale.
 */
export function isVersionMismatch(error: unknown): boolean {
  const problem: ApiProblem | null = readProblem(error);
  return problem?.status === 412 && problem.code === 'request.version-mismatch';
}

/**
 * Function isGone
 *
 * @description
 * Whether a write or read was refused because its goal or key result no longer exists or is
 * hidden (`404 goal.not-found` or `goal.result-not-found`).
 *
 * @param {unknown} error - The failure.
 * @returns {boolean} Whether the target is gone.
 */
export function isGone(error: unknown): boolean {
  const problem: ApiProblem | null = readProblem(error);
  return (
    problem?.status === 404 &&
    (problem.code === 'goal.not-found' || problem.code === 'goal.result-not-found')
  );
}

/**
 * Function passive
 *
 * @description
 * The request context of a read the page sends in the background.
 *
 * @param {boolean} background - Whether the read was triggered in the background.
 * @returns {HttpContext} The context, fenced by the organization pin while it is stale.
 */
function passive(background: boolean): HttpContext {
  return new HttpContext().set(PASSIVE_REQUEST, background);
}

/**
 * Function writeOf
 *
 * @description
 * The key result and goal version of a write's response.
 *
 * @param {HttpResponse<CreateGoalResultClientResult>} response - The gateway's response.
 * @returns {KeyResultWrite} The write.
 */
function writeOf(response: HttpResponse<CreateGoalResultClientResult>): KeyResultWrite {
  return {
    result: response.body === null ? null : toKeyResult(response.body),
    version: versionOfEtag(response.headers.get('ETag')),
  };
}

/**
 * Service GoalsApi
 *
 * @description
 * What the goals page reads and writes through `@cadenway/api-client`: the goals of a quarter
 * (`GoalsService`), the members who may own one (`MembersService`) and the milestone tasks
 * (`TasksService.getTask`, gap G-G1). Every method returns display models. Every write sends the
 * goal version it was made from as `If-Match`, which every goal write of the contract declares.
 */
@Service()
export class GoalsApi {
  // #region Properties
  /**
   * Property goals
   *
   * @description
   * Generated goal operations.
   *
   * @type {GoalsService}
   * @readonly
   */
  private readonly goals: GoalsService = inject(GoalsService);

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
   * Method list
   *
   * @description
   * Every goal of a quarter the caller can read, following the cursors to the last page, with the
   * expected progress of the first page's summary. Read without the HTTP cache, so a read after a
   * focus or a reconnection is current.
   *
   * @param {Quarter} quarter - The quarter.
   * @param {string} today - The caller's day, `YYYY-MM-DD`.
   * @param {boolean} background - Whether the read was triggered in the background.
   * @returns {Promise<GoalList>} The goals.
   */
  public list(quarter: Quarter, today: string, background: boolean): Promise<GoalList> {
    const page: (cursor: string | undefined) => Observable<ListGoalsClientResult> = (
      cursor: string | undefined,
    ) =>
      this.goals.listGoals(
        { quarter: quarter.key, today, limit: PAGE_SIZE, cursor },
        { context: passive(background), cache: 'no-store' },
      );
    return firstValueFrom(
      page(undefined).pipe(
        expand((current: ListGoalsClientResult) =>
          current.nextCursor === null ? EMPTY : page(current.nextCursor),
        ),
        reduce(
          (list: GoalList | null, current: ListGoalsClientResult): GoalList => ({
            quarter,
            goals: [...(list?.goals ?? []), ...current.items.map(toGoal)],
            expectedProgressPercent:
              list?.expectedProgressPercent ?? current.summary.expectedProgressPercent,
          }),
          null,
        ),
        map(
          (list: GoalList | null): GoalList =>
            list ?? { quarter, goals: [], expectedProgressPercent: 0 },
        ),
      ),
    );
  }

  /**
   * Method get
   *
   * @description
   * One goal, as it is now: after a write, for its new progress, health and version, or after a
   * stale version (`412`) to send again from the current one.
   *
   * @param {string} goalId - Id of the goal.
   * @param {string} today - The caller's day, `YYYY-MM-DD`.
   * @returns {Promise<Goal>} The goal.
   */
  public get(goalId: string, today: string): Promise<Goal> {
    return firstValueFrom(
      this.goals
        .getGoal(goalId, { today }, { cache: 'no-store' })
        .pipe(map((goal: GetGoalClientResult) => toGoal(goal))),
    );
  }

  /**
   * Method create
   *
   * @description
   * Creates a goal due on the last day of the quarter, with its first key result when one was
   * given. The idempotency key replays the original answer for 24 hours, so a send after an
   * unknown outcome cannot create it twice.
   *
   * @param {GoalDraft} draft - What the form submitted.
   * @param {Quarter} quarter - The quarter shown.
   * @param {string} today - The caller's day, `YYYY-MM-DD`.
   * @param {string} idempotencyKey - Key of this creation.
   * @returns {Promise<Goal>} The new goal.
   */
  public create(
    draft: GoalDraft,
    quarter: Quarter,
    today: string,
    idempotencyKey: string,
  ): Promise<Goal> {
    return firstValueFrom(
      this.goals
        .createGoal(
          toGoalCreation(draft, quarter),
          { today },
          { headers: { 'Idempotency-Key': idempotencyKey } },
        )
        .pipe(map((goal: GetGoalClientResult) => toGoal(goal))),
    );
  }

  /**
   * Method delete
   *
   * @description
   * Deletes a goal and its key results from the version shown. There is no restore (gap G-G4).
   *
   * @param {string} goalId - Id of the goal.
   * @param {number} version - The version shown.
   * @returns {Promise<void>} Settles once deleted.
   */
  public async delete(goalId: string, version: number): Promise<void> {
    await firstValueFrom(this.goals.deleteGoal(goalId, { headers: ifMatch(version) }), {
      defaultValue: undefined,
    });
  }

  /**
   * Method createResult
   *
   * @description
   * Adds a number key result from 0 towards its target to a goal, from the version shown.
   *
   * @param {string} goalId - Id of the goal.
   * @param {number} version - The version shown.
   * @param {KeyResultDraft} draft - What the form submitted.
   * @param {string} idempotencyKey - Key of this creation.
   * @returns {Promise<KeyResultWrite>} The new key result and goal version.
   */
  public createResult(
    goalId: string,
    version: number,
    draft: KeyResultDraft,
    idempotencyKey: string,
  ): Promise<KeyResultWrite> {
    return firstValueFrom(
      this.goals
        .createGoalResult(goalId, toKeyResultCreation(draft), {
          observe: 'response',
          headers: { ...ifMatch(version), 'Idempotency-Key': idempotencyKey },
        })
        .pipe(map(writeOf)),
    );
  }

  /**
   * Method updateResult
   *
   * @description
   * Sets the current value of a number key result, or the state of a checkbox, from the version
   * shown.
   *
   * @param {string} goalId - Id of the goal.
   * @param {string} resultId - Id of the key result.
   * @param {number} version - The version shown.
   * @param {{ readonly currentValue: number } | { readonly checked: boolean }} patch - The change.
   * @returns {Promise<KeyResultWrite>} The key result and goal version.
   */
  public updateResult(
    goalId: string,
    resultId: string,
    version: number,
    patch: { readonly currentValue: number } | { readonly checked: boolean },
  ): Promise<KeyResultWrite> {
    return firstValueFrom(
      this.goals
        .updateGoalResult(goalId, resultId, patch, {
          observe: 'response',
          headers: ifMatch(version),
        })
        .pipe(map((response: HttpResponse<UpdateGoalResultClientResult>) => writeOf(response))),
    );
  }

  /**
   * Method deleteResult
   *
   * @description
   * Removes a key result from a goal, from the version shown. The answer names no version: the
   * caller reads the goal again.
   *
   * @param {string} goalId - Id of the goal.
   * @param {string} resultId - Id of the key result.
   * @param {number} version - The version shown.
   * @returns {Promise<void>} Settles once removed.
   */
  public async deleteResult(goalId: string, resultId: string, version: number): Promise<void> {
    await firstValueFrom(
      this.goals.deleteGoalResult(goalId, resultId, { headers: ifMatch(version) }),
      { defaultValue: undefined },
    );
  }

  /**
   * Method owners
   *
   * @description
   * The members who may own a goal and whose names the goals show: every member of the
   * organization but its guests, who cannot read a goal's scope (`422 goal.owner-ineligible`).
   *
   * @param {boolean} background - Whether the read was triggered in the background.
   * @returns {Promise<readonly Person[]>} The people, in the gateway's order.
   */
  public owners(background: boolean): Promise<readonly Person[]> {
    const page: (cursor: string | undefined) => Observable<ListMembersClientResult> = (
      cursor: string | undefined,
    ) =>
      this.members.listMembers(
        { limit: PAGE_SIZE, cursor, role: ['owner', 'admin', 'member'] },
        { context: passive(background) },
      );
    return firstValueFrom(
      page(undefined).pipe(
        expand((current: ListMembersClientResult) =>
          current.nextCursor === null ? EMPTY : page(current.nextCursor),
        ),
        reduce(
          (people: readonly Person[], current: ListMembersClientResult) => [
            ...people,
            ...current.items.map((member: ListMembersClientResult['items'][number]) =>
              personOf(member.userId, member.name),
            ),
          ],
          [] as readonly Person[],
        ),
      ),
    );
  }

  /**
   * Method milestone
   *
   * @description
   * The task of a milestone key result, for its due date (gap G-G1). Unsubscribing cancels the
   * request. A `404` reads as `missing`; any other failure as `unknown`, so it never errors.
   *
   * @param {string} taskKey - Key of the milestone task.
   * @returns {Observable<MilestoneState>} What is known of the task.
   */
  public milestone(taskKey: string): Observable<MilestoneState> {
    return this.tasks.getTask(taskKey, { context: passive(true) }).pipe(
      map((task: GetTaskClientResult): MilestoneState => toMilestoneTask(task)),
      catchError((error: unknown): Observable<MilestoneState> =>
        readProblem(error)?.status === 404 ? of('missing' as const) : of('unknown' as const),
      ),
    );
  }
  // #endregion
}
