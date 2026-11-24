import { inject, type Signal, type Type } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';

import { authProblem } from '../../utils/auth-problem/auth-problem.util';
import { OrganizationApi } from '../../data-access/services/organization-api/organization-api.service';
import type { AuthProblem } from '../../models/auth-problem/auth-problem.interface';
import type {
  OrganizationChoice,
  OrganizationDraft,
} from '../../models/organization/organization.interface';

/**
 * Type CreationResult
 *
 * @description
 * Outcome of a creation: the new workspace path, or the refusal. `created` is the organization
 * when the creation itself succeeded but moving the session to it failed.
 *
 * @type {{ readonly ok: true; readonly destination: string; readonly logoFailed: boolean } | { readonly ok: false; readonly problem: AuthProblem; readonly created: OrganizationChoice | null }}
 */
export type CreationResult =
  | { readonly ok: true; readonly destination: string; readonly logoFailed: boolean }
  | {
      readonly ok: false;
      readonly problem: AuthProblem;
      readonly created: OrganizationChoice | null;
    };

/**
 * Interface OrganizationCreateStoreInstance
 *
 * @description
 * Public API of the creation store.
 */
interface OrganizationCreateStoreInstance {
  // #region Properties
  /**
   * Property creating
   *
   * @description
   * Whether a creation is running.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly creating: Signal<boolean>;
  // #endregion

  // #region Methods
  /**
   * Method create
   *
   * @description
   * Creates the organization, moves the session to it (retrying while the membership
   * propagates), then uploads the logo. A failed logo upload does not undo the creation.
   *
   * @param {OrganizationDraft} draft - The submitted form.
   * @returns {Promise<CreationResult>} The workspace path or the refusal.
   */
  create(draft: OrganizationDraft): Promise<CreationResult>;
  // #endregion
}

/**
 * Function createOrganizationCreateStore
 *
 * @description
 * Creates the store of the creation page, provided by that page.
 *
 * @returns {Type<OrganizationCreateStoreInstance>} The store provider.
 */
function createOrganizationCreateStore(): Type<OrganizationCreateStoreInstance> {
  return signalStore(
    withState({ creating: false }),
    withMethods((store, api: OrganizationApi = inject(OrganizationApi)) => ({
      async create(draft: OrganizationDraft): Promise<CreationResult> {
        if (store.creating()) {
          return { ok: false, problem: authProblem(null), created: null };
        }
        patchState(store, { creating: true });
        let created: OrganizationChoice | null = null;
        try {
          created = await api.create(draft);
          await api.choose(created.id, true);
        } catch (error: unknown) {
          patchState(store, { creating: false });
          return { ok: false, problem: authProblem(error), created };
        }
        let logoFailed: boolean = false;
        if (draft.logo !== null) {
          try {
            await api.uploadLogo(draft.logo);
          } catch {
            logoFailed = true;
          }
        }
        patchState(store, { creating: false });
        return { ok: true, destination: `/${created.slug}`, logoFailed };
      },
    })),
  );
}

/**
 * Constant OrganizationCreateStore
 *
 * @description
 * Creation state, provided by the creation page.
 *
 * @type {Type<OrganizationCreateStoreInstance>}
 */
export const OrganizationCreateStore: Type<OrganizationCreateStoreInstance> =
  createOrganizationCreateStore();

/**
 * Type OrganizationCreateStore
 *
 * @description
 * Instance type of the creation store.
 *
 * @type {OrganizationCreateStoreInstance}
 */
export type OrganizationCreateStore = OrganizationCreateStoreInstance;
