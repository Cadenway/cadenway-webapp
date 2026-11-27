import type {
  Favorite as FavoriteDto,
  ListSummary as ListSummaryDto,
  MilestonePage as MilestonePageDto,
  Space as SpaceDto,
  SpaceStatus,
  TaskCounts,
  TaskList as TaskListDto,
} from '@cadenway/api-client';

import type { Favorite, FavoriteKind } from '../../../models/favorite/favorite.interface';
import { STATUS_ORDER } from '../../../constants/statuses/statuses.constants';
import type { StatusKey } from '../../../models/list-view-config/list-view-config.interface';
import type { ShareRole } from '../../../models/list-share/list-share.interface';
import type { LookColor, LookIcon } from '../../../models/look/look.type';
import type { Milestone, MilestonePage } from '../../../models/milestone/milestone.interface';
import type { SpaceDetails, SpaceStatusOption } from '../../../models/space/space.interface';
import type {
  ListCounts,
  ListSummary,
  SpaceOverview,
  TaskList,
} from '../../../models/task-list/task-list.interface';

/**
 * Constant LOOK_COLORS
 *
 * @description
 * Colors the contract declares; an unknown future value falls back to `gris`.
 *
 * @type {ReadonlySet<string>}
 */
const LOOK_COLORS: ReadonlySet<string> = new Set([
  'gris',
  'violet',
  'indigo',
  'azur',
  'lagon',
  'vert',
  'olive',
  'jaune',
  'orange',
  'rouge',
  'rose',
  'fuchsia',
  'ardoise',
]);

/**
 * Constant LOOK_ICONS
 *
 * @description
 * Icons the contract declares; an unknown future value falls back to the default icon.
 *
 * @type {ReadonlySet<string>}
 */
const LOOK_ICONS: ReadonlySet<string> = new Set([
  'rocket',
  'paint',
  'megaphone',
  'gear',
  'code',
  'bug',
  'lightning',
  'target',
  'flag',
  'briefcase',
  'chart',
  'users',
  'book',
  'cube',
  'headset',
  'globe',
  'star',
]);

/**
 * Function toLookColor
 *
 * @description
 * Reads a color, `gris` for an unknown value.
 *
 * @param {string | null | undefined} value - Gateway color.
 * @returns {LookColor} The color.
 */
export function toLookColor(value: string | null | undefined): LookColor {
  return value && LOOK_COLORS.has(value) ? (value as LookColor) : 'gris';
}

/**
 * Function toLookIcon
 *
 * @description
 * Reads an icon, null for none or an unknown value.
 *
 * @param {string | null | undefined} value - Gateway icon.
 * @returns {LookIcon} The icon.
 */
export function toLookIcon(value: string | null | undefined): LookIcon {
  return value && LOOK_ICONS.has(value) ? (value as Exclude<LookIcon, null>) : null;
}

/**
 * Function isStatusKey
 *
 * @description
 * Whether a value is one of the ten status keys.
 *
 * @param {string} value - Value to check.
 * @returns {boolean} Whether it is a status key.
 */
export function isStatusKey(value: string): value is StatusKey {
  return (STATUS_ORDER as readonly string[]).includes(value);
}

/**
 * Function toCallerRole
 *
 * @description
 * Reads the caller's role on a space: absent is `edit` (the rule before grants existed), null
 * stays null (the caller sees only some of its lists), and a role this version does not know reads
 * as `view`, as the contract asks of an extensible role.
 *
 * @param {string | null | undefined} role - The gateway's `callerRole`.
 * @returns {ShareRole | null} The role, or null.
 */
function toCallerRole(role: string | null | undefined): ShareRole | null {
  if (role === undefined) return 'edit';
  if (role === null) return null;
  return role === 'edit' || role === 'comment' ? role : 'view';
}

/**
 * Function toSpace
 *
 * @description
 * Maps a space with its statuses in workflow order, its prefix and the caller's rights on it: an
 * absent `callerRole` reads as `edit` and an absent `callerCanManage` as managing, so the actions
 * stay offered and their `403` is handled.
 *
 * @param {SpaceDto} dto - Gateway space.
 * @returns {SpaceDetails} The display model.
 */
export function toSpace(dto: SpaceDto): SpaceDetails {
  return {
    id: dto.id,
    name: dto.name,
    prefix: dto.prefix,
    canEdit: dto.callerRole === undefined || dto.callerRole === 'edit',
    callerRole: toCallerRole(dto.callerRole),
    canManage: dto.callerCanManage ?? true,
    version: dto.version,
    description: dto.description,
    icon: toLookIcon(dto.icon),
    color: toLookColor(dto.color),
    private: dto.visibility === 'private',
    statuses: STATUS_ORDER.map((key: StatusKey): SpaceStatusOption => {
      const status: SpaceStatus | undefined = (
        dto.statuses as Partial<Record<StatusKey, SpaceStatus>> | undefined
      )?.[key];
      return {
        key,
        name: status?.name?.trim() ? status.name : null,
        hidden: status?.hidden ?? false,
      };
    }),
  };
}

/**
 * Function toTaskList
 *
 * @description
 * Maps a list or a sprint. Only `edit` allows writes (an unknown role reads as `view`); without
 * `callerRole` the list is taken as editable and the gateway refuses a write the caller may not
 * make.
 *
 * @param {TaskListDto} dto - Gateway list.
 * @returns {TaskList} The display model.
 */
export function toTaskList(dto: TaskListDto): TaskList {
  return {
    id: dto.id,
    spaceId: dto.spaceId,
    name: dto.name,
    icon: toLookIcon(dto.icon),
    color: toLookColor(dto.color),
    sprint: dto.sprint
      ? { startDate: dto.sprint.startDate, endDate: dto.sprint.endDate, goal: dto.sprint.goal }
      : null,
    archived: Boolean(dto.archivedAt),
    canEdit: dto.callerRole === undefined || dto.callerRole === 'edit',
    version: dto.version,
  };
}

/**
 * Function toListCounts
 *
 * @description
 * Maps the counts of a list.
 *
 * @param {TaskCounts} dto - Gateway counts.
 * @returns {ListCounts} The display model.
 */
export function toListCounts(dto: TaskCounts): ListCounts {
  return {
    total: dto.total,
    open: dto.open,
    done: dto.done,
    cancelled: dto.cancelled,
    late: dto.late,
  };
}

/**
 * Function toListSummary
 *
 * @description
 * Maps a list with its counts.
 *
 * @param {ListSummaryDto} dto - Gateway list summary.
 * @returns {ListSummary} The display model.
 */
export function toListSummary(dto: ListSummaryDto): ListSummary {
  return { list: toTaskList(dto.list), counts: toListCounts(dto.counts) };
}

/**
 * Function toSpaceOverview
 *
 * @description
 * Joins the pages of a space overview.
 *
 * @param {string} spaceId - The space.
 * @param {number} taskCount - Top-level tasks of the space.
 * @param {readonly ListSummaryDto[]} items - Lists of every page, in order.
 * @returns {SpaceOverview} The display model.
 */
export function toSpaceOverview(
  spaceId: string,
  taskCount: number,
  items: readonly ListSummaryDto[],
): SpaceOverview {
  return { spaceId, taskCount, lists: items.map(toListSummary) };
}

/**
 * Function toMilestonePage
 *
 * @description
 * Maps the milestones of a space.
 *
 * @param {MilestonePageDto} dto - Gateway page.
 * @returns {MilestonePage} The display model.
 */
export function toMilestonePage(dto: MilestonePageDto): MilestonePage {
  return {
    total: dto.total,
    items: dto.items.map((item: MilestonePageDto['items'][number]): Milestone => ({
      key: item.key,
      name: item.name,
      status: isStatusKey(item.status) ? item.status : 'todo',
      listId: item.listId,
      dueDate: item.dueDate,
    })),
  };
}

/**
 * Function toFavorite
 *
 * @description
 * Maps a favorite, or null for a kind this version does not know.
 *
 * @param {FavoriteDto} dto - Gateway favorite.
 * @returns {Favorite | null} The display model.
 */
export function toFavorite(dto: FavoriteDto): Favorite | null {
  const kinds: readonly string[] = ['space', 'list', 'saved-view'];
  if (!kinds.includes(dto.kind)) return null;
  return {
    id: dto.id,
    kind: dto.kind as FavoriteKind,
    targetId: dto.targetId,
    name: dto.target.name,
    listId: dto.target.listId ?? null,
  };
}
