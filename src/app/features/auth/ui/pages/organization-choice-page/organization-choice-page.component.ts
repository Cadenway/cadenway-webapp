import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  type ResourceRef,
  type Signal,
  signal,
  type WritableSignal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { CwAlert, CwAlertDescription } from '@cadenway/ui/components/alert';
import { CwButton } from '@cadenway/ui/components/button';
import { CwCard } from '@cadenway/ui/components/card';
import { CwEmpty, CwEmptyDescription, CwEmptyHeader } from '@cadenway/ui/components/empty';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { NgIcon } from '@ng-icons/core';

import { AuthEntryService } from '../../../data-access/services/entry/auth-entry.service';
import type { AuthProblem, OrganizationChoices } from '../../../models/auth/auth.interface';
import type { AuthResult } from '../../../models/auth/auth.type';
import { OrganizationActionsStore } from '../../../state/organization-actions/organization-actions.store';

/**
 * Component OrganizationChoicePage
 *
 * @description
 * Lists the organizations of the signed-in person and only opens a workspace after the session
 * successfully switches to that organization.
 */
@Component({
  selector: 'cw-organization-choice-page',
  imports: [
    CwAlert,
    CwAlertDescription,
    CwButton,
    CwCard,
    CwEmpty,
    CwEmptyDescription,
    CwEmptyHeader,
    CwSkeleton,
    NgIcon,
  ],
  providers: [OrganizationActionsStore],
  templateUrl: './organization-choice-page.component.html',
})
export class OrganizationChoicePage {
  // #region Properties
  /**
   * Property router
   *
   * @description
   * Opens the workspace, or returns to sign-in after the cookie session ends.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property destroyRef
   *
   * @description
   * Prevents a completed request from navigating after this page has been closed.
   *
   * @type {DestroyRef}
   * @readonly
   */
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /**
   * Property api
   *
   * @description
   * Reads the current account and its organizations through the generated client.
   *
   * @type {AuthEntryService}
   * @readonly
   */
  private readonly api: AuthEntryService = inject(AuthEntryService);

  /**
   * Property actions
   *
   * @description
   * Page-scoped session mutations with a shared pending state.
   *
   * @type {InstanceType<typeof OrganizationActionsStore>}
   * @readonly
   */
  protected readonly actions: InstanceType<typeof OrganizationActionsStore> =
    inject(OrganizationActionsStore);

  /**
   * Property pageCursors
   *
   * @description
   * Keeps visited cursors so preceding pages can be requested again.
   *
   * @type {WritableSignal<readonly (string | undefined)[]>}
   * @readonly
   */
  protected readonly pageCursors: WritableSignal<readonly (string | undefined)[]> = signal([
    undefined,
  ]);

  /**
   * Property choices
   *
   * @description
   * Cancellable list request for the active cursor, with loading distinct from failure or emptiness.
   *
   * @type {ResourceRef<AuthResult<OrganizationChoices> | undefined>}
   * @readonly
   */
  protected readonly choices: ResourceRef<AuthResult<OrganizationChoices> | undefined> = rxResource(
    {
      params: () => ({ cursor: this.pageCursors().at(-1) }),
      stream: ({ params }: { params: { cursor: string | undefined } }) =>
        this.api.choices(params.cursor),
    },
  );

  /**
   * Property actionMessage
   *
   * @description
   * Presents recoverable errors without reusing sensitive gateway descriptions.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly actionMessage: Signal<string> = computed(() => {
    const problem: AuthProblem | null = this.actions.problem();
    if (!problem || problem.status === 401) return '';
    if (problem.code === 'organization.mfa-required') {
      return 'Cette organisation exige la vérification en deux étapes.';
    }
    if (problem.status === 404) {
      return 'Cette organisation n’est plus accessible. Actualisez la liste.';
    }
    return 'L’action est indisponible. Réessayez dans un instant.';
  });
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Observes expiration on both direct visits and subsequent pages of the chooser.
   *
   * @constructor
   */
  public constructor() {
    effect(() => {
      const result: AuthResult<OrganizationChoices> | undefined = this.choices.value();
      if (result?.ok === false && result.problem.status === 401) {
        void this.router.navigateByUrl('/connexion', { replaceUrl: true });
      }
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method choose
   *
   * @description
   * Opens the workspace if the selected organization became current.
   *
   * @param {string} organizationId - The choice made by the caller.
   * @returns {Promise<void>} Resolves after handling the selection.
   */
  protected async choose(organizationId: string): Promise<void> {
    if ((await this.actions.choose(organizationId)) && !this.destroyRef.destroyed) {
      const destination: string =
        this.actions.problem()?.status === 401 ? '/connexion' : '/accueil';
      await this.router.navigateByUrl(destination, { replaceUrl: true });
    }
  }

  /**
   * Method signOut
   *
   * @description
   * Closes the session before returning to the login screen.
   *
   * @returns {Promise<void>} Resolves after handling session closure.
   */
  protected async signOut(): Promise<void> {
    if ((await this.actions.signOut()) && !this.destroyRef.destroyed) {
      await this.router.navigateByUrl('/connexion', { replaceUrl: true });
    }
  }
  // #endregion
}
