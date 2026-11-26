import { inject, Service } from '@angular/core';
import { GitLinksService, type ListTaskGitLinksClientResult } from '@cadenway/api-client';
import { firstValueFrom } from 'rxjs';

import type { TaskGitLinkPage } from '../../../models/task-git-link/task-git-link.interface';
import { toTaskGitLinkPage } from '../../adapters/task-git-link/task-git-link.adapter';

/**
 * Constant GIT_LINK_PAGE
 *
 * @description
 * Links read per page of the Development panel, the contract's default page size.
 *
 * @type {number}
 */
export const GIT_LINK_PAGE: number = 50;

/**
 * Service TaskGitLinksApi
 *
 * @description
 * The Git links of a task through the generated client (`GitLinksService.listTaskGitLinks`,
 * newest first, paged by cursor, without the HTTP cache since the gateway answers
 * `private, no-store`), mapped to the Development panel's models. The workspace's
 * `OrganizationPin` adds `If-Organization-Match` to the read. A failure rejects with the client's
 * error.
 */
@Service()
export class TaskGitLinksApi {
  // #region Properties
  /**
   * Property gitLinks
   *
   * @description
   * Generated Git links operations.
   *
   * @type {GitLinksService}
   * @readonly
   */
  private readonly gitLinks: GitLinksService = inject(GitLinksService);
  // #endregion

  // #region Methods
  /**
   * Method page
   *
   * @description
   * Reads one page of the task's Git links.
   *
   * @param {string} taskKey - Key of the task.
   * @param {string | null} cursor - Cursor of the page, null for the first one.
   * @returns {Promise<TaskGitLinkPage>} The page.
   */
  public async page(taskKey: string, cursor: string | null): Promise<TaskGitLinkPage> {
    const page: ListTaskGitLinksClientResult = await firstValueFrom(
      this.gitLinks.listTaskGitLinks(
        taskKey,
        { limit: GIT_LINK_PAGE, ...(cursor ? { cursor } : {}) },
        { cache: 'no-store' },
      ),
    );
    return toTaskGitLinkPage(page);
  }
  // #endregion
}
