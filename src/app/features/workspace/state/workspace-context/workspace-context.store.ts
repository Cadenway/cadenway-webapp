import type { Signal, Type } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';

import type {
  WorkspaceContext,
  WorkspaceOrganization,
  WorkspaceRole,
  WorkspaceUser,
} from '../../models/workspace-context/workspace-context.interface';
import type { WorkspaceContextPort } from '../../ports/workspace-context/workspace-context-port.interface';
import { meetsRole } from '../../utils/role-rank/role-rank.util';

/**
 * Interface WorkspaceContextState
 *
 * @description
 * The committed context the route publishes, and the values the guards of a pending navigation
 * verified for it.
 */
interface WorkspaceContextState {
  // #region Properties
  /**
   * Property _user
   *
   * @description
   * Person of the committed context, or null before the first commit.
   *
   * @type {WorkspaceUser | null}
   * @readonly
   */
  readonly _user: WorkspaceUser | null;

  /**
   * Property _organization
   *
   * @description
   * Organization of the committed context, or null before the first commit.
   *
   * @type {WorkspaceOrganization | null}
   * @readonly
   */
  readonly _organization: WorkspaceOrganization | null;

  /**
   * Property _pendingUser
   *
   * @description
   * Person the session guard verified for the navigation in progress.
   *
   * @type {WorkspaceUser | null}
   * @readonly
   */
  readonly _pendingUser: WorkspaceUser | null;

  /**
   * Property _pendingOrganization
   *
   * @description
   * Organization the organization guard verified for the navigation in progress.
   *
   * @type {WorkspaceOrganization | null}
   * @readonly
   */
  readonly _pendingOrganization: WorkspaceOrganization | null;

  /**
   * Property _pendingNavigationId
   *
   * @description
   * Router navigation whose organization guard verified `_pendingOrganization`, so a role check of
   * that same navigation can trust it before the resolver commits it.
   *
   * @type {number | null}
   * @readonly
   */
  readonly _pendingNavigationId: number | null;
  // #endregion
}

/**
 * Interface WorkspaceContextStoreInstance
 *
 * @description
 * The published context and the operations the workspace guards and resolver use to verify and
 * commit it.
 */
interface WorkspaceContextStoreInstance extends WorkspaceContextPort {
  // #region Methods
  /**
   * Method verifyUser
   *
   * @description
   * Keeps the person the session guard read for the navigation in progress, without changing the
   * published context.
   *
   * @param {WorkspaceUser} user - The signed-in person.
   */
  verifyUser(user: WorkspaceUser): void;

  /**
   * Method verifyOrganization
   *
   * @description
   * Keeps the organization the organization guard matched to the URL for the navigation in
   * progress, without changing the published context.
   *
   * @param {WorkspaceOrganization} organization - The session's current organization.
   * @param {number | null} [navigationId] - Router navigation that verified it, when known.
   */
  verifyOrganization(organization: WorkspaceOrganization, navigationId?: number | null): void;

  /**
   * Method roleDuring
   *
   * @description
   * Role a guard below `/:org` checks. Such a guard runs before the workspace resolver commits the
   * context, so it gets the role the organization guard verified during that same navigation,
   * otherwise the committed role (the guards of `/:org` did not run again), otherwise null.
   *
   * @param {number | null} navigationId - Router navigation the guard runs for.
   * @returns {WorkspaceRole | null} The role, or null before any verified organization.
   */
  roleDuring(navigationId: number | null): WorkspaceRole | null;

  /**
   * Method commit
   *
   * @description
   * Publishes the verified person and organization and clears the pending values. Without both
   * verified values, the published context is left unchanged.
   *
   * @returns {WorkspaceContext | null} The published context, or null when a value is missing.
   */
  commit(): WorkspaceContext | null;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * No context before the first verified navigation.
 *
 * @type {WorkspaceContextState}
 */
const initialState: WorkspaceContextState = {
  _user: null,
  _organization: null,
  _pendingUser: null,
  _pendingOrganization: null,
  _pendingNavigationId: null,
};

/**
 * Function committed
 *
 * @description
 * Reads a committed value, failing loudly when a reader runs before the resolver committed it,
 * which the route order makes impossible.
 *
 * @template T
 * @param {T | null} value - Committed value.
 * @returns {T} The value.
 * @throws {Error} When nothing was committed yet.
 */
function committed<T>(value: T | null): T {
  if (value === null) {
    throw new Error('The workspace context is read before the workspace resolver committed it.');
  }
  return value;
}

/**
 * Function createWorkspaceContextStore
 *
 * @description
 * Creates the route-scoped store of the workspace context.
 *
 * @returns {Type<WorkspaceContextStoreInstance>} Injectable store constructor.
 */
function createWorkspaceContextStore(): Type<WorkspaceContextStoreInstance> {
  return signalStore(
    withState(initialState),
    withComputed(
      ({
        _user,
        _organization,
      }: {
        _user: Signal<WorkspaceUser | null>;
        _organization: Signal<WorkspaceOrganization | null>;
      }) => ({
        user: (): WorkspaceUser => committed(_user()),
        organization: (): WorkspaceOrganization => committed(_organization()),
        role: (): WorkspaceRole => committed(_organization()).role,
      }),
    ),
    withMethods((store) => ({
      verifyUser(user: WorkspaceUser): void {
        patchState(store, { _pendingUser: user });
      },
      verifyOrganization(
        organization: WorkspaceOrganization,
        navigationId: number | null = null,
      ): void {
        patchState(store, {
          _pendingOrganization: organization,
          _pendingNavigationId: navigationId,
        });
      },
      roleDuring(navigationId: number | null): WorkspaceRole | null {
        const pending: WorkspaceOrganization | null = store._pendingOrganization();
        if (
          pending !== null &&
          navigationId !== null &&
          store._pendingNavigationId() === navigationId
        )
          return pending.role;
        return store._organization()?.role ?? null;
      },
      commit(): WorkspaceContext | null {
        const user: WorkspaceUser | null = store._pendingUser();
        const organization: WorkspaceOrganization | null = store._pendingOrganization();
        if (user === null || organization === null) return null;
        patchState(store, {
          _user: user,
          _organization: organization,
          _pendingUser: null,
          _pendingOrganization: null,
          _pendingNavigationId: null,
        });
        return { user, organization };
      },
      can(role: WorkspaceRole): boolean {
        return meetsRole(store.role(), role);
      },
    })),
  );
}

/**
 * Constant WorkspaceContextStore
 *
 * @description
 * Holds the person and the organization of the workspace, provided on the `/:org` route and
 * published as `WORKSPACE_CONTEXT`. The guards verify the values of each navigation that changes
 * the slug and the resolver commits them, so a navigation cancelled after a guard never changes
 * what the shell shows. It lives and dies with the route, so leaving the workspace (sign-out,
 * organization choice) drops it.
 *
 * @type {ReturnType<typeof createWorkspaceContextStore>}
 */
export const WorkspaceContextStore: ReturnType<typeof createWorkspaceContextStore> =
  createWorkspaceContextStore();
