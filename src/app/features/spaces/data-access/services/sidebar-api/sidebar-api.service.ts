import { inject, Service } from '@angular/core';
import {
  type ArchivedListPage,
  type ArchivedTaskPage,
  ArchivesService,
  type TrashEntryPage,
  TrashService,
} from '@cadenway/api-client';

import { abortableRead } from '../../utils/abortable-read/abortable-read.util';

/**
 * Service SidebarApi
 *
 * @description
 * The counts the spaces sidebar shows beside its navigation: the entries of the trash and the
 * archived lists and tasks. Each count reads one item and takes the page's `total`, so it costs
 * one small request whatever the size of the collection. The free seats of `Invite your team` come
 * from Organization's `PLAN_SEATS`, which shares the shell's one subscription read.
 */
@Service()
export class SidebarApi {
  // #region Properties
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
