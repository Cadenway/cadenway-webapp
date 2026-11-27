import { inject, Service } from '@angular/core';
import { AuthService } from '@cadenway/api-client';
import { firstValueFrom } from 'rxjs';

import type { ReauthenticationAnswer } from '../../../models/reauthentication/reauthentication.interface';

/**
 * Service ReauthenticationApi
 *
 * @description
 * Opens the 10-minute window of recent authentication of the session through
 * `AuthService.reauthenticate` (`POST /v1/auth/reauthentication`). It rejects with the gateway's
 * `HttpErrorResponse`, whose problem the reauthentication service reads.
 */
@Service()
export class ReauthenticationApi {
  // #region Properties
  /**
   * Property auth
   *
   * @description
   * Generated account operations.
   *
   * @type {AuthService}
   * @readonly
   */
  private readonly auth: AuthService = inject(AuthService);
  // #endregion

  // #region Methods
  /**
   * Method reauthenticate
   *
   * @description
   * Sends the password or the authenticator code the person typed.
   *
   * @param {ReauthenticationAnswer} answer - The password or the code.
   * @returns {Promise<void>} Resolves once the window is open.
   */
  public async reauthenticate(answer: ReauthenticationAnswer): Promise<void> {
    await firstValueFrom(
      this.auth.reauthenticate(
        'password' in answer ? { password: answer.password } : { code: answer.code },
      ),
    );
  }
  // #endregion
}
