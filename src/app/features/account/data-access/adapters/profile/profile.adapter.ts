import type {
  CurrentUser,
  EmailChangeCodeSent,
  MyOrganization as MyOrganizationDto,
  ProfileMediaUpload,
  ProfilePatch,
} from '@cadenway/api-client';

import type {
  AccountProfile,
  AvatarUpload,
  EmailChangeCode,
  MyOrganization,
  ProfileChange,
  ProfileField,
} from '../../../models/profile/profile.interface';

/**
 * Constant PROFILE_FIELDS
 *
 * @description
 * The members of `ProfilePatch` the `Personal information` form edits, as the gateway names them
 * in the `path` of a `400 request.invalid` issue.
 *
 * @type {ReadonlySet<string>}
 */
const PROFILE_FIELDS: ReadonlySet<string> = new Set<ProfileField>([
  'name',
  'displayName',
  'jobTitle',
  'timeZone',
]);

/**
 * Function profileInitials
 *
 * @description
 * The initials shown in place of a photo: the first letter of the first two words, upper case.
 *
 * @param {string} name - Full name.
 * @returns {string} The initials (`CM` for `Camille Martin`), empty for a blank name.
 */
export function profileInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/u)
    .filter((word: string) => word !== '')
    .slice(0, 2)
    .map((word: string) => (Array.from(word)[0] ?? '').toUpperCase())
    .join('');
}

/**
 * Function toAccountProfile
 *
 * @description
 * Maps the gateway's account to the display model.
 *
 * @param {CurrentUser} dto - The account the gateway answered.
 * @returns {AccountProfile} The display model.
 */
export function toAccountProfile(dto: CurrentUser): AccountProfile {
  return {
    id: dto.id,
    name: dto.name,
    displayName: dto.displayName,
    jobTitle: dto.jobTitle,
    email: dto.email,
    timeZone: dto.timeZone,
    avatarId: dto.avatarId ?? null,
    initials: profileInitials(dto.name),
    version: dto.version,
  };
}

/**
 * Function toProfilePatch
 *
 * @description
 * The JSON Merge Patch of a change: a member left out of the change is left out of the patch, and
 * a null display name or job title clears it.
 *
 * @param {ProfileChange} change - What the save changes.
 * @returns {ProfilePatch} The request body.
 */
export function toProfilePatch(change: ProfileChange): ProfilePatch {
  return {
    ...(change.name === undefined ? {} : { name: change.name }),
    ...(change.displayName === undefined ? {} : { displayName: change.displayName }),
    ...(change.jobTitle === undefined ? {} : { jobTitle: change.jobTitle }),
    ...(change.timeZone === undefined ? {} : { timeZone: change.timeZone }),
  };
}

/**
 * Function toAvatarUpload
 *
 * @description
 * Maps a photo reservation to the signed destination the image is sent to.
 *
 * @param {ProfileMediaUpload} dto - The reservation the gateway answered.
 * @returns {AvatarUpload} The upload.
 */
export function toAvatarUpload(dto: ProfileMediaUpload): AvatarUpload {
  return { uploadId: dto.uploadId, url: dto.url, fields: { ...dto.fields } };
}

/**
 * Function toEmailChangeCode
 *
 * @description
 * Maps the answer of an e-mail change request to the code the dialog waits for.
 *
 * @param {EmailChangeCodeSent} dto - The answer.
 * @returns {EmailChangeCode} The code's address and when another one can be asked for.
 */
export function toEmailChangeCode(dto: EmailChangeCodeSent): EmailChangeCode {
  return { email: dto.email, resendAvailableAt: Date.parse(dto.resendAvailableAt) };
}

/**
 * Function toMyOrganization
 *
 * @description
 * Maps an organization of the person to what the account deletion names.
 *
 * @param {MyOrganizationDto} dto - The organization.
 * @returns {MyOrganization} Its id, name and whether the person owns it.
 */
export function toMyOrganization(dto: MyOrganizationDto): MyOrganization {
  return { id: dto.id, name: dto.name, owned: dto.role === 'owner' };
}

/**
 * Function resendAvailableAtOf
 *
 * @description
 * When another code can be asked for, from the `details.resendAvailableAt` of a
 * `429 auth.code-throttled` problem.
 *
 * @param {Readonly<Record<string, unknown>> | null} details - The problem's `details`.
 * @returns {number | null} Milliseconds since the epoch, or null when the problem does not say.
 */
export function resendAvailableAtOf(
  details: Readonly<Record<string, unknown>> | null,
): number | null {
  const value: unknown = details?.['resendAvailableAt'];
  if (typeof value !== 'string') return null;
  const at: number = Date.parse(value);
  return Number.isNaN(at) ? null : at;
}

/**
 * Function organizationIdsOf
 *
 * @description
 * The organizations a `409 account.organization-owner` problem lists in
 * `details.organizationIds`.
 *
 * @param {Readonly<Record<string, unknown>> | null} details - The problem's `details`.
 * @returns {readonly string[]} The organization ids; none when the problem does not list them.
 */
export function organizationIdsOf(
  details: Readonly<Record<string, unknown>> | null,
): readonly string[] {
  const ids: unknown = details?.['organizationIds'];
  return Array.isArray(ids)
    ? (ids as unknown[]).filter((id: unknown): id is string => typeof id === 'string')
    : [];
}

/**
 * Function refusedProfileFields
 *
 * @description
 * The form fields named by the issues of a `400 request.invalid` problem, each once, in the
 * order of the issues; issues on other members or on the body itself are left out.
 *
 * @param {Readonly<Record<string, unknown>> | null} details - The problem's `details`.
 * @returns {readonly ProfileField[]} The refused fields.
 */
export function refusedProfileFields(
  details: Readonly<Record<string, unknown>> | null,
): readonly ProfileField[] {
  const issues: unknown = details?.['issues'];
  if (!Array.isArray(issues)) return [];
  const fields: ProfileField[] = [];
  for (const issue of issues as unknown[]) {
    const path: unknown =
      typeof issue === 'object' && issue !== null
        ? (issue as Record<string, unknown>)['path']
        : undefined;
    const field: unknown = typeof path === 'string' ? path.split('.')[0] : undefined;
    if (
      typeof field === 'string' &&
      PROFILE_FIELDS.has(field) &&
      !fields.includes(field as ProfileField)
    ) {
      fields.push(field as ProfileField);
    }
  }
  return fields;
}
