import { inject, Service } from '@angular/core';
import { Router } from '@angular/router';

import type { WorkspaceRefreshPort } from '../../ports/workspace-refresh/workspace-refresh-port.interface';
import {
  WORKSPACE_RECOVERY_NAVIGATION,
  WorkspaceRevalidation,
} from './workspace-revalidation.service';

/**
 * Service WorkspaceRefresh
 *
 * @description
 * The `WORKSPACE_REFRESH` of a `/:org` route: a same-address navigation marked as a workspace
 * recovery (`WORKSPACE_RECOVERY_NAVIGATION`, `onSameUrlNavigation: 'reload'`), after asking
 * `shouldRevalidateWorkspace` to rerun the guards and resolver. Being a recovery, a transient
 * failure cancels it without leaving the workspace, and `unsavedChangesGuard` lets it through
 * without asking. While another navigation is under way, only the request is recorded, for that
 * navigation or the next one to consume.
 */
@Service({ autoProvided: false })
export class WorkspaceRefresh implements WorkspaceRefreshPort {
  // #region Properties
  /**
   * Property router
   *
   * @description
   * Runs the verifying navigation.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property revalidation
   *
   * @description
   * The request `shouldRevalidateWorkspace` consumes.
   *
   * @type {WorkspaceRevalidation}
   * @readonly
   */
  private readonly revalidation: WorkspaceRevalidation = inject(WorkspaceRevalidation);
  // #endregion

  // #region Methods
  /**
   * Method refresh
   *
   * @description
   * Verifies the workspace again on the current address.
   *
   * @returns {Promise<void>} Resolves once the verification ended, or at once while another
   * navigation is under way.
   */
  public async refresh(): Promise<void> {
    this.revalidation.request();
    if (this.router.currentNavigation() !== null) return;
    try {
      await this.router.navigateByUrl(this.router.url, {
        onSameUrlNavigation: 'reload',
        info: WORKSPACE_RECOVERY_NAVIGATION,
      });
    } catch {
      // A failed verification redirects or keeps the workspace; the caller has nothing to undo.
    }
  }
  // #endregion
}
