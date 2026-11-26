import type { CurrentUser, MyOrganization, Organization } from '@cadenway/api-client';

import type {
  WorkspaceOrganization,
  WorkspaceUser,
} from '../../../models/workspace-context/workspace-context.interface';

/**
 * Function initialsOf
 *
 * @description
 * Derives the initials the rail and the avatars show: the first letters of the first and last
 * words of a name (`Atelier Nord` gives `AN`), or the first two letters of a single word.
 *
 * @param {string} name - Full name of a person or an organization.
 * @returns {string} One or two uppercase letters, or an empty string for a blank name.
 */
export function initialsOf(name: string): string {
  const words: string[] = name.trim().split(/\s+/u).filter(Boolean);
  const first: string = words.at(0) ?? '';
  const last: string = words.length > 1 ? (words.at(-1) ?? '') : '';
  const letters: string = last
    ? `${Array.from(first)[0] ?? ''}${Array.from(last)[0] ?? ''}`
    : Array.from(first).slice(0, 2).join('');
  return letters.toLocaleUpperCase();
}

/**
 * Function toWorkspaceUser
 *
 * @description
 * Keeps the fields of the signed-in account the workspace screens display.
 *
 * @param {CurrentUser} user - Account returned by `GET /v1/me`.
 * @returns {WorkspaceUser} Display model of the signed-in person.
 */
export function toWorkspaceUser(user: CurrentUser): WorkspaceUser {
  const name: string = user.name.trim();
  return {
    id: user.id,
    name,
    firstName: name.split(/\s+/u)[0] ?? '',
    displayName: user.displayName,
    email: user.email,
    initials: initialsOf(name),
  };
}

/**
 * Function toWorkspaceOrganization
 *
 * @description
 * Keeps the fields of an organization the workspace displays, from the current organization or an
 * entry of the caller's organizations.
 *
 * @param {Pick<Organization | MyOrganization, 'id' | 'slug' | 'name' | 'role' | 'plan'>} organization - Organization described by the gateway.
 * @returns {WorkspaceOrganization} Display model of the organization.
 */
export function toWorkspaceOrganization(
  organization: Pick<Organization | MyOrganization, 'id' | 'slug' | 'name' | 'role' | 'plan'>,
): WorkspaceOrganization {
  return {
    id: organization.id,
    slug: organization.slug,
    name: organization.name,
    initials: initialsOf(organization.name),
    role: organization.role,
    plan: organization.plan,
  };
}
