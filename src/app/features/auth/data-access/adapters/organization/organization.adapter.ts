import type {
  JoinedOrganization,
  MyOrganization,
  Organization,
  ReceivedInvitation as ReceivedInvitationDto,
} from '@cadenway/api-client';

import type {
  OrganizationChoice,
  ReceivedInvitation,
} from '../../../models/organization/organization.interface';

/**
 * Function organizationChoice
 *
 * @description
 * Keeps the fields the chooser shows of an organization of the caller.
 *
 * @param {MyOrganization | JoinedOrganization | Organization} organization - A listed, joined or
 * created organization.
 * @returns {OrganizationChoice} The chooser entry.
 */
export function organizationChoice(
  organization: MyOrganization | JoinedOrganization | Organization,
): OrganizationChoice {
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    role: organization.role,
    memberCount: organization.memberCount,
    plan: organization.plan,
  };
}

/**
 * Function receivedInvitation
 *
 * @description
 * Keeps the fields the chooser shows of an invitation addressed to the caller.
 *
 * @param {ReceivedInvitationDto} invitation - The invitation as the gateway lists it.
 * @returns {ReceivedInvitation} The chooser entry.
 */
export function receivedInvitation(invitation: ReceivedInvitationDto): ReceivedInvitation {
  return {
    id: invitation.id,
    organizationName: invitation.organization.name,
    role: invitation.role,
    inviterName: invitation.invitedBy.name,
    expiresAt: invitation.expiresAt,
  };
}
