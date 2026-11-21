import { inject, Service } from '@angular/core';
import {
  AuthService as GeneratedAuthService,
  OrganizationsService,
  type CurrentUser,
  type MyOrganization,
  type MyOrganizationPage,
} from '@cadenway/api-client';
import { catchError, forkJoin, map, type Observable, of } from 'rxjs';

import type {
  OrganizationChoices,
  OrganizationEntry,
  SignInCredentials,
} from '../../../models/auth/auth.interface';
import type { AuthResult, SignInOutcome } from '../../../models/auth/auth.type';
import { withSessionLock } from '../../../services/session-lock/session-lock.service';
import { authProblem } from '../../adapters/auth-problem.adapter';

/**
 * Constant roleLabels
 *
 * @description
 * Organization roles as they appear on the chooser.
 *
 * @type {Readonly<Record<MyOrganization['role'], string>>}
 */
const roleLabels: Readonly<Record<MyOrganization['role'], string>> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  member: 'Membre',
  guest: 'Invité',
};

/**
 * Function organizationEntry
 *
 * @description
 * Keeps only the fields displayed at the application entry.
 *
 * @param {MyOrganization} organization - The organization described by the gateway.
 * @returns {OrganizationEntry} The organization and the caller's translated role.
 */
function organizationEntry(
  organization: Pick<MyOrganization, 'id' | 'name' | 'role'>,
): OrganizationEntry {
  return {
    id: organization.id,
    name: organization.name,
    role: roleLabels[organization.role],
  };
}

/**
 * Function authResult
 *
 * @description
 * Turns client failures into safe data and keeps the request cancellable by its subscriber.
 *
 * @template T
 * @param {Observable<T>} request - The request after mapping to a display model.
 * @returns {Observable<AuthResult<T>>} The typed success or error.
 */
function authResult<T>(request: Observable<T>): Observable<AuthResult<T>> {
  return request.pipe(
    map((value): AuthResult<T> => ({ ok: true, value })),
    catchError((error: unknown) => of({ ok: false as const, problem: authProblem(error) })),
  );
}

/**
 * Service AuthEntryService
 *
 * @description
 * Maps generated auth and organization operations to models whose lifetime is limited to the
 * current screen. Session cookies are managed by the gateway.
 */
@Service()
export class AuthEntryService {
  // #region Properties
  /**
   * Property auth
   *
   * @description
   * Generated operations for password verification, the second step and session closure.
   *
   * @type {GeneratedAuthService}
   * @readonly
   */
  private readonly auth: GeneratedAuthService = inject(GeneratedAuthService);

  /**
   * Property organizations
   *
   * @description
   * Generated operations that list and choose the caller's organization.
   *
   * @type {OrganizationsService}
   * @readonly
   */
  private readonly organizations: OrganizationsService = inject(OrganizationsService);
  // #endregion

  // #region Methods
  /**
   * Method signIn
   *
   * @description
   * Uses the HTTP status to distinguish a new session from a challenge.
   *
   * @param {SignInCredentials} credentials - The submitted password form.
   * @returns {Observable<AuthResult<SignInOutcome>>} The new session or second step.
   */
  public signIn(credentials: SignInCredentials): Observable<AuthResult<SignInOutcome>> {
    return authResult(
      withSessionLock(() =>
        this.auth.signInWithPassword(credentials, { observe: 'response' }),
      ).pipe(
        map((response): SignInOutcome => {
          if (response.status === 200 && response.body && 'session' in response.body) {
            return { kind: 'signed-in' };
          }

          if (
            response.status === 202 &&
            response.body &&
            'token' in response.body &&
            response.body.token &&
            Array.isArray(response.body.methods) &&
            response.body.methods.includes('authenticator-app')
          ) {
            return {
              kind: 'challenge',
              challenge: { token: response.body.token, email: response.body.email },
            };
          }

          throw new Error('The gateway returned an unsupported sign-in response.');
        }),
      ),
    );
  }

  /**
   * Method answerWithCode
   *
   * @description
   * Answers the current challenge using the authenticator app.
   *
   * @param {string} token - The in-memory second-step token.
   * @param {string} code - The six digits typed by the caller.
   * @returns {Observable<AuthResult<void>>} Resolves only once the gateway opened the session.
   */
  public answerWithCode(token: string, code: string): Observable<AuthResult<void>> {
    return authResult(
      withSessionLock(() =>
        this.auth.answerSignInChallengeWithAuthenticatorApp(
          { token, code },
          { observe: 'response' },
        ),
      ).pipe(
        map((response): void => {
          if (response.status !== 200 || !response.body?.session) {
            throw new Error('The gateway did not open a session after the second step.');
          }
        }),
      ),
    );
  }

  /**
   * Method choices
   *
   * @description
   * Reads a page of organizations and the verified account address for the chooser.
   *
   * @param {string | undefined} cursor - The optional cursor from the previous page.
   * @returns {Observable<AuthResult<OrganizationChoices>>} The next page or a gateway failure.
   */
  public choices(cursor: string | undefined): Observable<AuthResult<OrganizationChoices>> {
    return authResult(
      forkJoin({
        user: this.auth.getCurrentUser(),
        page: this.organizations.listMyOrganizations({ cursor }),
      }).pipe(
        map(({ user, page }: { user: CurrentUser; page: MyOrganizationPage }) => ({
          email: user.email,
          items: page.items.map(organizationEntry),
          nextCursor: page.nextCursor,
        })),
      ),
    );
  }

  /**
   * Method choose
   *
   * @description
   * Changes the session organization on the gateway before the app opens its workspace.
   *
   * @param {string} organizationId - The organization selected from the caller's choices.
   * @returns {Observable<AuthResult<void>>} The selection result.
   */
  public choose(organizationId: string): Observable<AuthResult<void>> {
    return authResult(
      withSessionLock(() => this.organizations.switchOrganization({ organizationId })).pipe(
        map(() => undefined),
      ),
    );
  }

  /**
   * Method currentOrganization
   *
   * @description
   * Checks the caller's current organization from the session on each workspace entry.
   *
   * @returns {Observable<AuthResult<OrganizationEntry>>} The organization's name and role, or a refusal.
   */
  public currentOrganization(): Observable<AuthResult<OrganizationEntry>> {
    return authResult(
      this.organizations.getCurrentOrganization({ cache: 'no-store' }).pipe(map(organizationEntry)),
    );
  }

  /**
   * Method signOut
   *
   * @description
   * Closes the session at the gateway before returning to sign-in.
   *
   * @returns {Observable<AuthResult<void>>} The session closure result.
   */
  public signOut(): Observable<AuthResult<void>> {
    return authResult(withSessionLock(() => this.auth.signOut({})));
  }
  // #endregion
}
