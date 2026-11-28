import { inject, Service } from '@angular/core';
import { type GetTaskApprovalClientResult, TasksService } from '@cadenway/api-client';
import { defer, finalize, type Observable, share } from 'rxjs';

/**
 * Service TaskApprovalRead
 *
 * @description
 * The approval round of a task as the gateway answers it (`getTaskApproval`, never from the
 * HTTP cache), for the data-access services that map it to their own display models: the
 * properties panel's `Approval` row and the tabs' approval card. Readers of the same task that
 * ask while a read runs share it, since both read at the opening and again once the confirmed
 * version moves past the one they read; a read asked after the last one ended reads again, so
 * nothing is kept beyond the read in flight.
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
   * The approval round of a task, joining the read of that task in flight if there is one.
   *
   * @param {string} taskKey - Key of the task.
   * @returns {Observable<GetTaskApprovalClientResult>} The round as the gateway answers it.
   */
  public approval(taskKey: string): Observable<GetTaskApprovalClientResult> {
    const current: Observable<GetTaskApprovalClientResult> | undefined = this.running.get(taskKey);
    if (current !== undefined) return current;
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
