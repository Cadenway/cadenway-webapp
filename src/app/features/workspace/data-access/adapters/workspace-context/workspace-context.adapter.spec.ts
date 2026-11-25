import type { CurrentUser, MyOrganization } from '@cadenway/api-client';
import { describe, expect, it } from 'vitest';

import { initialsOf, toWorkspaceOrganization, toWorkspaceUser } from './workspace-context.adapter';

describe('workspace context adapter', () => {
  it.each([
    ['Atelier Nord', 'AN'],
    ['Lumen Cooperative', 'LC'],
    ['  camille   martin  ', 'CM'],
    ['Élodie de la Tour', 'ÉT'],
    ['Cadenway', 'CA'],
    ['', ''],
  ])('derives the initials of “%s” as “%s”', (name: string, initials: string) => {
    expect(initialsOf(name)).toBe(initials);
  });

  it('keeps the displayed fields of the signed-in account', () => {
    const user: CurrentUser = {
      id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30',
      name: 'Camille Martin',
      email: 'camille.martin@ateliernord.fr',
      language: 'fr',
      displayName: 'camille',
      jobTitle: null,
      timeZone: 'Europe/Paris',
      version: 2,
    };

    expect(toWorkspaceUser(user)).toEqual({
      id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30',
      name: 'Camille Martin',
      firstName: 'Camille',
      displayName: 'camille',
      email: 'camille.martin@ateliernord.fr',
      initials: 'CM',
    });
  });

  it('keeps the displayed fields of an organization of the caller', () => {
    const organization: MyOrganization = {
      id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f',
      name: 'Atelier Nord',
      slug: 'atelier-nord',
      role: 'owner',
      memberCount: 18,
      plan: 'team',
      joinedAt: '2026-11-01T10:00:00Z',
    };

    expect(toWorkspaceOrganization(organization)).toEqual({
      id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f',
      slug: 'atelier-nord',
      name: 'Atelier Nord',
      initials: 'AN',
      role: 'owner',
      plan: 'team',
    });
  });
});
