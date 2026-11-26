import type {
  Grant,
  Member,
  Space as SpaceDto,
  TaskList as TaskListDto,
} from '@cadenway/api-client';

import type {
  ListAccess,
  ShareDirectoryEntry,
  ShareGrant,
  ShareRole,
} from '../../../models/list-share/list-share.interface';

/**
 * Function toShareRole
 *
 * @description
 * Maps a gateway role; a role a later contract adds reads as `view`, the least it can give.
 *
 * @param {string} role - `edit`, `comment`, `view` or a later value.
 * @returns {ShareRole} The display role.
 */
export function toShareRole(role: string): ShareRole {
  return role === 'edit' || role === 'comment' ? role : 'view';
}

/**
 * Function toShareGrant
 *
 * @description
 * Maps one grant of the list.
 *
 * @param {Grant} dto - Gateway grant.
 * @returns {ShareGrant} The display grant.
 */
export function toShareGrant(dto: Grant): ShareGrant {
  return { userId: dto.userId, role: toShareRole(dto.role) };
}

/**
 * Function toShareDirectoryEntry
 *
 * @description
 * Maps a member of the organization; the `guest` role is the `Guest` badge.
 *
 * @param {Member} dto - Gateway member.
 * @returns {ShareDirectoryEntry} The directory entry.
 */
export function toShareDirectoryEntry(dto: Member): ShareDirectoryEntry {
  return { userId: dto.userId, name: dto.name, email: dto.email, guest: dto.role === 'guest' };
}

/**
 * Function toListAccess
 *
 * @description
 * Joins the reads of the share dialog. Without `callerRole` the caller is taken as an editor and
 * the gateway refuses a write they may not make; an absent switch reads as on, its default.
 *
 * @param {TaskListDto} list - The list.
 * @param {SpaceDto} space - Its space, for the owner and the visibility.
 * @param {readonly Grant[]} grants - Every grant of the list.
 * @returns {ListAccess} Who has access.
 */
export function toListAccess(
  list: TaskListDto,
  space: SpaceDto,
  grants: readonly Grant[],
): ListAccess {
  return {
    listId: list.id,
    canEdit: list.callerRole === undefined || list.callerRole === 'edit',
    organizationAccess: list.organizationAccess ?? true,
    privateSpace: space.visibility === 'private',
    ownerId: space.owner.userId,
    grants: grants
      .filter((grant: Grant): boolean => grant.userId !== space.owner.userId)
      .map(toShareGrant),
  };
}

/**
 * Function versionOfEtag
 *
 * @description
 * Reads the list version of an `ETag` (`"5"`, or the weak `W/"5"`).
 *
 * @param {string | null} etag - The header, or null when absent.
 * @returns {number | null} The version, or null when the header is absent or malformed.
 */
export function versionOfEtag(etag: string | null): number | null {
  const match: RegExpExecArray | null = /^(?:W\/)?"(\d+)"$/u.exec(etag?.trim() ?? '');
  return match ? Number(match[1]) : null;
}
