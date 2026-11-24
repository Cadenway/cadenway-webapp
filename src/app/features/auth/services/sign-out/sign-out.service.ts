import { inject, Service } from '@angular/core';
import { Router } from '@angular/router';

import { AuthApi } from '../../data-access/services/auth-api/auth-api.service';

/**
 * Service SignOut
 *
 * @description
 * Closes the session of this browser from anywhere in the application (the account menu, the
 * command palette), under the exclusive cross-tab session lock, then opens the signed-out screen
 * (`/logged-out?reason=signed-out`) with a replacing navigation, so Back does not return to a
 * workspace the gateway no longer serves. Signing out twice is not an error.
 */
@Service()
export class SignOut {
  // #region Properties
  /**
   * Property api
   *
   * @description
   * Gateway auth operations.
   *
   * @type {AuthApi}
   * @readonly
   */
  private readonly api: AuthApi = inject(AuthApi);

  /**
   * Property router
   *
   * @description
   * Router opening the signed-out screen.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);
  // #endregion

  // #region Methods
  /**
   * Method run
   *
   * @description
   * Signs out, then navigates to the signed-out screen. A failed request (network, unavailable
   * gateway, no Web Locks) leaves the session and the page as they were.
   *
   * @returns {Promise<boolean>} Whether the session was closed.
   */
  public async run(): Promise<boolean> {
    try {
      await this.api.signOut();
    } catch {
      return false;
    }
    await this.router.navigateByUrl('/logged-out?reason=signed-out', { replaceUrl: true });
    return true;
  }
  // #endregion
}
