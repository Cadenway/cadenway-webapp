import { inject, Service } from '@angular/core';
import { AccessRequestsService, TrashService } from '@cadenway/api-client';
import { catchError, map, type Observable, of, throwError } from 'rxjs';

import { hasProblemCode } from '@core/api';

import type { RestoreOutcome } from '../../../models/error-recovery/error-recovery.type';

/**
 * Service ErrorRecovery
 *
 * @description
 * The writes the route error states offer: asking the owner of a private space or list for access,
 * and restoring a deleted task from the trash. Failures other than those described propagate as
 * errors.
 */
@Service()
export class ErrorRecovery {
  // #region Properties
  /**
   * Property accessRequests
   *
   * @description
   * Generated access request operations.
   *
   * @type {AccessRequestsService}
   * @readonly
   */
  private readonly accessRequests: AccessRequestsService = inject(AccessRequestsService);

  /**
   * Property trash
   *
   * @description
   * Generated trash operations.
   *
   * @type {TrashService}
   * @readonly
   */
  private readonly trash: TrashService = inject(TrashService);
  // #endregion

  // #region Methods
  /**
   * Method requestAccess
   *
   * @description
   * Asks for access to a space or a list. The gateway always answers `202`, whether or not it
   * stored the request, so success only means the request was accepted for processing. A blank
   * message is sent as none.
   *
   * @param {{ readonly kind: 'space' | 'list'; readonly id: string }} target - Space or list to ask for.
   * @param {string} message - Optional message to the owner, 500 characters at most.
   * @returns {Observable<void>} Completion; a `429 access-request.limit-reached` or another failure errors.
   */
  public requestAccess(
    target: { readonly kind: 'space' | 'list'; readonly id: string },
    message: string,
  ): Observable<void> {
    const text: string = message.trim();
    return this.accessRequests
      .createAccessRequest({
        ...(target.kind === 'space' ? { spaceId: target.id } : { listId: target.id }),
        message: text === '' ? null : text,
      })
      .pipe(map((): void => undefined));
  }

  /**
   * Method restoreTask
   *
   * @description
   * Restores the trash entry of a deleted task. An entry that is gone, already restored or that
   * the caller may not restore answers `404 trash-entry.not-found`, reported as `already-restored`
   * (« Déjà restaurée » in the mockup).
   *
   * @param {string} entryId - Trash entry of the task.
   * @returns {Observable<RestoreOutcome>} The outcome; other failures error.
   */
  public restoreTask(entryId: string): Observable<RestoreOutcome> {
    return this.trash.restoreTrashEntry(entryId, {}).pipe(
      map((): RestoreOutcome => 'restored'),
      catchError((error: unknown) =>
        hasProblemCode(error, 'trash-entry.not-found')
          ? of<RestoreOutcome>('already-restored')
          : throwError(() => error),
      ),
    );
  }
  // #endregion
}
