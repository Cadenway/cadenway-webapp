import { Service } from '@angular/core';
import { type Observable, Subject } from 'rxjs';

import type { InboxRead } from '../../models/inbox-read/inbox-read.interface';

/**
 * Service InboxReads
 *
 * @description
 * Inbox-internal relay of recorded reads between the rail's `InboxStore` and the home screen's
 * `InboxDigestStore`, which do not share state. A store publishes a read once the gateway recorded
 * it; each listener keeps only reads of its own organization from the other view. It holds no data,
 * so it needs no reset on sign-out or organization change.
 */
@Service()
export class InboxReads {
  // #region Properties
  /**
   * Property reads
   *
   * @description
   * Recorded reads, as they are published.
   *
   * @type {Subject<InboxRead>}
   * @readonly
   */
  private readonly reads: Subject<InboxRead> = new Subject<InboxRead>();

  /**
   * Property changes
   *
   * @description
   * Recorded reads of every view; synchronous, with no replay.
   *
   * @type {Observable<InboxRead>}
   * @readonly
   */
  public readonly changes: Observable<InboxRead> = this.reads.asObservable();
  // #endregion

  // #region Methods
  /**
   * Method publish
   *
   * @description
   * Tells the other inbox views that the gateway recorded a read.
   *
   * @param {InboxRead} read - The recorded read.
   */
  public publish(read: InboxRead): void {
    this.reads.next(read);
  }
  // #endregion
}
