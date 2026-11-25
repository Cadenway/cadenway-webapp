import { inject, Service } from '@angular/core';
import {
  type ArchivedListPage,
  type ArchivedTaskPage,
  ArchivesService,
  BillingService,
  type BillingSubscription,
  type TrashEntryPage,
  TrashService,
} from '@cadenway/api-client';

import { abortableRead } from '../../utils/abortable-read/abortable-read.util';

/**
 * Interface SeatSummary
 *
 * @description
 * The plan of the organization and its free seats, for the `Invite your team` suggestion.
 */
export interface SeatSummary {
  // #region Properties
  /**
   * Property plan
   *
   * @description
   * Plan key (`free`, `team`, `enterprise` or a later one).
   *
   * @type {string}
   * @readonly
   */
  readonly plan: string;

  /**
   * Property free
   *
   * @description
   * Seats left on the plan, never below zero.
   *
   * @type {number}
   * @readonly
   */
  readonly free: number;
  // #endregion
}

/**
 * Service SidebarApi
 *
 * @description
 * The counts the spaces sidebar shows beside its navigation: the free seats of the plan, the
 * entries of the trash and the archived lists and tasks. Each count reads one item and takes the
 * page's `total`, so it costs one small request whatever the size of the collection.
 */
@Service()
export class SidebarApi {
  // #region Properties
  /**
   * Property billing
   *
   * @description
   * Generated billing operations.
   *
   * @type {BillingService}
   * @readonly
   */
  private readonly billing: BillingService = inject(BillingService);

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
  // #endregion

  // #region Methods
  /**
   * Method seats
   *
   * @description
   * Reads the plan and the seats left on it.
   *
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<SeatSummary>} The plan and its free seats.
   */
  public async seats(signal?: AbortSignal): Promise<SeatSummary> {
    const subscription: BillingSubscription = await abortableRead(
      this.billing.getBillingSubscription(),
      signal,
    );
    return {
      plan: subscription.plan,
      free: Math.max(0, subscription.seats.limit - subscription.seats.used),
    };
  }

  /**
   * Method trashCount
   *
   * @description
   * Counts the trash entries the caller may restore (`Trash`).
   *
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<number>} The count.
   */
  public async trashCount(signal?: AbortSignal): Promise<number> {
    const page: TrashEntryPage = await abortableRead(this.trash.listTrash({ limit: 1 }), signal);
    return page.total;
  }

  /**
   * Method archiveCount
   *
   * @description
   * Counts the archived lists and archived task roots the caller sees (`Archives`).
   *
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<number>} The count.
   */
  public async archiveCount(signal?: AbortSignal): Promise<number> {
    const [lists, tasks]: [ArchivedListPage, ArchivedTaskPage] = await Promise.all([
      abortableRead(this.archives.listArchivedLists({ limit: 1 }), signal),
      abortableRead(this.archives.listArchivedTasks({ limit: 1 }), signal),
    ]);
    return lists.total + tasks.total;
  }
  // #endregion
}
