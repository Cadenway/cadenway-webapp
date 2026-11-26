import { HttpErrorResponse, type HttpResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import {
  AccessService,
  type Grant,
  type GrantPage,
  ListsService,
  type MemberPage,
  MembersService,
  type Space as SpaceDto,
  SpacesService,
  type TaskList as TaskListDto,
} from '@cadenway/api-client';
import { firstValueFrom } from 'rxjs';

import type {
  ListAccess,
  ShareDirectoryEntry,
  ShareRole,
  ShareWrite,
} from '../../../models/list-share/list-share.interface';
import {
  toListAccess,
  toShareDirectoryEntry,
  versionOfEtag,
} from '../../adapters/list-access/list-access.adapter';
import { abortableRead } from '../../utils/abortable-read/abortable-read.util';

/**
 * Constant ACCESS_PAGE_LIMIT
 *
 * @description
 * Page size asked of the gateway when a read joins every page; a list holds 200 grants at most.
 *
 * @type {number}
 */
const ACCESS_PAGE_LIMIT: number = 100;

/**
 * Service ListAccessApi
 *
 * @description
 * Who has access to a list, the member directory and the changes of the list's access
 * (`openapi/public/access.yaml`, the switch of `PATCH /v1/lists/{listId}`), for the `Share`
 * dialog. The writes send no `If-Match`, which the
 * contract makes optional: each sets one absolute value (one person's role, or the switch), so
 * two people sharing at once never overwrite each other, as the contract intends. Each returns
 * the list version the gateway answered, which the list page then sends with its own writes.
 */
@Service()
export class ListAccessApi {
  // #region Properties
  /**
   * Property access
   *
   * @description
   * Grants client.
   *
   * @type {AccessService}
   * @readonly
   */
  private readonly access: AccessService = inject(AccessService);

  /**
   * Property lists
   *
   * @description
   * Lists client, for the list and its switch.
   *
   * @type {ListsService}
   * @readonly
   */
  private readonly lists: ListsService = inject(ListsService);

  /**
   * Property spaces
   *
   * @description
   * Spaces client, for the owner and the visibility.
   *
   * @type {SpacesService}
   * @readonly
   */
  private readonly spaces: SpacesService = inject(SpacesService);

  /**
   * Property members
   *
   * @description
   * Member directory client, for the names, addresses and guests.
   *
   * @type {MembersService}
   * @readonly
   */
  private readonly members: MembersService = inject(MembersService);
  // #endregion

  // #region Methods
  /**
   * Method read
   *
   * @description
   * Reads the list, its space and every grant at once.
   *
   * @param {string} listId - The list.
   * @param {string} spaceId - Its space.
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<ListAccess>} Who has access.
   */
  public async read(listId: string, spaceId: string, signal?: AbortSignal): Promise<ListAccess> {
    const [list, space, grants]: [TaskListDto, SpaceDto, readonly Grant[]] = await Promise.all([
      abortableRead(this.lists.getList(listId), signal),
      abortableRead(this.spaces.getSpace(spaceId), signal),
      this.grants(listId, signal),
    ]);
    return toListAccess(list, space, grants);
  }

  /**
   * Method directory
   *
   * @description
   * Reads every member and guest of the organization, page after page. Only a `403` (a caller
   * who may not read the directory) answers null; any other failure rejects, so that the dialog
   * offers `Retry`.
   *
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<readonly ShareDirectoryEntry[] | null>} The directory, or null when refused.
   */
  public async directory(signal?: AbortSignal): Promise<readonly ShareDirectoryEntry[] | null> {
    const items: ShareDirectoryEntry[] = [];
    let cursor: string | undefined;
    try {
      do {
        const page: MemberPage = await abortableRead(
          this.members.listMembers({ limit: ACCESS_PAGE_LIMIT, ...(cursor ? { cursor } : {}) }),
          signal,
        );
        items.push(...page.items.map(toShareDirectoryEntry));
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse && error.status === 403) return null;
      throw error;
    }
    return items;
  }

  /**
   * Method setRole
   *
   * @description
   * Gives a person a role on the list, or changes theirs (`setListGrant`).
   *
   * @param {string} listId - The list.
   * @param {string} userId - The person, a member or guest of the organization.
   * @param {ShareRole} role - The role.
   * @returns {Promise<ShareWrite>} The version of the list after the change.
   */
  public async setRole(listId: string, userId: string, role: ShareRole): Promise<ShareWrite> {
    const response: HttpResponse<Grant> = await firstValueFrom(
      this.access.setListGrant(listId, userId, { role }, { observe: 'response' }),
    );
    return { version: versionOfEtag(response.headers.get('ETag')) };
  }

  /**
   * Method removeRole
   *
   * @description
   * Removes a person's grant on the list (`removeListGrant`); they keep what the rule of the
   * organization or a grant of the space gives them.
   *
   * @param {string} listId - The list.
   * @param {string} userId - The person.
   * @returns {Promise<ShareWrite>} The version of the list after the change.
   */
  public async removeRole(listId: string, userId: string): Promise<ShareWrite> {
    const response: HttpResponse<void> = await firstValueFrom(
      this.access.removeListGrant(listId, userId, { observe: 'response' }),
    );
    return { version: versionOfEtag(response.headers.get('ETag')) };
  }

  /**
   * Method setOrganizationAccess
   *
   * @description
   * Turns the `Organization access` switch (`updateList` with `organizationAccess` only).
   *
   * @param {string} listId - The list.
   * @param {boolean} on - The switch.
   * @returns {Promise<ShareWrite>} The version of the list after the change.
   */
  public async setOrganizationAccess(listId: string, on: boolean): Promise<ShareWrite> {
    const list: TaskListDto = await firstValueFrom(
      this.lists.updateList(listId, { organizationAccess: on }),
    );
    return { version: list.version };
  }

  /**
   * Method grants
   *
   * @description
   * Reads every grant of the list, page after page.
   *
   * @param {string} listId - The list.
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<readonly Grant[]>} The grants, in the order access was given.
   */
  private async grants(listId: string, signal?: AbortSignal): Promise<readonly Grant[]> {
    const items: Grant[] = [];
    let cursor: string | undefined;
    do {
      const page: GrantPage = await abortableRead(
        this.access.listListGrants(listId, {
          limit: ACCESS_PAGE_LIMIT,
          ...(cursor ? { cursor } : {}),
        }),
        signal,
      );
      items.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return items;
  }
  // #endregion
}
