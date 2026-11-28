import { inject, Service } from '@angular/core';
import { type GetTaskApprovalClientResult, TasksService } from '@cadenway/api-client';
import { defer, finalize, type Observable, of, share, switchMap } from 'rxjs';

/**
 * Service TaskApprovalRead
 *
 * @description
 * The approval round of a task as the gateway answers it (`getTaskApproval`, never from the
 * HTTP cache), for the data-access services that map it to their own display models: the
 * properties panel's `Approval` row and the tabs' approval card. Readers of the same task that
 * ask while a read runs share it, since both read at the opening and again once the confirmed
 * version moves past the one they read; a read asked after the last one ended reads again, so
 * nothing is kept beyond the read in flight. A reader that names the task version it needs
 * (`atLeast`, the confirmed version after a write) never keeps an answer older than it: when the
 * shared read began before that version and answers an older one, it reads again.
 */
@Service()
export class TaskApprovalRead {
  // #region Properties
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
   * Property running
   *
   * @description
   * The read in flight of each task, by key, dropped once it ends, fails or loses its last reader.
   *
   * @type {Map<string, Observable<GetTaskApprovalClientResult>>}
   * @readonly
   */
  private readonly running: Map<string, Observable<GetTaskApprovalClientResult>> = new Map<
    string,
    Observable<GetTaskApprovalClientResult>
  >();
  // #endregion

  // #region Methods
  /**
   * Method approval
   *
   * @description
   * The approval round of a task, joining the read of that task in flight if there is one. With
   * `atLeast`, an answer at an older task version than `atLeast` is read again once, in a read
   * of its own that later readers may join.
   *
   * @param {string} taskKey - Key of the task.
   * @param {number | null} atLeast - The task version the answer must reach, or null for any.
   * @returns {Observable<GetTaskApprovalClientResult>} The round as the gateway answers it.
   */
  public approval(
    taskKey: string,
    atLeast: number | null = null,
  ): Observable<GetTaskApprovalClientResult> {
    return defer((): Observable<GetTaskApprovalClientResult> => {
      const joined: Observable<GetTaskApprovalClientResult> = this.joinOrStart(taskKey);
      if (atLeast === null) return joined;
      return joined.pipe(
        switchMap((state: GetTaskApprovalClientResult): Observable<GetTaskApprovalClientResult> =>
          state.taskVersion >= atLeast ? of(state) : this.joinOrStart(taskKey, joined),
        ),
      );
    });
  }

  /**
   * Method joinOrStart
   *
   * @description
   * The read in flight of the task, or a new one; `stale` names a read that must not be joined
   * (it answered too old a version) even while it is still registered.
   *
   * @param {string} taskKey - Key of the task.
   * @param {Observable<GetTaskApprovalClientResult> | null} stale - A read to leave aside.
   * @returns {Observable<GetTaskApprovalClientResult>} The shared read.
   */
  private joinOrStart(
    taskKey: string,
    stale: Observable<GetTaskApprovalClientResult> | null = null,
  ): Observable<GetTaskApprovalClientResult> {
    const current: Observable<GetTaskApprovalClientResult> | undefined = this.running.get(taskKey);
    if (current !== undefined && current !== stale) return current;
    const read: Observable<GetTaskApprovalClientResult> = defer(() =>
      this.tasks.getTaskApproval(taskKey, { cache: 'no-store' }),
    ).pipe(
      finalize((): void => {
        if (this.running.get(taskKey) === read) this.running.delete(taskKey);
      }),
      share(),
    );
    this.running.set(taskKey, read);
    return read;
  }
  // #endregion
}
