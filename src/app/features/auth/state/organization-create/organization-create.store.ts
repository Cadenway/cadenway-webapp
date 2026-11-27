import { inject, type Signal, type Type } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';

import { isReservedSlug, workspacePath } from '@core/routing';

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
 * Outcome of a creation: the new workspace address, which asks Onboarding's assistant to open
 * (`/<slug>?onboarding=start`, or `/organizations` for a reserved slug), or the refusal.
 * `created` is the organization when the creation itself succeeded but moving the session to it
 * failed.
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
 * Function creationDestination
 *
 * @description
 * The address a creation opens: the new workspace with `?onboarding=start`, which asks
 * Onboarding's first-launch assistant to open there, or `/organizations` without the parameter
 * when the slug is reserved or empty.
 *
 * @param {string} slug - Slug of the created organization.
 * @returns {string} `/<slug>?onboarding=start` or `/organizations`.
 */
function creationDestination(slug: string): string {
  const path: string = workspacePath(slug);
  return slug === '' || isReservedSlug(slug) ? path : `${path}?onboarding=start`;
}

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
   * Creates the organization, then moves the session to it and uploads the logo under one
   * exclusive session lock (`OrganizationApi.enterCreated`). A failed logo upload does not undo
   * the creation: the result says so, for the next screen to tell the person.
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
        let logoFailed: boolean;
        try {
          created = await api.create(draft);
          const entered: { readonly logoFailed: boolean } = await api.enterCreated(
            created.id,
            draft.logo,
          );
          logoFailed = entered.logoFailed;
        } catch (error: unknown) {
          patchState(store, { creating: false });
          return { ok: false, problem: authProblem(error), created };
        }
        patchState(store, { creating: false });
        return { ok: true, destination: creationDestination(created.slug), logoFailed };
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
