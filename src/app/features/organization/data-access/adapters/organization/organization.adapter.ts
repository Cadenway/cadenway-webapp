import type {
  Organization as OrganizationDto,
  OrganizationPatch,
  ProfileMediaUpload,
} from '@cadenway/api-client';

import { initialsOf } from '@shared/initials';

import type {
  OrganizationField,
  OrganizationLanguage,
  OrganizationLogoUpload,
  OrganizationProfile,
  OrganizationProfileChange,
} from '../../../models/organization/organization-profile.interface';

/**
 * Constant ORGANIZATION_LANGUAGES
 *
 * @description
 * The default languages this version knows (`defaultLanguage` is an extensible enum).
 *
 * @type {ReadonlySet<string>}
 */
const ORGANIZATION_LANGUAGES: ReadonlySet<string> = new Set<OrganizationLanguage>([
  'fr',
  'en',
  'de',
]);

/**
 * Constant ORGANIZATION_FIELDS
 *
 * @description
 * The members of `OrganizationPatch` the `Identity` form edits, as the gateway names them in the
 * `path` of a `400 request.invalid` issue.
 *
 * @type {ReadonlySet<string>}
 */
const ORGANIZATION_FIELDS: ReadonlySet<string> = new Set<OrganizationField>([
  'name',
  'slug',
  'description',
  'website',
  'defaultLanguage',
]);

/**
 * Function toOrganizationProfile
 *
 * @description
 * Maps the gateway's organization to the display model; a language this version does not know
 * becomes null.
 *
 * @param {OrganizationDto} dto - The organization the gateway answered.
 * @returns {OrganizationProfile} The display model.
 */
export function toOrganizationProfile(dto: OrganizationDto): OrganizationProfile {
  return {
    id: dto.id,
    name: dto.name,
    slug: dto.slug,
    description: dto.description,
    website: dto.website,
    defaultLanguage: ORGANIZATION_LANGUAGES.has(dto.defaultLanguage)
      ? (dto.defaultLanguage as OrganizationLanguage)
      : null,
    logoId: dto.logoId ?? null,
    initials: initialsOf(dto.name),
    version: dto.version,
  };
}

/**
 * Function toOrganizationPatch
 *
 * @description
 * The JSON Merge Patch of a change: a member left out of the change is left out of the patch, and
 * a null description or website clears it.
 *
 * @param {OrganizationProfileChange} change - What the save changes.
 * @returns {OrganizationPatch} The request body.
 */
export function toOrganizationPatch(change: OrganizationProfileChange): OrganizationPatch {
  return {
    ...(change.name === undefined ? {} : { name: change.name }),
    ...(change.slug === undefined ? {} : { slug: change.slug }),
    ...(change.description === undefined ? {} : { description: change.description }),
    ...(change.website === undefined ? {} : { website: change.website }),
    ...(change.defaultLanguage === undefined ? {} : { defaultLanguage: change.defaultLanguage }),
  };
}

/**
 * Function toOrganizationLogoUpload
 *
 * @description
 * Maps a logo reservation to the signed destination the image is sent to.
 *
 * @param {ProfileMediaUpload} dto - The reservation the gateway answered.
 * @returns {OrganizationLogoUpload} The upload.
 */
export function toOrganizationLogoUpload(dto: ProfileMediaUpload): OrganizationLogoUpload {
  return { uploadId: dto.uploadId, url: dto.url, fields: { ...dto.fields } };
}

/**
 * Function refusedFields
 *
 * @description
 * The form fields named by the issues of a `400 request.invalid` problem, each once, in the
 * order of the issues; issues on other members or on the body itself are left out.
 *
 * @param {Readonly<Record<string, unknown>> | null} details - The problem's `details`.
 * @returns {readonly OrganizationField[]} The refused fields.
 */
export function refusedFields(
  details: Readonly<Record<string, unknown>> | null,
): readonly OrganizationField[] {
  const issues: unknown = details?.['issues'];
  if (!Array.isArray(issues)) return [];
  const fields: OrganizationField[] = [];
  for (const issue of issues as unknown[]) {
    const path: unknown =
      typeof issue === 'object' && issue !== null
        ? (issue as Record<string, unknown>)['path']
        : undefined;
    const field: unknown = typeof path === 'string' ? path.split('.')[0] : undefined;
    if (
      typeof field === 'string' &&
      ORGANIZATION_FIELDS.has(field) &&
      !fields.includes(field as OrganizationField)
    ) {
      fields.push(field as OrganizationField);
    }
  }
  return fields;
}
