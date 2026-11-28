import { inject, Service } from '@angular/core';
import { type GetTaskApprovalClientResult, TasksService } from '@cadenway/api-client';
import { defer, finalize, type Observable, of, share, switchMap, tap, throwError } from 'rxjs';

import { OrganizationPin, OrganizationSwitchPendingError } from '@core/api';

/**
 * Constant EXTRA_READS
 *
 * @description
 * Further reads a reader asks, at most, when the answers it gets stay older than the task version
 * it needs; it then keeps the latest answer and its version follower reads again later.
 *
 * @type {number}
 */
const EXTRA_READS: number = 2;

/**
 * Service TaskApprovalRead
 *
 * @description
 * The approval round of a task as the gateway answers it (`getTaskApproval`, never from the
 * HTTP cache), for the data-access services that map it to their own display models: the
 * properties panel's `Approval` row and the tabs' approval card. Readers of the same task in the
 * same organization context (organization id and `OrganizationPin` revision) that ask while a
 * read runs share it, since both read at the opening and again once the confirmed version moves
 * past the one they read; a read asked after the last one ended reads again, so nothing is kept
 * beyond the read in flight. A read answered after its context changed fails with
 * `OrganizationSwitchPendingError`. A reader that names the task version it needs (`atLeast`,
 * the confirmed version after a write) checks every answer against it, its own retries
 * included: while an answer is older it reads again (a read it has not received yet, or a new
 * one), `EXTRA_READS` times at most, then keeps the latest answer.
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
   * Property pin
   *
   * @description
   * The workspace organization and its revision, which fence the shared reads.
   *
   * @type {OrganizationPin}
   * @readonly
   */
  private readonly pin: OrganizationPin = inject(OrganizationPin);

  /**
   * Property running
   *
   * @description
   * The read in flight of each task, by organization context and task key, dropped once it ends,
   * fails or loses its last reader.
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
   * The approval round of a task, joining the read of that task in flight in the current
   * organization context if there is one. With `atLeast`, an answer at an older task version is
   * read again, `EXTRA_READS` times at most.
   *
   * @param {string} taskKey - Key of the task.
   * @param {number | null} atLeast - The task version the answer must reach, or null for any.
   * @returns {Observable<GetTaskApprovalClientResult>} The round as the gateway answers it.
   */
  public approval(
    taskKey: string,
    atLeast: number | null = null,
  ): Observable<GetTaskApprovalClientResult> {
    return defer((): Observable<GetTaskApprovalClientResult> =>
      this.reach(taskKey, atLeast, new Set<Observable<GetTaskApprovalClientResult>>(), 0),
    );
  }

  /**
   * Method reach
   *
   * @description
   * Joins or begins a read the reader has not received yet, and reads again while its answer is
   * older than `atLeast` and further reads remain.
   *
   * @param {string} taskKey - Key of the task.
   * @param {number | null} atLeast - The task version the answer must reach, or null for any.
   * @param {ReadonlySet<Observable<GetTaskApprovalClientResult>>} received - The reads whose
   * answer the reader already received.
   * @param {number} extra - The further reads asked so far.
   * @returns {Observable<GetTaskApprovalClientResult>} The answer.
   */
  private reach(
    taskKey: string,
    atLeast: number | null,
    received: ReadonlySet<Observable<GetTaskApprovalClientResult>>,
    extra: number,
  ): Observable<GetTaskApprovalClientResult> {
    const read: Observable<GetTaskApprovalClientResult> = this.joinOrStart(taskKey, received);
    if (atLeast === null) return read;
    return read.pipe(
      switchMap((state: GetTaskApprovalClientResult): Observable<GetTaskApprovalClientResult> =>
        state.taskVersion >= atLeast || extra >= EXTRA_READS
          ? of(state)
          : this.reach(taskKey, atLeast, new Set([...received, read]), extra + 1),
      ),
    );
  }

  /**
   * Method joinOrStart
   *
   * @description
   * The read in flight of the task in the current organization context, unless the reader
   * already received its answer, or a new one bound to that context.
   *
   * @param {string} taskKey - Key of the task.
   * @param {ReadonlySet<Observable<GetTaskApprovalClientResult>>} received - Reads to leave aside.
   * @returns {Observable<GetTaskApprovalClientResult>} The shared read.
   */
  private joinOrStart(
    taskKey: string,
    received: ReadonlySet<Observable<GetTaskApprovalClientResult>>,
  ): Observable<GetTaskApprovalClientResult> {
    const context: string = this.context();
    const slot: string = `${context}|${taskKey}`;
    const current: Observable<GetTaskApprovalClientResult> | undefined = this.running.get(slot);
    if (current !== undefined && !received.has(current)) return current;
    const read: Observable<GetTaskApprovalClientResult> = defer(
      (): Observable<GetTaskApprovalClientResult> =>
        this.context() === context
          ? this.tasks.getTaskApproval(taskKey, { cache: 'no-store' })
          : throwError(() => new OrganizationSwitchPendingError()),
    ).pipe(
      tap((): void => {
        if (this.context() !== context) throw new OrganizationSwitchPendingError();
      }),
      finalize((): void => {
        if (this.running.get(slot) === read) this.running.delete(slot);
      }),
      share(),
    );
    this.running.set(slot, read);
    return read;
  }

  /**
   * Method context
   *
   * @description
   * The current organization context: its id and the pin revision.
   *
   * @returns {string} The context key.
   */
  private context(): string {
    return `${this.pin.current() ?? ''}#${String(this.pin.revision())}`;
  }
  // #endregion
}
