import { DOCUMENT, inject, Service } from '@angular/core';
import { Router } from '@angular/router';

import { AuthApi } from '../../data-access/services/auth-api/auth-api.service';

/**
 * Constant PERSONAL_STORAGE_PREFIXES
 *
 * @description
 * `localStorage` key prefixes of what a signed-in person leaves on the device and a sign-out must
 * forget: the command palette's recent tasks of Search (`cadenway-recent-tasks:<user>:<org>`).
 * The accounts remembered for the signed-out screen are kept on purpose.
 *
 * @type {readonly string[]}
 */
const PERSONAL_STORAGE_PREFIXES: readonly string[] = ['cadenway-recent-tasks:'];

/**
 * Service SignOut
 *
 * @description
 * Closes the session of this browser from anywhere in the application (the account menu, the
 * command palette), under the exclusive cross-tab session lock, then opens the signed-out screen
 * (`/logged-out?reason=signed-out`) with a replacing navigation, so Back does not return to a
 * workspace the gateway no longer serves. Once the session is closed it forgets the person's
 * device data listed in `PERSONAL_STORAGE_PREFIXES`. Signing out twice is not an error.
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

  /**
   * Property document
   *
   * @description
   * Document whose window holds the storage.
   *
   * @type {Document}
   * @readonly
   */
  private readonly document: Document = inject(DOCUMENT);
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
    this.forgetPersonalData();
    await this.router.navigateByUrl('/logged-out?reason=signed-out', { replaceUrl: true });
    return true;
  }

  /**
   * Method forgetPersonalData
   *
   * @description
   * Removes the person's device data from `localStorage`, tolerating inaccessible storage.
   */
  private forgetPersonalData(): void {
    try {
      const storage: Storage | undefined = this.document.defaultView?.localStorage;
      if (!storage) return;
      const keys: string[] = [];
      for (let index: number = 0; index < storage.length; index += 1) {
        const key: string | null = storage.key(index);
        if (key && PERSONAL_STORAGE_PREFIXES.some((prefix: string) => key.startsWith(prefix))) {
          keys.push(key);
        }
      }
      for (const key of keys) storage.removeItem(key);
    } catch {
      return;
    }
  }
  // #endregion
}
