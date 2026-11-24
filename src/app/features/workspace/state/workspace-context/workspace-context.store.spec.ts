import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import type {
  WorkspaceOrganization,
  WorkspaceRole,
  WorkspaceUser,
} from '../../models/workspace-context/workspace-context.interface';
import { WorkspaceContextStore } from './workspace-context.store';

/**
 * Constant camille
 *
 * @description
 * Signed-in person of the mockup.
 *
 * @type {WorkspaceUser}
 */
const camille: WorkspaceUser = {
  id: 'u1',
  name: 'Camille Martin',
  firstName: 'Camille',
  displayName: null,
  email: 'camille.martin@ateliernord.fr',
  initials: 'CM',
};

/**
 * Function organization
 *
 * @description
 * Atelier Nord with the given role of the person.
 *
 * @param {WorkspaceRole} role - Role of the person.
 * @returns {WorkspaceOrganization} The organization.
 */
function organization(role: WorkspaceRole): WorkspaceOrganization {
  return {
    id: 'o1',
    slug: 'atelier-nord',
    name: 'Atelier Nord',
    initials: 'AN',
    role,
    plan: 'team',
  };
}

describe('WorkspaceContextStore', () => {
  let store: InstanceType<typeof WorkspaceContextStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [WorkspaceContextStore] });
    store = TestBed.inject(WorkspaceContextStore);
  });

  it('fails loudly when read before the resolver committed a context', () => {
    expect(() => store.user()).toThrow(/before the workspace resolver committed it/u);
  });

  it('publishes only what the guards verified once it is committed', () => {
    store.verifyUser(camille);
    store.verifyOrganization(organization('admin'));
    expect(() => store.organization()).toThrow();

    expect(store.commit()).toEqual({ user: camille, organization: organization('admin') });
    expect(store.user()).toEqual(camille);
    expect(store.organization().slug).toBe('atelier-nord');
    expect(store.role()).toBe('admin');
  });

  it('keeps the published context when a navigation verified only part of it', () => {
    store.verifyUser(camille);
    store.verifyOrganization(organization('owner'));
    store.commit();

    store.verifyOrganization(organization('guest'));
    expect(store.commit()).toBeNull();
    expect(store.role()).toBe('owner');
  });

  it.each([
    ['owner', 'admin', true],
    ['admin', 'admin', true],
    ['member', 'admin', false],
    ['member', 'member', true],
    ['guest', 'member', false],
    ['guest', 'guest', true],
  ] as const)(
    'as %s, can(%s) is %s',
    (role: WorkspaceRole, required: WorkspaceRole, expected: boolean) => {
      store.verifyUser(camille);
      store.verifyOrganization(organization(role));
      store.commit();

      expect(store.can(required)).toBe(expected);
    },
  );
});
