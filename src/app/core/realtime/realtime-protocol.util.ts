import type {
  MemberPresenceChange,
  PersonalNotice,
  PresencePage,
  PresenceStatus,
  RealtimeChange,
} from './realtime.types';

/**
 * Constant UUID
 *
 * @description
 * UUID syntax used by the gateway's browser protocol.
 *
 * @type {RegExp}
 */
const UUID: RegExp = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Function record
 *
 * @description
 * Checks that an untrusted packet is a non-array object.
 *
 * @param {unknown} value - Incoming value.
 * @returns {value is Record<string, unknown>} Whether it is an object.
 */
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Function exactKeys
 *
 * @description
 * Rejects fields outside the closed browser protocol objects.
 *
 * @param {Record<string, unknown>} value - Object to inspect.
 * @param {readonly string[]} keys - Allowed property names.
 * @returns {boolean} Whether no extra properties are present.
 */
function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key: string) => keys.includes(key));
}

/**
 * Function envelope
 *
 * @description
 * Checks the common Socket.IO browser envelope before inspecting its payload.
 *
 * @param {unknown} value - Incoming packet.
 * @returns {value is Record<string, unknown>} Whether the envelope is valid.
 */
function envelope(value: unknown): value is Record<string, unknown> {
  return (
    record(value) &&
    exactKeys(value, ['id', 'type', 'at', 'version', 'data']) &&
    typeof value['id'] === 'string' &&
    UUID.test(value['id']) &&
    typeof value['type'] === 'string' &&
    typeof value['at'] === 'string' &&
    /^\d{4}-\d\d-\d\d[Tt]\d\d:\d\d:\d\d(?:\.\d+)?(?:[Zz]|[+-]\d\d:\d\d)$/.test(value['at']) &&
    !Number.isNaN(Date.parse(value['at'].replace(/:60(?=\.|[Zz]|[+-])/, ':59'))) &&
    Number.isSafeInteger(value['version']) &&
    (value['version'] as number) >= 1 &&
    record(value['data'])
  );
}

/**
 * Function heartbeatInterval
 *
 * @description
 * Validates admission and returns half the advertised heartbeat interval in milliseconds.
 *
 * @param {unknown} value - Gateway hello packet.
 * @param {string | null} organization - Expected organization.
 * @returns {number | null} Heartbeat cadence or null on invalid admission.
 */
export function heartbeatInterval(value: unknown, organization: string | null): number | null {
  if (!envelope(value) || value['type'] !== 'connection.ready.v1' || !record(value['data']))
    return null;
  const data: Record<string, unknown> = value['data'];
  const seconds: unknown = data['heartbeatIntervalSeconds'];
  if (
    !organization ||
    !exactKeys(data, ['organizationId', 'sessionExpiresAt', 'heartbeatIntervalSeconds']) ||
    typeof data['organizationId'] !== 'string' ||
    data['organizationId'].toLowerCase() !== organization.toLowerCase() ||
    typeof data['sessionExpiresAt'] !== 'string' ||
    Number.isNaN(Date.parse(data['sessionExpiresAt'])) ||
    typeof seconds !== 'number' ||
    !Number.isSafeInteger(seconds) ||
    seconds < 1 ||
    seconds > 3600
  )
    return null;
  return seconds * 500;
}

/**
 * Function parseChange
 *
 * @description
 * Validates the installed Socket.IO notice shapes, which differ from generated producer facts.
 *
 * @param {unknown} value - Untrusted change packet.
 * @returns {RealtimeChange | null} Validated invalidation, or null for unsupported packets.
 */
export function parseChange(value: unknown): RealtimeChange | null {
  if (!envelope(value) || !record(value['data'])) return null;
  const data: Record<string, unknown> = value['data'];
  const type: unknown = value['type'];
  if (type === 'list.tasks-changed.v1') {
    const listId: unknown = data['listId'];
    return exactKeys(data, ['listId']) && typeof listId === 'string' && UUID.test(listId)
      ? { id: value['id'] as string, type, at: value['at'] as string, data }
      : null;
  }
  const taskId: unknown = data['taskId'];
  if (typeof taskId !== 'string' || !UUID.test(taskId)) return null;
  if (type === 'task.updated.v1' || type === 'task.status-changed.v1') {
    if (
      !exactKeys(data, ['taskId', 'changed']) ||
      !Array.isArray(data['changed']) ||
      data['changed'].length === 0 ||
      !data['changed'].every((field: unknown) => typeof field === 'string')
    )
      return null;
  } else if (type === 'comment.created.v1') {
    if (
      !exactKeys(data, ['taskId', 'commentId']) ||
      typeof data['commentId'] !== 'string' ||
      !UUID.test(data['commentId'])
    )
      return null;
  } else if (type !== 'git.links-changed.v1' || !exactKeys(data, ['taskId'])) return null;
  return { id: value['id'] as string, type: type, at: value['at'] as string, data };
}

/**
 * Function parsePresence
 *
 * @description
 * Validates an organization presence notice.
 *
 * @param {unknown} value - Untrusted change packet.
 * @returns {MemberPresenceChange | null} Public presence, or null when invalid.
 */
export function parsePresence(value: unknown): MemberPresenceChange | null {
  if (!envelope(value) || value['type'] !== 'user.status-changed.v1' || !record(value['data']))
    return null;
  const data: Record<string, unknown> = value['data'];
  const status: unknown = data['status'];
  if (
    !exactKeys(data, ['memberId', 'status']) ||
    typeof data['memberId'] !== 'string' ||
    !UUID.test(data['memberId']) ||
    (status !== 'online' &&
      status !== 'away' &&
      status !== 'do-not-disturb' &&
      status !== 'offline')
  )
    return null;
  return { memberId: data['memberId'], status };
}

/**
 * Function parsePresencePage
 *
 * @description
 * Validates a snapshot page from the gateway before using its cursor or members.
 *
 * @param {unknown} value - Untrusted acknowledgement.
 * @returns {PresencePage | null} Validated page or null.
 */
export function parsePresencePage(value: unknown): PresencePage | null {
  if (
    !record(value) ||
    value['ok'] !== true ||
    !exactKeys(value, ['ok', 'status', 'members', 'nextCursor'])
  )
    return null;
  const status: unknown = value['status'];
  const cursor: unknown = value['nextCursor'];
  const members: unknown = value['members'];
  if (
    (status !== 'online' &&
      status !== 'away' &&
      status !== 'do-not-disturb' &&
      status !== 'invisible') ||
    !(
      cursor === null ||
      (typeof cursor === 'string' && cursor.length > 0 && cursor.length <= 128)
    ) ||
    !Array.isArray(members) ||
    members.length > 100
  )
    return null;
  const parsed: { memberId: string; status: Exclude<PresenceStatus, 'invisible'> }[] = [];
  for (const member of members as unknown[]) {
    if (
      !record(member) ||
      !exactKeys(member, ['memberId', 'status']) ||
      typeof member['memberId'] !== 'string' ||
      !UUID.test(member['memberId']) ||
      (member['status'] !== 'online' &&
        member['status'] !== 'away' &&
        member['status'] !== 'do-not-disturb')
    )
      return null;
    parsed.push({ memberId: member['memberId'], status: member['status'] });
  }
  return { status, members: parsed, nextCursor: cursor };
}

/**
 * Function parsePersonalNotice
 *
 * @description
 * Validates the closed personal notice payload before it triggers a server read.
 *
 * @param {unknown} value - Untrusted change packet.
 * @returns {PersonalNotice | null} Validated notice or null.
 */
export function parsePersonalNotice(value: unknown): PersonalNotice | null {
  if (!envelope(value) || !record(value['data'])) return null;
  const data: Record<string, unknown> = value['data'];
  if (value['type'] === 'notification.created.v1' && exactKeys(data, []))
    return { type: 'notification.created.v1' };
  if (
    value['type'] !== 'reminder.due.v1' ||
    !exactKeys(data, ['reminderId', 'taskId']) ||
    typeof data['reminderId'] !== 'string' ||
    !UUID.test(data['reminderId']) ||
    typeof data['taskId'] !== 'string' ||
    !UUID.test(data['taskId'])
  )
    return null;
  return { type: 'reminder.due.v1', reminderId: data['reminderId'], taskId: data['taskId'] };
}
