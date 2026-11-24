import { inject, resource, type ResourceRef, type Signal, type Type } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';

import { WorkspaceSession } from '../../data-access/services/workspace-session/workspace-session.service';
import type { OrganizationMenuEntry } from '../../models/organization-menu-entry/organization-menu-entry.interface';
import type { WorkspaceResult } from '../../models/workspace-context/workspace-context.interface';

/**
 * Interface OrganizationMenuState
 *
 * @description
 * Whether the menu asked for the caller's organizations yet.
 */
interface OrganizationMenuState {
  // #region Properties
  /**
   * Property _requested
   *
   * @description
   * True once the menu opened, so the list is read on demand rather than with every workspace.
   *
   * @type {boolean}
   * @readonly
   */
  readonly _requested: boolean;
  // #endregion
}

/**
 * Interface OrganizationMenuStoreInstance
 *
 * @description
 * The caller's organizations as the organizations menu shows them, read on demand.
 */
interface OrganizationMenuStoreInstance {
  // #region Properties
  /**
   * Property organizations
   *
   * @description
   * The read of the caller's organizations; idle until `load()`.
   *
   * @type {ResourceRef<readonly OrganizationMenuEntry[] | undefined>}
   * @readonly
   */
  readonly organizations: ResourceRef<readonly OrganizationMenuEntry[] | undefined>;

  /**
   * Property entries
   *
   * @description
   * The organizations read, or an empty list before the first answer and after a failure.
   *
   * @type {Signal<readonly OrganizationMenuEntry[]>}
   * @readonly
   */
  readonly entries: Signal<readonly OrganizationMenuEntry[]>;

  /**
   * Property loading
   *
   * @description
   * Whether the list is being read without a value to show yet.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly loading: Signal<boolean>;

  /**
   * Property failed
   *
   * @description
   * Whether the last read failed; distinct from a successful empty list.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly failed: Signal<boolean>;
  // #endregion

  // #region Methods
  /**
   * Method load
   *
   * @description
   * Starts the first read; later calls keep the list already read.
   */
  load(): void;

  /**
   * Method retry
   *
   * @description
   * Reads the list again after a failure.
   */
  retry(): void;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * Nothing requested before the menu opens.
 *
 * @type {OrganizationMenuState}
 */
const initialState: OrganizationMenuState = { _requested: false };

/**
 * Function createOrganizationMenuStore
 *
 * @description
 * Creates the store of the organizations menu.
 *
 * @returns {Type<OrganizationMenuStoreInstance>} Injectable store constructor.
 */
function createOrganizationMenuStore(): Type<OrganizationMenuStoreInstance> {
  return signalStore(
    withState(initialState),
    withProps((store) => {
      const session: WorkspaceSession = inject(WorkspaceSession);
      return {
        organizations: resource({
          params: (): true | undefined => (store._requested() ? true : undefined),
          loader: async (): Promise<readonly OrganizationMenuEntry[]> => {
            const result: WorkspaceResult<readonly OrganizationMenuEntry[]> = await firstValueFrom(
              session.menuOrganizations(),
            );
            if (!result.ok) throw new Error('The organizations could not be read.');
            return result.value;
          },
        }),
      };
    }),
    withComputed((store) => ({
      entries: (): readonly OrganizationMenuEntry[] =>
        store.organizations.hasValue() ? store.organizations.value() : [],
      loading: (): boolean => store.organizations.isLoading() && !store.organizations.hasValue(),
      failed: (): boolean => store.organizations.status() === 'error',
    })),
    withMethods((store) => ({
      load(): void {
        patchState(store, { _requested: true });
      },
      retry(): void {
        store.organizations.reload();
      },
    })),
  );
}

/**
 * Constant OrganizationMenuStore
 *
 * @description
 * The organizations menu's list, provided by the menu component so it lives with the shell. It is
 * read the first time the menu opens; a failure is a flag with a retry, never an emptied list.
 *
 * @type {ReturnType<typeof createOrganizationMenuStore>}
 */
export const OrganizationMenuStore: ReturnType<typeof createOrganizationMenuStore> =
  createOrganizationMenuStore();
